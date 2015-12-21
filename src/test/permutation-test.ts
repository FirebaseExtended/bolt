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

import {IndexPermutation, Permutation} from '../permutation';

suite("Permutations", () => {
  suite("IndexPermutation", () => {
    let tests = [
      { data: [1],
        expect: { values: [[0]], count: 1 } },
      { data: [1, 1],
        expect: { values: [[0]], count: 1 } },
      { data: [2],
        expect: { values: [[0, 1], [1, 0]], count: 2 } },
      { data: [3],
        expect: { values: [[0, 1, 2],
                           [0, 2, 1],
                           [1, 0, 2],
                           [1, 2, 0],
                           [2, 0, 1],
                           [2, 1, 0]],
                  count: 6 } },
      { data: [3, 1],
        expect: { values: [[0], [1], [2]],
                  count: 3 } },
      { data: [3, 2],
        expect: { values: [[0, 1],
                           [0, 2],
                           [1, 0],
                           [1, 2],
                           [2, 0],
                           [2, 1]],
                  count: 6 } },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let p = new IndexPermutation(data[0], data[1]);
      assert.equal(p.getCount(), expect.count);
      let results = [];
      while (p.current() !== null) {
        results.push(p.current());
        p.next();
      }
      assert.deepEqual(results, expect.values);
    });
  });

  suite("Permutation", () => {
    let tests = [
      { data: { c: ['a'], k: undefined },
        expect: { values: [['a']], count: 1 } },
      { data: { c: ['a', 'b'], k: undefined },
        expect: { values: [['a', 'b'], ['b', 'a']], count: 2 } },
      { data: { c: ['a', 'b', 'c'], k: 2 },
        expect: { values: [['a', 'b'],
                           ['a', 'c'],
                           ['b', 'a'],
                           ['b', 'c'],
                           ['c', 'a'],
                           ['c', 'b']],
                  count: 6 } },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      let p = new Permutation(data.c, data.k);
      assert.equal(p.getCount(), expect.count);
      let results = [];
      while (p.current() !== null) {
        results.push(p.current());
        p.next();
      }
      assert.deepEqual(results, expect.values);
    });
  });
});
