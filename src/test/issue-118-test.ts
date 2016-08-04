/*
 * Copyright 2016 Google Inc. All Rights Reserved.
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
import {rulesSuite} from '../simulator';
var secrets = require('../../auth-secrets');

rulesSuite("Type[] | Scalar - issue 118", function(test) {
  test.database(secrets.APP, secrets.SECRET);
  test.rules('samples/issue-118');

  test("Scalar tests.", function(rules) {
    rules
      // .debug()
      .as('mike')
      .at('/path/scalar')
      .write(1)
      .succeeds("Write to scalar.")
      .write(null)
      .succeeds("Deleting whole item can delete scalar.")

      // Needed for all subsequent tests to pass.
      .write(1)

      .at('/path/scalarOrNull')
      .write(1)
      .succeeds("Write to scalar or null.")
      .write(null)
      .succeeds("Can delete scalar or null.")
    ;
  });

  test("Array tests.", function(rules) {
    rules
      // .debug()
      .as('mike')
      .at('/path/scalar')
      .write(1)

      .at('/path/array')
      .write([1])
      .succeeds("Write to array.")
      .write(null)
      .succeeds("Deleting whole array.")
      .at('/path/array/999')
      .write(1)
      .succeeds("Write single entry to array.")
      .at('/path/array')
      .push(2)
      .succeeds("Pushes value into array.")
      .write("bogus")
      .fails("Should not be able to write non-array to array.")

      .at('/path/arrayOrNull/999')
      .write(1)
      .succeeds("Can write single array entry to array or null.")

      .at('/path/arrayOrNull')
      .write([1])
      .succeeds("Write array to array or null.")
      .write(null)
      .succeeds("Can delete array or null.")

      .at('/path/arrayOrScalar')
      .write(1)
      .succeeds("Write scalar to array or scalar.")
      .write([1])
      .succeeds("Write array to array or scalar.")
    ;
  });

  test("Map tests.", function(rules) {
    rules
      // .debug()
      .as('mike')
      .at('/path/scalar')
      .write(1)

      .at('/path/map')
      .write([1])
      .succeeds("Write to map.")
      .write(null)
      .succeeds("Deleting whole map.")
      .at('/path/map/key')
      .write(1)
      .succeeds("Write single entry to map.")
      .at('/path/map')
      .push(2)
      .succeeds("Pushes value into map.")
      .write("bogus")
      .fails("Should not be able to write non-map to map.")

      .at('/path/mapOrScalar')
      .write(1)
      .succeeds("Write scalar to map or scalar.")
      .write({"key": 2})
      .succeeds("Write map to map or scalar.")
    ;
  });
});
