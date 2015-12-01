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

import bolt = require('../bolt');
import ast = require('../ast');
import matcher = require('../ast-matcher');

suite("AST Matching", function() {
  suite("Values to values", () => {
    let tests = ["false", "1", "'a'", "a", "[]", "1.2", "null", "[1,2]"];

    helper.dataDrivenTest(tests, function(data, expect) {
      let exp = bolt.parseExpression(data);
      let match = matcher.findExp(bolt.parseExpression(data), exp);
      assert.deepEqual(match.exp, exp);
    });
  });

  suite("Values in expressions", () => {
    let tests = [
      { pattern: "false", exp: "true || false" },
      { pattern: "a", exp: "a + 1" },
      { pattern: "a", exp: "1 + a" },
      { pattern: "1", exp: "2 + 3 + 1 + 5" },
      { pattern: "'a'", exp: "2 + 3 + 'a' + 5" },
      { pattern: "3", exp: "2 * (4 + 3)" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let match = matcher.findExp(pattern, bolt.parseExpression(data.exp));
      assert.deepEqual(match.exp, pattern);
    });
  });

  suite("Sub-expressions in expressions", () => {
    let tests = [
      { pattern: "a + 1", exp: "a + 1" },
      { pattern: "a || b", exp: "a || b" },
      { pattern: "a || b", exp: "b || a" },
      { pattern: "a || b", exp: "a || b || c" },
      { pattern: "b || c", exp: "a || b || c" },
      { pattern: "a || c", exp: "a || b || c" },
      { pattern: "a || c", exp: "c || b || a" },
      { pattern: "a || c", exp: "b && (a || b || c)" },
      { pattern: "a.test(/x/)", exp: "a + a.test(/x/)" },
      { pattern: "a < b", exp: "a < b" },
      { pattern: "a < b", exp: "b > a" },
      { pattern: "a <= b", exp: "b >= a" },
      { pattern: "a == b", exp: "a == b" },
      { pattern: "a == b", exp: "b == a" },
      { pattern: "a != b", exp: "a != b" },
      { pattern: "a != b", exp: "b != a" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let match = matcher.findExp(pattern, bolt.parseExpression(data.exp));
      assert.equal((<ast.ExpOp> match.exp).op, (<ast.ExpOp> match.exp).op);
    });
  });

  suite("Sub-expressions not in expressions", () => {
    let tests = [
      { pattern: "a + 1", exp: "1 + a" },
      { pattern: "a || c", exp: "c || b || b" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let match = matcher.findExp(pattern, bolt.parseExpression(data.exp));
      assert.equal(match.exp, null);
    });
  });

  suite("Sub-expressions with params", () => {
    let tests = [
      { vars: ['a'], pattern: "a + 1", exp: "a + 1" },
      { vars: ['a'], pattern: "a + 1", exp: "x + 1" },
      { vars: ['x'], pattern: "x || true", exp: "a || b || true || c" },
      { vars: ['x'], pattern: "x || x", exp: "a || b || a" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let match = matcher.findExp(pattern,
                                  bolt.parseExpression(data.exp),
                                  data.vars);
      assert.ok(match.exp !== null && (<ast.ExpOp> match.exp).op === (<ast.ExpOp> match.exp).op);
    });
  });

  suite("Sub-expressions with params not present", () => {
    let tests = [
      { vars: ['a'], pattern: "a + 1", exp: "a + 2" },
      { vars: ['a'], pattern: "a + 1", exp: "x + 2" },
      { vars: ['x'], pattern: "x || x", exp: "a || b || c" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let match = matcher.findExp(pattern,
                                  bolt.parseExpression(data.exp),
                                  data.vars);
      assert.ok(match.exp == null);
    });
  });

  suite("Re-writing descriptors", () => {
    let tests = [
      { data: "a => b",
        expect: { params: [], pattern: "a", replacement: "b" } },
      { data: "() a => b",
        expect: { params: [], pattern: "a", replacement: "b" } },
      { data: "()a => b",
        expect: { params: [], pattern: "a", replacement: "b" } },
      { data: "(a) a => b",
        expect: { params: ['a'], pattern: "a", replacement: "b" } },
      { data: "(a, b) a => b",
        expect: { params: ['a', 'b'], pattern: "a", replacement: "b" } },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let rule = matcher.Rewriter.fromDescriptor(data);
      assert.deepEqual(rule.paramNames, expect.params);
      assert.equal(ast.decodeExpression(rule.pattern), expect.pattern);
      assert.equal(ast.decodeExpression(rule.replacement), expect.replacement);
    });
  });

  suite("ReplaceVars", () => {
    let tests = [
      { data: { exp: "a + 1", params: { a: "2" } },
        expect: "2 + 1" },
      { data: { exp: "a", params: { a: "2" } },
        expect: "2" },
      { data: { exp: "a.val()", params: { a: "newData" } },
        expect: "newData.val()" },
      { data: { exp: "a.val() + a", params: { a: "newData" } },
        expect: "newData.val() + newData" },
      // .a is a property name - not a variable
      { data: { exp: "a.a()", params: { a: "newData" } },
        expect: "newData.a()" },
      { data: { exp: "a.val() != b.val()", params: { a: "this", b: "prior(this)" } },
        expect: "this.val() != prior(this).val()" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let exp = bolt.parseExpression(data.exp);
      let params: ast.ExpParams = {};
      Object.keys(data.params).forEach((key) => {
        params[key] = bolt.parseExpression(data.params[key]);
      });
      let result = matcher.replaceVars(exp, params);
      assert.equal(ast.decodeExpression(result), expect);
    });
  });

  suite("Expression re-writing", () => {
    let tests = [
      { data: { rule: "newData => this", exp: "newData.val() != data.val()"},
        expect: "this.val() != data.val()" },
      { data: { rule: "data => prior(this)", exp: "newData.val() != data.val()"},
        expect: "newData.val() != prior(this).val()" },
      { data: { rule: "(a) a.val() => a", exp: "newData.val() != data.val()"},
        expect: "newData != data" },

      { data: { rule: "(a) a || true => true", exp: "one || two"},
        expect: "one || two" },
      { data: { rule: "(a) a || true => true", exp: "one || true"},
        expect: "true" },
      { data: { rule: "(a) a || true => true", exp: "one || two || true"},
        expect: "true" },
      { data: { rule: "(a) a || true => true", exp: "true || one || two"},
        expect: "true" },

      { data: { rule: "(a) a || false => a", exp: "one || two"},
        expect: "one || two" },
      { data: { rule: "(a) a || false => a", exp: "one || false"},
        expect: "one" },
      { data: { rule: "(a) a || false => a", exp: "one || two || false"},
        expect: "one || two" },
      { data: { rule: "(a) a || false => a", exp: "false || one || two"},
        expect: "one || two" },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let exp = bolt.parseExpression(data.exp);
      let rule = matcher.Rewriter.fromDescriptor(data.rule);
      let result = rule.apply(exp);
      assert.equal(ast.decodeExpression(result), expect);
    });
  });
});
