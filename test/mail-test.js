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
var bolt = (typeof(window) != 'undefined' && window.bolt) || require('../lib/bolt');
var rulesSuite = bolt.rulesSuite;
var secrets = require('./auth-secrets');

rulesSuite("Mail", function(test) {
  test.database(secrets.APP, secrets.SECRET);
  test.rules('test/samples/mail');

  test("Inbox tests.", function(rules) {
    rules
      .as('tom')
      .at('/users/bill/inbox/1')
      .write({
        from: 'tom',
        to: 'bill',
        message: 'Hi, Bill!'
      })
      .succeeds("Normal write.")

      .write(null)
      .fails("Sender cannot delete sent message.")

      .write({
        from: 'tom',
        to: 'bill',
        message: 'Hello, again!'
      })
      .fails("Sender cannot overwrite.")

    /* NYI
      .at('/users/bill/inbox/2')
      .write({
        from: 'tom',
        to: 'bill',
        message: 'Hi, Bill!',
        spurious: 'supurious data'
      })
      .fails("No undefined fields.")
    */

      .write({
        from: 'george',
        to: 'bill',
        message: 'Hi, Bill!'
      })
      .fails("From field should be correct.")

      .at('/users/bill/inbox/1/message')
      .write("Bill gets my inheritance")
      .fails("Cannnot tamper with message.")

      .at('/users/bill/inbox/1/from')
      .write('bill')
      .fails("Cannot tamper with from field.")

      .as('bill')
      .at('/users/bill/inbox/1')
      .write(null)
      .succeeds("Receiver can delete received mail.");
  });


  test("Outbox tests.", function(rules) {
    rules
      .as('bill')
      .at('/users/bill/outbox/1')
      .write({
        from: 'bill',
        to: 'tom',
        message: "Hi, Tom!"
      })
      .succeeds("Normal write.")

      .as('tom')
      .write(null)
      .fails("Receiver cannot delete outbox message.")

      .as('bill')

    /* NYI
      .at('/users/bill/outbox/1/message')
      .write("Bill gets my inheritance.")
      .fails("Sender cannot tamper with outbox message.")

      .at('/users/bill/outbox/1/from')
      .write('bill')
      .fails("Can't do a partial overwrite - even if same data.")
    */

      .as('bill')
      .at('/users/bill/outbox/2')
      .write({
        from: 'joe',
        to: 'tom',
        message: "Hi, Tom!"
      })
      .fails("From field must be correct.")

    /* NYI
      .write({
        from: 'bill',
        to: 'tom',
        message: "Hi, Tom!",
        spurious: "spurious"
      })
      .fails("No undefined fields.")
    */

      .at('/users/bill/outbox/1')
      .write(null)
      .succeeds("Sender can delete sent mail in outbox.");
  });

  test("Read permissions.", function(rules) {
    rules
      .as('bill')
      .at('/users/bill/outbox/1')
      .write({
        from: 'bill',
        to: 'tom',
        message: 'Hi, Tom!'
      })
      .succeeds("Normal write.")

      .as('tom')
      .at('/users/bill/inbox/1')
      .write({
        from: 'tom',
        to: 'bill',
        message: 'Hi, Bill!'
      })

      .as('bill')
      .at('/users/bill/inbox/1')
      .read()
      .succeeds("Can read own inbox.")

      .at('/users/bill/outbox/1')
      .read()
      .succeeds("Can read own outbox.")

      .as('tom')
      .at('/users/bill/inbox/1')
      .read()
      .fails("Can't read Bill's inbox.")

      .at('/users/bill/outbox/1')
      .read()
      .fails("Can't read Bills outbox.");
  });
});
