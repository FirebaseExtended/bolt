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
import * as util from '../util';

suite("Util", function() {
  suite("pruneEmptyChildren", function() {
    class T {
      public x = 'dummy';
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
      [ {a: 1, b: undefined}, {a: 1} ],
    ];

    helper.dataDrivenTest(tests, function(data: any, expect: any) {
      util.pruneEmptyChildren(data);
      assert.deepEqual(data, expect);
    });
  });

  suite("pruneEmptyChildren", function() {
    var tests = [
      [ {}, {} ],
      [ {a: 1}, {a: 1} ],
      [ {a: 1, dm: 2}, {a: 1} ],
      [ {a: 1, b: {dm: 2, c: 3}}, {a: 1, b: {c: 3}} ],
    ];

    helper.dataDrivenTest(tests, function(data: any, expect: any) {
      util.deletePropName(data, 'dm');
      assert.deepEqual(data, expect);
    });
  });
});
