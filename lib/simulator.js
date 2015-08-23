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
}

util.methods(RulesSuite, {
  run: function() {
    // Run Mocha Test Suite - serialize with any other mocha test suites.
    suite("Firebase Rules Simulator: " + this.suiteName, function() {
      suiteSetup(function() {
        var rulesPath = new Promise(function(resolve) {
          this.rulesPathResolve = resolve;
        }.bind(this));

        var database = new Promise(function(resolve) {
          this.databaseReady = resolve;
        }.bind(this));

        var rulesJSON = bolt.generate(util.getProp(fileIO.readFile(rulesPath),
                                                   'content'));

        this.ready = Promise.all([rulesJSON, database])
          .then(this.onReady.bind(this));

        this.fnSuite(this.getInterface());
      }.bind(this));

      test("Test initialization.", function() {
        return this.ready;
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
  onReady: function(prereq) {
    this.rules = prereq[0];
    return this.rootClient.put(rest.RULES_LOCATION, this.rules);
  },

  test: function(testName, fnTest) {
    new RulesTest(testName, this, fnTest);
  },

  rules: function(rulesPath) {
    this.rulesPathResolve(util.ensureExtension(rulesPath, bolt.FILE_EXTENSION));
  },

  database: function(appName, appSecret) {
    this.rootClient = new rest.Client(appName, appSecret);
    this.databaseReady();
  },
});

function RulesTest(testName, suite, fnTest) {
  this.testName = testName;
  this.suite = suite;
  this.fnTest = fnTest;
  this.status = undefined;
  this.users = {};

  // Only run the test when json and database sandbox ready.
  suite.ready
    .then(function() {
      // Mocha test function
      test(this.testName, this.run.bind(this));
    }.bind(this));
}

util.methods(RulesTest, {
  run: function() {
    var done = new Promise(function(resolve, reject) {
      this.testDone = resolve;
      this.testError = reject;
      this.fnTest(this);
    }.bind(this));
    return done;
  },

  as: function(user) {
    this.users[user] = generateAuthToken(user, this.appSecret);
    return this;
  },

  at: function(opPath) {
    this.path = opPath;
    return this;
  },

  write: function(obj) {
    this.status = true;
    return this;
  },

  read: function() {
    this.status = true;
    return this;
  },

  succeeds: function(message) {
    assert(this.status === true, message + " (should have succeed)");
    this.status = undefined;
    return this;
  },

  fails: function(message) {
    assert(this.status === false, message + " (should have failed)");
    this.status = undefined;
    return this;
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
