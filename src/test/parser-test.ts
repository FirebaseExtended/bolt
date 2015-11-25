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
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/mocha.d.ts" />

import chai = require('chai');
var assert = chai.assert;
import fileIO = require('../file-io');
var readFile = fileIO.readFile;
import helper = require('./test-helper');

interface Window { bolt: any; }
declare var window: Window;
var bolt = (typeof(window) !== 'undefined' && window.bolt) || require('../bolt');
var ast = bolt.ast;
var parse = bolt.parse;
var BOLT_EXTENSION = bolt.FILE_EXTENSION;

// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

suite("Rules Parser Tests", function() {
  test("Empty input", function() {
    var result = parse("");
    assert.ok(result instanceof ast.Symbols);
  });

  suite("Function Samples", function() {
    var tests = [
      { data: "function f() { return true; }",
        expect: { f: { params: [], body: ast.boolean(true) } }
      },
      { data: "function longName() { return false; }",
        expect: { longName: { params: [], body: ast.boolean(false) } }
      },
      { data: "function f(){return true;} function g(){return false;}",
        expect: { f: { params: [], body: ast.boolean(true) },
                  g: { params: [], body: ast.boolean(false) } }
      }
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.deepEqual(result.functions, expect);
    });
  });

  suite("Literals", function() {
    var tests = [
      [ "true", ast.boolean(true) ],
      [ "false", ast.boolean(false) ],
      [ "null", ast.nullType() ],
      [ "1", ast.number(1) ],
      [ "1.1", ast.number(1.1) ],
      [ "+3", ast.number(3) ],
      [ "-3", ast.number(-3) ],
      [ "0x2", ast.number(2) ],
      [ "[1, 2, 3]", ast.array([ast.number(1), ast.number(2), ast.number(3)]) ],
      [ "\"string\"", ast.string("string") ],
      [ "'string'", ast.string("string") ],
      [ "''", ast.string('') ],
      [ "/pattern/", ast.regexp("pattern") ],
      [ "/pattern/i", ast.regexp("pattern", "i") ],
      [ "/pat\\ntern/", ast.regexp("pat\\ntern") ],
      [ "/pat\\/tern/", ast.regexp("pat\\/tern") ],
      [ "/pat\\tern/", ast.regexp("pat\\tern") ],
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse("function f() { return " + data + ";}");
      assert.deepEqual(result.functions.f.body, expect);
    });
  });

  suite("Expressions", function() {
    var tests = [
      [ "a", ast.variable('a') ],
      [ "a.b", ast.reference(ast.variable('a'), ast.string('b')) ],
      [ "a['b']", ast.reference(ast.variable('a'), ast.string('b')) ],
      [ "a[b]", ast.reference(ast.variable('a'), ast.variable('b')) ],
      [ "a()", ast.call(ast.variable('a'), []) ],
      [ "a.b()", ast.call(ast.reference(ast.variable('a'), ast.string('b')), []) ],
      [ "a().b", ast.reference(ast.call(ast.variable('a'), []), ast.string('b')) ],
      [ "-a", ast.neg(ast.variable('a')) ],
      // TODO: This should be an error - looks like pre-decrement
      [ "--a", ast.neg(ast.neg(ast.variable('a'))) ],
      [ "+a", ast.variable('a') ],
      [ "!a", ast.not(ast.variable('a')) ],
      [ "2 * a", ast.mult(ast.number(2), ast.variable('a')) ],
      [ "2 / a", ast.div(ast.number(2), ast.variable('a')) ],
      [ "a % 2", ast.mod(ast.variable('a'), ast.number(2)) ],
      [ "1 + 1", ast.add(ast.number(1), ast.number(1)) ],
      [ "a - 1", ast.sub(ast.variable('a'), ast.number(1)) ],
      // Unary precedence
      [ "a - -b", ast.sub(ast.variable('a'), ast.neg(ast.variable('b'))) ],
      // Left associative
      [ "a + b + c", ast.add(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c')) ],
      // Multiplcation precedence
      [ "a + b * c", ast.add(ast.variable('a'), ast.mult(ast.variable('b'), ast.variable('c'))) ],
      [ "(a + b) * c", ast.mult(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c')) ],
      [ "a < 7", ast.lt(ast.variable('a'), ast.number(7)) ],
      [ "a > 7", ast.gt(ast.variable('a'), ast.number(7)) ],
      [ "a <= 7", ast.lte(ast.variable('a'), ast.number(7)) ],
      [ "a >= 7", ast.gte(ast.variable('a'), ast.number(7)) ],
      [ "a == 3", ast.eq(ast.variable('a'), ast.number(3)) ],
      [ "a != 0", ast.ne(ast.variable('a'), ast.number(0)) ],
      [ "a === 3", ast.eq(ast.variable('a'), ast.number(3)) ],
      [ "a !== 0", ast.ne(ast.variable('a'), ast.number(0)) ],
      [ "3 * a == b", ast.eq(ast.mult(ast.number(3), ast.variable('a')), ast.variable('b')) ],
      [ "a == 1 && b <= 2", ast.and(ast.eq(ast.variable('a'), ast.number(1)),
                                    ast.lte(ast.variable('b'), ast.number(2))) ],
      [ "a == 1 || b <= 2", ast.or(ast.eq(ast.variable('a'), ast.number(1)),
                                   ast.lte(ast.variable('b'), ast.number(2))) ],
      // Normal left associative && and ||
      [ "a && b && c", ast.and(ast.and(ast.variable('a'),
                                       ast.variable('b')),
                               ast.variable('c')) ],
      [ "a || b || c", ast.or(ast.or(ast.variable('a'),
                                     ast.variable('b')),
                              ast.variable('c')) ],
      [ "a && (b && c)", ast.and(ast.variable('a'),
                                 ast.and(ast.variable('b'),
                                         ast.variable('c'))) ],
      [ "a || (b || c)", ast.or(ast.variable('a'),
                                ast.or(ast.variable('b'),
                                       ast.variable('c'))) ],
      // && over || precendence
      [ "a && b || c && d", ast.or(ast.and(ast.variable('a'),
                                           ast.variable('b')),
                                   ast.and(ast.variable('c'),
                                           ast.variable('d'))) ],
      [ "a ? b : c", ast.ternary(ast.variable('a'), ast.variable('b'), ast.variable('c')) ],
      [ "a || b ? c : d", ast.ternary(ast.or(ast.variable('a'), ast.variable('b')),
                                      ast.variable('c'),
                                      ast.variable('d')) ],
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse("function f() { return " + data + ";}");
      assert.deepEqual(result.functions.f.body, expect);
    });
  });

  suite("Whitespace", function() {
    var fn = "function f() { return true; }";
    var fnAST = { params: [], body: ast.boolean(true) };

    var tests = [
      " " + fn,
      fn + " ",
      " " + fn + " ",
      "\t" + fn,
      "\n" + fn,
      "\r\n" + fn,
      fn + "\n",
      fn + "\r\n",
      "  \t" + fn + "  \r\n"
    ];

    helper.dataDrivenTest(tests, function(data) {
      assert.deepEqual(parse(data).functions.f, fnAST);
    });
  });

  suite("Comments", function() {
    var fn = "function f() { return true; }";
    var fnAST = { params: [], body: ast.boolean(true) };

    var tests = [
      "//Single Line\n" + fn,
      fn + " // My rule",
      "// Line 1\n// Line 2\n" + fn,
      "/* inline */ " + fn,
      "/* pre */ " + fn + " /* post */"
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      assert.deepEqual(parse(data).functions.f, fnAST);
    });
  });

  suite("Paths", function() {
    var tests = [
      { data: "path / {}",
        expect: {"/": { parts: [], isType: ast.typeType('Any'), methods: {} }} },
      { data: "path /x {}",
        expect: {"/x": { parts: ['x'], isType: ast.typeType('Any'), methods: {} }} },
      { data: "path /p/$q { write() { return true;  }}",
        expect: {"/p/$q": { isType: ast.typeType('Any'),
                            parts: ['p', '$q'],
                            methods: {write: {params: [], body: ast.boolean(true)}}}} },
      { data: "path /x/y { read() = true; }",
        expect: {"/x/y": { isType: ast.typeType('Any'),
                           parts: ['x', 'y'],
                           methods: {read: {params: [], body: ast.boolean(true)}}}} },
      { data: "path /x { read() = true; /y { write() = true; }}",
        expect: {"/x": { isType: ast.typeType('Any'),
                         parts: ['x'],
                         methods: {read: {params: [], body: ast.boolean(true)}}},
                 "/x/y": { isType: ast.typeType('Any'),
                           parts: ['x', 'y'],
                           methods: {write: {params: [], body: ast.boolean(true)}}}} },

      { data: "path /x { read() = true; /y { write() = true; path /$id { validate() = false; }}}",
        expect: {"/x": { isType: ast.typeType('Any'),
                         parts: ['x'],
                         methods: {read: {params: [], body: ast.boolean(true)}}},
                 "/x/y": { isType: ast.typeType('Any'),
                           parts: ['x', 'y'],
                           methods: {write: {params: [], body: ast.boolean(true)}}},
                 "/x/y/$id": { isType: ast.typeType('Any'),
                             parts: ['x', 'y', '$id'],
                             methods: {validate: {params: [], body: ast.boolean(false)}}},
                } },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      assert.deepEqual(parse(data).paths, expect);
    });
  });

  suite("Schema", function() {
    var tests = [
      { data: "type Foo { a: Number }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.typeType('Number')},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo { a: Number, b: String }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.typeType('Number'),
                               b: ast.typeType('String')},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo extends Bar {}",
        expect: { derivedFrom: ast.typeType('Bar'),
                  properties: {},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo { a: Number validate() { return true; }}",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.typeType('Number')},
                  methods: {validate: {params: [],
                                       body: ast.boolean(true)}},
                  params: [],
                }},
      { data: "type Foo { a: Number, validate() { return true; }}",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.typeType('Number')},
                  methods: {validate: {params: [],
                                       body: ast.boolean(true)}},
                  params: [],
                }},
      { data: "type Foo { a: Number | String }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.unionType([ast.typeType('Number'),
                                                 ast.typeType('String')])},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo extends Number | String;",
        expect: { derivedFrom: ast.unionType([ast.typeType('Number'), ast.typeType('String')]),
                  properties: {},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo { a: Map<String, Number> }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.genericType('Map', [ast.typeType('String'),
                                                          ast.typeType('Number')])},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo extends Map<String, Number>;",
        expect: { derivedFrom: ast.genericType('Map', [ast.typeType('String'), ast.typeType('Number')]),
                  properties: {},
                  methods: {},
                  params: [],
                }},
      // Alias for Map<String, Other>
      { data: "type Foo { a: Other[] }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.genericType('Map', [ast.typeType('String'),
                                                          ast.typeType('Other')])},
                  methods: {},
                  params: [],
                }},

      { data: "type Foo { a: Multi<String, Number, Boolean> }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.genericType('Multi', [ast.typeType('String'),
                                                            ast.typeType('Number'),
                                                            ast.typeType('Boolean')])},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo { a: Gen1<String> }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.genericType('Gen1', [ast.typeType('String')])},
                  methods: {},
                  params: [],
                }},

      { data: "type Foo<T> { a: T }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {a: ast.typeType('T')},
                  methods: {},
                  params: ["T"],
                }},
      { data: "type Foo { name: String, age: Number }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {name: ast.typeType('String'),
                               age: ast.typeType('Number')},
                  methods: {},
                  params: [],
                }},
      { data: "type Foo { name: String; age: Number; }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {name: ast.typeType('String'),
                               age: ast.typeType('Number')},
                  methods: {},
                  params: [],
                }},

      { data: "type Foo { 'hyphen-prop': String }",
        expect: { derivedFrom: ast.typeType('Object'),
                  properties: {"hyphen-prop": ast.typeType('String')},
                  methods: {},
                  params: [],
                }},
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data).schema.Foo;
      assert.deepEqual(result, expect);
    });
  });

  suite("Function variations", function() {
    var tests = [
      "function f(x) { return x + 1; }",
      "function f(x) { return x + 1 }",
      "function f(x) { x + 1; }",
      "function f(x) { x + 1 }",
      "f(x) = x + 1;",
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.deepEqual(result.functions.f.body,
                       ast.add(ast.variable('x'), ast.number(1)));
    });
  });

  suite("Method variations", function() {
    var tests = [
      "validate() { return this; }",
      "validate() { return this  }",
      "validate() { this; }",
      "validate() { this }",
      "validate() = this;",
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse("type T {" + data + "}");
      assert.deepEqual(result.schema.T.methods.validate.body,
                       ast.variable('this'));
    });
  });

  suite("Path variations", function() {
    var tests = [
      "path /p/c {}",
      "/p/c {}",
      "/p/c;",
      "path /p/c is String {}",
      "path /p/c is String;",
      "/p/c is String {}",
      "/p/c is String;",
      "/p/c { validate() { return true; } }",
      "/p/c { validate() { return true } }",
      "/p/c { validate() { true } }",
      "/p/c { validate() = true; }",
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.deepEqual(result.paths['/p/c'].parts,
                       ['p', 'c']);
    });
  });

  suite("Type variations", function() {
    var tests = [
      "type T extends Any {}",
      "type T extends Any;",
      "type T {}",
      "type T;"
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = parse(data);
      assert.deepEqual(result.schema.T,
                       { derivedFrom: ast.typeType('Any'),
                         methods: {},
                         properties: {},
                         params: [],
                       });
    });
  });

  suite("Sample files", function() {
    var files = ["all_access", "userdoc", "mail", "children"];

    helper.dataDrivenTest(files, function(data) {
      var filename = 'samples/' + data + '.' + BOLT_EXTENSION;
      return readFile(filename)
        .then(function(response) {
          var result = parse(response.content);
          assert.ok(result, response.url);
          return true;
        });
    });
  });

  suite("Parser Errors", function() {
    var tests = [
      { data: "path /x/y/ is String;",
        expect: /end in a slash/ },
      { data: "path /x//y is String;",
        expect: /empty part/ },
      // BUG: Following errors should expect /empty part/ - PEG parser error?
      { data: "path //x is String;",
        expect: /./ },
      { data: "path // is String;",
        expect: /./ },
      { data: "path /x { validate() { return this.test(/a/g); } }",
        expect: /unsupported regexp modifier/i },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      try {
        parse(data);
      } catch (e) {
        assert.match(e.message, expect);
        return;
      }
      assert.fail(undefined, undefined, "No exception thrown.");
    });
  });
});
