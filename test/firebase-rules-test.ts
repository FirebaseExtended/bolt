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

var assert = require('chai').assert;
var rest = require('../lib/firebase-rest');
var secrets = require('./auth-secrets');

suite("Firebase Rules Tests", function() {
  var client = new rest.Client(secrets.APP, secrets.SECRET);

  test("Write Rules", function() {
    return client.put(
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

  test("Read Rules", function() {
    return client.get(rest.RULES_LOCATION)
      .then(function(result) {
        assert('rules' in result);
      });
  });
});
