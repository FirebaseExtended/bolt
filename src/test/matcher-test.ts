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
import util = require('../util');
import matcher = require('../ast-matcher');

suite("AST Matching", function() {
  suite("Values", () => {
    let tests = ["false", "1", "'a'", "a", "[]"];

    helper.dataDrivenTest(tests, function(data, expect) {
      let exp = bolt.parseExpression(data);
      let match = matcher.forEachExp(bolt.parseExpression(data), exp);
      assert.deepEqual(match.exp, exp);
    }, helper.expFormat);
  });

  suite("Value expressions", () => {
    let tests = [
      { data: { pattern: "false", exp: "true || false" },
        expect:  "false"},
      { data: { pattern: "false", exp: "true || true" },
        expect: null },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let match = matcher.forEachExp(bolt.parseExpression(data.pattern),
                                     bolt.parseExpression(data.exp));
      if (util.isType(expect, 'string')) {
        expect = bolt.parseExpression(expect);
      }
      assert.deepEqual(match.exp, expect);
    }, helper.expFormat);
  });
});
