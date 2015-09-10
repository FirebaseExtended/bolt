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

var bolt = (typeof(window) != 'undefined' && window.bolt) || require('../lib/bolt');
var parse = bolt.parse;
var fileio = require('../lib/file-io');
var util = require('../lib/util');

var assert = require('chai').assert;


// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

/*
 * Run data drive test with tests is one of these formats:
 * [ { data: <input>, expect: <expected output> }, ... ]
 * [ [ <input>, <expected output> ], ... ]
 *
 * Calls testIt(data, expect) for each test.
 */
function dataDrivenTest(tests, testIt) {
  for (var i = 0; i < tests.length; i++) {
    var data = tests[i].data || tests[i][0] || tests[i];
    var expect = tests[i].expect || tests[i][1];
    var label = tests[i].label || JSON.stringify(data) + " => " + JSON.stringify(expect);
    test(label, testIt.bind(undefined, data, expect));
  }
}

suite("Rules Generator Tests", function() {
  suite("Basic Samples", function() {
    var tests = [
      { data: "path / {read() { return true; } write() { return true; }}",
        expect: { rules: {".read": "true", ".write": "true"} }
      },
      { data: "path / {read() { return true; }}",
        expect: { rules: {".read": "true"} }
      },
      { data: "path / { read() { return false; }}",
        expect: { rules: {} }
      },
      { data: "path / {index() { return ['a', 'b']; }}",
        expect: { rules: {".indexOn": ["a", "b"]} }
      },
      { data: "path / { validate() { return this > 0; }}",
        expect: { rules: { ".validate": "newData.val() > 0" } }
      },
    ];

    dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.ok(result);
      var gen = new bolt.Generator(result);
      var json = gen.generateRules();
      assert.deepEqual(json, expect);
    });
  });

  suite("Sample files", function() {
    var files = ["all_access", "userdoc", "mail", "type-extension"];
    for (var i = 0; i < files.length; i++) {
      test(files[i],
           testFileSample.bind(undefined,
                               'test/samples/' + files[i] + '.' + bolt.FILE_EXTENSION));
    }
  });

  function testFileSample(filename) {
    return fileio.readFile(filename)
      .then(function(response) {
        var result = parse(response.content);
        assert.ok(result, response.url);
        var gen = new bolt.Generator(result);
        var json = gen.generateRules();
        assert.ok('rules' in json, response.url + " has rules");
        return fileio.readJSONFile(response.url.replace('.' + bolt.FILE_EXTENSION, '.json'))
          .then(function(response2) {
            assert.deepEqual(json, response2);
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

  suite("Partial evaluation", function() {
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
      { f: "function f(a) { return a + 1; }", x: "a[f(123)]", e: "a[123 + 1]" },
      { f: "", x: "this", e: "newData.val() == true" },
      { f: "", x: "!this", e: "!(newData.val() == true)" },
      { f: "", x: "this.prop", e: "newData.child('prop').val() == true" },
      { f: "", x: "!this.prop", e: "!(newData.child('prop').val() == true)" },
      { f: "", x: "this.foo.parent()", e: "newData.child('foo').parent().val() == true" },
      { f: "",
        x: "this.foo || this.bar",
        e: "newData.child('foo').val() == true || newData.child('bar').val() == true"},
      // Don't support snapshot functions beyond parent.
      // TODO: Should warn user not to use Firebase builtins!
      { f: "", x: "this.isString == 'a'", e: "newData.child('isString').val() == 'a'" },
      { f: "function f(a) { return a == '123'; }", x: "f(this)", e: "newData.val() == '123'" },
      { f: "function f(a) { return a == '123'; }",
        x: "f(this.foo)", e: "newData.child('foo').val() == '123'" },
    ];

    function testIt(t) {
      var symbols = parse(t.f + " path /x { read() { return " + t.x + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      gen.generateRules();
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      assert.equal(decode, t.e);
    }

    for (var i = 0; i < tests.length; i++) {
      test(tests[i].x + " => " + tests[i].e, testIt.bind(undefined, tests[i]));
    }
  });

  suite("String methods", function() {
    var tests = [
      { data: "this.length",
        expect: "newData.val().length" },
      { data: "this.length < 100",
        expect: "newData.val().length < 100" },
      { data: "'abc'.length",
        expect: "'abc'.length" },
      { data: "'abc'.includes('b')",
        expect: "'abc'.contains('b')" },
      { data: "this.includes('b')",
        expect: "newData.val().contains('b')" },
      { data: "'abc'.includes(this)",
        expect: "'abc'.contains(newData.val())" },
      { data: "'abc'.startsWith(this)",
        expect: "'abc'.beginsWith(newData.val())" },
      { data: "'abc'.endsWith(this)",
        expect: "'abc'.endsWith(newData.val())" },
      { data: "'abc'.replace(this.a, this.b)",
        expect: "'abc'.replace(newData.child('a').val(), newData.child('b').val())" },
      { data: "'ABC'.toLowerCase()",
        expect: "'ABC'.toLowerCase()" },
      { data: "'abc'.toUpperCase()",
        expect: "'abc'.toUpperCase()" },
      { data: "this.toUpperCase()",
        expect: "newData.val().toUpperCase()" },
      { data: "'ababa'.test('/bab/')",
        expect: "'ababa'.matches(/bab/)" },
    ];

    dataDrivenTest(tests, function testIt(data, expect) {
      var symbols = parse("path /x { read() { return " + data + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      gen.generateRules();
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      assert.equal(decode, expect);
    });
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
      assert.throws(getExpressionText.bind(undefined, gen, symbols.paths['/x'].methods.read.body),
                    Error,
                    "Recursive");
    }
  });

  test("Builtin validation functions", function() {
    var symbols = parse("path / {}");
    var gen = new bolt.Generator(symbols);
    gen.generateRules();
    var baseTypes = ['String', 'Number', 'Boolean'];
    assert.equal(gen.getExpressionText(symbols.functions['@validator@Object'].body),
                 'newData.hasChildren()', 'Object');
    assert.equal(gen.getExpressionText(symbols.functions['@validator@Null'].body),
                 'newData.val() == null', 'Null');
    assert.equal(gen.getExpressionText(symbols.functions['@validator@Any'].body),
                 'true', 'Any');
    for (var i = 0; i < baseTypes.length; i++) {
      var type = baseTypes[i];
      assert.equal(gen.getExpressionText(symbols.functions['@validator@' + type].body),
                   'newData.is' + type.toUpperCase()[0] + type.slice(1) + '()', type);
    }
  });

  suite("Schema Validation", function() {
    var tests = [
      { s: "type Simple {}",
        x: undefined },
      { s: "type Simple extends Object {}",
        x: "newData.hasChildren()" },
      { s: "type Simple extends String {}",
        x: "newData.isString()" },
      { s: "type Simple extends String { validate() { return this.length > 0; } }",
        x: "newData.isString() && newData.val().length > 0" },
      { s: "type NonEmpty extends String { validate() { return this.length > 0; } } \
            type Simple { prop: NonEmpty }",
        x: "newData.child('prop').isString() && newData.child('prop').val().length > 0" },
      { s: "type Simple {n: Number}",
        x: "newData.child('n').isNumber()" },
      { s: "type Simple {s: String}",
        x: "newData.child('s').isString()" },
      { s: "type Simple {b: Boolean}",
        x: "newData.child('b').isBoolean()" },
      { s: "type Simple {x: Object}",
        x: "newData.child('x').hasChildren()" },
      { s: "type Simple {x: Number|String}",
        x: "newData.child('x').isNumber() || newData.child('x').isString()" },
      { s: "type Simple {a: Number, b: String}",
        x: "newData.child('a').isNumber() && newData.child('b').isString()" },
      { s: "type Simple {x: Number|Null}",
        x: "newData.child('x').isNumber() || newData.child('x').val() == null" },
      { s: "type Simple {n: Number, validate() {return this.n < 7;}}",
        x: "newData.child('n').isNumber() && newData.child('n').val() < 7" },
    ];

    function testIt(t) {
      var symbols = parse(t.s + " path /x is Simple {}");
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      if (t.x === undefined) {
        assert.deepEqual(rules, {"rules": {"x": {} }});
      } else {
        assert.deepEqual(rules, {"rules": {"x": {".validate": t.x}}});
      }
    }

    for (var i = 0; i < tests.length; i++) {
      test(tests[i].s + " => " + tests[i].x, testIt.bind(undefined, tests[i]));
    }
  });

  suite("Schema Generation Errors", function() {
    var tests = [
      { s: "",
        e: /at least one path/ },
      { s: "type Simple extends String {a: String} path /x {} ",
        e: /properties.*extend/ },
      { s: "path /y { index() { return 1; }}",
        e: /index.*string/i },
      { s: "path /x { write() { return undefinedFunc(); }}",
        e: /undefined.*function/i },
      { s: "path /x is NoSuchType {}",
        e: /type definition.*NoSuchType/ },
      { s: "path /x { unsupported() { return true; } }",
        w: /unsupported method/i },
      { s: "path /x { validate() { return this.test(123); } }",
        e: /convert value/i },
      { s: "path /x { validate() { return this.test('a/'); } }",
        e: /convert value/i },
    ];

    function testIt(t) {
      var symbols = parse(t.s);
      var gen = new bolt.Generator(symbols);
      var lastError;
      gen.setLoggers({
        error: function(s) {
          lastError = s;
        },
        warn: function(s) {
          lastError = s;
        },
      });

      try {
        gen.generateRules();
      } catch (e) {
        if (!t.e) {
          throw e;
        }
        lastError = lastError || e.message;
        assert.match(lastError, t.e);
        return;
      }
      if (t.e) {
        assert.fail(undefined, undefined, "No exception thrown.");
      }
      if (t.w) {
        assert.match(lastError, t.w);
      }
    }

    for (var i = 0; i < tests.length; i++) {
      test(util.quoteString(tests[i].s), testIt.bind(undefined, tests[i]));
    }
  });
});
