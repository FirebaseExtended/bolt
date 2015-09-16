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
var helper = require('./test-helper');

var ast = require('../lib/ast');

suite("Abstract Syntax Tree (AST)", function() {
  suite("Left Associative Operators (AND OR)", function() {
    var t = ast.boolean(true);
    var f = ast.boolean(false);
    var v = ast.variable;
    var and = ast.and;
    var or = ast.or;
    var a = v('a');
    var b = v('b');
    var c = v('c');
    var d = v('d');

    var tests = [
      { data: [],
        expect: {and: t, or: f} },
      { data: [t],
        expect: {and: t, or: t} },
      { data: [f],
        expect: {and: f, or: f} },
      { data: [f, t],
        expect: {and: f, or: t} },
      { data: [t, f],
        expect: {and: f, or: t} },
      { data: [t, f, t],
        expect: {and: f, or: t} },
      { data: [f, t, f],
        expect: {and: f, or: t} },
      { data: [a],
        expect: {and: a, or: a} },
      { data: [a, t],
        expect: {and: a, or: t} },
      { data: [a, f],
        expect: {and: f, or: a} },
      { data: [t, a],
        expect: {and: a, or: t} },
      { data: [f, a],
        expect: {and: f, or: a} },
      { data: [t, a, f],
        expect: {and: f, or: t} },
      { data: [f, a, t],
        expect: {and: f, or: t} },
      { data: [a, f, a],
        expect: {and: f, or: ast.or(a, a)} },
      { data: [a, t, a],
        expect: {and: and(a, a), or: t} },
      { data: [and(a, b), and(c, d)],
        expect: {and: and(and(and(a, b), c), d),
                 or: or(and(a, b), and(c, d))} },
      { data: [or(a, b), or(c, d)],
        expect: {and: and(or(a, b), or(c, d)),
                 or: or(or(or(a, b), c), d)} },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      assert.deepEqual(ast.andArray(data), expect.and, 'AND');
      assert.deepEqual(ast.orArray(data), expect.or, 'OR');
    }, helper.expFormat);
  });

  suite("Flatten", function() {
    var v = ast.variable;
    var and = ast.and;
    var a = v('a');
    var b = v('b');
    var c = v('c');
    var d = v('d');

    var tests = [
      { data: a,
        expect: [a] },
      { data: and(a, b),
        expect: [a, b] },
      { data: and(a, b),
        expect: [a, b] },
      { data: and(and(a, b), c),
        expect: [a, b, c] },
      { data: and(a, and(b, c)),
        expect: [a, b, c] },
      { data: and(and(a, b), and(c, d)),
        expect: [a, b, c, d] },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = ast.flatten('&&', data);
      assert.deepEqual(result, expect);
    }, helper.expFormat);
  });
});
