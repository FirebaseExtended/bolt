var Promise = require('promise');
var path = require('path');
var uuid = require('node-uuid');
var assert = require('chai').assert;
var FirebaseTokenGenerator = require('firebase-token-generator');

var util = require('./util');
var fileIO = require('./file-io');

var dirname = util.maybePromise(path.dirname);
var join = util.maybePromise(path.join);

var SECRETS_FILE = 'auth-secrets.json';

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

  suite("Firebase Rules Simulator: " + suiteName, function() {
    var rulesJSON = bolt.generate(util.getProp(fileIO.readFile(rulesFile), 'content'));
    var secrets = fileIO.readJSONFile(join(dirname(rulesFile), SECRETS_FILE), promptForSecrets);
    // TODO: Write rules to firebase
    // Create auth tokens.
    var token = util.maybePromise(generateAuthToken)(util.getProp(secrets, 'APP_SECRET'), 'username');
    ready = Promise.all([rulesJSON, secrets, token]);

    test("Test initialization.", function() {
      return ready;
    });

    fnSuite(doTest);

    return ready;
  });
}

function promptForSecrets(secretsPath) {
  return new Promise(function(resolve, reject) {
    var response = {
      FIREBASE_NAMESPACE: "xxx",
      APP_SECRET: "yyy",
    };

    return fileIO.writeJSONFile(secretsPath, response)
      .then(function() {
        return response;
      });
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
    provider: 'bolt-simulator'
  }, opts);

  var tokenGenerator = new FirebaseTokenGenerator(secret);
  return tokenGenerator.createToken(opts);
}
