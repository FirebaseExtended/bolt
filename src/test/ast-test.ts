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
import {assert} from 'chai';
import * as helper from './test-helper';

import * as bolt from '../bolt';
let parse = bolt.parse;
import * as ast from '../ast';

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

    helper.dataDrivenTest(tests, function(data: ast.Exp[], expect: any) {
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

    helper.dataDrivenTest(tests, function(data: ast.Exp, expect: ast.Exp[]) {
      var result = ast.flatten('&&', data);
      assert.deepEqual(result, expect);
    }, helper.expFormat);
  });

  suite("isIdentifierString", function() {
    let tests = [
      [ast.string('hi'), true],
      [ast.string('Hi'), true],
      [ast.string('a'), true],
      [ast.string('A'), true],
      [ast.string('hiThere'), true],
      [ast.string('H123'), true],
      [ast.string('$id'), true],
      [ast.string('a$id'), false],
      [ast.string('a b'), false],
      [ast.string('0H123'), false],
      [ast.boolean(true), false],
      [ast.number(123), false],
      ['hi', false],
    ];

    helper.dataDrivenTest(tests, function(data: ast.Exp, expect: boolean) {
      var result = ast.isIdentifierStringExp(data);
      assert.equal(result, expect);
    }, helper.expFormat);
  });

  suite("Expression decoding.", function() {
    var tests = [
      [ "true" ],
      [ "false" ],
      [ "1" ],
      [ "(1)", '1' ],
      [ "1.1" ],
      [ "+3", "3"],
      [ "-3" ],
      [ "0x2", "2" ],
      [ "\"string\"", "'string'" ],
      [ "'string'" ],
      [ "'st\\'ring'"],
      [ "'st\\ring'" ],
      [ "'\\u000d'", "'\\r'" ],
      [ "/pattern/" ],
      [ "/pattern/i" ],
      [ "/pat\\/tern/i" ],
      [ "a" ],
      [ "a.b" ],
      [ "a.b.c" ],

      [ "a['b']", 'a.b' ],
      [ "a[b]" ],
      [ "a[b][c]" ],
      [ "a.b[c]" ],
      [ "a[b].c" ],
      [ "(a.b)[c]", "a.b[c]" ],
      [ "(a(b))[c]", "a(b)[c]" ],

      [ "a()" ],
      [ "a()()" ],
      [ "a.b()" ],
      [ "a().b" ],
      [ "a[0]()" ],
      [ "a()[0]" ],

      [ "-a" ],
      [ "--a" ],
      [ "+a", "a"],
      [ "+a +b", "a + b" ],
      [ "-a -b", "-a - b" ],
      [ "-a --b", "-a - -b" ],
      [ "-a ---b", "-a - --b" ],
      [ "!a" ],
      [ "!!a" ],
      [ "!+a", '!a' ],
      [ "!-a" ],
      [ "-!a" ],
      [ "2 * a" ],
      [ "(2 * a)", '2 * a' ],
      [ "2 / a" ],
      [ "a % 2" ],
      [ "1 + 1" ],
      [ "a - 1" ],
      [ "a - -b" ],
      [ "a + b + c" ],
      [ "a + (b + c)" ],
      [ "(a + b) + c", 'a + b + c' ],
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
      [ "(this + ' ').test(/\d+/)" ],
    ];

    helper.dataDrivenTest(tests, function(data: string, expect: string) {
      // Decode to self by default
      expect = expect || data;
      var result = parse('function f() {return ' + data + ';}');
      var exp = result.functions.f.body;
      var decode = bolt.decodeExpression(exp);
      assert.equal(decode, expect);
    });
  });
});
