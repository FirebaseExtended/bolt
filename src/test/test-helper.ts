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

import util = require('../util');
import ast = require('../ast');
import logger = require('../logger');

/*
 * Run data drive test with tests is one of these formats:
 * [ { label: (opt) <string>, data: <input>, expect: (opt) <expected output> }, ... ]
 * [ [ <input>, <expected output> ], ... ]
 * [ scalar, ... ]
 *
 * Calls testIt(data, expect) for each test.
 */
export function dataDrivenTest(tests, testIt, formatter?) {
  var data;
  var expect;
  var label: string;

  formatter = formatter || format;

  for (var i = 0; i < tests.length; i++) {
    // Not Array or Object
    if (typeof tests[i] !== 'object') {
      label = formatter(tests[i]);
      data = tests[i];
      expect = undefined;
    } else {
      data = tests[i].data;
      if (data === undefined) {
        data = tests[i][0];
      }
      if (data === undefined) {
        data = tests[i];
      }
      if (util.isType(data, 'object') && 'expect' in data) {
        data = util.extend({}, data);
        delete data.expect;
      }
      expect = tests[i].expect || tests[i][1];
      label = tests[i].label;
      if (label === undefined) {
        if (expect !== undefined) {
          label = formatter(data) + " => " + formatter(expect);
        } else {
          label = formatter(data);
        }
      }
    }

    setup(() => {
      logger.reset();
      logger.silent();
    });
    teardown(() => {
      logger.reset();
    });
    test(label, testIt.bind(undefined, data, expect, tests[i]));
  }
}

function format(o) {
  switch (util.typeOf(o)) {
  case 'regexp':
    return o.toString();
  default:
    return JSON.stringify(o);
  }
}

export function expFormat(x) {
  if (util.isType(x, 'array')) {
    return '[' + x.map(expFormat).join(', ') + ']';
  }
  if (util.isType(x, 'object')) {
    if ('type' in x) {
      return ast.decodeExpression(x);
    }
    var result = '{';
    var sep = '';
    for (var prop in x) {
      if (!x.hasOwnProperty(prop)) {
        continue;
      }
      result += sep + expFormat(x[prop]);
      sep = ', ';
    }
    result += '}';
    return result;
  }
  return JSON.stringify(x);
}
