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
var gen = require('../lib/rules-generator');
var util = require('../lib/util');

suite("Abstract Syntax Tree (AST)", function() {
  suite("Left Associative Operators (AND OR)", function() {
    var t = ast.boolean(true);
    var f = ast.boolean(false);
    var v = ast.variable('v');

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
      { data: [v],
        expect: {and: v, or: v} },
      { data: [v, t],
        expect: {and: v, or: t} },
      { data: [v, f],
        expect: {and: f, or: v} },
      { data: [t, v],
        expect: {and: v, or: t} },
      { data: [f, v],
        expect: {and: f, or: v} },
      { data: [t, v, f],
        expect: {and: f, or: t} },
      { data: [f, v, t],
        expect: {and: f, or: t} },
      { data: [v, f, v],
        expect: {and: f, or: ast.or(v, v)} },
      { data: [v, t, v],
        expect: {and: ast.and(v, v), or: t} },
    ];

    function formatter(x) {
      if (util.isType(x, 'array')) {
        return '[' + x.map(formatter).join(', ') + ']';
      }
      if (util.isType(x, 'object')) {
        if ('type' in x) {
          return gen.decodeExpression(x);
        }
        var result = '{';
        var sep = '';
        for (var prop in x) {
          result += sep + formatter(x[prop]);
          sep = ', ';
        }
        result += '}';
        return result;
      }
      return JSON.stringify(x);
    }

    helper.dataDrivenTest(tests, function(data, expect) {
      assert.deepEqual(ast.andArray(data), expect.and, 'AND');
      assert.deepEqual(ast.orArray(data), expect.or, 'OR');
    }, formatter);
  });
});
