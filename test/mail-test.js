var rulesSuite = require('bolt').rulesSuite;

rulesSuite("Mail test.", function(test) {
  test.rules('samples/mail');

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

      .at('/users/bill/inbox/2')
      .write({
        from: 'tom',
        to: 'bill',
        message: 'Hi, Bill!',
        spurious: 'supurious data'
      })
      .fails("No undefined fields.")

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

      .at('/users/bill/inbox/1')
      .write(null)
      .succeeds("Receiver can delete received mail.");
  });


  test("Outbox tests.", function() {
    rules
      .as('bill')
      .at('/users/bill/output/1')
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
      .at('/users/bill/outbox/1/message')
      .write("Bill gets my inheritance.")
      .fails("Sender cannot tamper with outbox message.")

      .at('/users/bill/outbox/1/from')
      .write('bill')
      .fails("Can do a partial overwrite - even if same data.")

      .as('bill')
      .at('/users/bill/outbox/2')
      .write({
        from: 'joe',
        to: 'tom',
        message: "Hi, Tom!"
      })
      .fails("From field must be correct.")

      .write({
        from: 'bill',
        to: 'tom',
        message: "Hi, Tom!",
        spurious: "spurious"
      })
      .fails("No undefined fields.")

      .at('/users/bill/outbox/1')
      .write(null)
      .succeeds("Sender can delete sent mail in outbox.");
  });

  test("Read permissions.", function() {
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
