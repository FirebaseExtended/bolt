namespace.module('firebase.rules-generator.test', function(exports, require) {
  "use strict";

  var rules = require('firebase.rules');
  var generator = require('firebase.rules.generator');
  var types = require('namespace.types');
  require('namespace.funcs').patch();

  // Hack - shold be passed in to test function - throws functions breaks...
  var assert = QUnit.assert;

  var test = QUnit.test;
  var skip = QUnit.skip;

  var parse;

  var defaultRules = {
    rules: {
      ".read": "true",
      ".write": "true"
    }
  };

  // TODO: Test duplicated function, and schema definitions.
  // TODO: Test other parser errors - appropriate messages (exceptions).

  window.addEventListener('load', init);

  function init() {
    parse = rules.parser.parse;
  }

  function readURL(url) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();

      req.open('GET', url);

      req.onload = function() {
        if (req.status == 200) {
          resolve(req.responseText);
        } else {
          reject(new Error(req.statusText));
        }
      };

      req.onerror = function() {
        reject(new Error("Network Error"));
      };

      req.send();
    });
  }

  // Enable error message matchin (not in Qunit)
  function assertThrows(fn, message, match) {
    try {
      fn();
    } catch (e) {
      var expected = true;
      if (match) {
        if (types.isType(match, 'regexp')) {
          if (!match.test(e.message)) {
            expected = false;
          }
        } else {
          if (e.message.indexOf(match) == -1) {
            expected = false;
          }
        }
      }
      assert.ok(expected, message || "Expected assertion: " + e.message);
      return;
    }
    fail(message || "Expected assertion not thrown.");
  }

  function fail(msg) {
    assert.ok(false, msg || "Fail.");
  }

  QUnit.module("Rules Generator Tests");

  test("Empty file", function(assert) {
    var result = parse("");
    var gen = new generator.Generator(result);
    assert.throws(function() {
      gen.generateRules();
    }, "at least one path");
  });

  test("All Access", function() {
    var test = "\
      path / {\
      read() { return true; }\
      write() { return true; }\
      }\
      ";
    var result = parse(test);
    assert.ok(result);
    var gen = new generator.Generator(result);
    var json = gen.generateRules();
    assert.deepEqual(json, defaultRules);
  });

  test("Read only", function() {
    var test = "\
      path / {\
      read() { return true; }\
      }\
      ";
    var result = parse(test);
    assert.ok(result);
    var gen = new generator.Generator(result);
    var json = gen.generateRules();
    assert.deepEqual(json, {rules: {".read": "true"}});
  });

  test("Read none", function() {
    var test = "\
      path / {\
      read() { return false; }\
      }\
      ";
    var result = parse(test);
    assert.ok(result);
    var gen = new generator.Generator(result);
    var json = gen.generateRules();
    assert.deepEqual(json, {rules: {".read": "false"}});
  });

  test("Indexed", function() {
    var test = "\
      path / {\
      index() { return ['a', 'b']; }\
      }\
      ";
    var result = parse(test);
    assert.ok(result);
    var gen = new generator.Generator(result);
    var json = gen.generateRules();
    assert.deepEqual(json, {rules: {".indexOn": ["a", "b"]}});
  });

  test("Sample files", function() {
    var files = ["all_access"];
    var completed = [];
    for (var i = 0; i < files.length; i++) {
      var filename = 'samples/' + files[i] + '.rules';
      console.log("Reading " + filename + "...");
      completed.push(readURL(filename)
        .then(function(contents) {
          console.log("Read " + filename + "...");
          var result = parse(contents);
          assert.ok(result, filename);
          var gen = new generator.Generator(result);
          var json = gen.generateRules();
          assert.ok(json);
          assert.ok('rules' in json, "has rules");
          return true;
      }));
    }
    return Promise.all(completed);
  });

  test("Expression decoding.", function() {
    var tests = [
      [ "true" ],
      [ "false" ],
      [ "1" ],
      [ "1.1" ],
      [ "+3" , "3"],
      [ "-3" ],
      [ "0x2", "2" ],
      [ "\"string\"" ],
      [ "'string'", "\"string\"" ],
      [ "a" ],
      [ "a.b" ],
      [ "a['b']", "a[\"b\"]" ],
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
      var decode = generator.decodeExpression(ast);
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
      { f: "function f(a) { return g(a); } function g(a) { return a == true; }", x: "f(123)", e: "123 == true" },
      { f: "function f(a, b) { return g(a) == g(b); } function g(a) { return a == true; }", x: "f(1, 2)", e: "1 == true == (2 == true)" },
      // Highler level function works as long as returns a constant function
      { f: "function f() { return g; } function g(a) { return a == true; }", x: "f()(123)", e: "123 == true" },
      // Undefined function - should just leave function defintion.
      { f: "function f(a) { return a + 1; }", x: "g(1, 2)", e: "g(1, 2)" },
      { f: "function f(a) { return a + 1; }", x: "a[f(123)]", e: "a[123 + 1]" },
      { f: "", x: "this", e: "newData.val() == true" },
      { f: "", x: "this.foo", e: "newData.child(\"foo\").val() == true" },
      { f: "", x: "this.foo || this.bar", e: "newData.child(\"foo\").val() == true || newData.child(\"bar\").val() == true"},
      // Don't use child on built-in method names.
      { f: "", x: "this.isString", e: "newData.isString" },
      { f: "function f(a) { return a == '123'; }", x: "f(this)", e: "newData.val() == \"123\"" },
      { f: "function f(a) { return a == '123'; }", x: "f(this.foo)", e: "newData.child(\"foo\").val() == \"123\"" },
    ];
    for (var i = 0; i < tests.length; i++) {
      var symbols = parse(tests[i].f + " path /x { read() { return " + tests[i].x + "; }}");
      var gen = new generator.Generator(symbols);
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      assert.equal(decode, tests[i].e, tests[i].e);
    }
  });

  test("Function expansion errors", function(assert) {
    var tests = [
      { p: "a", f: "f(a)", x: "f(1)" },
    ];
    for (var i = 0; i < tests.length; i++) {
      var symbols = parse("\
        function f(" + tests[i].p + ") { return " + tests[i].f + "; }\
        path /x { read() { return " + tests[i].x + "; }}\
      ");
      var gen = new generator.Generator(symbols);
      assertThrows(function() {
        gen.getExpressionText(symbols.paths['/x'].methods.read.body);
      }, undefined, "Recursive");
    }
  });

  test("Builtin validation functions", function() {
    var symbols = new parse("");
    var gen = new generator.Generator(symbols);
    var types = ['string', 'number', 'boolean'];
    assert.equal(gen.getExpressionText(symbols.functions['@validator@object'].body),
                 'newData.hasChildren()', 'object');
    assert.equal(gen.getExpressionText(symbols.functions['@validator@null'].body),
                 'newData.val() == null', 'object');
    for (var i = 0; i < types.length; i++) {
      var type = types[i];
      assert.equal(gen.getExpressionText(symbols.functions['@validator@' + type].body),
                   'newData.is' + type.toUpperCase()[0] + type.slice(1) + '()', type);
    }
  });

  test("Schema Validation", function() {
    var tests = [
      { s:"type Simple {}", v: "this instanceof Simple", x: "newData.val() == null || newData.hasChildren()" },
      { s:"type Simple {n: number}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"n\").isNumber()" },
      { s:"type Simple {s: string}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"s\").isString()" },
      { s:"type Simple {b: boolean}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"b\").isBoolean()" },
      { s:"type Simple {x: object}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"x\").hasChildren()" },
      { s:"type Simple {x: number|string}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && (newData.child(\"x\").isNumber() || newData.child(\"x\").isString())" },
      { s:"type Simple {a: number, b: string}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"a\").isNumber() && newData.child(\"b\").isString()" },
      { s:"type Simple {x: number|null}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && (newData.child(\"x\").isNumber() || newData.child(\"x\").val() == null)" },
      { s:"type Simple {n: number, validate() {return this.n < 7;}}", v: "this instanceof Simple",
        x: "newData.val() == null || newData.hasChildren() && newData.child(\"n\").isNumber() && newData.child(\"n\").val() < 7" },
    ];
    for (var i = 0; i < tests.length; i++) {
      var symbols = parse(tests[i].s + " path /x { validate() { return " + tests[i].v + "; }}");
      var gen = new generator.Generator(symbols);
      var decode = gen.getExpressionText(symbols.paths['/x'].methods.validate.body);
      assert.equal(decode, tests[i].x, tests[i].x);
    }
  });

});
