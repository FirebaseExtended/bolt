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
/// <reference path="../typings/es6-promise.d.ts" />

import Promise = require('promise');
import rest = require('../firebase-rest');
var secrets = require('../../auth-secrets');

var TEST_LOCATION = '/rest-test';

suite("Firebase REST Tests", function() {
  var client = new rest.Client(secrets.APP);

  suiteSetup(function() {
    var adminClient = new rest.Client(secrets.APP, secrets.SECRET);
    return adminClient.put(
      rest.RULES_LOCATION,
      {
        rules: {
          ".read": true,
          ".write": false,
          "rest-test": {
            ".write": true
          }
        }
      });
  });

  test("Read location", function() {
    return client.get(TEST_LOCATION);
  });

  test("Write data", function() {
    var tests = [
      { location: 'string', value: 'Hello, world.' },
      { location: 'integer', value: 123 },
      { location: 'number', value: 123.456 },
      { location: 'boolean', value: false },
      { location: 'object', value: {this: 1, that: 'other'} },
      { location: 'TIMESTAMP', value: rest.TIMESTAMP },
    ];
    var results = [];
    for (var i = 0; i < tests.length; i++) {
      var t = tests[i];
      results.push(client.put(TEST_LOCATION + '/types/' + t.location, t.value));
    }
    return Promise.all(results);
  });

  test("Invalid location", function() {
    return client.get('../../illegal')
      .catch(function(error) {
        return true;
      });
  });
});
