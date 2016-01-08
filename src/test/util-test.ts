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

var util = require('../util');

suite("Util", function() {
  suite("pruneEmptyChildren", () => {
    function T() {
      this.x = 'dummy';
    }

    var tests = [
      [ {}, {} ],
      [ {a: 1}, {a: 1} ],
      [ {a: {}}, {} ],
      [ {a: 1, b: {}}, {a: 1} ],
      [ {a: []}, {a: []} ],
      [ {a: new T()}, {a: new T()} ],
      [ {a: {a: {a: {}}}}, {} ],
      [ {a: {a: {a: {}, b: 1}}}, {a: {a: {b: 1}}} ],
    ];

    helper.dataDrivenTest(tests, (data, expect) => {
      util.pruneEmptyChildren(data);
      assert.deepEqual(data, expect);
    });
  });

  suite("commonPrefix", () => {
    var tests = [
      [ ["abc", "acd"], "a" ],
      [ ["abc", "def"], "" ],
      [ ["", "abc"], "" ],
      [ [[1, 2, 3], [1, 3, 4]], [1] ],
      [ [[1, 2, 3], [5, 3, 4]], [] ],
      [ [[], [5, 3, 4]], [] ],
    ];

    helper.dataDrivenTest(tests, (data, expect) => {
      let result = util.commonPrefix(data[0], data[1]);
      assert.deepEqual(result, expect);
    });
  });
});
