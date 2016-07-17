"use strict";
var bolt = require('../bolt');
var rulesSuite = bolt.rulesSuite;
var secrets = require('../../auth-secrets');
rulesSuite("Mail", function (test) {
    var uid = test.uid;
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/mail');
    test("Inbox tests.", function (rules) {
        rules
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .succeeds("Normal write.")
            .write(null)
            .fails("Sender cannot delete sent message.")
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hello, again!'
        })
            .fails("Sender cannot overwrite.")
            .at('/users/' + uid('bill') + '/inbox/2')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!',
            spurious: 'supurious data'
        })
            .fails("No undefined fields.")
            .write({
            from: uid('george'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .fails("From field should be correct.")
            .at('/users/' + uid('bill') + '/inbox/1/message')
            .write("Bill gets my inheritance")
            .fails("Cannnot tamper with message.")
            .at('/users/' + uid('bill') + '/inbox/1/from')
            .write(uid('bill'))
            .fails("Cannot tamper with from field.")
            .as('bill')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write(null)
            .succeeds("Receiver can delete received mail.");
    });
    test("Outbox tests.", function (rules) {
        rules
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1')
            .write({
            from: uid('bill'),
            to: uid('tom'),
            message: "Hi, Tom!"
        })
            .succeeds("Normal write.")
            .as('tom')
            .write(null)
            .fails("Receiver cannot delete outbox message.")
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1/message')
            .write("Bill gets my inheritance.")
            .fails("Sender cannot tamper with outbox message.")
            .at('/users/' + uid('bill') + '/outbox/1/from')
            .write('bill')
            .fails("Can't do a partial overwrite - even if same data.")
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/2')
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
            .at('/users/' + uid('bill') + '/outbox/1')
            .write(null)
            .succeeds("Sender can delete sent mail in outbox.");
    });
    test("Read permissions.", function (rules) {
        rules
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1')
            .write({
            from: uid('bill'),
            to: uid('tom'),
            message: 'Hi, Tom!'
        })
            .succeeds("Normal write.")
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .as('bill')
            .at('/users/' + uid('bill') + '/inbox/1')
            .read()
            .succeeds("Can read own inbox.")
            .at('/users/' + uid('bill') + '/outbox/1')
            .read()
            .succeeds("Can read own outbox.")
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .read()
            .fails("Can't read Bill's inbox.")
            .at('/users/' + uid('bill') + '/outbox/1')
            .read()
            .fails("Can't read Bills outbox.");
    });
});

