"use strict";
var chai = require('chai');
var assert = chai.assert;
var fileIO = require('../file-io');
var readFile = fileIO.readFile;
var logger = require('../logger');
var parser = require('../rules-parser');
var parse = parser.parse;
var ast = require('../ast');
var bolt = require('../bolt');
var helper = require('./test-helper');
suite("Rules Parser Tests", function () {
    test("Empty input", function () {
        var result = parse("");
        assert.ok(result instanceof ast.Symbols);
    });
    suite("Imports", function () {
        var tests = [
            { data: "import {'foo'}",
                expect: {
                    filename: ast.string('foo'),
                    alias: ast.string(''),
                    scope: ast.boolean(true)
                }
            },
            { data: "import {'../../foo/bar'}",
                expect: {
                    filename: ast.string('../../foo/bar'),
                    alias: ast.string(''),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo/bar'}",
                expect: {
                    filename: ast.string('./foo/bar'),
                    alias: ast.string(''),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo/bar'} as lol",
                expect: {
                    filename: ast.string('./foo/bar'),
                    alias: ast.string('lol'),
                    scope: ast.boolean(false)
                }
            },
            { data: "import {'./foo-bar'} as lol",
                expect: {
                    filename: ast.string('./foo-bar'),
                    alias: ast.string('lol'),
                    scope: ast.boolean(false)
                }
            }
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.deepEqual(result.imports[0].filename, expect.filename.value);
            assert.deepEqual(result.imports[0].alias, expect.alias.value);
            assert.deepEqual(result.imports[0].scope, expect.scope.value);
        });
    });
    suite("Function Samples", function () {
        var tests = [
            { data: "function f() { return true; }",
                expect: { f: { params: [], body: ast.boolean(true) } }
            },
            { data: "function longName() { return false; }",
                expect: { longName: { params: [], body: ast.boolean(false) } }
            },
            { data: "function f(){return true;} function g(){return false;}",
                expect: { f: { params: [], body: ast.boolean(true) },
                    g: { params: [], body: ast.boolean(false) } }
            }
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.deepEqual(result.functions, expect);
        });
    });
    suite("Literals", function () {
        var tests = [
            ["true", ast.boolean(true)],
            ["false", ast.boolean(false)],
            ["null", ast.nullType()],
            ["1", ast.number(1)],
            ["1.1", ast.number(1.1)],
            ["+3", ast.number(3)],
            ["-3", ast.number(-3)],
            ["0x2", ast.number(2)],
            ["[1, 2, 3]", ast.array([ast.number(1), ast.number(2), ast.number(3)])],
            ["\"string\"", ast.string("string")],
            ["'string'", ast.string("string")],
            ["''", ast.string('')],
            ["/pattern/", ast.regexp("pattern")],
            ["/pattern/i", ast.regexp("pattern", "i")],
            ["/pat\\ntern/", ast.regexp("pat\\ntern")],
            ["/pat\\/tern/", ast.regexp("pat\\/tern")],
            ["/pat\\tern/", ast.regexp("pat\\tern")],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("function f() { return " + data + ";}");
            assert.deepEqual(result.functions.f.body, expect);
        });
    });
    suite("Expressions", function () {
        var tests = [
            ["a", ast.variable('a')],
            ["a.b", ast.reference(ast.variable('a'), ast.string('b'))],
            ["a['b']", ast.reference(ast.variable('a'), ast.string('b'))],
            ["a[b]", ast.reference(ast.variable('a'), ast.variable('b'))],
            ["a()", ast.call(ast.variable('a'), [])],
            ["a.b()", ast.call(ast.reference(ast.variable('a'), ast.string('b')), [])],
            ["a().b", ast.reference(ast.call(ast.variable('a'), []), ast.string('b'))],
            ["-a", ast.neg(ast.variable('a'))],
            ["--a", ast.neg(ast.neg(ast.variable('a')))],
            ["+a", ast.variable('a')],
            ["!a", ast.not(ast.variable('a'))],
            ["2 * a", ast.mult(ast.number(2), ast.variable('a'))],
            ["2 / a", ast.div(ast.number(2), ast.variable('a'))],
            ["a % 2", ast.mod(ast.variable('a'), ast.number(2))],
            ["1 + 1", ast.add(ast.number(1), ast.number(1))],
            ["a - 1", ast.sub(ast.variable('a'), ast.number(1))],
            ["a - -b", ast.sub(ast.variable('a'), ast.neg(ast.variable('b')))],
            ["a + b + c", ast.add(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a + b * c", ast.add(ast.variable('a'), ast.mult(ast.variable('b'), ast.variable('c')))],
            ["(a + b) * c", ast.mult(ast.add(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a < 7", ast.lt(ast.variable('a'), ast.number(7))],
            ["a > 7", ast.gt(ast.variable('a'), ast.number(7))],
            ["a <= 7", ast.lte(ast.variable('a'), ast.number(7))],
            ["a >= 7", ast.gte(ast.variable('a'), ast.number(7))],
            ["a == 3", ast.eq(ast.variable('a'), ast.number(3))],
            ["a != 0", ast.ne(ast.variable('a'), ast.number(0))],
            ["a === 3", ast.eq(ast.variable('a'), ast.number(3))],
            ["a !== 0", ast.ne(ast.variable('a'), ast.number(0))],
            ["3 * a == b", ast.eq(ast.mult(ast.number(3), ast.variable('a')), ast.variable('b'))],
            ["a == 1 && b <= 2", ast.and(ast.eq(ast.variable('a'), ast.number(1)), ast.lte(ast.variable('b'), ast.number(2)))],
            ["a == 1 || b <= 2", ast.or(ast.eq(ast.variable('a'), ast.number(1)), ast.lte(ast.variable('b'), ast.number(2)))],
            ["a && b && c", ast.and(ast.and(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a || b || c", ast.or(ast.or(ast.variable('a'), ast.variable('b')), ast.variable('c'))],
            ["a && b || c && d", ast.or(ast.and(ast.variable('a'), ast.variable('b')), ast.and(ast.variable('c'), ast.variable('d')))],
            ["a ? b : c", ast.ternary(ast.variable('a'), ast.variable('b'), ast.variable('c'))],
            ["a || b ? c : d", ast.ternary(ast.or(ast.variable('a'), ast.variable('b')), ast.variable('c'), ast.variable('d'))],
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("function f() { return " + data + ";}");
            assert.deepEqual(result.functions.f.body, expect);
        });
    });
    suite("Whitespace", function () {
        var fn = "function f() { return true; }";
        var fnAST = { params: [], body: ast.boolean(true) };
        var tests = [
            " " + fn,
            fn + " ",
            " " + fn + " ",
            "\t" + fn,
            "\n" + fn,
            "\r\n" + fn,
            fn + "\n",
            fn + "\r\n",
            "  \t" + fn + "  \r\n"
        ];
        helper.dataDrivenTest(tests, function (data) {
            assert.deepEqual(parse(data).functions.f, fnAST);
        });
    });
    suite("Comments", function () {
        var fn = "function f() { return true; }";
        var fnAST = { params: [], body: ast.boolean(true) };
        var tests = [
            "//Single Line\n" + fn,
            fn + " // My rule",
            "// Line 1\n// Line 2\n" + fn,
            "/* inline */ " + fn,
            "/* pre */ " + fn + " /* post */"
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            assert.deepEqual(parse(data).functions.f, fnAST);
        });
    });
    suite("Paths", function () {
        var tests = [
            { data: "path / {}",
                expect: [{ template: new ast.PathTemplate(),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
            { data: "path /x {}",
                expect: [{ template: new ast.PathTemplate(['x']),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
            { data: "path /p/{$q} { write() { return true;  }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['p', '$q']),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /p/{q} { write() { return true;  }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['p', new ast.PathPart('$q', 'q')]),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x/y { read() { true } }",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { read: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x { read() { true } /y { write() { true } }}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x']),
                        methods: { read: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { write: { params: [], body: ast.boolean(true) } } }] },
            { data: "path /x { read() { true } /y { write() { true } path /{$id} { validate() { false } }}}",
                expect: [{ isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x']),
                        methods: { read: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y']),
                        methods: { write: { params: [], body: ast.boolean(true) } } },
                    { isType: ast.typeType('Any'),
                        template: new ast.PathTemplate(['x', 'y', '$id']),
                        methods: { validate: { params: [], body: ast.boolean(false) } } },
                ] },
            { data: "path /hyphen-key {}",
                expect: [{ template: new ast.PathTemplate(['hyphen-key']),
                        isType: ast.typeType('Any'),
                        methods: {} }] },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            assert.deepEqual(sortPaths(parse(data).paths), sortPaths(expect));
        });
    });
    suite("Schema", function () {
        var tests = [
            { data: "type Foo { a: Number }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Number, b: String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number'),
                        b: ast.typeType('String') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Bar {}",
                expect: { derivedFrom: ast.typeType('Bar'),
                    properties: {},
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Number validate() { return true; }}",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: { validate: { params: [],
                            body: ast.boolean(true) } },
                    params: []
                } },
            { data: "type Foo { a: Number, validate() { return true; }}",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('Number') },
                    methods: { validate: { params: [],
                            body: ast.boolean(true) } },
                    params: []
                } },
            { data: "type Foo { a: Number | String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.unionType([ast.typeType('Number'),
                            ast.typeType('String')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Number | String;",
                expect: { derivedFrom: ast.unionType([ast.typeType('Number'), ast.typeType('String')]),
                    properties: {},
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Map<String, Number> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Map', [ast.typeType('String'),
                            ast.typeType('Number')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo extends Map<String, Number>;",
                expect: { derivedFrom: ast.genericType('Map', [ast.typeType('String'), ast.typeType('Number')]),
                    properties: {},
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Other[] }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Map', [ast.typeType('String'),
                            ast.typeType('Other')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Multi<String, Number, Boolean> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Multi', [ast.typeType('String'),
                            ast.typeType('Number'),
                            ast.typeType('Boolean')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { a: Gen1<String> }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.genericType('Gen1', [ast.typeType('String')]) },
                    methods: {},
                    params: []
                } },
            { data: "type Foo<T> { a: T }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { a: ast.typeType('T') },
                    methods: {},
                    params: ["T"]
                } },
            { data: "type Foo { name: String, age: Number }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { name: ast.typeType('String'),
                        age: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { name: String; age: Number; }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { name: ast.typeType('String'),
                        age: ast.typeType('Number') },
                    methods: {},
                    params: []
                } },
            { data: "type Foo { 'hyphen-prop': String }",
                expect: { derivedFrom: ast.typeType('Object'),
                    properties: { "hyphen-prop": ast.typeType('String') },
                    methods: {},
                    params: []
                } },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data).schema.Foo;
            assert.deepEqual(result, expect);
        });
    });
    suite("Function variations", function () {
        var tests = [
            "function f(x) { return x + 1; }",
            "function f(x) { return x + 1 }",
            "function f(x) { x + 1; }",
            "function f(x) { x + 1 }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.deepEqual(result.functions.f.body, ast.add(ast.variable('x'), ast.number(1)));
        });
    });
    suite("Method variations", function () {
        var tests = [
            "validate() { return this; }",
            "validate() { return this  }",
            "validate() { this; }",
            "validate() { this }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse("type T {" + data + "}");
            assert.deepEqual(result.schema.T.methods.validate.body, ast.variable('this'));
        });
    });
    suite("Path variations", function () {
        var tests = [
            "path /p/{c} {}",
            "/p/{c} {}",
            "/p/{c};",
            "path /p/{c} is String {}",
            "path /p/{c} is String;",
            "/p/{c} is String {}",
            "/p/{c} is String;",
            "/p/{c=*} is String;",
            "/p/{c = *} is String;",
            "/p/{c} { validate() { return true; } }",
            "/p/{c} { validate() { return true } }",
            "/p/{c} { validate() { true } }",
            "/p/{c} { validate() { true; } }",
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.deepEqual(result.paths[0].template, new ast.PathTemplate(['p', new ast.PathPart('$c', 'c')]));
        });
    });
    suite("Type variations", function () {
        var tests = [
            "type T extends Any {}",
            "type T extends Any;",
            "type T {}",
            "type T;"
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            var result = parse(data);
            assert.deepEqual(result.schema.T, { derivedFrom: ast.typeType('Any'),
                methods: {},
                properties: {},
                params: []
            });
        });
    });
    suite("Sample files", function () {
        var files = ["all_access", "userdoc", "mail", "children", "create-update-delete"];
        helper.dataDrivenTest(files, function (data) {
            var filename = 'samples/' + data + '.' + bolt.FILE_EXTENSION;
            return readFile(filename)
                .then(function (response) {
                var result = parse(response.content);
                assert.ok(result, response.url);
                return true;
            });
        });
    });
    suite("Parser Errors", function () {
        var tests = [
            { data: "path /x/y/ is String;",
                expect: /end in a slash/ },
            { data: "path /x//y is String;",
                expect: /empty part/ },
            { data: "path //x is String;",
                expect: /./ },
            { data: "path // is String;",
                expect: /./ },
            { data: "path /x { validate() { return this.test(/a/g); } }",
                expect: /unsupported regexp modifier/i },
            { data: "path {}",
                expect: /missing path template/i },
            { data: "path / }",
                expect: /missing body of path/i },
            { data: "function foo { 7 }",
                expect: /missing parameters/i },
            { data: "foo { 7 }",
                expect: /expected.*function/i },
            { data: "foo(x)",
                expect: /missing.*body/i },
            { data: "path /x { foo(x); }",
                expect: /invalid path or method/i },
            { data: "foo(x) { x = 'a' }",
                expect: /equality/i },
            { data: "type X { bad-prop: String; }",
                expect: /invalid property or method/i },
            { data: "type { foo: String;}",
                expect: /missing type name/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            try {
                parse(data);
            }
            catch (e) {
                assert.match(e.message, expect);
                return;
            }
            assert.fail(undefined, undefined, "No exception thrown.");
        });
    });
    suite("Syntax warnings.", function () {
        var tests = [
            { data: "path /x { read() { true }; }",
                expect: /extra separator/i },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            parse(data);
            assert.match(logger.getLastMessage(), expect);
        });
    });
    suite("Deprecation warnings.", function () {
        var tests = [
            { data: "path /x/$y is String;",
                expect: /path segment is deprecated/ },
            { data: "f(x) = x + 1;",
                expect: /fn\(x\) = exp; format is deprecated/ },
            { data: "f(x) = x + 1",
                expect: /fn\(x\) = exp; format is deprecated/ },
        ];
        helper.dataDrivenTest(tests, function (data, expect) {
            parse(data);
            assert.match(logger.getLastMessage(), expect);
        });
    });
});
function sortPaths(paths) {
    function cmpStr(a, b) {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }
    paths.sort(function (a, b) {
        return cmpStr(a.template.getLabels().join('~'), b.template.getLabels().join('~'));
    });
    return paths;
}

