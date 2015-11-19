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
/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/mocha.d.ts" />
/// <reference path="../typings/chai.d.ts" />

import decoder = require('../rules-decoder');
import helper = require('./test-helper');

import chai = require('chai');
chai.config.truncateThreshold = 1000;
var assert = chai.assert;


suite("JSON Rules Decoder", function() {
  suite("Basic Samples", function() {
    var tests = [
      { data: { rules: {".read": "true", ".write": "true"} },
        expect: decoder.PREAMBLE + "path / {\n  read() = true;\n  write() = true;\n}\n",
      },

      { data: { rules: { "a": { ".read": "true", ".write": "true"}} },
        expect: decoder.PREAMBLE + "path /a {\n  read() = true;\n  write() = true;\n}\n",
      },
    ];

    helper.dataDrivenTest(tests, function(data, expect) {
      var result = decoder.decodeJSON(data);
      assert.deepEqual(result, expect);
    });
  });
});
