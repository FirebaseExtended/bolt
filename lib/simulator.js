var methods = require('./util').methods;
var assert = require('chai').assert;

module.exports = {
  rulesSuite: rulesSuite
};

function rulesSuite(suiteName, fnSuite) {
  var rulesFile;

  var doTest = function(testName, fnTest) {
    var t = new RulesTest(testName, rulesFile, fnTest);
    test(testName, function() {
      t.prepare();
      t.run();
    });
  };

  doTest.rules = function(name) {
    rulesFile = name;
  };

  suite("Firebase Rules Simulator: " + suiteName, function() {
    fnSuite(doTest);
  });
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

methods(RulesTest, {
  prepare: function() {
    this.prepare_ = true;
    this.fnTest(this);
  },

  run: function() {
    this.prepare_ = false;
    this.fnTest(this);
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
