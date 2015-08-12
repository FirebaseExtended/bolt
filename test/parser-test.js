namespace.module('firebase.rules-parser.test', function(exports, require) {
  "use strict";

  require('namespace.funcs').patch();

  var rules = require('firebase.rules');
  var ast = require('firebase.rules.ast');
  var helpers = require('firebase.test.helpers');

  var parse;
  var assert = QUnit.assert;
  var test = QUnit.test;

  // TODO: Test duplicated function, and schema definitions.
  // TODO: Test other parser errors - appropriate messages (exceptions).

  window.addEventListener('load', init);

  function init() {
    parse = rules.parser.parse;
  }

  var fn = functionExpression('f', 'true');
  function fnAST() {
    return {
      params: [],
      body: {
        type: 'boolean',
        value: true
      }
    };
  }

  var path = "path /p {}";
  var pathAST = {
    parts: ['p'],
    methods: {}
  };

  var schema = "type Foo { a: number }";
  var schemaAST = {
    derivedFrom: 'object',
    properties: { "a": { types: ['number'] } },
    methods: {}
  };

  function functionExpression(name, exp) {
    return "function " + name + "() { return " + exp + "; }";
  }

  QUnit.module("Rules Parser Tests");

  test("Empty input", function() {
    var result = parse("");
    assert.deepEqual(result, new ast.Symbols());
  });

  test("Single Rule", function() {
    var result = parse(fn);
    assert.deepEqual(result.functions, { f: fnAST()});
  });

  test("Function name", function() {
    var result = parse("function longName() {return false;}");
    assert.deepEqual(result.functions.longName,
      {
        params: [],
        body: {
          type: "boolean",
          value: false
        }
      });
  });

  test("Two functions", function() {
    var result = parse(fn + "/* sep */" + functionExpression('g', 'true'));
    assert.deepEqual(result.functions, {f: fnAST(), g: fnAST()});
  });

  test("Literals", function() {
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
    for (var i = 0; i < tests.length; i++) {
      var result = parse(functionExpression('f', tests[i][0]));
      assert.deepEqual(result.functions.f.body, tests[i][1], tests[i][0]);
    }
  });

  test("Expressions", function() {
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
      [ "a instanceof Document", ast.instanceOf(ast.variable('a'), ast.variable('Document')) ],
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
    for (var i = 0; i < tests.length; i++) {
      var result = parse(functionExpression('f', tests[i][0]));
      assert.deepEqual(result.functions.f.body, tests[i][1], tests[i][0]);
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
    assert.deepEqual(result.paths, {'/p': pathAST});
  });

  test("Root Path", function() {
    var result = parse("path / {}");
    assert.deepEqual(result.paths['/'],
      {
        parts: [],
        methods: {}
      }
    );
  });

  test("Simple Schema", function() {
    var result = parse(schema);
    assert.deepEqual(result.schema, {Foo: schemaAST});
  });

  test("Multiprop Schema", function() {
    var result = parse("\
      type Multi {\
        a: number,\
        b: string\
      }\
    ");
    assert.deepEqual(result.schema.Multi,
      {
        derivedFrom: 'object',
        properties: {
          "a": { types: ['number'] },
          "b": { types: ['string'] }
        },
        methods: {}
      });
  });

  test("Schema extension", function() {
    var result = parse("type Foo extends Bar {}");
    assert.deepEqual(result.schema.Foo,
      {
        derivedFrom: "Bar",
        properties: {},
        methods: {}
      }
    );
  });

  test("Schema method", function() {
    var result = parse("\
      type Foo {\
      \
      a: number,\
      \
      validate() {\
        return true;\
      }\
    }");
    assert.deepEqual(result.schema.Foo,
      {
        derivedFrom: 'object',
        properties: { "a": { types: ['number'] }},
        methods: {
          "validate": {
            params: [],
            body: {
              type: "boolean",
              value: true
            }
          }
        }
      }
    );
  });

  test("Path method", function() {
    var result = parse("\
      path /p/$q {\
      \
      validate() {\
        return true;\
      }\
    }");
    assert.deepEqual(result.paths['/p/$q'],
      {
        parts: ['p', '$q'],
        methods: {
          validate: {
            params: [],
            body: {
              type: "boolean",
              value: true
            }
          }
        }
      }
    );
  });

  test("Sample files", function() {
    var files = [
      "all_access",
      "userdoc",
      "mail"
    ];
    var completed = [];
    for (var i = 0; i < files.length; i++) {
      completed.push(testFile('samples/' + files[i] + '.sam'));
    }
    return Promise.all(completed);
  });

  function testFile(filename) {
    console.log("Reading " + filename + "...");
    return helpers.readURL(filename)
      .then(function(response) {
        var result = parse(response.content);
        assert.ok(result, response.url);
        return true;
      });
  }
});
