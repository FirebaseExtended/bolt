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

var util = require('../lib/util');

suite("Util", function() {
  suite("pruneEmptyChildren", function() {
    function T() {
      return true;
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

    helper.dataDrivenTest(tests, function(data, expect) {
      util.pruneEmptyChildren(data);
      assert.deepEqual(data, expect);
    });
  });
});
