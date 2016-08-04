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
import * as bolt from '../bolt';
let parse = bolt.parse;
import * as generator from '../rules-generator';
import * as ast from '../ast';
import * as fileio from '../file-io';
import * as logger from '../logger';
import * as helper from './test-helper';
import {samples} from './sample-files';

import * as chai from 'chai';
chai.config.truncateThreshold = 1000;
let assert = chai.assert;

// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

suite("Rules Generator Tests", function() {
  suite("Basic Samples", function() {
    var tests = [
      { data: "path / {read() { true } write() { true }}",
        expect: { rules: {".read": "true", ".write": "true"} }
      },
      { data: "path / { write() { true }}",
        expect: { rules: {".write": "true"} }
      },
      { data: "path / { create() { true }}",
        expect: { rules: {".write": "data.val() == null"} }
      },
      { data: "path / { update() { true }}",
        expect: { rules: {".write": "data.val() != null && newData.val() != null"} }
      },
      { data: "path / { delete() { true }}",
        expect: { rules: {".write": "data.val() != null && newData.val() == null"} }
      },
      { data: "path / {read() { true }}",
        expect: { rules: {".read": "true"} }
      },
      { data: "path / { read() { false }}",
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
    helper.dataDrivenTest(samples, function(filename) {
      filename = 'samples/' + filename + '.' + bolt.FILE_EXTENSION;
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
      // TODO: Don't support snapshot functions beyond parent.
      // TODO: Should warn user not to use Firebase builtins!
      // { f: "", x: "this.isString()", expect: "newData.child('isString').val() == true" },
      { f: "function f(a) { return a == '123'; }", x: "f(this)", expect: "newData.val() == '123'" },
      { f: "function f(a) { return a == '123'; }",
        x: "f(this.foo)", expect: "newData.child('foo').val() == '123'" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse(data.f + " path /x { write() { return " + data.x + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      var json = <any> gen.generateRules();
      assert.equal(json['rules']['x']['.write'], expect);
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
      { data: "'ababa'.test(/bab/)",
        expect: "'ababa'.matches(/bab/)" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse("path /x { write() { return " + data + "; }}");
      var gen = new bolt.Generator(symbols);
      // Make sure local Schema initialized.
      var json = <any> gen.generateRules();
      assert.equal(json['rules']['x']['.write'], expect);
    });
  });

  suite("Builtin validation functions", function() {
    var tests = [
      [ 'String', 'this.isString()'],
      [ 'Number', 'this.isNumber()'],
      [ 'Boolean', 'this.isBoolean()'],
      [ 'Object', 'this.hasChildren()'],
      [ 'Null', 'false'],
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse("path / {}");
      var gen = new bolt.Generator(symbols);
      gen.ensureValidator(ast.typeType(data));

      var terms = <ast.Exp[]> gen.validators[data]['.validate'];
      var result = bolt.decodeExpression(ast.andArray(terms));
      assert.deepEqual(result, expect);
    });
  });

  suite("Schema Validation", function() {
    var tests = [
      { data: "type T {}",
        expect: undefined },
      { data: "type T extends Object {}",
        expect: {'.validate': "newData.hasChildren()"} },
      { data: "type T extends String {}",
        expect: {'.validate': "newData.isString()"} },
      { data: "type T extends String { validate() { return this.length > 0; } }",
        expect: {'.validate': "newData.isString() && newData.val().length > 0"} },
      { data: "type NonEmpty extends String { validate() { return this.length > 0; } } \
            type T { prop: NonEmpty }",
        expect: {'.validate': "newData.hasChildren(['prop'])",
                 prop: {
                   '.validate': 'newData.isString() && newData.val().length > 0'
                 },
                 '$other': {'.validate': "false"}
                } },
      { data: "type T {n: Number}",
        expect: {'.validate': "newData.hasChildren(['n'])",
                 n: {'.validate': "newData.isNumber()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {s: String}",
        expect: {'.validate': "newData.hasChildren(['s'])",
                 s: {'.validate': "newData.isString()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {b: Boolean}",
        expect: {'.validate': "newData.hasChildren(['b'])",
                 b: {'.validate': "newData.isBoolean()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {x: Object}",
        expect: {'.validate': "newData.hasChildren(['x'])",
                 x: {'.validate': "newData.hasChildren()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {x: Number|String}",
        expect: {'.validate': "newData.hasChildren(['x'])",
                 x: {'.validate': "newData.isNumber() || newData.isString()"},
                 '$other': {'.validate': "false"}} },

      { data: "type T { $key: Number }",
        expect: {'.validate': "newData.hasChildren()",
                 '$key': {'.validate': "newData.isNumber()"}} },

      { data: "type T { 'a b': Number }",
        expect: {'.validate': "newData.hasChildren(['a b'])",
                 'a b': {'.validate': "newData.isNumber()"},
                 '$other': {'.validate': 'false'}} },

      { data: "type T {a: Number, b: String}",
        expect: {'.validate': "newData.hasChildren(['a', 'b'])",
                 a: {'.validate': "newData.isNumber()"},
                 b: {'.validate': "newData.isString()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {x: Number|Null}",
        expect: {'.validate': "newData.hasChildren()",
                 x: {'.validate': "newData.isNumber()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {n: Number, validate() {return this.n < 7;}}",
        expect: {'.validate': "newData.hasChildren(['n']) && newData.child('n').val() < 7",
                 n: {'.validate': "newData.isNumber()"},
                 '$other': {'.validate': "false"}} },
      { data: "type Bigger extends Number {validate() { return this > prior(this); }}" +
        "type T { ts: Bigger }",
        expect: {'.validate': "newData.hasChildren(['ts'])",
                 ts: {'.validate': "newData.isNumber() && newData.val() > data.val()"},
                 '$other': {'.validate': "false"}} },
      { data: "type T {a: String, b: String, c: String}",
        expect: {'.validate': "newData.hasChildren(['a', 'b', 'c'])",
                 a: {'.validate': "newData.isString()"},
                 b: {'.validate': "newData.isString()"},
                 c: {'.validate': "newData.isString()"},
                 '$other': {'.validate': "false"}} },
      { data: "type B { foo: Number } type T extends B { bar: String }",
        expect: {'.validate': "newData.hasChildren(['foo', 'bar'])",
                 foo: {'.validate': "newData.isNumber()"},
                 bar: {'.validate': "newData.isString()"},
                 '$other': {'.validate': "false"}} },

      { data: "type T {n: Number, x: Map<String, Number>}",
        expect: {'.validate': "newData.hasChildren(['n'])",
                 n: {'.validate': "newData.isNumber()"},
                 x: {'$key1': {'.validate': "newData.isNumber()"},
                     '.validate': "newData.hasChildren()" },
                 '$other': {'.validate': "false"}} },
      { data: "type T {x: Map<String, Number>}",
        expect: {'.validate': "newData.hasChildren()",
                 x: {'$key1': {'.validate': "newData.isNumber()"},
                     '.validate': "newData.hasChildren()" },
                 '$other': {'.validate': "false"}} },
      { data: "type SmallString extends String { validate() { this.length < 32 } } " +
              "type T {x: Map<SmallString, Number>}",
        expect: {'.validate': "newData.hasChildren()",
                 x: {'$key1': {'.validate': "$key1.length < 32 && newData.isNumber()"},
                     '.validate': "newData.hasChildren()" },
                 '$other': {'.validate': "false"}} },
      { data: "type M extends Map<String, Number>; type T { x: M }",
        expect: {'.validate': "newData.hasChildren()",
                 '$other': {'.validate': "false"},
                 'x': {'$key1': {'.validate': "newData.isNumber()"},
                       '.validate': "newData.hasChildren()" }} },
      { data: "type Pair<X, Y> { first: X, second: Y } type T extends Pair<String, Number>;",
        expect: {'.validate': "newData.hasChildren(['first', 'second'])",
                 'first': {'.validate': "newData.isString()"},
                 'second': {'.validate': "newData.isNumber()"},
                 '$other': {'.validate': "false"}} },

      { data: "type X { a: Number, validate() { this.a == key() } } type T extends X[];",
        expect: {'$key1': {'.validate': "newData.hasChildren(['a']) && newData.child('a').val() == $key1",
                           'a': {'.validate': "newData.isNumber()"},
                           '$other': {'.validate': "false"}},
                 '.validate': "newData.hasChildren()"
                } },
      { data: "type X { a: Number, validate() { this.a == key() } } type T { x: X }",
        expect: {'x': {'.validate': "newData.hasChildren(['a']) && newData.child('a').val() == 'x'",
                       'a': {'.validate': "newData.isNumber()"},
                       '$other': {'.validate': "false"}},
                 '$other': {'.validate': "false"},
                 '.validate': "newData.hasChildren(['x'])"
                } },

      { data: "type T extends String { validate() { root == 'new' && prior(root) == 'old' } }" +
              "path /t/x is Any { read() { root == 'old' } }",
        expect: {'.validate': "newData.isString() && newData.parent().val() == 'new' && root.val() == 'old'",
                 'x': {'.read': "root.val() == 'old'"}
                } },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var symbols = parse(data + " path /t is T;");
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      if (expect === undefined) {
        assert.deepEqual(rules, {"rules": {}});
      } else {
        assert.deepEqual(rules, {"rules": {t: expect}});
      }
    });
  });

  suite("extendValidator", function() {
    var tests = [
      { data: {target: {}, src: {}},
        expect: {} },
      { data: {target: {}, src: {'.x': [1]}},
        expect: {'.x': [1]} },
      { data: {target: {'.x': [1]}, src: {'.x': [2]}},
        expect: {'.x': [1, 2]} },
      { data: {target: {'.x': [1]}, src: {'.x': [2], c: {'.x': [3]}}},
        expect: {'.x': [1, 2], c: {'.x': [3]}} },
      { data: {target: {'.x': [1], c: {'.x': [2]}}, src: {c: {'.x': [3]}}},
        expect: {'.x': [1], c: {'.x': [2, 3]}} },
      { data: {target: {}, src: {a: {b: {c: {d: {'.x': [1], e: {'.x': [2]}}}}}}},
        expect: {a: {b: {c: {d: {'.x': [1], e: {'.x': [2]}}}}}} },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      generator.extendValidator(data.target, data.src);
      assert.deepEqual(data.target, expect);
    });
  });

  suite("mapValidator", function() {
    var tests = [
      { data: {'.x': 'a'}, expect: {'.x': 'a+'} },
      { data: {'.x': 'b'}, expect: {} },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      generator.mapValidator(data, function(value, prop) {
        if (value === 'b') {
          return undefined;
        }
        return value + '+';
      });
      assert.deepEqual(data, expect);
    });
  });

  suite("Schema Generation Errors", function() {
    var tests = [
      { data: "",
        expect: /at least one path/ },
      { data: "type Simple extends String {a: String} path /x is Simple;",
        expect: /properties.*extend/ },
      { data: "path /y { index() { return 1; }}",
        expect: /index.*string/i },
      { data: "path /x { write() { return undefinedFunc(); }}",
        expect: /undefined.*function/i },
      { data: "path /x is NoSuchType {}",
        expect: /No type.*NoSuchType/ },
      { data: "path /x { unsupported() { true } }",
        warn: /unsupported method/i },

      { data: "path /x { validate() { return this.test(123); } }",
        expect: /convert value/i },
      { data: "path /x { validate() { return this.test('a/'); } }",
        expect: /convert value/i },
      { data: "path /x { validate() { return this.test('/a/'); } }",
        expect: /convert value/i },

      { data: "function f(a) { return f(a); } path / { validate() { return f(1); }}",
        expect: /recursive/i },
      { data: "type X { $n: Number, $s: String } path / is X;",
        expect: /wild property/ },
      { data: "type X { $$n: Number } path / is X;",
        expect: /property names/i },
      { data: "type X { '\x01': Number } path / is X;",
        expect: /property names/i },
      { data: "path / is Map;",
        expect: /No type.*non-generic/ },
      { data: "type Pair<X, Y> {a: X, b: Y} path / is Pair;",
        expect: /No type.*non-generic/ },
      { data: "path / is String<Number>;",
        expect: /No type.*generic/ },
      { data: "path / is Map<Object, Number>;",
        expect: /must derive from String/ },
      { data: "path / { write() { true } create() { true } }",
        expect: /write-aliasing.*create/i },
      { data: "path / { write() { true } update() { true } }",
        expect: /write-aliasing.*update/i },
      { data: "path / { write() { true } delete() { true } }",
        expect: /write-aliasing.*delete/i },
    ];

    helper.dataDrivenTest(tests, function(data, expect, t) {
      logger.reset();
      logger.silent();
      let symbols = parse(data);
      let gen = new bolt.Generator(symbols);
      let lastError: string;

      try {
        gen.generateRules();
      } catch (e) {
        if (!expect) {
          throw e;
        }
        lastError = logger.getLastMessage() || e.message;
        assert.match(lastError, expect);
        return;
      }
      if (expect) {
        assert.fail(undefined, undefined, "No exception thrown.");
      }
      if (t.warn) {
        assert.match(logger.getLastMessage(), t.warn);
      }
    });
  });
});
