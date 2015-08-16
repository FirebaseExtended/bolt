var methods = require('./util').methods;
var assert = require('chai').assert;

module.exports = {
  rulesSuite: rulesSuite
};

function rulesSuite(suiteName, fnSuite) {
  var rulesFile;

  var doTest = function(testName, fnTest) {
    var t = new RulesTest(rulesFile);
    fnTest(t);
    console.log(Object.keys(t.users));
    t.run();
    fnTest(t);
  }

  doTest.rules = function(name) {
    rulesFile = name;
  }

  fnSuite(doTest);
}

function RulesTest(rulesFile) {
  if (!rulesFile) {
    assert.fail("Missing definition of rules file to test.");
  }
  this.rulesFile = rulesFile;
  this.prepare = true;
  this.status = undefined;
  this.users = {};
  this.rulesFile = undefined;
}

methods(RulesTest, {
  run: function() {
    this.prepare = false;
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
    if (this.prepare) {
      return this;
    }
    this.status = true;
    return this;
  },

  read: function() {
    if (this.prepare) {
      return this;
    }
    this.status = true;
    return this;
  },

  succeeds: function(message) {
    if (this.prepare) {
      return this;
    }
    assert(this.status === true, message + " (should have succeed)");
    this.status = undefined;
    return this;
  },

  fails: function(message) {
    if (this.prepare) {
      return this;
    }
    assert(this.status === false, message + " (should have failed)");
    this.status = undefined;
    return this;
  }
});