//# sourceMappingURL=data:application/json;base64,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QUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxXQUFXLENBQUM7YUFDekMsSUFBSSxFQUFFO2FBQ04sS0FBSyxDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDdkMsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L21haWwtdGVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuICpcclxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4gKi9cclxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3Mvbm9kZS5kLnRzXCIgLz5cclxuXHJcbmltcG9ydCBib2x0ID0gcmVxdWlyZSgnLi4vYm9sdCcpO1xyXG52YXIgcnVsZXNTdWl0ZSA9IGJvbHQucnVsZXNTdWl0ZTtcclxudmFyIHNlY3JldHMgPSByZXF1aXJlKCcuLi8uLi9hdXRoLXNlY3JldHMnKTtcclxuXHJcbnJ1bGVzU3VpdGUoXCJNYWlsXCIsIGZ1bmN0aW9uKHRlc3QpIHtcclxuICB2YXIgdWlkID0gdGVzdC51aWQ7XHJcblxyXG4gIHRlc3QuZGF0YWJhc2Uoc2VjcmV0cy5BUFAsIHNlY3JldHMuU0VDUkVUKTtcclxuICB0ZXN0LnJ1bGVzKCdzYW1wbGVzL21haWwnKTtcclxuXHJcbiAgdGVzdChcIkluYm94IHRlc3RzLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmFzKCd0b20nKVxyXG4gICAgICAuYXQoJy91c2Vycy8nICsgdWlkKCdiaWxsJykgKyAnL2luYm94LzEnKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgndG9tJyksXHJcbiAgICAgICAgdG86IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdIaSwgQmlsbCEnXHJcbiAgICAgIH0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5vcm1hbCB3cml0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJTZW5kZXIgY2Fubm90IGRlbGV0ZSBzZW50IG1lc3NhZ2UuXCIpXHJcblxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgndG9tJyksXHJcbiAgICAgICAgdG86IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdIZWxsbywgYWdhaW4hJ1xyXG4gICAgICB9KVxyXG4gICAgICAuZmFpbHMoXCJTZW5kZXIgY2Fubm90IG92ZXJ3cml0ZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMicpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCd0b20nKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsIScsXHJcbiAgICAgICAgc3B1cmlvdXM6ICdzdXB1cmlvdXMgZGF0YSdcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiTm8gdW5kZWZpbmVkIGZpZWxkcy5cIilcclxuXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdnZW9yZ2UnKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsISdcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiRnJvbSBmaWVsZCBzaG91bGQgYmUgY29ycmVjdC5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMS9tZXNzYWdlJylcclxuICAgICAgLndyaXRlKFwiQmlsbCBnZXRzIG15IGluaGVyaXRhbmNlXCIpXHJcbiAgICAgIC5mYWlscyhcIkNhbm5ub3QgdGFtcGVyIHdpdGggbWVzc2FnZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMS9mcm9tJylcclxuICAgICAgLndyaXRlKHVpZCgnYmlsbCcpKVxyXG4gICAgICAuZmFpbHMoXCJDYW5ub3QgdGFtcGVyIHdpdGggZnJvbSBmaWVsZC5cIilcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJSZWNlaXZlciBjYW4gZGVsZXRlIHJlY2VpdmVkIG1haWwuXCIpO1xyXG4gIH0pO1xyXG5cclxuXHJcbiAgdGVzdChcIk91dGJveCB0ZXN0cy5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIHRvOiB1aWQoJ3RvbScpLFxyXG4gICAgICAgIG1lc3NhZ2U6IFwiSGksIFRvbSFcIlxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJOb3JtYWwgd3JpdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ3RvbScpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJSZWNlaXZlciBjYW5ub3QgZGVsZXRlIG91dGJveCBtZXNzYWdlLlwiKVxyXG5cclxuICAgICAgLmFzKCdiaWxsJylcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEvbWVzc2FnZScpXHJcbiAgICAgIC53cml0ZShcIkJpbGwgZ2V0cyBteSBpbmhlcml0YW5jZS5cIilcclxuICAgICAgLmZhaWxzKFwiU2VuZGVyIGNhbm5vdCB0YW1wZXIgd2l0aCBvdXRib3ggbWVzc2FnZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEvZnJvbScpXHJcbiAgICAgIC53cml0ZSgnYmlsbCcpXHJcbiAgICAgIC5mYWlscyhcIkNhbid0IGRvIGEgcGFydGlhbCBvdmVyd3JpdGUgLSBldmVuIGlmIHNhbWUgZGF0YS5cIilcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzInKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206ICdqb2UnLFxyXG4gICAgICAgIHRvOiAndG9tJyxcclxuICAgICAgICBtZXNzYWdlOiBcIkhpLCBUb20hXCJcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiRnJvbSBmaWVsZCBtdXN0IGJlIGNvcnJlY3QuXCIpXHJcblxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206ICdiaWxsJyxcclxuICAgICAgICB0bzogJ3RvbScsXHJcbiAgICAgICAgbWVzc2FnZTogXCJIaSwgVG9tIVwiLFxyXG4gICAgICAgIHNwdXJpb3VzOiBcInNwdXJpb3VzXCJcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiTm8gdW5kZWZpbmVkIGZpZWxkcy5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLnN1Y2NlZWRzKFwiU2VuZGVyIGNhbiBkZWxldGUgc2VudCBtYWlsIGluIG91dGJveC5cIik7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJSZWFkIHBlcm1pc3Npb25zLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmFzKCdiaWxsJylcclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9vdXRib3gvMScpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgdG86IHVpZCgndG9tJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBUb20hJ1xyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJOb3JtYWwgd3JpdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ3RvbScpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCd0b20nKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsISdcclxuICAgICAgfSlcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC5yZWFkKClcclxuICAgICAgLnN1Y2NlZWRzKFwiQ2FuIHJlYWQgb3duIGluYm94LlwiKVxyXG5cclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9vdXRib3gvMScpXHJcbiAgICAgIC5yZWFkKClcclxuICAgICAgLnN1Y2NlZWRzKFwiQ2FuIHJlYWQgb3duIG91dGJveC5cIilcclxuXHJcbiAgICAgIC5hcygndG9tJylcclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9pbmJveC8xJylcclxuICAgICAgLnJlYWQoKVxyXG4gICAgICAuZmFpbHMoXCJDYW4ndCByZWFkIEJpbGwncyBpbmJveC5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAucmVhZCgpXHJcbiAgICAgIC5mYWlscyhcIkNhbid0IHJlYWQgQmlsbHMgb3V0Ym94LlwiKTtcclxuICB9KTtcclxufSk7XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
