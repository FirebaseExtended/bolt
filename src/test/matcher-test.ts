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
import matcher = require('../ast-matcher');

suite("AST Matching", function() {
  suite("Values to values", () => {
    let tests = ["false", "1", "'a'", "a", "[]", "1.2", "null", "[1,2]"];

    helper.dataDrivenTest(tests, function(data, expect) {
      let exp = bolt.parseExpression(data);
      let match = matcher.forEachExp(bolt.parseExpression(data), exp);
      assert.deepEqual(match.exp, exp);
    }, helper.expFormat);
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
      let match = matcher.forEachExp(pattern, bolt.parseExpression(data.exp));
      assert.deepEqual(match.exp, pattern);
    }, helper.expFormat);
  });

  suite("Sub-expressions in expressions", () => {
    let tests = [
      { pattern: "a + 1", exp: "a + 1" },
      { pattern: "a || b", exp: "a || b" },
      /*
      { pattern: "a + 1", exp: "a + 1 + 2" },
      { pattern: "a || b", exp: "a || b || c" },
      { pattern: "b || c", exp: "a || b || c" },
      { pattern: "a || c", exp: "a || b || c" },
      */
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let pattern = bolt.parseExpression(data.pattern);
      let exp = bolt.parseExpression(data.exp);
      let match = matcher.forEachExp(pattern, bolt.parseExpression(data.exp));
      assert.deepEqual(match.exp, exp);
    }, helper.expFormat);
  });
});
