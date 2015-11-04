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
import chai = require('chai');
var assert = chai.assert;
import helper = require('./test-helper');
import storage = require('../storage-simulator');
let parser = require('../rules-parser');
let parse = parser.parse;

suite("Firebase Storage Simulator", function() {
  test("Needs Rules", function() {
    assert.throws(function() {
      let ss = new storage.Storage({});
      return ss;
    });
    let ss = new storage.Storage({"rules": {}});
    assert(ss !== undefined);
  });

  test("Rules Expression", function() {
    assert.throws(function() {
    let ss = new storage.Storage({"rules": {'.write': "}"}});
      return ss;
    });
    let ss = new storage.Storage({"rules": {'.write': "true"}});
    assert(ss !== undefined);
  });

  test("SetUser", function() {
    let ss = new storage.Storage({"rules": {}});
    ss.as('abc');
    assert.equal(ss.user, 'abc');
  });

  test("partsFromPath error", function() {
    assert.throws(function() {
      storage.partsFromPath('a/b');
    });
  });

  suite("partsFromPath", function() {
    let tests = [
      [ '/', [] ],
      [ '/a', ['a'] ],
      [ '/a/b', ['a', 'b'] ],
      [ '/a/b/', ['a', 'b'] ],
    ];
    helper.dataDrivenTest(tests, function(data, expect) {
      var result = storage.partsFromPath(data);
      assert.deepEqual(result, expect);
    }, helper.expFormat);
  });

  suite("all allowed write", function() {
    let tests = [
      { data: [{ path: '/', value: 1 }],
        expect: 1 },
      { data: [{ path: '/a', value: 1 }],
        expect: { a: 1 } },
      { data: [{ path: '/a', value: 1 },
               { path: '/b', value: 2 }],
        expect: { a: 1, b: 2 } },
      { data: [{ path: '/a', value: 1 },
               { path: '/a', value: 2 }],
        expect: { a: 2 } },
      { data: [{ path: '/a', value: 1 },
               { path: '/a/b', value: 2 }],
        expect: undefined },
      { data: [{ path: '/a', value: {b: 2} },
               { path: '/a/c', value: 3 }],
        expect: { a: {b: 2, c: 3} } },
      { data: [{ path: '/a', value: {b: 2} },
               { path: '/a/b/c', value: 3 }],
        expect: undefined },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
        let ss = new storage.Storage({rules: {'.write': "true"}});
      if (expect === undefined) {
        assert.throws(function() {
          data.forEach(function(setter) {
            ss.at(setter.path)
              .write(setter.value);
          });
        });
        return;
      }
      data.forEach(function(setter) {
        ss.at(setter.path)
          .write(setter.value);
      });
      assert.deepEqual(ss.root, expect);
    });
  });

  suite("all allowed read", function() {
    let tests = [
      { data: { root: null, path: [] },
        expect: null },
      { data: { root: {'a': 1}, path: [] },
        expect: {'a': 1} },
      { data: { root: {'a': 1}, path: ['a'] },
        expect: 1 },
      { data: { root: {'a': 1}, path: ['b'] },
        expect: null },
      { data: { root: {'a': 1}, path: ['a', 'b'] },
        expect: undefined },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let ss = new storage.Storage({rules: {'.read': "true"}},
                                   data.root);
      if (expect === undefined) {
        assert.throws(function() {
          this.get(data.path);
        });
        return;
      }
      assert.deepEqual(ss.get(data.path), expect);
    });
  });

  suite("read permissions", function() {
    let rules = {
      readOnly: {
        ".read": "true"
      },
      writeOnly: {
        ".write": "true"
      },
      both: {
        ".read": "true",
        ".write": "true"
      }
    };

    let root = {
      readOnly: {
        value: 123
      },
      writeOnly: {
        value: 456
      },
      both: {
        value: 789
      }
    };

    let tests = [
      { data: { rules: {'.read': "true"},
                root: null, path: '/' },
        expect: true },
      { data: { rules: {'.read': "false"},
                root: null, path: '/' },
        expect: false },
      { data: { rules: {},
                root: null, path: '/' },
        expect: false },
      { data: { rules: rules,
                root: root, path: '/' },
        expect: false },
      { data: { rules: rules,
                root: root, path: '/readOnly/value' },
        expect: true },
      { data: { rules: rules,
                root: root, path: '/writeOnly/value' },
        expect: false },
      { data: { rules: rules,
                root: root, path: '/both/value' },
        expect: true },
      { data: { rules: rules,
                root: root, path: '/notDefined' },
        expect: false },
      { data: { rules: rules,
                root: root, path: '/readOnly/noDefined' },
        expect: true },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let ss = new storage.Storage({'rules': data.rules}, data.root);
      ss.at(data.path).read();
      assert.equal(ss.status, expect);
    });
  });

  suite("JSON Expression evaluation.", function() {
    let root = {
      a: 1,
      b: {
        c: 2,
        d: "Hello",
        e: false
      }
    };

    let globals = < {[name: string]: any; } > {};
    globals['now'] = 123;
    globals['auth'] = null;
    globals['data'] = new storage.DataSnapshot(['b'], root);

    let tests = [
      [ "true", true ],
      [ "false", false ],
      [ "1", 1 ],
      [ "(1)", 1 ],
      [ "1.1", 1.1 ],
      [ "+3", 3],
      [ "-3", -3 ],
      [ "0x2", 2 ],
      [ "\"string\"", 'string' ],
      [ "'string'", 'string' ],
      [ "'st\\'ring'", "st'ring" ],
      [ "2 + 2", 4 ],
      [ "2 * 3", 6 ],
      [ "4 / 2", 2 ],
      [ "2.2 * 2", 4.4 ],
      [ "2 + 3*5 < 20", true ],
      [ "'a' + 'b'", 'ab' ],
      [ "'a' < 'b'", true ],
      [ "'a' == 'b'", false ],
      [ "'a' <= 'b'", true ],

      [ "123 < 234", true ],
      [ "123 <= 234", true ],
      [ "123 > 234", false ],
      [ "123 >= 234", false ],
      [ "123 == 234", false ],
      [ "123 != 234", true ],

      [ "now", 123 ],

      // Ideosyncratic treatment of auth variable
      [ "auth", null ],
      [ "auth.uid", null ],
      [ "auth.any", null ],

      [ "data.child('c').val()", 2 ],
      [ "data.parent().child('a').val()", 1 ],
      [ "data.child('c').isString()", false ],
      [ "data.child('d').isString()", true ],
      [ "data.child('c').isNumber()", true ],
      [ "data.child('d').isNumber()", false ],
      [ "data.child('c').isBoolean()", false ],
      [ "data.child('e').isBoolean()", true ],

      [ "data.exists()", true ],
      [ "data.child('c').exists()", true ],
      [ "data.child('f').exists()", false ],

      [ "data.child('d').val().length", 5 ],
      [ "data.child('d').val().beginsWith('He')", true ],
      [ "data.child('d').val().endsWith('lo')", true ],
      [ "data.child('d').val().replace('H', 'J')", 'Jello' ],
      [ "data.child('d').val().replace('l', 'dip')", 'Hedipdipo' ],
      [ "data.child('d').val().replace('l', 'll')", 'Hellllo' ],
      [ "data.child('d').val().toUpperCase()", "HELLO" ],
      [ "data.child('d').val().toUpperCase().toLowerCase()", "hello" ],
      // [ "data.child('d').val().matches(/h.*o/)", true ],
      // [ "data.child('d').val().matches(/g.*e/)", false ],
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      // Decode to self by default
      let result = parse('function f() {return ' + data + ';}');
      let exp = result.functions.f.body;
      let value = storage.evalJSONExpression(exp, globals);
      assert.equal(value, expect);
    });
  });
});
