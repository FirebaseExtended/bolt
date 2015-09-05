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

var bolt = (typeof(window) != 'undefined' && window.bolt) || require('bolt');
var parse = bolt.parse;
var fileio = require('file-io');
var helper = require('./test-helper');

var assert = require('chai').assert;

// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

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

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.ok(result);
      var gen = new bolt.Generator(result);
      var json = gen.generateRules();
      assert.deepEqual(json, expect);
    });
  });

  suite("Sample files", function() {
    var files = ["all_access", "userdoc", "mail", "type-extension"];

    helper.dataDrivenTest(files, function(filename) {
      filename = 'test/samples/' + filename + '.' + bolt.FILE_EXTENSION;
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
    });
  });

  suite("Expression decoding.", function() {
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

    helper.dataDrivenTest(tests, function(data, expect) {
      // Decode to self by default
      expect = expect || data;
      var result = parse('function f() {return ' + data + ';}');
      var exp = result.functions.f.body;
      var decode = bolt.decodeExpression(exp);
      assert.equal(decode, expect);
    });
  });

  suite("Partial evaluation", function() {
    var tests = [
      { f: "function f(a) { return true == a; }", x: "f(a == b)", expect: "true == (a == b)" },
      { f: "function f(a) { return a == true; }", x: "f(a == b)", expect: "a == b == true" },
      { f: "function f(a) { return a + 3; }", x: "f(1 + 2)", expect: "1 + 2 + 3" },
      { f: "function f(a) { return a + 3; }", x: "f(1 * 2)", expect: "1 * 2 + 3" },
      { f: "function f(a) { return a * 3; }", x: "f(1 + 2)", expect: "(1 + 2) * 3" },
      { f: "function f(a) { return a + 1; }", x: "f(a + a)", expect: "a + a + 1" },
      { f: "function f(a) { return g(a); } function g(a) { return a == true; }",
        x: "f(123)", expect: "123 == true" },
      { f: "function f(a, b) { return g(a) == g(b); } function g(a) { return a == true; }",
        x: "f(1, 2)", expect: "1 == true == (2 == true)" },
      // Highler level function works as long as returns a constant function
      { f: "function f() { return g; } function g(a) { return a == true; }",
        x: "f()(123)", expect: "123 == true" },
      { f: "function f(a) { return a + 1; }", x: "a[f(123)]", expect: "a[123 + 1]" },
      { f: "", x: "this", expect: "newData.val() == true" },
      { f: "", x: "!this", expect: "!(newData.val() == true)" },
      { f: "", x: "this.prop", expect: "newData.child('prop').val() == true" },
      { f: "", x: "!this.prop", expect: "!(newData.child('prop').val() == true)" },
      { f: "", x: "this.foo.parent()", expect: "newData.child('foo').parent().val() == true" },
      { f: "",
        x: "this.foo || this.bar",
        expect: "newData.child('foo').val() == true || newData.child('bar').val() == true"},
      // Don't support snapshot functions beyond parent.
      // TODO: Should warn user not to use Firebase builtins!
      { f: "", x: "this.isString == 'a'", expect: "newData.child('isString').val() == 'a'" },
      { f: "function f(a) { return a == '123'; }", x: "f(this)", expect: "newData.val() == '123'" },
      { f: "function f(a) { return a == '123'; }",
        x: "f(this.foo)", expect: "newData.child('foo').val() == '123'" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse(data.f + " path /x { read() { return " + data.x + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      gen.generateRules();
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      assert.equal(decode, expect);
    });
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

    helper.dataDrivenTest(tests, function testIt(data, expect) {
      var symbols = parse("path /x { read() { return " + data + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      gen.generateRules();
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      assert.equal(decode, expect);
    });
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
      { data: "type Simple {}",
        expect: undefined },
      { data: "type Simple extends Object {}",
        expect: "newData.hasChildren()" },
      { data: "type Simple extends String {}",
        expect: "newData.isString()" },
      { data: "type Simple extends String { validate() { return this.length > 0; } }",
        expect: "newData.isString() && newData.val().length > 0" },
      { data: "type NonEmpty extends String { validate() { return this.length > 0; } } \
            type Simple { prop: NonEmpty }",
        expect: "newData.child('prop').isString() && newData.child('prop').val().length > 0" },
      { data: "type Simple {n: Number}",
        expect: "newData.child('n').isNumber()" },
      { data: "type Simple {s: String}",
        expect: "newData.child('s').isString()" },
      { data: "type Simple {b: Boolean}",
        expect: "newData.child('b').isBoolean()" },
      { data: "type Simple {x: Object}",
        expect: "newData.child('x').hasChildren()" },
      { data: "type Simple {x: Number|String}",
        expect: "newData.child('x').isNumber() || newData.child('x').isString()" },
      { data: "type Simple {a: Number, b: String}",
        expect: "newData.child('a').isNumber() && newData.child('b').isString()" },
      { data: "type Simple {x: Number|Null}",
        expect: "newData.child('x').isNumber() || newData.child('x').val() == null" },
      { data: "type Simple {n: Number, validate() {return this.n < 7;}}",
        expect: "newData.child('n').isNumber() && newData.child('n').val() < 7" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse(data + " path /x is Simple {}");
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      if (expect === undefined) {
        assert.deepEqual(rules, {"rules": {"x": {} }});
      } else {
        assert.deepEqual(rules, {"rules": {"x": {".validate": expect}}});
      }
    });
  });

  suite("Schema Generation Errors", function() {
    var tests = [
      { data: "",
        expect: /at least one path/ },
      { data: "type Simple extends String {a: String} path /x {} ",
        expect: /properties.*extend/ },
      { data: "path /y { index() { return 1; }}",
        expect: /index.*string/i },
      { data: "path /x { write() { return undefinedFunc(); }}",
        expect: /undefined.*function/i },
      { data: "path /x is NoSuchType {}",
        expect: /type definition.*NoSuchType/ },
      { data: "path /x { unsupported() { return true; } }",
        w: /unsupported method/i },
      { data: "path /x { validate() { return this.test(123); } }",
        expect: /convert value/i },
      { data: "path /x { validate() { return this.test('a/'); } }",
        expect: /convert value/i },
      { data: "function f(a) { return f(a); } path / { validate() { return f(1); }}",
        expect: /recursive/i }
    ];

    helper.dataDrivenTest(tests, function(data, expect, t) {
      var symbols = parse(data);
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
        if (!expect) {
          throw e;
        }
        lastError = lastError || e.message;
        assert.match(lastError, expect);
        return;
      }
      if (expect) {
        assert.fail(undefined, undefined, "No exception thrown.");
      }
      if (t.w) {
        assert.match(lastError, t.w);
      }
    });
  });
});
