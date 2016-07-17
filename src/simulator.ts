/*
 * Firebase Rules test simulator.
 *
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/// <reference path="typings/node.d.ts" />
/// <reference path="typings/chai.d.ts" />
/// <reference path="typings/mocha.d.ts" />
/// <reference path="typings/es6-promise.d.ts" />

import Promise = require('promise');
import chai = require('chai');
var assert = chai.assert;
import rest = require('./firebase-rest');
import util = require('./util');
import fileIO = require('./file-io');

// Browserify bug: https://github.com/substack/node-browserify/issues/1150
interface Window { bolt: any; }
declare var window: Window;
var bolt = (typeof window !== 'undefined' && window.bolt) || require('./bolt');
var secrets = require('../auth-secrets.json');
var MAX_TEST_MS = 60000;

export function rulesSuite(suiteName, fnSuite) {
  new RulesSuite(suiteName, fnSuite).run();
}

function RulesSuite(suiteName, fnSuite) {
  this.suiteName = suiteName;
  this.fnSuite = fnSuite;
  this.users = {};
  this.tests = [];
  this.debug = false;
}

util.methods(RulesSuite, {
  setDebug: function(debug) {
    if (debug === undefined) {
      debug = false;
    }
    this.debug = debug;
    return this;
  },

  run: function() {
    var self = this;

    // Run Mocha Test Suite - serialize with any other mocha test suites.
    suite("Firebase Rules Simulator: " + self.suiteName, function() {
      this.timeout(MAX_TEST_MS);
      suiteSetup(function() {
        var rulesPath = new Promise(function(resolve) {
          self.rulesPathResolve = resolve;
        });

        var database = new Promise(function(resolve) {
          self.databaseReady = resolve;
        });

        var rulesJSON = bolt.generate(util.getProp(fileIO.readFile(rulesPath), 'content'));

        // JT - TODO: Not sure why I needed to disable this.
        self.ready = Promise.all([rulesJSON, database]).then(self.onRulesReady.bind(self));

        // Execute initialization and get test definitions (in client code).
        self.fnSuite(self.getInterface());

        return self.ready;
      });

      test("Initialization.", function() {
        // pass
      });

      test("Rules test.", function() {
        return self.runTests();
      });
    });
  },

  // Interface for test functions:
  //   test.rules(rulesPath)
  //   test.database(appName, appSecret)
  //   test.uid(username)
  //   test(testName, testFunction)
  //   test.TIMESTAMP
  getInterface: function() {
    var test = this.test.bind(this);
    test.rules = this.rules.bind(this);
    test.database = this.database.bind(this);
    test.uid = this.uid.bind(this);
    test.TIMESTAMP = rest.TIMESTAMP;
    return test;
  },

  // Called when rules are generated and test database is known.
  // Arg: [rulesJSON, true]
  onRulesReady: function(prereq) {
    this.rules = prereq[0];
    return this.adminClient.put(rest.RULES_LOCATION, this.rules);
  },

  runTests: function() {
    var p = Promise.resolve(true);

    function next(prev, test) {
      return prev.then(function() {
        return test.run();
      });
    }

    for (var i = 0; i < this.tests.length; i++) {
      p = next(p, this.tests[i]);
    }

    return p;
  },

  test: function(testName, fnTest) {
    this.tests.push(new RulesTest(testName, this, fnTest));
  },

  rules: function(rulesPath) {
    if (this.rulesPath) {
      throw new Error("Only expect a single call to the test.rules function.");
    }
    this.rulesPath = rulesPath;
    this.rulesPathResolve(util.ensureExtension(rulesPath, bolt.FILE_EXTENSION));
  },

  database: function(appSecret) {
    if (this.adminClient) {
      throw new Error("Only expect a single call to the test.database function.");
    }
    this.appSecret = appSecret;
    this.adminClient = new rest.Client(secrets.appName,secrets.secret); // using classic rest interface still
    this.databaseReady();
  },

  uid: function(username) {
    return this.users[username].uid;
  },

  ensureUser: function(username) {
    if (!(username in this.users)) {
        var clientInfo
        if(username === 'admin'){
            clientInfo = new rest.Client(secrets.appName, secrets.secret);
        } else {
          clientInfo = rest.createFirebaseDbRefForUser(username);
        }
        this.users[username] = clientInfo;
    }
    return this.users[username];
  }
});

function RulesTest(testName, suite, fnTest) {
  this.testName = testName;
  this.suite = suite;
  this.fnTest = fnTest;
  this.status = undefined;
  this.lastError = undefined;
  this.steps = [];
  this.failed = false;

  // Current user and path (for read/write).
  this.path = undefined;
  this.auth = undefined;
}

util.methods(RulesTest, {
  run: function() {
    this.debug(true);
    // JT: This is not working properly below
    this.as('admin');
    this.at('/');
    this.write(null); // Clear out any existing data
    this.succeeds("initialization");
    this.at(undefined);
    this.as('anon');
    this.fnTest(this);
    this.debug(false);

    return this.executeQueue()
      .then(() => {
        this.log("Finished");
      })
      .catch((error) => {
        this.log("Failed: " + error);
        throw error;
      });
  },

  // Queue a function to be called in sequence after previous step
  // in test is (successfully) completed.
  queue: function(op, args, fn) {
    if (this.failed) {
      return;
    }
    args = util.copyArray(args).map(function(x) {
      return util.prettyJSON(x);
    });
    var label = op + '(' + args.join(', ') + ')';
    this.steps.push({label: label, fn: fn});
  },

  executeQueue: function() {
    var self = this;

    this.log("Executing (" + this.steps.length + " steps)");
    var p = Promise.resolve(true);

    function next(prev, step) {
      return prev.then(function() {
        console.log(step.label);
        self.log(step.label);
        return step.fn();
      });
    }

    for (var i = 0; i < this.steps.length; i++) {
      p = next(p, this.steps[i]);
    }

    return p;
  },

  debug: function(debug) {
    this.suite.setDebug(debug);
    this.queue('debug', arguments, () => {
      this.suite.setDebug(debug);
    });
    return this;
  },

  as: function(username) {
    var client = this.suite.ensureUser(username);
    console.log('##### Ensure User:' + username);
    this.queue('as', arguments, () => {
      this.client = client;
      this.username = username;
    });
    return this;
  },

  at: function(opPath) {
    this.queue('at', arguments, () => {
      this.path = opPath;
    });
    return this;
  },

  // TODO: Cleanup. There's got to be a better admin UI for doing this
  write: function(obj) {
    this.queue('write', arguments, () => {
      var tmp;
      if(this.username === 'admin'){
        console.log(this);
        tmp = this.client.put(this.path, obj)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
      } else{
       tmp = this.client.database().ref(this.path).set(obj)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
      }
        return tmp;
    });

    return this;
  },

  push: function(obj) {
    this.queue('write', arguments, () => {
      return this.client.database().ref(this.path).push(obj)
       .then(() => {
         this.status = true;
       })
       .catch((error) => {
         this.status = false;
         this.lastError = error;
       });
    });
    return this;
  },

  read: function() {
    this.queue('read', arguments, () => {
      return this.client.get(this.path)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
    });
    return this;
  },

  succeeds: function(message) {
    this.queue('succeeds', arguments, () => {
      assert(this.status === true,
             this.messageFormat(message + " (should have succeed)\n" + this.lastError));
      this.good(message);
      this.status = undefined;
    });
    return this;
  },

  fails: function(message) {
    this.queue('fails', arguments, () => {
      assert(this.status === false,
             this.messageFormat(message + " (should have failed)"));
      this.good(message);
      this.status = undefined;
    });
    return this;
  },

  good: function(message) {
    this.log(message + " (Correct)");
  },

  log: function(message) {
    if (this.suite.debug) {
      console.log(this.messageFormat(message));
    }
  },

  messageFormat: function(message) {
    return this.suite.suiteName + "." + this.testName + " " + message;
  }
});
