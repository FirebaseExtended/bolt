var Promise = require('promise');
var path = require('path');
var uuid = require('node-uuid');
var assert = require('chai').assert;
var FirebaseTokenGenerator = require('firebase-token-generator');

var util = require('./util');
var readJSONFile = require('./read-file').readJSONFile;
var readFile = require('./read-file').readFile;

var dirname = util.maybePromise(path.dirname);
var join = util.maybePromise(path.join);

var SECRETS_FILE = 'auth-secrets.json';

module.exports = {
  rulesSuite: rulesSuite
};

function rulesSuite(suiteName, fnSuite) {
  // Browserify bug: https://github.com/substack/node-browserify/issues/1150
  var bolt = (typeof(window) != 'undefined' && window.bolt) || require('./bolt');
  var rulesJSON;
  var secrets;

  var doTest = function(testName, fnTest) {
    var t = new RulesTest(testName, rulesFile, fnTest);
    test(testName, function() {
      t.prepare();
      return t.run();
    });
  };

  var rulesFile = new Promise(function(resolve, reject) {
    doTest.rules = function(rulesFile) {
      resolve(rulesFile);
    };
  });

  rulesJSON = bolt.generate(readFile(rulesFile));
  secrets = readJSONFile(join(dirname(rulesFile), SECRETS_FILE), promptForSecrets);

  suite("Firebase Rules Simulator: " + suiteName, function() {
    fnSuite(doTest);
  });
}

function promptForSecrets() {
  return {
    APP_SECRET: "xxx",
  };
}

function RulesTest(testName, rulesFile, fnTest) {
  if (!rulesFile) {
    assert.fail("Missing definition of rules file to test.");
  }
  this.name = testName;
  this.rulesFile = rulesFile;
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

  at: function(path) {
    this.path = path;
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
    provider: 'bolt-simulator'
  }, opts);

  var tokenGenerator = new FirebaseTokenGenerator(secret);
  return tokenGenerator.createToken(opts);
}
