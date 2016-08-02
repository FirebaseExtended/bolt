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
import {rulesSuite} from '../simulator';
var secrets = require('../../auth-secrets');

rulesSuite("Create, Update, and Delete", function(test) {
  test.database(secrets.APP, secrets.SECRET);
  test.rules('samples/create-update-delete');
  var uid = test.uid;

  test("Create", (rules) => {
    rules
      .at('/docs/' + uid('mike') + '/create')
      .write('created')
      .succeeds("Anyone can create.")

      .write('updated')
      .fails("No-one can update.")

      .write(null)
      .fails("No-one can delete.")

      .as('mike')

      .write('owner-updated')
      .fails("Owner can't update.")

      .write(null)
      .fails("Owner can't delete.")
    ;
  });

  test("Update", (rules) => {
    rules
      .at('/docs/' + uid('mike') + '/update')
      .as('mike')
      .write('created')
      .fails("Owner can't create.")

      .as('admin')
      .write('created')
      .succeeds("Admin can create.")

      .as('anon')

      .write('updated')
      .succeeds("Anyone can update.")

      .write(null)
      .fails("No-one can delete.")

      .as('mike')
      .write('owner-updated')
      .succeeds("Owner can update.")

      .write(null)
      .fails("Owner can't delete.")
    ;
  });

  test("Delete", (rules) => {
    rules
      .at('/docs/' + uid('mike') + '/delete')
      .as('admin')
      .write('created')
      .succeeds("Admin can create.")

      .as('anon')

      .write('updated')
      .fails("Anyone can't update.")

      .write(null)
      .succeeds("Anyone can delete.")

      .as('mike')
      .write('owner-created')
      .fails("Owner can't create.")

      .as('admin')
      .write('created')

      .as('mike')

      .write('owner-updated')
      .fails("Owner can't update.")

      .write(null)
      .succeeds("Owner can delete.")
    ;
  });

  test("Owner Create and Delete", (rules) => {
    rules
      .at('/docs/' + uid('mike') + '/owner-create-delete')
      .as('anon')
      .write('created')
      .fails("Anyone can't create.")

      .as('mike')
      .write('created')
      .succeeds("Owner can create.")

      .as('anon')

      .write('updated')
      .succeeds("Anyone can update.")

      .write(null)
      .fails("Anyone can't delete.")

      .as('mike')
      .write(null)
      .succeeds("Owner can delete.")
    ;
  });
});
