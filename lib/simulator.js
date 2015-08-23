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
"use strict";

var Promise = require('promise');
var uuid = require('node-uuid');
var assert = require('chai').assert;
var rest = require('./firebase-rest');
var FirebaseTokenGenerator = require('firebase-token-generator');

// Browserify bug: https://github.com/substack/node-browserify/issues/1150
var bolt = (typeof window != 'undefined' && window.bolt) || require('./bolt');

var util = require('./util');
var fileIO = require('./file-io');

module.exports = {
  rulesSuite: rulesSuite
};

function rulesSuite(suiteName, fnSuite) {
  new RulesSuite(suiteName, fnSuite).run();
}

function RulesSuite(suiteName, fnSuite) {
  this.suiteName = suiteName;
  this.fnSuite = fnSuite;
  this.users = {};
  this.tests = [];
}

util.methods(RulesSuite, {
  run: function() {
    // Run Mocha Test Suite - serialize with any other mocha test suites.
    suite("Firebase Rules Simulator: " + this.suiteName, function() {
      console.log("Suite");
      suiteSetup(function() {
        console.log("setupSuite");
        var rulesPath = new Promise(function(resolve) {
          this.rulesPathResolve = resolve;
        }.bind(this));

        var database = new Promise(function(resolve) {
          this.databaseReady = resolve;
        }.bind(this));

        var rulesJSON = bolt.generate(util.getProp(fileIO.readFile(rulesPath),
                                                   'content'));

        this.ready = Promise.all([rulesJSON, database])
          .then(this.onRulesReady.bind(this));

        // Execute initialization and get test definitions (in client code).
        this.fnSuite(this.getInterface());

        return this.ready;
      }.bind(this));

      test("Initialization.", function() {
      });

      test("Rules test.", function() {
        this.runTests();
      }.bind(this));
    }.bind(this));
  },

  // Interface for test functions:
  //   test.rules(rulesPath)
  //   test.database(appName, appSecret)
  //   test(testName, testFunction)
  getInterface: function() {
    var test = this.test.bind(this);
    test.rules = this.rules.bind(this);
    test.database = this.database.bind(this);
    return test;
  },

  // Called when rules are generated and test database is known.
  // Arg: [rulesJSON, true]
  onRulesReady: function(prereq) {
    this.rules = prereq[0];
    return this.adminClient.put(rest.RULES_LOCATION, this.rules)
      .then(function() {
        console.log("READY!");
      });
  },

  runTests: function() {
    for (var i = 0; i < this.tests.length; i++) {
      this.tests[i].run();
    }
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

  database: function(appName, appSecret) {
    if (this.adminClient) {
      throw new Error("Only expect a single call to the test.database function.");
    }
    this.appSecret = appSecret;
    this.adminClient = new rest.Client(appName, appSecret);
    this.databaseReady();
  },

  ensureUser: function(username) {
    if (!(username in this.users)) {
      var opt = { username: username };
      if (username == 'admin') {
        opt.admin = true;
      }
      this.users[username] = generateAuthToken(opt, this.appSecret);
      console.log(username + ": " + this.users[username]);
    }
  },
});

function RulesTest(testName, suite, fnTest) {
  this.testName = testName;
  this.suite = suite;
  this.fnTest = fnTest;
  this.status = undefined;
  this.steps = [];
  this.failed = false;

  // Current user and path (for read/write).
  this.path = undefined;
  this.auth = undefined;
}

util.methods(RulesTest, {
  run: function() {
    console.log("Running: " + this.testName);
    this.fnTest(this);
  },

  // Queue a function to be called in sequence after previous step
  // in test is (successfully) completed.
  queue: function(op, args, fn) {
    if (this.failed) {
      return;
    }
    args = util.copyArray(args).map(function(x) {
      return JSON.stringify(x, undefined, 2);
    });
    var label = op + '(' + args.join(', ') + ')';
    console.log("Queuing: " + label);
    this.steps.push({label: label, fn: fn});
  },

  as: function(username) {
    var token = this.suite.ensureUser(username);
    this.queue('as', arguments, function() {
      this.auth = token;
    }.bind(this));
    return this;
  },

  at: function(opPath) {
    this.queue('at', arguments, function() {
      this.path = opPath;
    }.bind(this));
    return this;
  },

  write: function(obj) {
    this.queue('write', arguments, function() {
      this.status = true;
    }.bind(this));
    return this;
  },

  read: function() {
    this.queue('read', arguments, function() {
      this.status = true;
    }.bind(this));
    return this;
  },

  succeeds: function(message) {
    this.queue('succeeds', arguments, function() {
      assert(this.status === true, message + " (should have succeed)");
      this.good(message);
      this.status = undefined;
    }.bind(this));
    return this;
  },

  fails: function(message) {
    this.queue('fails', arguments, function() {
      assert(this.status === false, message + " (should have failed)");
      this.good(message);
      this.status = undefined;
    }.bind(this));
    return this;
  },

  good: function(message) {
    this.log(message + " (Good)");
  },

  log: function(message) {
    console.log(this.suite.suiteName + ": " + message);
  }
});

function generateAuthToken(opts, secret) {
  if (typeof opts == 'string') {
    opts = {
      username: opts
    };
  }

  opts = util.extend({
    uid: uuid.v4(),
    provider: 'bolt-simulator',
    debug: true
  }, opts);

  var tokenGenerator = new FirebaseTokenGenerator(secret);
  return tokenGenerator.createToken(opts);
}
