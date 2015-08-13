/*
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

var bolt = require('../lib/bolt');
var parse = bolt.parse;
var util = require('../lib/util');

var helpers = require('./helpers');
var assert = QUnit.assert;
var test = QUnit.test;
// var skip = QUnit.skip;


var defaultRules = {
  rules: {
    ".read": "true",
    ".write": "true"
  }
};

// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

// Enable error message matchin (not in Qunit)
function assertThrows(fn, match, message) {
  try {
    fn();
  } catch (e) {
    var expected = true;
    if (match) {
      if (util.isType(match, 'regexp')) {
        if (!match.test(e.message)) {
          expected = false;
        }
      } else {
        if (e.message.indexOf(match) == -1) {
          expected = false;
        }
      }
    }
    assert.ok(expected, message || "Assertion was: " + e.message);
    return;
  }
  fail(message || "Expected assertion not thrown.");
}

function fail(msg) {
  assert.ok(false, msg || "Fail.");
}

QUnit.module("Rules Generator Tests", {
  beforeEach: function() {
    QUnit.dump.maxDepth = 20;
  }
});

test("All Access", function() {
  var data = "\
path / {\
read() { return true; }\
write() { return true; }\
}\
";
  var result = parse(data);
  assert.ok(result);
  var gen = new bolt.Generator(result);
  var json = gen.generateRules();
  assert.deepEqual(json, defaultRules);
});

test("Read only", function() {
  var data = "\
path / {\
read() { return true; }\
}\
";
  var result = parse(data);
  assert.ok(result);
  var gen = new bolt.Generator(result);
  var json = gen.generateRules();
  assert.deepEqual(json, {rules: {".read": "true"}});
});

test("Read none", function() {
  var data = "\
path / {\
read() { return false; }\
}\
";
  var result = parse(data);
  assert.ok(result);
  var gen = new bolt.Generator(result);
  var json = gen.generateRules();
  assert.deepEqual(json, {rules: {".read": "false"}});
});

test("Indexed", function() {
  var data = "\
path / {\
index() { return ['a', 'b']; }\
}\
";
  var result = parse(data);
  assert.ok(result);
  var gen = new bolt.Generator(result);
  var json = gen.generateRules();
  assert.deepEqual(json, {rules: {".indexOn": ["a", "b"]}});
});

test("Sample files", function() {
  var files = [
    "all_access",
    "userdoc",
    "mail"
  ];
  var completed = [];
  for (var i = 0; i < files.length; i++) {
    completed.push(testFileSample('samples/' + files[i] + '.sam'));
  }
  return Promise.all(completed);
});

function testFileSample(filename) {
  console.log("Generating from " + filename + "...");
  return helpers.readURL(filename)
    .then(function(response) {
      console.log("Read " + response.url + "...");
      var result = parse(response.content);
      assert.ok(result, response.url);
      var gen = new bolt.Generator(result);
      var json = gen.generateRules();
      assert.ok('rules' in json, response.url + " has rules");
      return helpers.readURL(response.url.replace('.sam', '.json'))
        .then(function(response2) {
          assert.deepEqual(json, JSON.parse(response2.content),
                           "Generated JSON should match " + response2.url);
        });
    })
    .catch(function(error) {
      assert.ok(false, error.message);
    });
}

test("Expression decoding.", function() {
  var tests = [
    [ "true" ],
    [ "false" ],
    [ "1" ],
    [ "1.1" ],
    [ "+3", "3"],
    [ "-3" ],
    [ "0x2", "2" ],
    [ "\"string\"", "'string'" ],
    [ "'string'" ],
    [ "'st\\'ring'"],
    [ "'st\\ring'" ],
    [ "'\\u000d'", "'\\r'" ],
    [ "a" ],
    [ "a.b" ],
    [ "a['b']" ],
    [ "a[b]" ],
    [ "a.b[c]" ],
    [ "(a.b)[c]", "a.b[c]" ],
    [ "a()" ],
    [ "a.b()" ],
    [ "a()()" ],
    [ "a().b" ],
    [ "-a" ],
    [ "--a" ],
    [ "+a", "a"],
    [ "!a" ],
    [ "2 * a" ],
    [ "2 / a" ],
    [ "a % 2" ],
    [ "1 + 1" ],
    [ "a - 1" ],
    [ "a - -b" ],
    [ "a + b + c" ],
    [ "a + b * c" ],
    [ "(a + b) * c" ],
    [ "a < 7" ],
    [ "a > 7" ],
    [ "a <= 7" ],
    [ "a >= 7" ],
    [ "a instanceof Document" ],
    [ "a == 3" ],
    [ "a != 0" ],
    [ "a === 3", "a == 3" ],
    [ "a !== 0", "a != 0" ],
    [ "3 * a == b" ],
    [ "a == 1 && b <= 2" ],
    [ "a == 1 || b <= 2" ],
    [ "a && b && c" ],
    [ "a || b || c" ],
    [ "a && b || c && d" ],
    [ "a ? b : c",  ],
    [ "a || b ? c : d" ],
  ];
  for (var i = 0; i < tests.length; i++) {
    var result = parse('function f() {return ' + tests[i][0] + ';}');
    var ast = result.functions.f.body;
    var decode = bolt.decodeExpression(ast);
    var expected = tests[i][1] || tests[i][0];
    assert.deepEqual(decode, expected, tests[i][0] + " {" + ast.type + "}");
  }
});

test("Partial evaluation", function() {
  var tests = [
    { f: "function f(a) { return true == a; }", x: "f(a == b)", e: "true == (a == b)" },
    { f: "function f(a) { return a == true; }", x: "f(a == b)", e: "a == b == true" },
    { f: "function f(a) { return a + 3; }", x: "f(1 + 2)", e: "1 + 2 + 3" },
    { f: "function f(a) { return a + 3; }", x: "f(1 * 2)", e: "1 * 2 + 3" },
    { f: "function f(a) { return a * 3; }", x: "f(1 + 2)", e: "(1 + 2) * 3" },
    { f: "function f(a) { return a + 1; }", x: "f(a + a)", e: "a + a + 1" },
    { f: "function f(a) { return g(a); } function g(a) { return a == true; }",
      x: "f(123)", e: "123 == true" },
    { f: "function f(a, b) { return g(a) == g(b); } function g(a) { return a == true; }",
      x: "f(1, 2)", e: "1 == true == (2 == true)" },
    // Highler level function works as long as returns a constant function
    { f: "function f() { return g; } function g(a) { return a == true; }",
      x: "f()(123)", e: "123 == true" },
    // Undefined function - should just leave function defintion.
    { f: "function f(a) { return a + 1; }", x: "g(1, 2)", e: "g(1, 2)" },
    { f: "function f(a) { return a + 1; }", x: "a[f(123)]", e: "a[123 + 1]" },
    { f: "", x: "this", e: "newData.val() == true" },
    { f: "", x: "this.foo", e: "newData.child('foo').val() == true" },
    { f: "",
      x: "this.foo || this.bar",
      e: "newData.child('foo').val() == true || newData.child('bar').val() == true"},
    // Don't use child on built-in method names.
    { f: "", x: "this.isString", e: "newData.isString" },
    { f: "function f(a) { return a == '123'; }", x: "f(this)", e: "newData.val() == '123'" },
    { f: "function f(a) { return a == '123'; }",
      x: "f(this.foo)", e: "newData.child('foo').val() == '123'" },
  ];
  for (var i = 0; i < tests.length; i++) {
    var symbols = parse(tests[i].f + " path /x { read() { return " + tests[i].x + "; }}");
    var gen = new bolt.Generator(symbols);
    var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
    assert.equal(decode, tests[i].e, tests[i].e);
  }
});

test("Function expansion errors", function() {
  var tests = [
    { p: "a", f: "f(a)", x: "f(1)" },
  ];
  function getExpressionText(gen, exp) {
    gen.getExpressionText(exp);
  }
  for (var i = 0; i < tests.length; i++) {
    var symbols = parse("\
function f(" + tests[i].p + ") { return " + tests[i].f + "; }\
path /x { read() { return " + tests[i].x + "; }}\
");
    var gen = new bolt.Generator(symbols);
    assertThrows(getExpressionText.bind(undefined, gen, symbols.paths['/x'].methods.read.body),
                 "Recursive");
  }
});

test("Builtin validation functions", function() {
  var symbols = parse("");
  var gen = new bolt.Generator(symbols);
  var baseTypes = ['string', 'number', 'boolean'];
  assert.equal(gen.getExpressionText(symbols.functions['@validator@object'].body),
               'newData.hasChildren()', 'object');
  assert.equal(gen.getExpressionText(symbols.functions['@validator@null'].body),
               'newData.val() == null', 'object');
  for (var i = 0; i < baseTypes.length; i++) {
    var type = baseTypes[i];
    assert.equal(gen.getExpressionText(symbols.functions['@validator@' + type].body),
                 'newData.is' + type.toUpperCase()[0] + type.slice(1) + '()', type);
  }
});

test("Schema Validation", function() {
  var tests = [
    { s: "type Simple {}", v: "this instanceof Simple",
      x: "newData.hasChildren()" },
    { s: "type Simple extends string {}", v: "this instanceof Simple", x: "newData.isString()" },
    { s: "type Simple {n: number}", v: "this instanceof Simple",
      x: "newData.child('n').isNumber()" },
    { s: "type Simple {s: string}", v: "this instanceof Simple",
      x: "newData.child('s').isString()" },
    { s: "type Simple {b: boolean}", v: "this instanceof Simple",
      x: "newData.child('b').isBoolean()" },
    { s: "type Simple {x: object}", v: "this instanceof Simple",
      x: "newData.child('x').hasChildren()" },
    { s: "type Simple {x: number|string}", v: "this instanceof Simple",
      x: "newData.child('x').isNumber() || newData.child('x').isString()" },
    { s: "type Simple {a: number, b: string}", v: "this instanceof Simple",
      x: "newData.child('a').isNumber() && newData.child('b').isString()" },
    { s: "type Simple {x: number|null}", v: "this instanceof Simple",
      x: "newData.child('x').isNumber() || newData.child('x').val() == null" },
    { s: "type Simple {n: number, validate() {return this.n < 7;}}", v: "this instanceof Simple",
      x: "newData.child('n').isNumber() && newData.child('n').val() < 7" },
  ];
  for (var i = 0; i < tests.length; i++) {
    var symbols = parse(tests[i].s + " path /x { validate() { return " + tests[i].v + "; }}");
    var gen = new bolt.Generator(symbols);
    var decode = gen.getExpressionText(symbols.paths['/x'].methods.validate.body);
    assert.equal(decode, tests[i].x, tests[i].x);
  }
});

test("Schema Generation Errors", function() {
  var tests = [
    { s: "",
      e: "at least one path" },
    { s: "type Simple extends string {a: string} path /x {} ",
      e: /properties.*extend/ },
    { s: "path /y { index() { return 1; }}",
      e: /index.*string/i },
  ];

  function generateRules(symbols) {
    var gen = new bolt.Generator(symbols);
    gen.generateRules();
  }

  for (var i = 0; i < tests.length; i++) {
    var symbols = parse(tests[i].s);
    assertThrows(generateRules.bind(undefined, symbols),
                 tests[i].e);
  }
});
