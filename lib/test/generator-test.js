"use strict";
var bolt = require('../bolt');
var parse = bolt.parse;
var generator = require('../rules-generator');
var ast = require('../ast');
var fileio = require('../file-io');
var logger = require('../logger');
var helper = require('./test-helper');
var chai = require('chai');
chai.config.truncateThreshold = 1000;
var assert = chai.assert;
suite("Rules Generator Tests", function () {
    suite("Basic Samples", function () {
        var tests = [
            { data: "path / {read() { true } write() { true }}",
                expect: { rules: { ".read": "true", ".write": "true" } }
            },
            { data: "path / { write() { true }}",
                expect: { rules: { ".write": "true" } }
            },
            { data: "path / { create() { true }}",
                expect: { rules: { ".write": "data.val() == null" } }
            },
            { data: "path / { update() { true }}",
                expect: { rules: { ".write": "data.val() != null && newData.val() != null" } }
            },
            { data: "path / { delete() { true }}",
                expect: { rules: { ".write": "data.val() != null && newData.val() == null" } }
            },
            { data: "path / {read() { true }}",
                expect: { rules: { ".read": "true" } }
            },
            { data: "path / { read() { false }}",
                expect: { rules: {} }
            },
            { data: "path / {index() { return ['a', 'b']; }}",
                expect: { rules: { ".indexOn": ["a", "b"] } }
            },
            { data: "path / { validate() { return this > 0; }}",
                expect: { rules: { ".validate": "newData.val() > 0" } }
            },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.ok(result);
            var gen = new bolt.Generator(result);
            var json = gen.generateRules();
            assert.deepEqual(json, expect);
        });
    });
    suite("Sample files", function () {
        var files = ["all_access",
            "userdoc",
            "mail",
            "type-extension",
            "children",
            "create-update-delete",
            "functional",
            "user-security",
            "generics",
            "groups",
            "multi-update",
            "chat",
            "serialized",
            "map-scalar",
            "regexp",
        ];
        helper.dataDrivenTest(files, function (filename) {
            filename = 'samples/' + filename + '.' + bolt.FILE_EXTENSION;
            return fileio.readFile(filename)
                .then(function (response) {
                var result = parse(response.content);
                assert.ok(result, response.url);
                var gen = new bolt.Generator(result);
                var json = gen.generateRules();
                assert.ok('rules' in json, response.url + " has rules");
                return fileio.readJSONFile(response.url.replace('.' + bolt.FILE_EXTENSION, '.json'))
                    .then(function (response2) {
                    assert.deepEqual(json, response2);
                });
            })
                .catch(function (error) {
                assert.ok(false, error.message);
            });
        });
    });
    suite("Partial evaluation", function () {
        var tests = [
            { f: "function f(a) { return true == a; }", x: "f(a == b)", expect: "true == (a == b)" },
            { f: "function f(a) { return a == true; }", x: "f(a == b)", expect: "a == b == true" },
            { f: "function f(a) { return a + 3; }", x: "f(1 + 2)", expect: "1 + 2 + 3" },
            { f: "function f(a) { return a + 3; }", x: "f(1 * 2)", expect: "1 * 2 + 3" },
            { f: "function f(a) { return a * 3; }", x: "f(1 + 2)", expect: "(1 + 2) * 3" },
            { f: "function f(a) { return a + 1; }", x: "f(a + a)", expect: "a + a + 1" },
            { f: "function f(a) { return g(a); } function g(a) { return a == true; }",
                x: "f(123)", expect: "123 == true" },
            { f: "function f(a, b) { return g(a) == g(b); } function g(a) { return a == true; }",
                x: "f(1, 2)", expect: "1 == true == (2 == true)" },
            { f: "function f() { return g; } function g(a) { return a == true; }",
                x: "f()(123)", expect: "123 == true" },
            { f: "function f(a) { return a + 1; }", x: "a[f(123)]", expect: "a[123 + 1]" },
            { f: "", x: "this", expect: "newData.val() == true" },
            { f: "", x: "!this", expect: "!(newData.val() == true)" },
            { f: "", x: "this.prop", expect: "newData.child('prop').val() == true" },
            { f: "", x: "!this.prop", expect: "!(newData.child('prop').val() == true)" },
            { f: "", x: "this.foo.parent()", expect: "newData.child('foo').parent().val() == true" },
            { f: "",
                x: "this.foo || this.bar",
                expect: "newData.child('foo').val() == true || newData.child('bar').val() == true" },
            { f: "function f(a) { return a == '123'; }", x: "f(this)", expect: "newData.val() == '123'" },
            { f: "function f(a) { return a == '123'; }",
                x: "f(this.foo)", expect: "newData.child('foo').val() == '123'" },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse(data.f + " path /x { write() { return " + data.x + "; }}");
            var gen = new bolt.Generator(symbols);
            var json = gen.generateRules();
            assert.equal(json['rules']['x']['.write'], expect);
        });
    });
    suite("String methods", function () {
        var tests = [
            { data: "this.length",
                expect: "newData.val().length" },
            { data: "this.length < 100",
                expect: "newData.val().length < 100" },
            { data: "'abc'.length",
                expect: "'abc'.length" },
            { data: "'abc'.includes('b')",
                expect: "'abc'.contains('b')" },
            { data: "this.includes('b')",
                expect: "newData.val().contains('b')" },
            { data: "'abc'.includes(this)",
                expect: "'abc'.contains(newData.val())" },
            { data: "'abc'.startsWith(this)",
                expect: "'abc'.beginsWith(newData.val())" },
            { data: "'abc'.endsWith(this)",
                expect: "'abc'.endsWith(newData.val())" },
            { data: "'abc'.replace(this.a, this.b)",
                expect: "'abc'.replace(newData.child('a').val(), newData.child('b').val())" },
            { data: "'ABC'.toLowerCase()",
                expect: "'ABC'.toLowerCase()" },
            { data: "'abc'.toUpperCase()",
                expect: "'abc'.toUpperCase()" },
            { data: "this.toUpperCase()",
                expect: "newData.val().toUpperCase()" },
            { data: "'ababa'.test(/bab/)",
                expect: "'ababa'.matches(/bab/)" },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse("path /x { write() { return " + data + "; }}");
            var gen = new bolt.Generator(symbols);
            var json = gen.generateRules();
            assert.equal(json['rules']['x']['.write'], expect);
        });
    });
    suite("Builtin validation functions", function () {
        var tests = [
            ['String', 'this.isString()'],
            ['Number', 'this.isNumber()'],
            ['Boolean', 'this.isBoolean()'],
            ['Object', 'this.hasChildren()'],
            ['Null', 'this == null'],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse("path / {}");
            var gen = new bolt.Generator(symbols);
            gen.ensureValidator(ast.typeType(data));
            var terms = gen.validators[data]['.validate'];
            var result = bolt.decodeExpression(ast.andArray(terms));
            assert.deepEqual(result, expect);
        });
    });
    suite("Schema Validation", function () {
        var tests = [
            { data: "type T {}",
                expect: undefined },
            { data: "type T extends Object {}",
                expect: { '.validate': "newData.hasChildren()" } },
            { data: "type T extends String {}",
                expect: { '.validate': "newData.isString()" } },
            { data: "type T extends String { validate() { return this.length > 0; } }",
                expect: { '.validate': "newData.isString() && newData.val().length > 0" } },
            { data: "type NonEmpty extends String { validate() { return this.length > 0; } } \
            type T { prop: NonEmpty }",
                expect: { '.validate': "newData.hasChildren(['prop'])",
                    prop: {
                        '.validate': 'newData.isString() && newData.val().length > 0'
                    },
                    '$other': { '.validate': "false" }
                } },
            { data: "type T {n: Number}",
                expect: { '.validate': "newData.hasChildren(['n'])",
                    n: { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {s: String}",
                expect: { '.validate': "newData.hasChildren(['s'])",
                    s: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {b: Boolean}",
                expect: { '.validate': "newData.hasChildren(['b'])",
                    b: { '.validate': "newData.isBoolean()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Object}",
                expect: { '.validate': "newData.hasChildren(['x'])",
                    x: { '.validate': "newData.hasChildren()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Number|String}",
                expect: { '.validate': "newData.hasChildren(['x'])",
                    x: { '.validate': "newData.isNumber() || newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T { $key: Number }",
                expect: { '.validate': "newData.hasChildren()",
                    '$key': { '.validate': "newData.isNumber()" } } },
            { data: "type T { 'a b': Number }",
                expect: { '.validate': "newData.hasChildren(['a b'])",
                    'a b': { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': 'false' } } },
            { data: "type T {a: Number, b: String}",
                expect: { '.validate': "newData.hasChildren(['a', 'b'])",
                    a: { '.validate': "newData.isNumber()" },
                    b: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Number|Null}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '.validate': "newData.isNumber() || newData.val() == null" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {n: Number, validate() {return this.n < 7;}}",
                expect: { '.validate': "newData.hasChildren(['n']) && newData.child('n').val() < 7",
                    n: { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type Bigger extends Number {validate() { return this > prior(this); }}" +
                    "type T { ts: Bigger }",
                expect: { '.validate': "newData.hasChildren(['ts'])",
                    ts: { '.validate': "newData.isNumber() && newData.val() > data.val()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {a: String, b: String, c: String}",
                expect: { '.validate': "newData.hasChildren(['a', 'b', 'c'])",
                    a: { '.validate': "newData.isString()" },
                    b: { '.validate': "newData.isString()" },
                    c: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type B { foo: Number } type T extends B { bar: String }",
                expect: { '.validate': "newData.hasChildren(['foo', 'bar'])",
                    foo: { '.validate': "newData.isNumber()" },
                    bar: { '.validate': "newData.isString()" },
                    '$other': { '.validate': "false" } } },
            { data: "type T {n: Number, x: Map<String, Number>}",
                expect: { '.validate': "newData.hasChildren(['n'])",
                    n: { '.validate': "newData.isNumber()" },
                    x: { '$key1': { '.validate': "newData.isNumber()" } },
                    '$other': { '.validate': "false" } } },
            { data: "type T {x: Map<String, Number>}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '$key1': { '.validate': "newData.isNumber()" } },
                    '$other': { '.validate': "false" } } },
            { data: "type SmallString extends String { validate() { this.length < 32 } } " +
                    "type T {x: Map<SmallString, Number>}",
                expect: { '.validate': "newData.hasChildren()",
                    x: { '$key1': { '.validate': "$key1.length < 32 && newData.isNumber()" } },
                    '$other': { '.validate': "false" } } },
            { data: "type M extends Map<String, Number>; type T { x: M }",
                expect: { '.validate': "newData.hasChildren()",
                    '$other': { '.validate': "false" },
                    'x': { '$key1': { '.validate': "newData.isNumber()" } } } },
            { data: "type Pair<X, Y> { first: X, second: Y } type T extends Pair<String, Number>;",
                expect: { '.validate': "newData.hasChildren(['first', 'second'])",
                    'first': { '.validate': "newData.isString()" },
                    'second': { '.validate': "newData.isNumber()" },
                    '$other': { '.validate': "false" } } },
            { data: "type X { a: Number, validate() { this.a == key() } } type T extends X[];",
                expect: { '$key1': { '.validate': "newData.hasChildren(['a']) && newData.child('a').val() == $key1",
                        'a': { '.validate': "newData.isNumber()" },
                        '$other': { '.validate': "false" } }
                } },
            { data: "type X { a: Number, validate() { this.a == key() } } type T { x: X }",
                expect: { 'x': { '.validate': "newData.hasChildren(['a']) && newData.child('a').val() == 'x'",
                        'a': { '.validate': "newData.isNumber()" },
                        '$other': { '.validate': "false" } },
                    '$other': { '.validate': "false" },
                    '.validate': "newData.hasChildren(['x'])"
                } },
            { data: "type T extends String { validate() { root == 'new' && prior(root) == 'old' } }" +
                    "path /t/x is Any { read() { root == 'old' } }",
                expect: { '.validate': "newData.isString() && newData.parent().val() == 'new' && root.val() == 'old'",
                    'x': { '.read': "root.val() == 'old'" }
                } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var symbols = parse(data + " path /t is T;");
            var gen = new bolt.Generator(symbols);
            var rules = gen.generateRules();
            if (expect === undefined) {
                assert.deepEqual(rules, { "rules": {} });
            }
            else {
                assert.deepEqual(rules, { "rules": { t: expect } });
            }
        });
    });
    suite("extendValidator", function () {
        var tests = [
            { data: { target: {}, src: {} },
                expect: {} },
            { data: { target: {}, src: { '.x': [1] } },
                expect: { '.x': [1] } },
            { data: { target: { '.x': [1] }, src: { '.x': [2] } },
                expect: { '.x': [1, 2] } },
            { data: { target: { '.x': [1] }, src: { '.x': [2], c: { '.x': [3] } } },
                expect: { '.x': [1, 2], c: { '.x': [3] } } },
            { data: { target: { '.x': [1], c: { '.x': [2] } }, src: { c: { '.x': [3] } } },
                expect: { '.x': [1], c: { '.x': [2, 3] } } },
            { data: { target: {}, src: { a: { b: { c: { d: { '.x': [1], e: { '.x': [2] } } } } } } },
                expect: { a: { b: { c: { d: { '.x': [1], e: { '.x': [2] } } } } } } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            generator.extendValidator(data.target, data.src);
            assert.deepEqual(data.target, expect);
        });
    });
    suite("mapValidator", function () {
        var tests = [
            { data: { '.x': 'a' }, expect: { '.x': 'a+' } },
            { data: { '.x': 'b' }, expect: {} },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            generator.mapValidator(data, function (value, prop) {
                if (value === 'b') {
                    return undefined;
                }
                return value + '+';
            });
            assert.deepEqual(data, expect);
        });
    });
    suite("Schema Generation Errors", function () {
        var tests = [
            { data: "",
                expect: /at least one path/ },
            { data: "type Simple extends String {a: String} path /x is Simple;",
                expect: /properties.*extend/ },
            { data: "path /y { index() { return 1; }}",
                expect: /index.*string/i },
            { data: "path /x { write() { return undefinedFunc(); }}",
                expect: /undefined.*function/i },
            { data: "path /x is NoSuchType {}",
                expect: /No type.*NoSuchType/ },
            { data: "path /x { unsupported() { true } }",
                warn: /unsupported method/i },
            { data: "path /x { validate() { return this.test(123); } }",
                expect: /convert value/i },
            { data: "path /x { validate() { return this.test('a/'); } }",
                expect: /convert value/i },
            { data: "path /x { validate() { return this.test('/a/'); } }",
                expect: /convert value/i },
            { data: "function f(a) { return f(a); } path / { validate() { return f(1); }}",
                expect: /recursive/i },
            { data: "type X { $n: Number, $s: String } path / is X;",
                expect: /wild property/ },
            { data: "type X { $$n: Number } path / is X;",
                expect: /property names/i },
            { data: "type X { '\x01': Number } path / is X;",
                expect: /property names/i },
            { data: "path / is Map;",
                expect: /No type.*non-generic/ },
            { data: "type Pair<X, Y> {a: X, b: Y} path / is Pair;",
                expect: /No type.*non-generic/ },
            { data: "path / is String<Number>;",
                expect: /No type.*generic/ },
            { data: "path / is Map<Object, Number>;",
                expect: /must derive from String/ },
            { data: "path / { write() { true } create() { true } }",
                expect: /write-aliasing.*create/i },
            { data: "path / { write() { true } update() { true } }",
                expect: /write-aliasing.*update/i },
            { data: "path / { write() { true } delete() { true } }",
                expect: /write-aliasing.*delete/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect, t) {
            logger.reset();
            logger.silent();
            var symbols = parse(data);
            var gen = new bolt.Generator(symbols);
            var lastError;
            try {
                gen.generateRules();
            }
            catch (e) {
                if (!expect) {
                    throw e;
                }
                lastError = logger.getLastMessage() || e.message;
                assert.match(lastError, expect);
                return;
            }
            if (expect) {
                assert.fail(undefined, undefined, "No exception thrown.");
            }
            if (t.warn) {
                assert.match(logger.getLastMessage(), t.warn);
            }
        });
    });
});

//# sourceMappingURL=data:application/json;base64,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Q0FBQyxDQUFDLENBQUMsRUFBQyxFQUFFLEdBQUcsRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFDLEVBQUM7Z0JBQzdDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBQyxFQUFFO1lBQzFCLEVBQUUsSUFBSSxFQUFFLEVBQUMsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBRSxHQUFHLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUM7Z0JBQzdELE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUU7WUFDMUMsRUFBRSxJQUFJLEVBQUUsRUFBQyxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBQyxFQUFDLEVBQUUsR0FBRyxFQUFFLEVBQUMsQ0FBQyxFQUFFLEVBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFDO2dCQUNsRSxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUMsRUFBQyxFQUFFO1lBQzFDLEVBQUUsSUFBSSxFQUFFLEVBQUMsTUFBTSxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsRUFBQyxDQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUUsRUFBQyxDQUFDLEVBQUUsRUFBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxD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QUFHLE1BQU0sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLENBQUMsT0FBTyxDQUFDO2dCQUNqRCxNQUFNLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztnQkFDaEMsTUFBTSxDQUFDO1lBQ1QsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0JBQ1gsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsU0FBUyxFQUFFLHNCQUFzQixDQUFDLENBQUM7WUFDNUQsQ0FBQztZQUNELEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNYLE1BQU0sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLGNBQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvZ2VuZXJhdG9yLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL25vZGUuZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL21vY2hhLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9jaGFpLmQudHNcIiAvPlxyXG5cclxuaW1wb3J0IGJvbHQgPSByZXF1aXJlKCcuLi9ib2x0Jyk7XHJcbnZhciBwYXJzZSA9IGJvbHQucGFyc2U7XHJcbmltcG9ydCBnZW5lcmF0b3IgPSByZXF1aXJlKCcuLi9ydWxlcy1nZW5lcmF0b3InKTtcclxuaW1wb3J0IGFzdCA9IHJlcXVpcmUoJy4uL2FzdCcpO1xyXG5pbXBvcnQgZmlsZWlvID0gcmVxdWlyZSgnLi4vZmlsZS1pbycpO1xyXG5pbXBvcnQgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XHJcbmltcG9ydCBoZWxwZXIgPSByZXF1aXJlKCcuL3Rlc3QtaGVscGVyJyk7XHJcblxyXG5pbXBvcnQgY2hhaSA9IHJlcXVpcmUoJ2NoYWknKTtcclxuY2hhaS5jb25maWcudHJ1bmNhdGVUaHJlc2hvbGQgPSAxMDAwO1xyXG52YXIgYXNzZXJ0ID0gY2hhaS5hc3NlcnQ7XHJcblxyXG4vLyBUT0RPOiBUZXN0IGR1cGxpY2F0ZWQgZnVuY3Rpb24sIGFuZCBzY2hlbWEgZGVmaW5pdGlvbnMuXHJcbi8vIFRPRE86IFRlc3Qgb3RoZXIgcGFyc2VyIGVycm9ycyAtIGFwcHJvcHJpYXRlIG1lc3NhZ2VzIChleGNlcHRpb25zKS5cclxuXHJcbnN1aXRlKFwiUnVsZXMgR2VuZXJhdG9yIFRlc3RzXCIsIGZ1bmN0aW9uKCkge1xyXG4gIHN1aXRlKFwiQmFzaWMgU2FtcGxlc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7cmVhZCgpIHsgdHJ1ZSB9IHdyaXRlKCkgeyB0cnVlIH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7XCIucmVhZFwiOiBcInRydWVcIiwgXCIud3JpdGVcIjogXCJ0cnVlXCJ9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHdyaXRlKCkgeyB0cnVlIH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7XCIud3JpdGVcIjogXCJ0cnVlXCJ9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IGNyZWF0ZSgpIHsgdHJ1ZSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLndyaXRlXCI6IFwiZGF0YS52YWwoKSA9PSBudWxsXCJ9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHVwZGF0ZSgpIHsgdHJ1ZSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLndyaXRlXCI6IFwiZGF0YS52YWwoKSAhPSBudWxsICYmIG5ld0RhdGEudmFsKCkgIT0gbnVsbFwifSB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyBkZWxldGUoKSB7IHRydWUgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgcnVsZXM6IHtcIi53cml0ZVwiOiBcImRhdGEudmFsKCkgIT0gbnVsbCAmJiBuZXdEYXRhLnZhbCgpID09IG51bGxcIn0gfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIHtyZWFkKCkgeyB0cnVlIH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7XCIucmVhZFwiOiBcInRydWVcIn0gfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIHsgcmVhZCgpIHsgZmFsc2UgfX1cIixcclxuICAgICAgICBleHBlY3Q6IHsgcnVsZXM6IHt9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7aW5kZXgoKSB7IHJldHVybiBbJ2EnLCAnYiddOyB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBydWxlczoge1wiLmluZGV4T25cIjogW1wiYVwiLCBcImJcIl19IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcyA+IDA7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IHJ1bGVzOiB7IFwiLnZhbGlkYXRlXCI6IFwibmV3RGF0YS52YWwoKSA+IDBcIiB9IH1cclxuICAgICAgfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBhc3NlcnQub2socmVzdWx0KTtcclxuICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihyZXN1bHQpO1xyXG4gICAgICB2YXIganNvbiA9IGdlbi5nZW5lcmF0ZVJ1bGVzKCk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwoanNvbiwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlNhbXBsZSBmaWxlc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmaWxlcyA9IFtcImFsbF9hY2Nlc3NcIixcclxuICAgICAgICAgICAgICAgICBcInVzZXJkb2NcIixcclxuICAgICAgICAgICAgICAgICBcIm1haWxcIixcclxuICAgICAgICAgICAgICAgICBcInR5cGUtZXh0ZW5zaW9uXCIsXHJcbiAgICAgICAgICAgICAgICAgXCJjaGlsZHJlblwiLFxyXG4gICAgICAgICAgICAgICAgIFwiY3JlYXRlLXVwZGF0ZS1kZWxldGVcIixcclxuICAgICAgICAgICAgICAgICBcImZ1bmN0aW9uYWxcIixcclxuICAgICAgICAgICAgICAgICBcInVzZXItc2VjdXJpdHlcIixcclxuICAgICAgICAgICAgICAgICBcImdlbmVyaWNzXCIsXHJcbiAgICAgICAgICAgICAgICAgXCJncm91cHNcIixcclxuICAgICAgICAgICAgICAgICBcIm11bHRpLXVwZGF0ZVwiLFxyXG4gICAgICAgICAgICAgICAgIFwiY2hhdFwiLFxyXG4gICAgICAgICAgICAgICAgIFwic2VyaWFsaXplZFwiLFxyXG4gICAgICAgICAgICAgICAgIFwibWFwLXNjYWxhclwiLFxyXG4gICAgICAgICAgICAgICAgIFwicmVnZXhwXCIsXHJcbiAgICAgICAgICAgICAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdChmaWxlcywgZnVuY3Rpb24oZmlsZW5hbWUpIHtcclxuICAgICAgZmlsZW5hbWUgPSAnc2FtcGxlcy8nICsgZmlsZW5hbWUgKyAnLicgKyBib2x0LkZJTEVfRVhURU5TSU9OO1xyXG4gICAgICByZXR1cm4gZmlsZWlvLnJlYWRGaWxlKGZpbGVuYW1lKVxyXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gcGFyc2UocmVzcG9uc2UuY29udGVudCk7XHJcbiAgICAgICAgICBhc3NlcnQub2socmVzdWx0LCByZXNwb25zZS51cmwpO1xyXG4gICAgICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihyZXN1bHQpO1xyXG4gICAgICAgICAgdmFyIGpzb24gPSBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICAgICAgYXNzZXJ0Lm9rKCdydWxlcycgaW4ganNvbiwgcmVzcG9uc2UudXJsICsgXCIgaGFzIHJ1bGVzXCIpO1xyXG4gICAgICAgICAgcmV0dXJuIGZpbGVpby5yZWFkSlNPTkZpbGUocmVzcG9uc2UudXJsLnJlcGxhY2UoJy4nICsgYm9sdC5GSUxFX0VYVEVOU0lPTiwgJy5qc29uJykpXHJcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlMikge1xyXG4gICAgICAgICAgICAgIGFzc2VydC5kZWVwRXF1YWwoanNvbiwgcmVzcG9uc2UyKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgICAgIGFzc2VydC5vayhmYWxzZSwgZXJyb3IubWVzc2FnZSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJQYXJ0aWFsIGV2YWx1YXRpb25cIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIHRydWUgPT0gYTsgfVwiLCB4OiBcImYoYSA9PSBiKVwiLCBleHBlY3Q6IFwidHJ1ZSA9PSAoYSA9PSBiKVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgPT0gdHJ1ZTsgfVwiLCB4OiBcImYoYSA9PSBiKVwiLCBleHBlY3Q6IFwiYSA9PSBiID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMzsgfVwiLCB4OiBcImYoMSArIDIpXCIsIGV4cGVjdDogXCIxICsgMiArIDNcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMzsgfVwiLCB4OiBcImYoMSAqIDIpXCIsIGV4cGVjdDogXCIxICogMiArIDNcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICogMzsgfVwiLCB4OiBcImYoMSArIDIpXCIsIGV4cGVjdDogXCIoMSArIDIpICogM1wiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgKyAxOyB9XCIsIHg6IFwiZihhICsgYSlcIiwgZXhwZWN0OiBcImEgKyBhICsgMVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGcoYSk7IH0gZnVuY3Rpb24gZyhhKSB7IHJldHVybiBhID09IHRydWU7IH1cIixcclxuICAgICAgICB4OiBcImYoMTIzKVwiLCBleHBlY3Q6IFwiMTIzID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhLCBiKSB7IHJldHVybiBnKGEpID09IGcoYik7IH0gZnVuY3Rpb24gZyhhKSB7IHJldHVybiBhID09IHRydWU7IH1cIixcclxuICAgICAgICB4OiBcImYoMSwgMilcIiwgZXhwZWN0OiBcIjEgPT0gdHJ1ZSA9PSAoMiA9PSB0cnVlKVwiIH0sXHJcbiAgICAgIC8vIEhpZ2hsZXIgbGV2ZWwgZnVuY3Rpb24gd29ya3MgYXMgbG9uZyBhcyByZXR1cm5zIGEgY29uc3RhbnQgZnVuY3Rpb25cclxuICAgICAgeyBmOiBcImZ1bmN0aW9uIGYoKSB7IHJldHVybiBnOyB9IGZ1bmN0aW9uIGcoYSkgeyByZXR1cm4gYSA9PSB0cnVlOyB9XCIsXHJcbiAgICAgICAgeDogXCJmKCkoMTIzKVwiLCBleHBlY3Q6IFwiMTIzID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiZnVuY3Rpb24gZihhKSB7IHJldHVybiBhICsgMTsgfVwiLCB4OiBcImFbZigxMjMpXVwiLCBleHBlY3Q6IFwiYVsxMjMgKyAxXVwiIH0sXHJcbiAgICAgIHsgZjogXCJcIiwgeDogXCJ0aGlzXCIsIGV4cGVjdDogXCJuZXdEYXRhLnZhbCgpID09IHRydWVcIiB9LFxyXG4gICAgICB7IGY6IFwiXCIsIHg6IFwiIXRoaXNcIiwgZXhwZWN0OiBcIiEobmV3RGF0YS52YWwoKSA9PSB0cnVlKVwiIH0sXHJcbiAgICAgIHsgZjogXCJcIiwgeDogXCJ0aGlzLnByb3BcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ3Byb3AnKS52YWwoKSA9PSB0cnVlXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLCB4OiBcIiF0aGlzLnByb3BcIiwgZXhwZWN0OiBcIiEobmV3RGF0YS5jaGlsZCgncHJvcCcpLnZhbCgpID09IHRydWUpXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLCB4OiBcInRoaXMuZm9vLnBhcmVudCgpXCIsIGV4cGVjdDogXCJuZXdEYXRhLmNoaWxkKCdmb28nKS5wYXJlbnQoKS52YWwoKSA9PSB0cnVlXCIgfSxcclxuICAgICAgeyBmOiBcIlwiLFxyXG4gICAgICAgIHg6IFwidGhpcy5mb28gfHwgdGhpcy5iYXJcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS5jaGlsZCgnZm9vJykudmFsKCkgPT0gdHJ1ZSB8fCBuZXdEYXRhLmNoaWxkKCdiYXInKS52YWwoKSA9PSB0cnVlXCJ9LFxyXG4gICAgICAvLyBUT0RPOiBEb24ndCBzdXBwb3J0IHNuYXBzaG90IGZ1bmN0aW9ucyBiZXlvbmQgcGFyZW50LlxyXG4gICAgICAvLyBUT0RPOiBTaG91bGQgd2FybiB1c2VyIG5vdCB0byB1c2UgRmlyZWJhc2UgYnVpbHRpbnMhXHJcbiAgICAgIC8vIHsgZjogXCJcIiwgeDogXCJ0aGlzLmlzU3RyaW5nKClcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ2lzU3RyaW5nJykudmFsKCkgPT0gdHJ1ZVwiIH0sXHJcbiAgICAgIHsgZjogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGEgPT0gJzEyMyc7IH1cIiwgeDogXCJmKHRoaXMpXCIsIGV4cGVjdDogXCJuZXdEYXRhLnZhbCgpID09ICcxMjMnXCIgfSxcclxuICAgICAgeyBmOiBcImZ1bmN0aW9uIGYoYSkgeyByZXR1cm4gYSA9PSAnMTIzJzsgfVwiLFxyXG4gICAgICAgIHg6IFwiZih0aGlzLmZvbylcIiwgZXhwZWN0OiBcIm5ld0RhdGEuY2hpbGQoJ2ZvbycpLnZhbCgpID09ICcxMjMnXCIgfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHN5bWJvbHMgPSBwYXJzZShkYXRhLmYgKyBcIiBwYXRoIC94IHsgd3JpdGUoKSB7IHJldHVybiBcIiArIGRhdGEueCArIFwiOyB9fVwiKTtcclxuICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihzeW1ib2xzKTtcclxuICAgICAgLy8gTWFrZSBzdXJlIGxvY2FsIFNjaGVtYSBpbml0aWFsaXplZC5cclxuICAgICAgdmFyIGpzb24gPSBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICBhc3NlcnQuZXF1YWwoanNvblsncnVsZXMnXVsneCddWycud3JpdGUnXSwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlN0cmluZyBtZXRob2RzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwidGhpcy5sZW5ndGhcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS5sZW5ndGhcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwidGhpcy5sZW5ndGggPCAxMDBcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS5sZW5ndGggPCAxMDBcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycubGVuZ3RoXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmxlbmd0aFwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5pbmNsdWRlcygnYicpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmNvbnRhaW5zKCdiJylcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwidGhpcy5pbmNsdWRlcygnYicpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIm5ld0RhdGEudmFsKCkuY29udGFpbnMoJ2InKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5pbmNsdWRlcyh0aGlzKVwiLFxyXG4gICAgICAgIGV4cGVjdDogXCInYWJjJy5jb250YWlucyhuZXdEYXRhLnZhbCgpKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCInYWJjJy5zdGFydHNXaXRoKHRoaXMpXCIsXHJcbiAgICAgICAgZXhwZWN0OiBcIidhYmMnLmJlZ2luc1dpdGgobmV3RGF0YS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycuZW5kc1dpdGgodGhpcylcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycuZW5kc1dpdGgobmV3RGF0YS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ2FiYycucmVwbGFjZSh0aGlzLmEsIHRoaXMuYilcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycucmVwbGFjZShuZXdEYXRhLmNoaWxkKCdhJykudmFsKCksIG5ld0RhdGEuY2hpbGQoJ2InKS52YWwoKSlcIiB9LFxyXG4gICAgICB7IGRhdGE6IFwiJ0FCQycudG9Mb3dlckNhc2UoKVwiLFxyXG4gICAgICAgIGV4cGVjdDogXCInQUJDJy50b0xvd2VyQ2FzZSgpXCIgfSxcclxuICAgICAgeyBkYXRhOiBcIidhYmMnLnRvVXBwZXJDYXNlKClcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYycudG9VcHBlckNhc2UoKVwiIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0aGlzLnRvVXBwZXJDYXNlKClcIixcclxuICAgICAgICBleHBlY3Q6IFwibmV3RGF0YS52YWwoKS50b1VwcGVyQ2FzZSgpXCIgfSxcclxuICAgICAgeyBkYXRhOiBcIidhYmFiYScudGVzdCgvYmFiLylcIixcclxuICAgICAgICBleHBlY3Q6IFwiJ2FiYWJhJy5tYXRjaGVzKC9iYWIvKVwiIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciBzeW1ib2xzID0gcGFyc2UoXCJwYXRoIC94IHsgd3JpdGUoKSB7IHJldHVybiBcIiArIGRhdGEgKyBcIjsgfX1cIik7XHJcbiAgICAgIHZhciBnZW4gPSBuZXcgYm9sdC5HZW5lcmF0b3Ioc3ltYm9scyk7XHJcbiAgICAgIC8vIE1ha2Ugc3VyZSBsb2NhbCBTY2hlbWEgaW5pdGlhbGl6ZWQuXHJcbiAgICAgIHZhciBqc29uID0gZ2VuLmdlbmVyYXRlUnVsZXMoKTtcclxuICAgICAgYXNzZXJ0LmVxdWFsKGpzb25bJ3J1bGVzJ11bJ3gnXVsnLndyaXRlJ10sIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJCdWlsdGluIHZhbGlkYXRpb24gZnVuY3Rpb25zXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBbICdTdHJpbmcnLCAndGhpcy5pc1N0cmluZygpJ10sXHJcbiAgICAgIFsgJ051bWJlcicsICd0aGlzLmlzTnVtYmVyKCknXSxcclxuICAgICAgWyAnQm9vbGVhbicsICd0aGlzLmlzQm9vbGVhbigpJ10sXHJcbiAgICAgIFsgJ09iamVjdCcsICd0aGlzLmhhc0NoaWxkcmVuKCknXSxcclxuICAgICAgWyAnTnVsbCcsICd0aGlzID09IG51bGwnXSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHN5bWJvbHMgPSBwYXJzZShcInBhdGggLyB7fVwiKTtcclxuICAgICAgdmFyIGdlbiA9IG5ldyBib2x0LkdlbmVyYXRvcihzeW1ib2xzKTtcclxuICAgICAgZ2VuLmVuc3VyZVZhbGlkYXRvcihhc3QudHlwZVR5cGUoZGF0YSkpO1xyXG5cclxuICAgICAgdmFyIHRlcm1zID0gPGFzdC5FeHBbXT4gZ2VuLnZhbGlkYXRvcnNbZGF0YV1bJy52YWxpZGF0ZSddO1xyXG4gICAgICB2YXIgcmVzdWx0ID0gYm9sdC5kZWNvZGVFeHByZXNzaW9uKGFzdC5hbmRBcnJheSh0ZXJtcykpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdCwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlNjaGVtYSBWYWxpZGF0aW9uXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB1bmRlZmluZWQgfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCBleHRlbmRzIE9iamVjdCB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwifSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIGV4dGVuZHMgU3RyaW5nIHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpXCJ9IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQgZXh0ZW5kcyBTdHJpbmcgeyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMubGVuZ3RoID4gMDsgfSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpICYmIG5ld0RhdGEudmFsKCkubGVuZ3RoID4gMFwifSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBOb25FbXB0eSBleHRlbmRzIFN0cmluZyB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcy5sZW5ndGggPiAwOyB9IH0gXFxcclxuICAgICAgICAgICAgdHlwZSBUIHsgcHJvcDogTm9uRW1wdHkgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWydwcm9wJ10pXCIsXHJcbiAgICAgICAgICAgICAgICAgcHJvcDoge1xyXG4gICAgICAgICAgICAgICAgICAgJy52YWxpZGF0ZSc6ICduZXdEYXRhLmlzU3RyaW5nKCkgJiYgbmV3RGF0YS52YWwoKS5sZW5ndGggPiAwJ1xyXG4gICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifVxyXG4gICAgICAgICAgICAgICAgfSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHtuOiBOdW1iZXJ9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ24nXSlcIixcclxuICAgICAgICAgICAgICAgICBuOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQge3M6IFN0cmluZ31cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsncyddKVwiLFxyXG4gICAgICAgICAgICAgICAgIHM6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7YjogQm9vbGVhbn1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsnYiddKVwiLFxyXG4gICAgICAgICAgICAgICAgIGI6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzQm9vbGVhbigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQge3g6IE9iamVjdH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsneCddKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7eDogTnVtYmVyfFN0cmluZ31cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsneCddKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKCkgfHwgbmV3RGF0YS5pc1N0cmluZygpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHsgJGtleTogTnVtYmVyIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIixcclxuICAgICAgICAgICAgICAgICAnJGtleSc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn19IH0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHsgJ2EgYic6IE51bWJlciB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2EgYiddKVwiLFxyXG4gICAgICAgICAgICAgICAgICdhIGInOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6ICdmYWxzZSd9fSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInR5cGUgVCB7YTogTnVtYmVyLCBiOiBTdHJpbmd9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2EnLCAnYiddKVwiLFxyXG4gICAgICAgICAgICAgICAgIGE6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgYjogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHt4OiBOdW1iZXJ8TnVsbH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIixcclxuICAgICAgICAgICAgICAgICB4OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpIHx8IG5ld0RhdGEudmFsKCkgPT0gbnVsbFwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHtuOiBOdW1iZXIsIHZhbGlkYXRlKCkge3JldHVybiB0aGlzLm4gPCA3O319XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ24nXSkgJiYgbmV3RGF0YS5jaGlsZCgnbicpLnZhbCgpIDwgN1wiLFxyXG4gICAgICAgICAgICAgICAgIG46IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgQmlnZ2VyIGV4dGVuZHMgTnVtYmVyIHt2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMgPiBwcmlvcih0aGlzKTsgfX1cIiArXHJcbiAgICAgICAgXCJ0eXBlIFQgeyB0czogQmlnZ2VyIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKFsndHMnXSlcIixcclxuICAgICAgICAgICAgICAgICB0czogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKSAmJiBuZXdEYXRhLnZhbCgpID4gZGF0YS52YWwoKVwifSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHthOiBTdHJpbmcsIGI6IFN0cmluZywgYzogU3RyaW5nfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWydhJywgJ2InLCAnYyddKVwiLFxyXG4gICAgICAgICAgICAgICAgIGE6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgYjogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNTdHJpbmcoKVwifSxcclxuICAgICAgICAgICAgICAgICBjOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEIgeyBmb286IE51bWJlciB9IHR5cGUgVCBleHRlbmRzIEIgeyBiYXI6IFN0cmluZyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2ZvbycsICdiYXInXSlcIixcclxuICAgICAgICAgICAgICAgICBmb286IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgYmFyOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc1N0cmluZygpXCJ9LFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn19IH0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHtuOiBOdW1iZXIsIHg6IE1hcDxTdHJpbmcsIE51bWJlcj59XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ24nXSlcIixcclxuICAgICAgICAgICAgICAgICBuOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9LFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnJGtleTEnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9fSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBUIHt4OiBNYXA8U3RyaW5nLCBOdW1iZXI+fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgIHg6IHsnJGtleTEnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5pc051bWJlcigpXCJ9fSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBTbWFsbFN0cmluZyBleHRlbmRzIFN0cmluZyB7IHZhbGlkYXRlKCkgeyB0aGlzLmxlbmd0aCA8IDMyIH0gfSBcIiArXHJcbiAgICAgICAgICAgICAgXCJ0eXBlIFQge3g6IE1hcDxTbWFsbFN0cmluZywgTnVtYmVyPn1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmhhc0NoaWxkcmVuKClcIixcclxuICAgICAgICAgICAgICAgICB4OiB7JyRrZXkxJzogeycudmFsaWRhdGUnOiBcIiRrZXkxLmxlbmd0aCA8IDMyICYmIG5ld0RhdGEuaXNOdW1iZXIoKVwifX0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgTSBleHRlbmRzIE1hcDxTdHJpbmcsIE51bWJlcj47IHR5cGUgVCB7IHg6IE0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oKVwiLFxyXG4gICAgICAgICAgICAgICAgICckb3RoZXInOiB7Jy52YWxpZGF0ZSc6IFwiZmFsc2VcIn0sXHJcbiAgICAgICAgICAgICAgICAgJ3gnOiB7JyRrZXkxJzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifX19IH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFBhaXI8WCwgWT4geyBmaXJzdDogWCwgc2Vjb25kOiBZIH0gdHlwZSBUIGV4dGVuZHMgUGFpcjxTdHJpbmcsIE51bWJlcj47XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2ZpcnN0JywgJ3NlY29uZCddKVwiLFxyXG4gICAgICAgICAgICAgICAgICdmaXJzdCc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJ3NlY29uZCc6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzTnVtYmVyKClcIn0sXHJcbiAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX0gfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFggeyBhOiBOdW1iZXIsIHZhbGlkYXRlKCkgeyB0aGlzLmEgPT0ga2V5KCkgfSB9IHR5cGUgVCBleHRlbmRzIFhbXTtcIixcclxuICAgICAgICBleHBlY3Q6IHsnJGtleTEnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2EnXSkgJiYgbmV3RGF0YS5jaGlsZCgnYScpLnZhbCgpID09ICRrZXkxXCIsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICdhJzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgJyRvdGhlcic6IHsnLnZhbGlkYXRlJzogXCJmYWxzZVwifX1cclxuICAgICAgICAgICAgICAgIH0gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgWCB7IGE6IE51bWJlciwgdmFsaWRhdGUoKSB7IHRoaXMuYSA9PSBrZXkoKSB9IH0gdHlwZSBUIHsgeDogWCB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7J3gnOiB7Jy52YWxpZGF0ZSc6IFwibmV3RGF0YS5oYXNDaGlsZHJlbihbJ2EnXSkgJiYgbmV3RGF0YS5jaGlsZCgnYScpLnZhbCgpID09ICd4J1wiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICdhJzogeycudmFsaWRhdGUnOiBcIm5ld0RhdGEuaXNOdW1iZXIoKVwifSxcclxuICAgICAgICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9fSxcclxuICAgICAgICAgICAgICAgICAnJG90aGVyJzogeycudmFsaWRhdGUnOiBcImZhbHNlXCJ9LFxyXG4gICAgICAgICAgICAgICAgICcudmFsaWRhdGUnOiBcIm5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4J10pXCJcclxuICAgICAgICAgICAgICAgIH0gfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFQgZXh0ZW5kcyBTdHJpbmcgeyB2YWxpZGF0ZSgpIHsgcm9vdCA9PSAnbmV3JyAmJiBwcmlvcihyb290KSA9PSAnb2xkJyB9IH1cIiArXHJcbiAgICAgICAgICAgICAgXCJwYXRoIC90L3ggaXMgQW55IHsgcmVhZCgpIHsgcm9vdCA9PSAnb2xkJyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsnLnZhbGlkYXRlJzogXCJuZXdEYXRhLmlzU3RyaW5nKCkgJiYgbmV3RGF0YS5wYXJlbnQoKS52YWwoKSA9PSAnbmV3JyAmJiByb290LnZhbCgpID09ICdvbGQnXCIsXHJcbiAgICAgICAgICAgICAgICAgJ3gnOiB7Jy5yZWFkJzogXCJyb290LnZhbCgpID09ICdvbGQnXCJ9XHJcbiAgICAgICAgICAgICAgICB9IH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciBzeW1ib2xzID0gcGFyc2UoZGF0YSArIFwiIHBhdGggL3QgaXMgVDtcIik7XHJcbiAgICAgIHZhciBnZW4gPSBuZXcgYm9sdC5HZW5lcmF0b3Ioc3ltYm9scyk7XHJcbiAgICAgIHZhciBydWxlcyA9IGdlbi5nZW5lcmF0ZVJ1bGVzKCk7XHJcbiAgICAgIGlmIChleHBlY3QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgIGFzc2VydC5kZWVwRXF1YWwocnVsZXMsIHtcInJ1bGVzXCI6IHt9fSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYXNzZXJ0LmRlZXBFcXVhbChydWxlcywge1wicnVsZXNcIjoge3Q6IGV4cGVjdH19KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiZXh0ZW5kVmFsaWRhdG9yXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IHt0YXJnZXQ6IHt9LCBzcmM6IHt9fSxcclxuICAgICAgICBleHBlY3Q6IHt9IH0sXHJcbiAgICAgIHsgZGF0YToge3RhcmdldDoge30sIHNyYzogeycueCc6IFsxXX19LFxyXG4gICAgICAgIGV4cGVjdDogeycueCc6IFsxXX0gfSxcclxuICAgICAgeyBkYXRhOiB7dGFyZ2V0OiB7Jy54JzogWzFdfSwgc3JjOiB7Jy54JzogWzJdfX0sXHJcbiAgICAgICAgZXhwZWN0OiB7Jy54JzogWzEsIDJdfSB9LFxyXG4gICAgICB7IGRhdGE6IHt0YXJnZXQ6IHsnLngnOiBbMV19LCBzcmM6IHsnLngnOiBbMl0sIGM6IHsnLngnOiBbM119fX0sXHJcbiAgICAgICAgZXhwZWN0OiB7Jy54JzogWzEsIDJdLCBjOiB7Jy54JzogWzNdfX0gfSxcclxuICAgICAgeyBkYXRhOiB7dGFyZ2V0OiB7Jy54JzogWzFdLCBjOiB7Jy54JzogWzJdfX0sIHNyYzoge2M6IHsnLngnOiBbM119fX0sXHJcbiAgICAgICAgZXhwZWN0OiB7Jy54JzogWzFdLCBjOiB7Jy54JzogWzIsIDNdfX0gfSxcclxuICAgICAgeyBkYXRhOiB7dGFyZ2V0OiB7fSwgc3JjOiB7YToge2I6IHtjOiB7ZDogeycueCc6IFsxXSwgZTogeycueCc6IFsyXX19fX19fX0sXHJcbiAgICAgICAgZXhwZWN0OiB7YToge2I6IHtjOiB7ZDogeycueCc6IFsxXSwgZTogeycueCc6IFsyXX19fX19fSB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBnZW5lcmF0b3IuZXh0ZW5kVmFsaWRhdG9yKGRhdGEudGFyZ2V0LCBkYXRhLnNyYyk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwoZGF0YS50YXJnZXQsIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJtYXBWYWxpZGF0b3JcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogeycueCc6ICdhJ30sIGV4cGVjdDogeycueCc6ICdhKyd9IH0sXHJcbiAgICAgIHsgZGF0YTogeycueCc6ICdiJ30sIGV4cGVjdDoge30gfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgZ2VuZXJhdG9yLm1hcFZhbGlkYXRvcihkYXRhLCBmdW5jdGlvbih2YWx1ZSwgcHJvcCkge1xyXG4gICAgICAgIGlmICh2YWx1ZSA9PT0gJ2InKSB7XHJcbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdmFsdWUgKyAnKyc7XHJcbiAgICAgIH0pO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKGRhdGEsIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJTY2hlbWEgR2VuZXJhdGlvbiBFcnJvcnNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJcIixcclxuICAgICAgICBleHBlY3Q6IC9hdCBsZWFzdCBvbmUgcGF0aC8gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgU2ltcGxlIGV4dGVuZHMgU3RyaW5nIHthOiBTdHJpbmd9IHBhdGggL3ggaXMgU2ltcGxlO1wiLFxyXG4gICAgICAgIGV4cGVjdDogL3Byb3BlcnRpZXMuKmV4dGVuZC8gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3kgeyBpbmRleCgpIHsgcmV0dXJuIDE7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvaW5kZXguKnN0cmluZy9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgd3JpdGUoKSB7IHJldHVybiB1bmRlZmluZWRGdW5jKCk7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvdW5kZWZpbmVkLipmdW5jdGlvbi9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IGlzIE5vU3VjaFR5cGUge31cIixcclxuICAgICAgICBleHBlY3Q6IC9ObyB0eXBlLipOb1N1Y2hUeXBlLyB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveCB7IHVuc3VwcG9ydGVkKCkgeyB0cnVlIH0gfVwiLFxyXG4gICAgICAgIHdhcm46IC91bnN1cHBvcnRlZCBtZXRob2QvaSB9LFxyXG5cclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMudGVzdCgxMjMpOyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9jb252ZXJ0IHZhbHVlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3ggeyB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRoaXMudGVzdCgnYS8nKTsgfSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvY29udmVydCB2YWx1ZS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgdmFsaWRhdGUoKSB7IHJldHVybiB0aGlzLnRlc3QoJy9hLycpOyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9jb252ZXJ0IHZhbHVlL2kgfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJmdW5jdGlvbiBmKGEpIHsgcmV0dXJuIGYoYSk7IH0gcGF0aCAvIHsgdmFsaWRhdGUoKSB7IHJldHVybiBmKDEpOyB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogL3JlY3Vyc2l2ZS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFggeyAkbjogTnVtYmVyLCAkczogU3RyaW5nIH0gcGF0aCAvIGlzIFg7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvd2lsZCBwcm9wZXJ0eS8gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgWCB7ICQkbjogTnVtYmVyIH0gcGF0aCAvIGlzIFg7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvcHJvcGVydHkgbmFtZXMvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBYIHsgJ1xceDAxJzogTnVtYmVyIH0gcGF0aCAvIGlzIFg7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvcHJvcGVydHkgbmFtZXMvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIGlzIE1hcDtcIixcclxuICAgICAgICBleHBlY3Q6IC9ObyB0eXBlLipub24tZ2VuZXJpYy8gfSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgUGFpcjxYLCBZPiB7YTogWCwgYjogWX0gcGF0aCAvIGlzIFBhaXI7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvTm8gdHlwZS4qbm9uLWdlbmVyaWMvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8gaXMgU3RyaW5nPE51bWJlcj47XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvTm8gdHlwZS4qZ2VuZXJpYy8gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyBpcyBNYXA8T2JqZWN0LCBOdW1iZXI+O1wiLFxyXG4gICAgICAgIGV4cGVjdDogL211c3QgZGVyaXZlIGZyb20gU3RyaW5nLyB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvIHsgd3JpdGUoKSB7IHRydWUgfSBjcmVhdGUoKSB7IHRydWUgfSB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvd3JpdGUtYWxpYXNpbmcuKmNyZWF0ZS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8geyB3cml0ZSgpIHsgdHJ1ZSB9IHVwZGF0ZSgpIHsgdHJ1ZSB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC93cml0ZS1hbGlhc2luZy4qdXBkYXRlL2kgfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggLyB7IHdyaXRlKCkgeyB0cnVlIH0gZGVsZXRlKCkgeyB0cnVlIH0gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL3dyaXRlLWFsaWFzaW5nLipkZWxldGUvaSB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCwgdCkge1xyXG4gICAgICBsb2dnZXIucmVzZXQoKTtcclxuICAgICAgbG9nZ2VyLnNpbGVudCgpO1xyXG4gICAgICBsZXQgc3ltYm9scyA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBsZXQgZ2VuID0gbmV3IGJvbHQuR2VuZXJhdG9yKHN5bWJvbHMpO1xyXG4gICAgICBsZXQgbGFzdEVycm9yO1xyXG5cclxuICAgICAgdHJ5IHtcclxuICAgICAgICBnZW4uZ2VuZXJhdGVSdWxlcygpO1xyXG4gICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgaWYgKCFleHBlY3QpIHtcclxuICAgICAgICAgIHRocm93IGU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGxhc3RFcnJvciA9IGxvZ2dlci5nZXRMYXN0TWVzc2FnZSgpIHx8IGUubWVzc2FnZTtcclxuICAgICAgICBhc3NlcnQubWF0Y2gobGFzdEVycm9yLCBleHBlY3QpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBpZiAoZXhwZWN0KSB7XHJcbiAgICAgICAgYXNzZXJ0LmZhaWwodW5kZWZpbmVkLCB1bmRlZmluZWQsIFwiTm8gZXhjZXB0aW9uIHRocm93bi5cIik7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHQud2Fybikge1xyXG4gICAgICAgIGFzc2VydC5tYXRjaChsb2dnZXIuZ2V0TGFzdE1lc3NhZ2UoKSwgdC53YXJuKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pO1xyXG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
