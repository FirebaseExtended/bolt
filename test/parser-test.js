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

var assert = require('chai').assert;
var readFile = require('../lib/file-io').readFile;

var bolt = (typeof(window) != 'undefined' && window.bolt) || require('../lib/bolt');
var ast = bolt.ast;
var parse = bolt.parse;
var BOLT_EXTENSION = bolt.FILE_EXTENSION;

// TODO: Test duplicated function, and schema definitions.
// TODO: Test other parser errors - appropriate messages (exceptions).

var fn = functionExpression('f', 'true');
function fnAST() {
  return {
    params: [],
    body: {
      type: 'Boolean',
      value: true
    }
  };
}

var path = "path /x {}";
var pathAST = {
  parts: ['x'],
  isType: 'Any',
  methods: {}
};

var schema = "type Foo { a: Number }";
var schemaAST = {
  derivedFrom: 'Object',
  properties: { "a": { types: ['Number'] } },
  methods: {}
};

function functionExpression(name, exp) {
  return "function " + name + "() { return " + exp + "; }";
}

suite("Rules Parser Tests", function() {
  test("Empty input", function() {
    var result = parse("");
    assert.ok(result instanceof ast.Symbols);
  });

  test("Single Rule", function() {
    var result = parse(fn);
    assert.deepEqual(result.functions, { f: fnAST()});
  });

  test("Function name", function() {
    var result = parse("function longName() {return false;}");
    assert.deepEqual(result.functions.longName, {
      params: [],
      body: {
        type: "Boolean",
        value: false
      }
    });
  });

  test("Two functions", function() {
    var result = parse(fn + "/* sep */" + functionExpression('g', 'true'));
    assert.deepEqual(result.functions, {f: fnAST(), g: fnAST()});
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
    ];

    function testIt(t) {
      var result = parse(functionExpression('f', t[0]));
      assert.deepEqual(result.functions.f.body, t[1]);
    }

    for (var i = 0; i < tests.length; i++) {
      test(tests[i][0], testIt.bind(undefined, tests[i]));
    }
  });

  suite("Expressions", function() {
    var tests = [
      [ "a", ast.variable('a') ],
      [ "a.b", ast.reference(ast.variable('a'), 'b') ],
      [ "a['b']", ast.reference(ast.variable('a'), ast.string('b')) ],
      [ "a[b]", ast.reference(ast.variable('a'), ast.variable('b')) ],
      [ "a()", ast.call(ast.variable('a'), []) ],
      [ "a.b()", ast.call(ast.reference(ast.variable('a'), 'b'), []) ],
      [ "a().b", ast.reference(ast.call(ast.variable('a'), []), 'b') ],
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
      // Left associative (even though execution is short-circuited!
      [ "a && b && c", ast.and(ast.and(ast.variable('a'),
                                       ast.variable('b')),
                               ast.variable('c')) ],
      [ "a || b || c", ast.or(ast.or(ast.variable('a'),
                                     ast.variable('b')),
                              ast.variable('c')) ],
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

    function testIt(t) {
      var result = parse(functionExpression('f', t[0]));
      assert.deepEqual(result.functions.f.body, t[1]);
    }

    for (var i = 0; i < tests.length; i++) {
      test(tests[i][0], testIt.bind(undefined, tests[i]));
    }
  });

  test("Whitespace", function() {
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
    for (var i = 0; i < tests.length; i++) {
      var result = parse(tests[i]);
      assert.deepEqual(result.functions.f, fnAST(), "'" + encodeURIComponent(tests[i]) + "'");
    }
  });

  test("Comments", function() {
    var tests = [
      "//Single Line\n" + fn,
      fn + " // My rule",
      "// Line 1\n// Line 2\n" + fn,
      "/* inline */ " + fn,
      "/* pre */ " + fn + " /* post */"
    ];
    for (var i = 0; i < tests.length; i++) {
      var result = parse(tests[i]);
      assert.deepEqual(result.functions.f, fnAST(), "'" + encodeURIComponent(tests[i]) + "'");
    }
  });

  test("Path", function() {
    var result = parse(path);
    assert.deepEqual(result.paths, {'/x': pathAST});
  });

  test("Root Path", function() {
    var result = parse("path / {}");
    assert.deepEqual(result.paths['/'], {
      parts: [],
      isType: 'Any',
      methods: {}
    });
  });

  test("Simple Schema", function() {
    var result = parse(schema);
    assert.deepEqual(result.schema, {Foo: schemaAST});
  });

  test("Multiprop Schema", function() {
    var result = parse("\
type Multi {\
a: Number,\
b: String\
}\
");
    assert.deepEqual(result.schema.Multi, {
      derivedFrom: 'Object',
      properties: {
        "a": { types: ['Number'] },
        "b": { types: ['String'] }
      },
      methods: {}
    });
  });

  test("Schema extension", function() {
    var result = parse("type Foo extends Bar {}");
    assert.deepEqual(result.schema.Foo, {
      derivedFrom: "Bar",
      properties: {},
      methods: {}
    });
  });

  test("Schema method", function() {
    var result = parse("\
type Foo {\
\
a: Number,\
\
validate() {\
return true;\
}\
}");
    assert.deepEqual(result.schema.Foo, {
      derivedFrom: 'Object',
      properties: { "a": { types: ['Number'] }},
      methods: {
        "validate": {
          params: [],
          body: {
            type: "Boolean",
            value: true
          }
        }
      }
    });
  });

  test("Path method", function() {
    var result = parse("\
path /p/$q {\
\
write() {\
return true;\
}\
}");
    assert.deepEqual(result.paths['/p/$q'], {
      parts: ['p', '$q'],
      isType: 'Any',
      methods: {
        write: {
          params: [],
          body: {
            type: "Boolean",
            value: true
          }
        }
      }
    });
  });

  suite("Sample files", function() {
    var files = [
      "all_access",
      "userdoc",
      "mail"
    ];
    for (var i = 0; i < files.length; i++) {
      test(files[i],
           testFile.bind(undefined,
                         'test/samples/' + files[i] + '.' + BOLT_EXTENSION));
    }
  });

  function testFile(filename) {
    return readFile(filename)
      .then(function(response) {
        var result = parse(response.content);
        assert.ok(result, response.url);
        return true;
      });
  }
});
