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
var FirebaseTokenGenerator = require('firebase-token-generator');

var util = require('./util');
var fileIO = require('./file-io');

module.exports = {
  rulesSuite: rulesSuite
};

function rulesSuite(suiteName, fnSuite) {
  // Browserify bug: https://github.com/substack/node-browserify/issues/1150
  var bolt = (typeof window != 'undefined' && window.bolt) || require('./bolt');
  var ready;

  var doTest = function(testName, fnTest) {
    var t = new RulesTest(testName, fnTest);
    ready
      .then(function() {
        test(testName, function() {
          t.prepare();
          return t.run();
        });
      });
  };

  var rulesFile = new Promise(function(resolve, reject) {
    doTest.rules = function(rulesFilePath) {
      rulesFilePath = util.ensureExtension(rulesFilePath, bolt.FILE_EXTENSION);
      resolve(rulesFilePath);
    };
  });

  var secrets = new Promise(function(resolve, reject) {
    doTest.useDatabase = function(appName, appSecret) {
      resolve({appName: appName, appSecret: appSecret});
    };
  });

  suite("Firebase Rules Simulator: " + suiteName, function() {
    var rulesJSON = bolt.generate(util.getProp(fileIO.readFile(rulesFile), 'content'));
    // TODO: Write rules to firebase
    var token = util.maybePromise(generateAuthToken)(util.getProp(secrets, 'appSecret'),
                                                     'username');
    ready = Promise.all([rulesJSON, secrets, token]);

    test("Test initialization.", function() {
      return ready;
    });

    fnSuite(doTest);

    return ready;
  });
}

function RulesTest(testName, fnTest) {
  this.name = testName;
  this.fnTest = fnTest;
  this.status = undefined;
  this.users = {};
  this.rulesFile = undefined;
}

util.methods(RulesTest, {
  prepare: function() {
    this.prepare_ = true;
    this.fnTest(this);
  },

  run: function() {
    this.prepare_ = false;
    this.fnTest(this);
    return Promise.resolve(true);
  },

  as: function(user) {
    this.user = user;
    this.users[user] = true;
    return this;
  },

  at: function(opPath) {
    this.path = opPath;
    return this;
  },

  write: function(obj) {
    if (this.prepare_) {
      return this;
    }
    this.status = true;
    return this;
  },

  read: function() {
    if (this.prepare_) {
      return this;
    }
    this.status = true;
    return this;
  },

  succeeds: function(message) {
    if (this.prepare_) {
      return this;
    }
    assert(this.status === true, message + " (should have succeed)");
    this.status = undefined;
    return this;
  },

  fails: function(message) {
    if (this.prepare_) {
      return this;
    }
    assert(this.status === false, message + " (should have failed)");
    this.status = undefined;
    return this;
  }
});

function generateAuthToken(secret, opts) {
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