//# sourceMappingURL=data:application/json;base64,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QUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDL0QsQ0FBRSxNQUFNLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUMvRCxDQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUU7WUFDMUMsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFFO1lBQzVFLENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUM1RSxDQUFFLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUVwQyxDQUFFLEtBQUssRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDOUMsQ0FBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBRTtZQUMzQixDQUFFLElBQUksRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUNwQyxDQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFFO1lBQ3ZELENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDdEQsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUN0RCxDQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ2xELENBQUUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFFdEQsQ0FBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFFcEUsQ0FBRSxXQUFXLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBRTtZQUUxRixDQUFFLFdBQVcsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQzNGLENBQUUsYUFBYSxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDN0YsQ0FBRSxPQUFPLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUNyRCxDQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3JELENBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDdkQsQ0FBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUN2RCxDQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3RELENBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUU7WUFDdEQsQ0FBRSxTQUFTLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUN2RCxDQUFFLFNBQVMsRUFBRSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFFO1lBQ3ZELENBQUUsWUFBWSxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUU7WUFDdkYsQ0FBRSxrQkFBa0IsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQ3hDLEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBRTtZQUMxRSxDQUFFLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsUUFB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LEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNwRixDQUFDLENBQUMsQ0FBQztJQUVILE1BQU0sQ0FBQyxLQUFLLENBQUM7QUFDZixDQUFDIiwiZmlsZSI6InRlc3QvcGFyc2VyLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL25vZGUuZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL21vY2hhLmQudHNcIiAvPlxyXG5cclxuaW1wb3J0IGNoYWkgPSByZXF1aXJlKCdjaGFpJyk7XHJcbnZhciBhc3NlcnQgPSBjaGFpLmFzc2VydDtcclxuaW1wb3J0IGZpbGVJTyA9IHJlcXVpcmUoJy4uL2ZpbGUtaW8nKTtcclxudmFyIHJlYWRGaWxlID0gZmlsZUlPLnJlYWRGaWxlO1xyXG5pbXBvcnQgbG9nZ2VyID0gcmVxdWlyZSgnLi4vbG9nZ2VyJyk7XHJcbnZhciBwYXJzZXIgPSByZXF1aXJlKCcuLi9ydWxlcy1wYXJzZXInKTtcclxudmFyIHBhcnNlID0gcGFyc2VyLnBhcnNlO1xyXG5pbXBvcnQgYXN0ID0gcmVxdWlyZSgnLi4vYXN0Jyk7XHJcbmltcG9ydCBib2x0ID0gcmVxdWlyZSgnLi4vYm9sdCcpO1xyXG5pbXBvcnQgaGVscGVyID0gcmVxdWlyZSgnLi90ZXN0LWhlbHBlcicpO1xyXG5cclxuLy8gVE9ETzogVGVzdCBkdXBsaWNhdGVkIGZ1bmN0aW9uLCBhbmQgc2NoZW1hIGRlZmluaXRpb25zLlxyXG5cclxuc3VpdGUoXCJSdWxlcyBQYXJzZXIgVGVzdHNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgdGVzdChcIkVtcHR5IGlucHV0XCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHJlc3VsdCA9IHBhcnNlKFwiXCIpO1xyXG4gICAgYXNzZXJ0Lm9rKHJlc3VsdCBpbnN0YW5jZW9mIGFzdC5TeW1ib2xzKTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJJbXBvcnRzXCIsIGZ1bmN0aW9uKCl7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJpbXBvcnQgeydmb28nfVwiLFxyXG4gICAgICAgIGV4cGVjdDoge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGFzdC5zdHJpbmcoJ2ZvbycpICxcclxuICAgICAgICAgIGFsaWFzOiBhc3Quc3RyaW5nKCcnKSxcclxuICAgICAgICAgIHNjb3BlOiBhc3QuYm9vbGVhbih0cnVlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcImltcG9ydCB7Jy4uLy4uL2Zvby9iYXInfVwiLFxyXG4gICAgICAgIGV4cGVjdDoge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGFzdC5zdHJpbmcoJy4uLy4uL2Zvby9iYXInKSxcclxuICAgICAgICAgIGFsaWFzOiBhc3Quc3RyaW5nKCcnKSxcclxuICAgICAgICAgIHNjb3BlOiBhc3QuYm9vbGVhbihmYWxzZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0sXHJcbiAgICAgIHsgZGF0YTogXCJpbXBvcnQgeycuL2Zvby9iYXInfVwiLFxyXG4gICAgICAgIGV4cGVjdDoge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGFzdC5zdHJpbmcoJy4vZm9vL2JhcicpLFxyXG4gICAgICAgICAgYWxpYXM6IGFzdC5zdHJpbmcoJycpLFxyXG4gICAgICAgICAgc2NvcGU6IGFzdC5ib29sZWFuKGZhbHNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcImltcG9ydCB7Jy4vZm9vL2Jhcid9IGFzIGxvbFwiLFxyXG4gICAgICAgIGV4cGVjdDoge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGFzdC5zdHJpbmcoJy4vZm9vL2JhcicpLFxyXG4gICAgICAgICAgYWxpYXM6IGFzdC5zdHJpbmcoJ2xvbCcpLFxyXG4gICAgICAgICAgc2NvcGU6IGFzdC5ib29sZWFuKGZhbHNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcImltcG9ydCB7Jy4vZm9vLWJhcid9IGFzIGxvbFwiLFxyXG4gICAgICAgIGV4cGVjdDoge1xyXG4gICAgICAgICAgZmlsZW5hbWU6IGFzdC5zdHJpbmcoJy4vZm9vLWJhcicpLFxyXG4gICAgICAgICAgYWxpYXM6IGFzdC5zdHJpbmcoJ2xvbCcpLFxyXG4gICAgICAgICAgc2NvcGU6IGFzdC5ib29sZWFuKGZhbHNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgXTtcclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShkYXRhKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQuaW1wb3J0c1swXS5maWxlbmFtZSwgZXhwZWN0LmZpbGVuYW1lLnZhbHVlKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQuaW1wb3J0c1swXS5hbGlhcywgZXhwZWN0LmFsaWFzLnZhbHVlKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQuaW1wb3J0c1swXS5zY29wZSwgZXhwZWN0LnNjb3BlLnZhbHVlKTtcclxuXHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJGdW5jdGlvbiBTYW1wbGVzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwiZnVuY3Rpb24gZigpIHsgcmV0dXJuIHRydWU7IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZjogeyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKSB9IH1cclxuICAgICAgfSxcclxuICAgICAgeyBkYXRhOiBcImZ1bmN0aW9uIGxvbmdOYW1lKCkgeyByZXR1cm4gZmFsc2U7IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgbG9uZ05hbWU6IHsgcGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4oZmFsc2UpIH0gfVxyXG4gICAgICB9LFxyXG4gICAgICB7IGRhdGE6IFwiZnVuY3Rpb24gZigpe3JldHVybiB0cnVlO30gZnVuY3Rpb24gZygpe3JldHVybiBmYWxzZTt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGY6IHsgcGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSkgfSxcclxuICAgICAgICAgICAgICAgICAgZzogeyBwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbihmYWxzZSkgfSB9XHJcbiAgICAgIH1cclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5mdW5jdGlvbnMsIGV4cGVjdCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJMaXRlcmFsc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgWyBcInRydWVcIiwgYXN0LmJvb2xlYW4odHJ1ZSkgXSxcclxuICAgICAgWyBcImZhbHNlXCIsIGFzdC5ib29sZWFuKGZhbHNlKSBdLFxyXG4gICAgICBbIFwibnVsbFwiLCBhc3QubnVsbFR5cGUoKSBdLFxyXG4gICAgICBbIFwiMVwiLCBhc3QubnVtYmVyKDEpIF0sXHJcbiAgICAgIFsgXCIxLjFcIiwgYXN0Lm51bWJlcigxLjEpIF0sXHJcbiAgICAgIFsgXCIrM1wiLCBhc3QubnVtYmVyKDMpIF0sXHJcbiAgICAgIFsgXCItM1wiLCBhc3QubnVtYmVyKC0zKSBdLFxyXG4gICAgICBbIFwiMHgyXCIsIGFzdC5udW1iZXIoMikgXSxcclxuICAgICAgWyBcIlsxLCAyLCAzXVwiLCBhc3QuYXJyYXkoW2FzdC5udW1iZXIoMSksIGFzdC5udW1iZXIoMiksIGFzdC5udW1iZXIoMyldKSBdLFxyXG4gICAgICBbIFwiXFxcInN0cmluZ1xcXCJcIiwgYXN0LnN0cmluZyhcInN0cmluZ1wiKSBdLFxyXG4gICAgICBbIFwiJ3N0cmluZydcIiwgYXN0LnN0cmluZyhcInN0cmluZ1wiKSBdLFxyXG4gICAgICBbIFwiJydcIiwgYXN0LnN0cmluZygnJykgXSxcclxuICAgICAgWyBcIi9wYXR0ZXJuL1wiLCBhc3QucmVnZXhwKFwicGF0dGVyblwiKSBdLFxyXG4gICAgICBbIFwiL3BhdHRlcm4vaVwiLCBhc3QucmVnZXhwKFwicGF0dGVyblwiLCBcImlcIikgXSxcclxuICAgICAgWyBcIi9wYXRcXFxcbnRlcm4vXCIsIGFzdC5yZWdleHAoXCJwYXRcXFxcbnRlcm5cIikgXSxcclxuICAgICAgWyBcIi9wYXRcXFxcL3Rlcm4vXCIsIGFzdC5yZWdleHAoXCJwYXRcXFxcL3Rlcm5cIikgXSxcclxuICAgICAgWyBcIi9wYXRcXFxcdGVybi9cIiwgYXN0LnJlZ2V4cChcInBhdFxcXFx0ZXJuXCIpIF0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShcImZ1bmN0aW9uIGYoKSB7IHJldHVybiBcIiArIGRhdGEgKyBcIjt9XCIpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5mdW5jdGlvbnMuZi5ib2R5LCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiRXhwcmVzc2lvbnNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIFsgXCJhXCIsIGFzdC52YXJpYWJsZSgnYScpIF0sXHJcbiAgICAgIFsgXCJhLmJcIiwgYXN0LnJlZmVyZW5jZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnN0cmluZygnYicpKSBdLFxyXG4gICAgICBbIFwiYVsnYiddXCIsIGFzdC5yZWZlcmVuY2UoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5zdHJpbmcoJ2InKSkgXSxcclxuICAgICAgWyBcImFbYl1cIiwgYXN0LnJlZmVyZW5jZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnZhcmlhYmxlKCdiJykpIF0sXHJcbiAgICAgIFsgXCJhKClcIiwgYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdhJyksIFtdKSBdLFxyXG4gICAgICBbIFwiYS5iKClcIiwgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnN0cmluZygnYicpKSwgW10pIF0sXHJcbiAgICAgIFsgXCJhKCkuYlwiLCBhc3QucmVmZXJlbmNlKGFzdC5jYWxsKGFzdC52YXJpYWJsZSgnYScpLCBbXSksIGFzdC5zdHJpbmcoJ2InKSkgXSxcclxuICAgICAgWyBcIi1hXCIsIGFzdC5uZWcoYXN0LnZhcmlhYmxlKCdhJykpIF0sXHJcbiAgICAgIC8vIFRPRE86IFRoaXMgc2hvdWxkIGJlIGFuIGVycm9yIC0gbG9va3MgbGlrZSBwcmUtZGVjcmVtZW50XHJcbiAgICAgIFsgXCItLWFcIiwgYXN0Lm5lZyhhc3QubmVnKGFzdC52YXJpYWJsZSgnYScpKSkgXSxcclxuICAgICAgWyBcIithXCIsIGFzdC52YXJpYWJsZSgnYScpIF0sXHJcbiAgICAgIFsgXCIhYVwiLCBhc3Qubm90KGFzdC52YXJpYWJsZSgnYScpKSBdLFxyXG4gICAgICBbIFwiMiAqIGFcIiwgYXN0Lm11bHQoYXN0Lm51bWJlcigyKSwgYXN0LnZhcmlhYmxlKCdhJykpIF0sXHJcbiAgICAgIFsgXCIyIC8gYVwiLCBhc3QuZGl2KGFzdC5udW1iZXIoMiksIGFzdC52YXJpYWJsZSgnYScpKSBdLFxyXG4gICAgICBbIFwiYSAlIDJcIiwgYXN0Lm1vZChhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigyKSkgXSxcclxuICAgICAgWyBcIjEgKyAxXCIsIGFzdC5hZGQoYXN0Lm51bWJlcigxKSwgYXN0Lm51bWJlcigxKSkgXSxcclxuICAgICAgWyBcImEgLSAxXCIsIGFzdC5zdWIoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoMSkpIF0sXHJcbiAgICAgIC8vIFVuYXJ5IHByZWNlZGVuY2VcclxuICAgICAgWyBcImEgLSAtYlwiLCBhc3Quc3ViKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubmVnKGFzdC52YXJpYWJsZSgnYicpKSkgXSxcclxuICAgICAgLy8gTGVmdCBhc3NvY2lhdGl2ZVxyXG4gICAgICBbIFwiYSArIGIgKyBjXCIsIGFzdC5hZGQoYXN0LmFkZChhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnZhcmlhYmxlKCdiJykpLCBhc3QudmFyaWFibGUoJ2MnKSkgXSxcclxuICAgICAgLy8gTXVsdGlwbGNhdGlvbiBwcmVjZWRlbmNlXHJcbiAgICAgIFsgXCJhICsgYiAqIGNcIiwgYXN0LmFkZChhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm11bHQoYXN0LnZhcmlhYmxlKCdiJyksIGFzdC52YXJpYWJsZSgnYycpKSkgXSxcclxuICAgICAgWyBcIihhICsgYikgKiBjXCIsIGFzdC5tdWx0KGFzdC5hZGQoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC52YXJpYWJsZSgnYicpKSwgYXN0LnZhcmlhYmxlKCdjJykpIF0sXHJcbiAgICAgIFsgXCJhIDwgN1wiLCBhc3QubHQoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoNykpIF0sXHJcbiAgICAgIFsgXCJhID4gN1wiLCBhc3QuZ3QoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoNykpIF0sXHJcbiAgICAgIFsgXCJhIDw9IDdcIiwgYXN0Lmx0ZShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcig3KSkgXSxcclxuICAgICAgWyBcImEgPj0gN1wiLCBhc3QuZ3RlKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDcpKSBdLFxyXG4gICAgICBbIFwiYSA9PSAzXCIsIGFzdC5lcShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigzKSkgXSxcclxuICAgICAgWyBcImEgIT0gMFwiLCBhc3QubmUoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoMCkpIF0sXHJcbiAgICAgIFsgXCJhID09PSAzXCIsIGFzdC5lcShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigzKSkgXSxcclxuICAgICAgWyBcImEgIT09IDBcIiwgYXN0Lm5lKGFzdC52YXJpYWJsZSgnYScpLCBhc3QubnVtYmVyKDApKSBdLFxyXG4gICAgICBbIFwiMyAqIGEgPT0gYlwiLCBhc3QuZXEoYXN0Lm11bHQoYXN0Lm51bWJlcigzKSwgYXN0LnZhcmlhYmxlKCdhJykpLCBhc3QudmFyaWFibGUoJ2InKSkgXSxcclxuICAgICAgWyBcImEgPT0gMSAmJiBiIDw9IDJcIiwgYXN0LmFuZChhc3QuZXEoYXN0LnZhcmlhYmxlKCdhJyksIGFzdC5udW1iZXIoMSkpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QubHRlKGFzdC52YXJpYWJsZSgnYicpLCBhc3QubnVtYmVyKDIpKSkgXSxcclxuICAgICAgWyBcImEgPT0gMSB8fCBiIDw9IDJcIiwgYXN0Lm9yKGFzdC5lcShhc3QudmFyaWFibGUoJ2EnKSwgYXN0Lm51bWJlcigxKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0Lmx0ZShhc3QudmFyaWFibGUoJ2InKSwgYXN0Lm51bWJlcigyKSkpIF0sXHJcbiAgICAgIC8vIExlZnQgYXNzb2NpYXRpdmUgKGV2ZW4gdGhvdWdoIGV4ZWN1dGlvbiBpcyBzaG9ydC1jaXJjdWl0ZWQhXHJcbiAgICAgIFsgXCJhICYmIGIgJiYgY1wiLCBhc3QuYW5kKGFzdC5hbmQoYXN0LnZhcmlhYmxlKCdhJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgnYicpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgnYycpKSBdLFxyXG4gICAgICBbIFwiYSB8fCBiIHx8IGNcIiwgYXN0Lm9yKGFzdC5vcihhc3QudmFyaWFibGUoJ2EnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgnYicpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdjJykpIF0sXHJcbiAgICAgIC8vICYmIG92ZXIgfHwgcHJlY2VuZGVuY2VcclxuICAgICAgWyBcImEgJiYgYiB8fCBjICYmIGRcIiwgYXN0Lm9yKGFzdC5hbmQoYXN0LnZhcmlhYmxlKCdhJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudmFyaWFibGUoJ2InKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmFuZChhc3QudmFyaWFibGUoJ2MnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgnZCcpKSkgXSxcclxuICAgICAgWyBcImEgPyBiIDogY1wiLCBhc3QudGVybmFyeShhc3QudmFyaWFibGUoJ2EnKSwgYXN0LnZhcmlhYmxlKCdiJyksIGFzdC52YXJpYWJsZSgnYycpKSBdLFxyXG4gICAgICBbIFwiYSB8fCBiID8gYyA6IGRcIiwgYXN0LnRlcm5hcnkoYXN0Lm9yKGFzdC52YXJpYWJsZSgnYScpLCBhc3QudmFyaWFibGUoJ2InKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdjJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnZhcmlhYmxlKCdkJykpIF0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHZhciByZXN1bHQgPSBwYXJzZShcImZ1bmN0aW9uIGYoKSB7IHJldHVybiBcIiArIGRhdGEgKyBcIjt9XCIpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5mdW5jdGlvbnMuZi5ib2R5LCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiV2hpdGVzcGFjZVwiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmbiA9IFwiZnVuY3Rpb24gZigpIHsgcmV0dXJuIHRydWU7IH1cIjtcclxuICAgIHZhciBmbkFTVCA9IHsgcGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSkgfTtcclxuXHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIFwiIFwiICsgZm4sXHJcbiAgICAgIGZuICsgXCIgXCIsXHJcbiAgICAgIFwiIFwiICsgZm4gKyBcIiBcIixcclxuICAgICAgXCJcXHRcIiArIGZuLFxyXG4gICAgICBcIlxcblwiICsgZm4sXHJcbiAgICAgIFwiXFxyXFxuXCIgKyBmbixcclxuICAgICAgZm4gKyBcIlxcblwiLFxyXG4gICAgICBmbiArIFwiXFxyXFxuXCIsXHJcbiAgICAgIFwiICBcXHRcIiArIGZuICsgXCIgIFxcclxcblwiXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSkge1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHBhcnNlKGRhdGEpLmZ1bmN0aW9ucy5mLCBmbkFTVCk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJDb21tZW50c1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmbiA9IFwiZnVuY3Rpb24gZigpIHsgcmV0dXJuIHRydWU7IH1cIjtcclxuICAgIHZhciBmbkFTVCA9IHsgcGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSkgfTtcclxuXHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIFwiLy9TaW5nbGUgTGluZVxcblwiICsgZm4sXHJcbiAgICAgIGZuICsgXCIgLy8gTXkgcnVsZVwiLFxyXG4gICAgICBcIi8vIExpbmUgMVxcbi8vIExpbmUgMlxcblwiICsgZm4sXHJcbiAgICAgIFwiLyogaW5saW5lICovIFwiICsgZm4sXHJcbiAgICAgIFwiLyogcHJlICovIFwiICsgZm4gKyBcIiAvKiBwb3N0ICovXCJcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChwYXJzZShkYXRhKS5mdW5jdGlvbnMuZiwgZm5BU1QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiUGF0aHNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8ge31cIixcclxuICAgICAgICBleHBlY3Q6IFt7IHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZSgpLFxyXG4gICAgICAgICAgICAgICAgICAgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30gfV0gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3gge31cIixcclxuICAgICAgICBleHBlY3Q6IFt7IHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3gnXSksXHJcbiAgICAgICAgICAgICAgICAgICBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSB9XSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvcC97JHF9IHsgd3JpdGUoKSB7IHJldHVybiB0cnVlOyAgfX1cIixcclxuICAgICAgICBleHBlY3Q6IFt7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3AnLCAnJHEnXSksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7d3JpdGU6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fV0gfSxcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3Ave3F9IHsgd3JpdGUoKSB7IHJldHVybiB0cnVlOyAgfX1cIixcclxuICAgICAgICBleHBlY3Q6IFt7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3AnLCBuZXcgYXN0LlBhdGhQYXJ0KCckcScsICdxJyldKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt3cml0ZToge3BhcmFtczogW10sIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX19XSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveC95IHsgcmVhZCgpIHsgdHJ1ZSB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IFt7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3gnLCAneSddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHtyZWFkOiB7cGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fX1dIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgcmVhZCgpIHsgdHJ1ZSB9IC95IHsgd3JpdGUoKSB7IHRydWUgfSB9fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsneCddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHtyZWFkOiB7cGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fX0sXHJcbiAgICAgICAgICAgICAgICAgeyBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogbmV3IGFzdC5QYXRoVGVtcGxhdGUoWyd4JywgJ3knXSksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7d3JpdGU6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fV0gfSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgcmVhZCgpIHsgdHJ1ZSB9IC95IHsgd3JpdGUoKSB7IHRydWUgfSBwYXRoIC97JGlkfSB7IHZhbGlkYXRlKCkgeyBmYWxzZSB9IH19fVwiLFxyXG4gICAgICAgIGV4cGVjdDogW3sgaXNUeXBlOiBhc3QudHlwZVR5cGUoJ0FueScpLFxyXG4gICAgICAgICAgICAgICAgICAgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsneCddKSxcclxuICAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHtyZWFkOiB7cGFyYW1zOiBbXSwgYm9keTogYXN0LmJvb2xlYW4odHJ1ZSl9fX0sXHJcbiAgICAgICAgICAgICAgICAgeyBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICB0ZW1wbGF0ZTogbmV3IGFzdC5QYXRoVGVtcGxhdGUoWyd4JywgJ3knXSksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7d3JpdGU6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbih0cnVlKX19fSxcclxuICAgICAgICAgICAgICAgICB7IGlzVHlwZTogYXN0LnR5cGVUeXBlKCdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3gnLCAneScsICckaWQnXSksXHJcbiAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7dmFsaWRhdGU6IHtwYXJhbXM6IFtdLCBib2R5OiBhc3QuYm9vbGVhbihmYWxzZSl9fX0sXHJcbiAgICAgICAgICAgICAgICBdIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC9oeXBoZW4ta2V5IHt9XCIsXHJcbiAgICAgICAgZXhwZWN0OiBbIHsgdGVtcGxhdGU6IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFsnaHlwaGVuLWtleSddKSxcclxuICAgICAgICAgICAgICAgICAgICBpc1R5cGU6IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30gfV0gfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChzb3J0UGF0aHMocGFyc2UoZGF0YSkucGF0aHMpLCBzb3J0UGF0aHMoZXhwZWN0KSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJTY2hlbWFcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IE51bWJlciB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LnR5cGVUeXBlKCdOdW1iZXInKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IE51bWJlciwgYjogU3RyaW5nIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudHlwZVR5cGUoJ051bWJlcicpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYjogYXN0LnR5cGVUeXBlKCdTdHJpbmcnKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyBleHRlbmRzIEJhciB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdCYXInKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge30sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IE51bWJlciB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRydWU7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LnR5cGVUeXBlKCdOdW1iZXInKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt2YWxpZGF0ZToge3BhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX0sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTnVtYmVyLCB2YWxpZGF0ZSgpIHsgcmV0dXJuIHRydWU7IH19XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LnR5cGVUeXBlKCdOdW1iZXInKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt2YWxpZGF0ZToge3BhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJvZHk6IGFzdC5ib29sZWFuKHRydWUpfX0sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTnVtYmVyIHwgU3RyaW5nIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudW5pb25UeXBlKFthc3QudHlwZVR5cGUoJ051bWJlcicpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnR5cGVUeXBlKCdTdHJpbmcnKV0pfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIGV4dGVuZHMgTnVtYmVyIHwgU3RyaW5nO1wiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnVuaW9uVHlwZShbYXN0LnR5cGVUeXBlKCdOdW1iZXInKSwgYXN0LnR5cGVUeXBlKCdTdHJpbmcnKV0pLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgYTogTWFwPFN0cmluZywgTnVtYmVyPiB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LmdlbmVyaWNUeXBlKCdNYXAnLCBbYXN0LnR5cGVUeXBlKCdTdHJpbmcnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC50eXBlVHlwZSgnTnVtYmVyJyldKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyBleHRlbmRzIE1hcDxTdHJpbmcsIE51bWJlcj47XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QuZ2VuZXJpY1R5cGUoJ01hcCcsIFthc3QudHlwZVR5cGUoJ1N0cmluZycpLCBhc3QudHlwZVR5cGUoJ051bWJlcicpXSksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgIH19LFxyXG4gICAgICAvLyBBbGlhcyBmb3IgTWFwPFN0cmluZywgT3RoZXI+XHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IE90aGVyW10gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge2E6IGFzdC5nZW5lcmljVHlwZSgnTWFwJywgW2FzdC50eXBlVHlwZSgnU3RyaW5nJyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudHlwZVR5cGUoJ090aGVyJyldKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb28geyBhOiBNdWx0aTxTdHJpbmcsIE51bWJlciwgQm9vbGVhbj4gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogeyBkZXJpdmVkRnJvbTogYXN0LnR5cGVUeXBlKCdPYmplY3QnKSxcclxuICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge2E6IGFzdC5nZW5lcmljVHlwZSgnTXVsdGknLCBbYXN0LnR5cGVUeXBlKCdTdHJpbmcnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnR5cGVUeXBlKCdOdW1iZXInKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnR5cGVUeXBlKCdCb29sZWFuJyldKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IGE6IEdlbjE8U3RyaW5nPiB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7YTogYXN0LmdlbmVyaWNUeXBlKCdHZW4xJywgW2FzdC50eXBlVHlwZSgnU3RyaW5nJyldKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcblxyXG4gICAgICB7IGRhdGE6IFwidHlwZSBGb288VD4geyBhOiBUIH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHthOiBhc3QudHlwZVR5cGUoJ1QnKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtcIlRcIl0sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgICAgeyBkYXRhOiBcInR5cGUgRm9vIHsgbmFtZTogU3RyaW5nLCBhZ2U6IE51bWJlciB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7bmFtZTogYXN0LnR5cGVUeXBlKCdTdHJpbmcnKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFnZTogYXN0LnR5cGVUeXBlKCdOdW1iZXInKX0sXHJcbiAgICAgICAgICAgICAgICAgIG1ldGhvZHM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICBwYXJhbXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgfX0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7IG5hbWU6IFN0cmluZzsgYWdlOiBOdW1iZXI7IH1cIixcclxuICAgICAgICBleHBlY3Q6IHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnT2JqZWN0JyksXHJcbiAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtuYW1lOiBhc3QudHlwZVR5cGUoJ1N0cmluZycpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYWdlOiBhc3QudHlwZVR5cGUoJ051bWJlcicpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIEZvbyB7ICdoeXBoZW4tcHJvcCc6IFN0cmluZyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiB7IGRlcml2ZWRGcm9tOiBhc3QudHlwZVR5cGUoJ09iamVjdCcpLFxyXG4gICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XCJoeXBoZW4tcHJvcFwiOiBhc3QudHlwZVR5cGUoJ1N0cmluZycpfSxcclxuICAgICAgICAgICAgICAgICAgbWV0aG9kczoge30sXHJcbiAgICAgICAgICAgICAgICAgIHBhcmFtczogW10sXHJcbiAgICAgICAgICAgICAgICB9fSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpLnNjaGVtYS5Gb287XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHN1aXRlKFwiRnVuY3Rpb24gdmFyaWF0aW9uc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgXCJmdW5jdGlvbiBmKHgpIHsgcmV0dXJuIHggKyAxOyB9XCIsXHJcbiAgICAgIFwiZnVuY3Rpb24gZih4KSB7IHJldHVybiB4ICsgMSB9XCIsXHJcbiAgICAgIFwiZnVuY3Rpb24gZih4KSB7IHggKyAxOyB9XCIsXHJcbiAgICAgIFwiZnVuY3Rpb24gZih4KSB7IHggKyAxIH1cIixcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5mdW5jdGlvbnMuZi5ib2R5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGFzdC5hZGQoYXN0LnZhcmlhYmxlKCd4JyksIGFzdC5udW1iZXIoMSkpKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIk1ldGhvZCB2YXJpYXRpb25zXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICBcInZhbGlkYXRlKCkgeyByZXR1cm4gdGhpczsgfVwiLFxyXG4gICAgICBcInZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcyAgfVwiLFxyXG4gICAgICBcInZhbGlkYXRlKCkgeyB0aGlzOyB9XCIsXHJcbiAgICAgIFwidmFsaWRhdGUoKSB7IHRoaXMgfVwiLFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoXCJ0eXBlIFQge1wiICsgZGF0YSArIFwifVwiKTtcclxuICAgICAgYXNzZXJ0LmRlZXBFcXVhbChyZXN1bHQuc2NoZW1hLlQubWV0aG9kcy52YWxpZGF0ZS5ib2R5LFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGFzdC52YXJpYWJsZSgndGhpcycpKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlBhdGggdmFyaWF0aW9uc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgXCJwYXRoIC9wL3tjfSB7fVwiLFxyXG4gICAgICBcIi9wL3tjfSB7fVwiLFxyXG4gICAgICBcIi9wL3tjfTtcIixcclxuICAgICAgXCJwYXRoIC9wL3tjfSBpcyBTdHJpbmcge31cIixcclxuICAgICAgXCJwYXRoIC9wL3tjfSBpcyBTdHJpbmc7XCIsXHJcbiAgICAgIFwiL3Ave2N9IGlzIFN0cmluZyB7fVwiLFxyXG4gICAgICBcIi9wL3tjfSBpcyBTdHJpbmc7XCIsXHJcbiAgICAgIFwiL3Ave2M9Kn0gaXMgU3RyaW5nO1wiLFxyXG4gICAgICBcIi9wL3tjID0gKn0gaXMgU3RyaW5nO1wiLFxyXG4gICAgICBcIi9wL3tjfSB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdHJ1ZTsgfSB9XCIsXHJcbiAgICAgIFwiL3Ave2N9IHsgdmFsaWRhdGUoKSB7IHJldHVybiB0cnVlIH0gfVwiLFxyXG4gICAgICBcIi9wL3tjfSB7IHZhbGlkYXRlKCkgeyB0cnVlIH0gfVwiLFxyXG4gICAgICBcIi9wL3tjfSB7IHZhbGlkYXRlKCkgeyB0cnVlOyB9IH1cIixcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgdmFyIHJlc3VsdCA9IHBhcnNlKGRhdGEpO1xyXG4gICAgICBhc3NlcnQuZGVlcEVxdWFsKHJlc3VsdC5wYXRoc1swXS50ZW1wbGF0ZSxcclxuICAgICAgICAgICAgICAgICAgICAgICBuZXcgYXN0LlBhdGhUZW1wbGF0ZShbJ3AnLCBuZXcgYXN0LlBhdGhQYXJ0KCckYycsICdjJyldKSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJUeXBlIHZhcmlhdGlvbnNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIFwidHlwZSBUIGV4dGVuZHMgQW55IHt9XCIsXHJcbiAgICAgIFwidHlwZSBUIGV4dGVuZHMgQW55O1wiLFxyXG4gICAgICBcInR5cGUgVCB7fVwiLFxyXG4gICAgICBcInR5cGUgVDtcIlxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICB2YXIgcmVzdWx0ID0gcGFyc2UoZGF0YSk7XHJcbiAgICAgIGFzc2VydC5kZWVwRXF1YWwocmVzdWx0LnNjaGVtYS5ULFxyXG4gICAgICAgICAgICAgICAgICAgICAgIHsgZGVyaXZlZEZyb206IGFzdC50eXBlVHlwZSgnQW55JyksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2RzOiB7fSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgcGFyYW1zOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlNhbXBsZSBmaWxlc1wiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciBmaWxlcyA9IFtcImFsbF9hY2Nlc3NcIiwgXCJ1c2VyZG9jXCIsIFwibWFpbFwiLCBcImNoaWxkcmVuXCIsIFwiY3JlYXRlLXVwZGF0ZS1kZWxldGVcIl07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KGZpbGVzLCBmdW5jdGlvbihkYXRhKSB7XHJcbiAgICAgIHZhciBmaWxlbmFtZSA9ICdzYW1wbGVzLycgKyBkYXRhICsgJy4nICsgYm9sdC5GSUxFX0VYVEVOU0lPTjtcclxuICAgICAgcmV0dXJuIHJlYWRGaWxlKGZpbGVuYW1lKVxyXG4gICAgICAgIC50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XHJcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gcGFyc2UocmVzcG9uc2UuY29udGVudCk7XHJcbiAgICAgICAgICBhc3NlcnQub2socmVzdWx0LCByZXNwb25zZS51cmwpO1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9KTtcclxuXHJcbiAgc3VpdGUoXCJQYXJzZXIgRXJyb3JzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgdmFyIHRlc3RzID0gW1xyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveC95LyBpcyBTdHJpbmc7XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvZW5kIGluIGEgc2xhc2gvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94Ly95IGlzIFN0cmluZztcIixcclxuICAgICAgICBleHBlY3Q6IC9lbXB0eSBwYXJ0LyB9LFxyXG4gICAgICAvLyBCVUc6IEZvbGxvd2luZyBlcnJvcnMgc2hvdWxkIGV4cGVjdCAvZW1wdHkgcGFydC8gLSBQRUcgcGFyc2VyIGVycm9yP1xyXG4gICAgICB7IGRhdGE6IFwicGF0aCAvL3ggaXMgU3RyaW5nO1wiLFxyXG4gICAgICAgIGV4cGVjdDogLy4vIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8vIGlzIFN0cmluZztcIixcclxuICAgICAgICBleHBlY3Q6IC8uLyB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCAveCB7IHZhbGlkYXRlKCkgeyByZXR1cm4gdGhpcy50ZXN0KC9hL2cpOyB9IH1cIixcclxuICAgICAgICBleHBlY3Q6IC91bnN1cHBvcnRlZCByZWdleHAgbW9kaWZpZXIvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwicGF0aCB7fVwiLFxyXG4gICAgICAgIGV4cGVjdDogL21pc3NpbmcgcGF0aCB0ZW1wbGF0ZS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC8gfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL21pc3NpbmcgYm9keSBvZiBwYXRoL2kgfSxcclxuICAgICAgeyBkYXRhOiBcImZ1bmN0aW9uIGZvbyB7IDcgfVwiLFxyXG4gICAgICAgIGV4cGVjdDogL21pc3NpbmcgcGFyYW1ldGVycy9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmb28geyA3IH1cIixcclxuICAgICAgICBleHBlY3Q6IC9leHBlY3RlZC4qZnVuY3Rpb24vaSB9LFxyXG4gICAgICB7IGRhdGE6IFwiZm9vKHgpXCIsXHJcbiAgICAgICAgZXhwZWN0OiAvbWlzc2luZy4qYm9keS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgZm9vKHgpOyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvaW52YWxpZCBwYXRoIG9yIG1ldGhvZC9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmb28oeCkgeyB4ID0gJ2EnIH1cIixcclxuICAgICAgICBleHBlY3Q6IC9lcXVhbGl0eS9pIH0sXHJcbiAgICAgIHsgZGF0YTogXCJ0eXBlIFggeyBiYWQtcHJvcDogU3RyaW5nOyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvaW52YWxpZCBwcm9wZXJ0eSBvciBtZXRob2QvaSB9LFxyXG4gICAgICB7IGRhdGE6IFwidHlwZSB7IGZvbzogU3RyaW5nO31cIixcclxuICAgICAgICBleHBlY3Q6IC9taXNzaW5nIHR5cGUgbmFtZS9pIH0sXHJcbiAgICBdO1xyXG5cclxuICAgIGhlbHBlci5kYXRhRHJpdmVuVGVzdCh0ZXN0cywgZnVuY3Rpb24oZGF0YSwgZXhwZWN0KSB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgcGFyc2UoZGF0YSk7XHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBhc3NlcnQubWF0Y2goZS5tZXNzYWdlLCBleHBlY3QpO1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBhc3NlcnQuZmFpbCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgXCJObyBleGNlcHRpb24gdGhyb3duLlwiKTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIlN5bnRheCB3YXJuaW5ncy5cIiwgZnVuY3Rpb24oKSB7XHJcbiAgICB2YXIgdGVzdHMgPSBbXHJcbiAgICAgIHsgZGF0YTogXCJwYXRoIC94IHsgcmVhZCgpIHsgdHJ1ZSB9OyB9XCIsXHJcbiAgICAgICAgZXhwZWN0OiAvZXh0cmEgc2VwYXJhdG9yL2kgfSxcclxuICAgIF07XHJcblxyXG4gICAgaGVscGVyLmRhdGFEcml2ZW5UZXN0KHRlc3RzLCBmdW5jdGlvbihkYXRhLCBleHBlY3QpIHtcclxuICAgICAgcGFyc2UoZGF0YSk7XHJcbiAgICAgIGFzc2VydC5tYXRjaChsb2dnZXIuZ2V0TGFzdE1lc3NhZ2UoKSwgZXhwZWN0KTtcclxuICAgIH0pO1xyXG4gIH0pO1xyXG5cclxuICBzdWl0ZShcIkRlcHJlY2F0aW9uIHdhcm5pbmdzLlwiLCBmdW5jdGlvbigpIHtcclxuICAgIHZhciB0ZXN0cyA9IFtcclxuICAgICAgeyBkYXRhOiBcInBhdGggL3gvJHkgaXMgU3RyaW5nO1wiLFxyXG4gICAgICAgIGV4cGVjdDogL3BhdGggc2VnbWVudCBpcyBkZXByZWNhdGVkLyB9LFxyXG4gICAgICB7IGRhdGE6IFwiZih4KSA9IHggKyAxO1wiLFxyXG4gICAgICAgIGV4cGVjdDogL2ZuXFwoeFxcKSA9IGV4cDsgZm9ybWF0IGlzIGRlcHJlY2F0ZWQvIH0sXHJcbiAgICAgIHsgZGF0YTogXCJmKHgpID0geCArIDFcIixcclxuICAgICAgICBleHBlY3Q6IC9mblxcKHhcXCkgPSBleHA7IGZvcm1hdCBpcyBkZXByZWNhdGVkLyB9LFxyXG4gICAgXTtcclxuXHJcbiAgICBoZWxwZXIuZGF0YURyaXZlblRlc3QodGVzdHMsIGZ1bmN0aW9uKGRhdGEsIGV4cGVjdCkge1xyXG4gICAgICBwYXJzZShkYXRhKTtcclxuICAgICAgYXNzZXJ0Lm1hdGNoKGxvZ2dlci5nZXRMYXN0TWVzc2FnZSgpLCBleHBlY3QpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn0pO1xyXG5cclxuZnVuY3Rpb24gc29ydFBhdGhzKHBhdGhzOiBhc3QuUGF0aFtdKTogYXN0LlBhdGhbXSB7XHJcbiAgZnVuY3Rpb24gY21wU3RyKGEsIGIpIHtcclxuICAgIGlmIChhIDwgYikge1xyXG4gICAgICByZXR1cm4gLTE7XHJcbiAgICB9XHJcbiAgICBpZiAoYSA+IGIpIHtcclxuICAgICAgcmV0dXJuIDE7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gMDtcclxuICB9XHJcblxyXG4gIHBhdGhzLnNvcnQoKGEsIGIpID0+IHtcclxuICAgIHJldHVybiBjbXBTdHIoYS50ZW1wbGF0ZS5nZXRMYWJlbHMoKS5qb2luKCd+JyksIGIudGVtcGxhdGUuZ2V0TGFiZWxzKCkuam9pbignficpKTtcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHBhdGhzO1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
