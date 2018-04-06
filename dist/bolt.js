(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";
exports.__esModule = true;
/*
 * AST builders for Firebase Rules Language.
 *
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
var util = require("./util");
var logger = require("./logger");
var errors = {
    typeMismatch: "Unexpected type: ",
    duplicatePathPart: "A path component name is duplicated: "
};
;
;
var PathPart = /** @class */ (function () {
    // "label", undefined - static path part
    // "$label", X - variable path part
    // X, !undefined - variable path part
    function PathPart(label, variable) {
        if (label[0] === '$' && variable === undefined) {
            variable = label;
        }
        if (variable && label[0] !== '$') {
            label = '$' + label;
        }
        this.label = label;
        this.variable = variable;
    }
    return PathPart;
}());
exports.PathPart = PathPart;
var PathTemplate = /** @class */ (function () {
    function PathTemplate(parts) {
        if (parts === void 0) { parts = []; }
        this.parts = parts.map(function (part) {
            if (util.isType(part, 'string')) {
                return new PathPart(part);
            }
            else {
                return part;
            }
        });
    }
    PathTemplate.prototype.copy = function () {
        var result = new PathTemplate();
        result.push(this);
        return result;
    };
    PathTemplate.prototype.getLabels = function () {
        return this.parts.map(function (part) { return part.label; });
    };
    // Mapping from variables to JSON labels
    PathTemplate.prototype.getScope = function () {
        var result = {};
        this.parts.forEach(function (part) {
            if (part.variable) {
                if (result[part.variable]) {
                    throw new Error(errors.duplicatePathPart + part.variable);
                }
                result[part.variable] = literal(part.label);
            }
        });
        return result;
    };
    PathTemplate.prototype.push = function (temp) {
        util.extendArray(this.parts, temp.parts);
    };
    PathTemplate.prototype.pop = function (temp) {
        var _this = this;
        temp.parts.forEach(function (part) {
            _this.parts.pop();
        });
    };
    PathTemplate.prototype.length = function () {
        return this.parts.length;
    };
    PathTemplate.prototype.getPart = function (i) {
        if (i > this.parts.length || i < -this.parts.length) {
            var l = this.parts.length;
            throw new Error("Path reference out of bounds: " + i +
                " [" + -l + " .. " + l + "]");
        }
        if (i < 0) {
            return this.parts[this.parts.length + i];
        }
        return this.parts[i];
    };
    return PathTemplate;
}());
exports.PathTemplate = PathTemplate;
;
var Schema = /** @class */ (function () {
    function Schema() {
    }
    Schema.isGeneric = function (schema) {
        return schema.params !== undefined && schema.params.length > 0;
    };
    return Schema;
}());
exports.Schema = Schema;
;
exports.string = valueGen('String');
exports.boolean = valueGen('Boolean');
exports.number = valueGen('Number');
exports.array = valueGen('Array');
exports.neg = opGen('neg', 1);
exports.not = opGen('!', 1);
exports.mult = opGen('*');
exports.div = opGen('/');
exports.mod = opGen('%');
exports.add = opGen('+');
exports.sub = opGen('-');
exports.eq = opGen('==');
exports.lt = opGen('<');
exports.lte = opGen('<=');
exports.gt = opGen('>');
exports.gte = opGen('>=');
exports.ne = opGen('!=');
exports.and = opGen('&&');
exports.or = opGen('||');
exports.ternary = opGen('?:', 3);
exports.value = opGen('value', 1);
function variable(name) {
    return { type: 'var', valueType: 'Any', name: name };
}
exports.variable = variable;
function literal(name) {
    return { type: 'literal', valueType: 'Any', name: name };
}
exports.literal = literal;
function nullType() {
    return { type: 'Null', valueType: 'Null' };
}
exports.nullType = nullType;
function reference(base, prop) {
    return {
        type: 'ref',
        valueType: 'Any',
        base: base,
        accessor: prop
    };
}
exports.reference = reference;
var reIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_]*$/;
function isIdentifierStringExp(exp) {
    return exp.type === 'String' && reIdentifier.test(exp.value);
}
exports.isIdentifierStringExp = isIdentifierStringExp;
// Shallow copy of an expression (so it can be modified and preserve
// immutability of the original expression).
function copyExp(exp) {
    exp = util.extend({}, exp);
    switch (exp.type) {
        case 'op':
        case 'call':
            var opExp = exp;
            opExp.args = util.copyArray(opExp.args);
            return opExp;
        case 'union':
            var unionExp = exp;
            unionExp.types = util.copyArray(unionExp.types);
            return unionExp;
        case 'generic':
            var genericExp = exp;
            genericExp.params = util.copyArray(genericExp.params);
            return genericExp;
        default:
            return exp;
    }
}
exports.copyExp = copyExp;
// Make a (shallow) copy of the base expression, setting (or removing) it's
// valueType.
//
// valueType is a string indicating the type of evaluating an expression (e.g.
// 'Snapshot') - used to know when type coercion is needed in the context
// of parent expressions.
function cast(base, valueType) {
    var result = copyExp(base);
    result.valueType = valueType;
    return result;
}
exports.cast = cast;
function call(ref, args) {
    if (args === void 0) { args = []; }
    return { type: 'call', valueType: 'Any', ref: ref, args: args };
}
exports.call = call;
// Return empty string if not a function.
function getFunctionName(exp) {
    if (exp.ref.type === 'ref') {
        return '';
    }
    return exp.ref.name;
}
exports.getFunctionName = getFunctionName;
// Return empty string if not a (simple) method call -- ref.fn()
function getMethodName(exp) {
    if (exp.ref.type === 'var') {
        return exp.ref.name;
    }
    if (exp.ref.type !== 'ref') {
        return '';
    }
    return getPropName(exp.ref);
}
exports.getMethodName = getMethodName;
function getPropName(ref) {
    if (ref.accessor.type !== 'String') {
        return '';
    }
    return ref.accessor.value;
}
exports.getPropName = getPropName;
// TODO: Type of function signature does not fail this declaration?
function builtin(fn) {
    return { type: 'builtin', valueType: 'Any', fn: fn };
}
exports.builtin = builtin;
function snapshotVariable(name) {
    return cast(variable(name), 'Snapshot');
}
exports.snapshotVariable = snapshotVariable;
function snapshotParent(base) {
    if (base.valueType !== 'Snapshot') {
        throw new Error(errors.typeMismatch + "expected Snapshot");
    }
    return cast(call(reference(cast(base, 'Any'), exports.string('parent'))), 'Snapshot');
}
exports.snapshotParent = snapshotParent;
function ensureValue(exp) {
    if (exp.valueType === 'Snapshot') {
        return snapshotValue(exp);
    }
    return exp;
}
exports.ensureValue = ensureValue;
// ref.val()
function snapshotValue(exp) {
    return call(reference(cast(exp, 'Any'), exports.string('val')));
}
exports.snapshotValue = snapshotValue;
// Ensure expression is a boolean (when used in a boolean context).
function ensureBoolean(exp) {
    exp = ensureValue(exp);
    if (isCall(exp, 'val')) {
        exp = exports.eq(exp, exports.boolean(true));
    }
    return exp;
}
exports.ensureBoolean = ensureBoolean;
function isCall(exp, methodName) {
    return exp.type === 'call' && exp.ref.type === 'ref' &&
        exp.ref.accessor.type === 'String' &&
        exp.ref.accessor.value === methodName;
}
exports.isCall = isCall;
// Return value generating function for a given Type.
function valueGen(typeName) {
    return function (val) {
        return {
            type: typeName,
            valueType: typeName,
            value: val // The (constant) value itself.
        };
    };
}
function regexp(pattern, modifiers) {
    if (modifiers === void 0) { modifiers = ""; }
    switch (modifiers) {
        case "":
        case "i":
            break;
        default:
            throw new Error("Unsupported RegExp modifier: " + modifiers);
    }
    return {
        type: 'RegExp',
        valueType: 'RegExp',
        value: pattern,
        modifiers: modifiers
    };
}
exports.regexp = regexp;
function cmpValues(v1, v2) {
    if (v1.type !== v2.type) {
        return false;
    }
    return v1.value === v2.value;
}
function isOp(opType, exp) {
    return exp.type === 'op' && exp.op === opType;
}
// Return a generating function to make an operator exp node.
function opGen(opType, arity) {
    if (arity === void 0) { arity = 2; }
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        if (args.length !== arity) {
            throw new Error("Operator has " + args.length +
                " arguments (expecting " + arity + ").");
        }
        return op(opType, args);
    };
}
exports.andArray = leftAssociateGen('&&', exports.boolean(true), exports.boolean(false));
exports.orArray = leftAssociateGen('||', exports.boolean(false), exports.boolean(true));
// Create an expression builder function which operates on arrays of values.
// Returns new expression like v1 op v2 op v3 ...
//
// - Any identityValue's in array input are ignored.
// - If zeroValue is found - just return zeroValue.
//
// Our function re-orders top-level op in array elements to the resulting
// expression is left-associating.  E.g.:
//
//    [a && b, c && d] => (((a && b) && c) && d)
//    (NOT (a && b) && (c && d))
function leftAssociateGen(opType, identityValue, zeroValue) {
    return function (a) {
        var i;
        function reducer(result, current) {
            if (result === undefined) {
                return current;
            }
            return op(opType, [result, current]);
        }
        // First flatten all top-level op values to one flat array.
        var flat = [];
        for (i = 0; i < a.length; i++) {
            flatten(opType, a[i], flat);
        }
        var result = [];
        for (i = 0; i < flat.length; i++) {
            // Remove identifyValues from array.
            if (cmpValues(flat[i], identityValue)) {
                continue;
            }
            // Just return zeroValue if found
            if (cmpValues(flat[i], zeroValue)) {
                return zeroValue;
            }
            result.push(flat[i]);
        }
        if (result.length === 0) {
            return identityValue;
        }
        // Return left-associative expression of opType.
        return result.reduce(reducer);
    };
}
// Flatten the top level tree of op into a single flat array of expressions.
function flatten(opType, exp, flat) {
    var i;
    if (flat === undefined) {
        flat = [];
    }
    if (!isOp(opType, exp)) {
        flat.push(exp);
        return flat;
    }
    for (i = 0; i < exp.args.length; i++) {
        flatten(opType, exp.args[i], flat);
    }
    return flat;
}
exports.flatten = flatten;
function op(opType, args) {
    return {
        type: 'op',
        valueType: 'Any',
        op: opType,
        args: args // Arguments to the operator Array<exp>
    };
}
exports.op = op;
// Warning: NOT an expression type!
function method(params, body) {
    return {
        params: params,
        body: body
    };
}
exports.method = method;
function typeType(typeName) {
    return { type: "type", valueType: "type", name: typeName };
}
exports.typeType = typeType;
function unionType(types) {
    return { type: "union", valueType: "type", types: types };
}
exports.unionType = unionType;
function genericType(typeName, params) {
    return { type: "generic", valueType: "type", name: typeName, params: params };
}
exports.genericType = genericType;
var Symbols = /** @class */ (function () {
    function Symbols() {
        this.functions = {};
        this.paths = [];
        this.schema = {};
    }
    Symbols.prototype.register = function (map, typeName, name, object) {
        if (map[name]) {
            logger.error("Duplicated " + typeName + " definition: " + name + ".");
        }
        else {
            map[name] = object;
        }
        return map[name];
    };
    Symbols.prototype.registerFunction = function (name, params, body) {
        return this.register(this.functions, 'functions', name, method(params, body));
    };
    Symbols.prototype.registerPath = function (template, isType, methods) {
        if (methods === void 0) { methods = {}; }
        isType = isType || typeType('Any');
        var p = {
            template: template.copy(),
            isType: isType,
            methods: methods
        };
        this.paths.push(p);
        return p;
    };
    Symbols.prototype.registerSchema = function (name, derivedFrom, properties, methods, params) {
        if (properties === void 0) { properties = {}; }
        if (methods === void 0) { methods = {}; }
        if (params === void 0) { params = []; }
        derivedFrom = derivedFrom || typeType(Object.keys(properties).length > 0 ? 'Object' : 'Any');
        var s = {
            derivedFrom: derivedFrom,
            properties: properties,
            methods: methods,
            params: params
        };
        return this.register(this.schema, 'schema', name, s);
    };
    Symbols.prototype.isDerivedFrom = function (type, ancestor) {
        var _this = this;
        if (ancestor === 'Any') {
            return true;
        }
        switch (type.type) {
            case 'type':
            case 'generic':
                var simpleType = type;
                if (simpleType.name === ancestor) {
                    return true;
                }
                if (simpleType.name === 'Any') {
                    return false;
                }
                var schema = this.schema[simpleType.name];
                if (!schema) {
                    return false;
                }
                return this.isDerivedFrom(schema.derivedFrom, ancestor);
            case 'union':
                return type.types
                    .map(function (subType) { return _this.isDerivedFrom(subType, ancestor); })
                    .reduce(util.or);
            default:
                throw new Error("Unknown type: " + type.type);
        }
    };
    return Symbols;
}());
exports.Symbols = Symbols;
var JS_OPS = {
    'value': { rep: "", p: 18 },
    'neg': { rep: "-", p: 15 },
    '!': { p: 15 },
    '*': { p: 14 },
    '/': { p: 14 },
    '%': { p: 14 },
    '+': { p: 13 },
    '-': { p: 13 },
    '<': { p: 11 },
    '<=': { p: 11 },
    '>': { p: 11 },
    '>=': { p: 11 },
    'in': { p: 11 },
    '==': { p: 10 },
    "!=": { p: 10 },
    '&&': { p: 6 },
    '||': { p: 5 },
    '?:': { p: 4 },
    ',': { p: 0 }
};
// From an AST, decode as an expression (string).
function decodeExpression(exp, outerPrecedence) {
    if (outerPrecedence === undefined) {
        outerPrecedence = 0;
    }
    var innerPrecedence = precedenceOf(exp);
    var result = '';
    switch (exp.type) {
        case 'Boolean':
        case 'Number':
            result = JSON.stringify(exp.value);
            break;
        case 'String':
            result = util.quoteString(exp.value);
            break;
        // RegExp assumed to be in pre-quoted format.
        case 'RegExp':
            var regexp_1 = exp;
            result = '/' + regexp_1.value + '/';
            if (regexp_1.modifiers !== '') {
                result += regexp_1.modifiers;
            }
            break;
        case 'Array':
            result = '[' + decodeArray(exp.value) + ']';
            break;
        case 'Null':
            result = 'null';
            break;
        case 'var':
        case 'literal':
            result = exp.name;
            break;
        case 'ref':
            var expRef = exp;
            if (isIdentifierStringExp(expRef.accessor)) {
                result = decodeExpression(expRef.base, innerPrecedence) + '.' + expRef.accessor.value;
            }
            else {
                result = decodeExpression(expRef.base, innerPrecedence) +
                    '[' + decodeExpression(expRef.accessor) + ']';
            }
            break;
        case 'call':
            var expCall = exp;
            result = decodeExpression(expCall.ref) + '(' + decodeArray(expCall.args) + ')';
            break;
        case 'builtin':
            result = decodeExpression(exp);
            break;
        case 'op':
            var expOp = exp;
            var rep = JS_OPS[expOp.op].rep === undefined ? expOp.op : JS_OPS[expOp.op].rep;
            if (expOp.args.length === 1) {
                result = rep + decodeExpression(expOp.args[0], innerPrecedence);
            }
            else if (expOp.args.length === 2) {
                result =
                    decodeExpression(expOp.args[0], innerPrecedence) +
                        ' ' + rep + ' ' +
                        // All ops are left associative - so nudge the innerPrecendence
                        // down on the right hand side to force () for right-associating
                        // operations.
                        decodeExpression(expOp.args[1], innerPrecedence + 1);
            }
            else if (expOp.args.length === 3) {
                result =
                    decodeExpression(expOp.args[0], innerPrecedence) + ' ? ' +
                        decodeExpression(expOp.args[1], innerPrecedence) + ' : ' +
                        decodeExpression(expOp.args[2], innerPrecedence);
            }
            break;
        case 'type':
            result = exp.name;
            break;
        case 'union':
            result = exp.types.map(decodeExpression).join(' | ');
            break;
        case 'generic':
            var genericType_1 = exp;
            return genericType_1.name + '<' + decodeArray(genericType_1.params) + '>';
        default:
            result = "***UNKNOWN TYPE*** (" + exp.type + ")";
            break;
    }
    if (innerPrecedence < outerPrecedence) {
        result = '(' + result + ')';
    }
    return result;
}
exports.decodeExpression = decodeExpression;
function decodeArray(args) {
    return args.map(decodeExpression).join(', ');
}
function precedenceOf(exp) {
    var result;
    switch (exp.type) {
        case 'op':
            result = JS_OPS[exp.op].p;
            break;
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
        // lists call as 17 and ref as 18 - but how could they be anything other than left to right?
        // http://www.scriptingmaster.com/javascript/operator-precedence.asp - agrees.
        case 'call':
            result = 18;
            break;
        case 'ref':
            result = 18;
            break;
        default:
            result = 19;
            break;
    }
    return result;
}


},{"./logger":3,"./util":7}],2:[function(require,module,exports){
"use strict";
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
exports.__esModule = true;
// TODO(koss): After node 0.10 leaves LTS - remove polyfilled Promise library.
if (typeof Promise === 'undefined') {
    require('es6-promise').polyfill();
}
var parser = require('./rules-parser');
var generator = require("./rules-generator");
var astImport = require("./ast");
exports.FILE_EXTENSION = 'bolt';
exports.ast = astImport;
exports.parse = parser.parse;
exports.Generator = generator.Generator;
exports.decodeExpression = exports.ast.decodeExpression;
exports.generate = generator.generate;


},{"./ast":1,"./rules-generator":5,"./rules-parser":6,"es6-promise":8}],3:[function(require,module,exports){
"use strict";
exports.__esModule = true;
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
var lastError;
var lastMessage;
var errorCount;
var silenceOutput;
var DEBUG = false;
var getContext = function () { return ({}); };
reset();
function reset() {
    lastError = undefined;
    lastMessage = undefined;
    errorCount = 0;
    silenceOutput = false;
}
exports.reset = reset;
function setDebug(debug) {
    if (debug === void 0) { debug = true; }
    DEBUG = debug;
}
exports.setDebug = setDebug;
function silent(f) {
    if (f === void 0) { f = true; }
    silenceOutput = f;
}
exports.silent = silent;
function setContext(fn) {
    getContext = fn;
}
exports.setContext = setContext;
function error(s) {
    var err = errorString(s);
    // De-dup identical messages
    if (err === lastMessage) {
        return;
    }
    lastMessage = err;
    lastError = lastMessage;
    if (!silenceOutput) {
        console.error(lastError);
        if (DEBUG) {
            var e = new Error("Stack trace");
            console.error(e.stack);
        }
    }
    errorCount += 1;
}
exports.error = error;
function warn(s) {
    var err = errorString(s);
    // De-dup identical messages
    if (err === lastMessage) {
        return;
    }
    lastMessage = err;
    if (!silenceOutput) {
        console.warn(lastMessage);
    }
}
exports.warn = warn;
function getLastMessage() {
    return lastMessage;
}
exports.getLastMessage = getLastMessage;
function errorString(s) {
    var ctx = getContext();
    if (ctx.line !== undefined && ctx.column !== undefined) {
        return 'bolt:' + ctx.line + ':' + ctx.column + ': ' + s;
    }
    else {
        return 'bolt: ' + s;
    }
}
function hasErrors() {
    return errorCount > 0;
}
exports.hasErrors = hasErrors;
function errorSummary() {
    if (errorCount === 1) {
        return lastError;
    }
    if (errorCount !== 0) {
        return "Fatal errors: " + errorCount;
    }
    return "";
}
exports.errorSummary = errorSummary;


},{}],4:[function(require,module,exports){
"use strict";
exports.__esModule = true;
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
var parser = require('./rules-parser');
function parseExpression(expression) {
    var result = parser.parse('function f() {return ' + expression + ';}');
    return result.functions.f.body;
}
exports.parseExpression = parseExpression;


},{"./rules-parser":6}],5:[function(require,module,exports){
"use strict";
exports.__esModule = true;
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
var util = require("./util");
var ast = require("./ast");
var logger_1 = require("./logger");
var parser = require('./rules-parser');
var parse_util_1 = require("./parse-util");
var errors = {
    badIndex: "The index function must return a String or an array of Strings.",
    noPaths: "Must have at least one path expression.",
    nonObject: "Type contains properties and must extend 'Object'.",
    missingSchema: "Missing definition for type.",
    recursive: "Recursive function call.",
    mismatchParams: "Incorrect number of function arguments.",
    generateFailed: "Could not generate JSON: ",
    noSuchType: "No type definition for: ",
    badSchemaMethod: "Unsupported method name in type statement: ",
    badPathMethod: "Unsupported method name in path statement: ",
    badWriteAlias: "Cannot have both a write() method and a write-aliasing method: ",
    coercion: "Cannot convert value: ",
    undefinedFunction: "Undefined function: ",
    application: "Bolt application error: ",
    invalidGeneric: "Invalid generic schema usage: ",
    invalidMapKey: "Map<Key, T> - Key must derive from String type.",
    invalidWildChildren: "Types can have at most one $wild property and cannot mix with other properties.",
    invalidPropertyName: "Property names cannot contain any of: . $ # [ ] / or control characters: "
};
var INVALID_KEY_REGEX = /[\[\].#$\/\u0000-\u001F\u007F]/;
;
var builtinSchemaNames = ['Any', 'Null', 'String', 'Number', 'Boolean', 'Object'];
// Method names allowed in Bolt files.
var valueMethods = ['length', 'includes', 'startsWith', 'beginsWith', 'endsWith',
    'replace', 'toLowerCase', 'toUpperCase', 'test', 'contains',
    'matches'];
// TODO: Make sure users don't call internal methods...make private to impl.
var snapshotMethods = ['parent', 'child', 'hasChildren', 'val', 'isString', 'isNumber',
    'isBoolean'].concat(valueMethods);
var writeAliases = {
    'create': parse_util_1.parseExpression('prior(this) == null'),
    'update': parse_util_1.parseExpression('prior(this) != null && this != null'),
    'delete': parse_util_1.parseExpression('prior(this) != null && this == null')
};
// Usage:
//   json = bolt.generate(bolt-text)
function generate(symbols) {
    if (typeof symbols === 'string') {
        symbols = parser.parse(symbols);
    }
    var gen = new Generator(symbols);
    return gen.generateRules();
}
exports.generate = generate;
// Symbols contains:
//   functions: {}
//   schema: {}
//   paths: {}
var Generator = /** @class */ (function () {
    function Generator(symbols) {
        this.symbols = symbols;
        this.validators = {};
        this.rules = {};
        this.errorCount = 0;
        this.runSilently = false;
        this.allowUndefinedFunctions = false;
        this.keyIndex = 0;
        // TODO: globals should be part of this.symbols (nested scopes)
        this.globals = {
            "root": ast.call(ast.variable('@root'))
        };
        this.registerBuiltinSchema();
    }
    // Return Firebase compatible Rules JSON for a the given symbols definitions.
    Generator.prototype.generateRules = function () {
        var _this = this;
        this.errorCount = 0;
        var paths = this.symbols.paths;
        var schema = this.symbols.schema;
        var name;
        paths.forEach(function (path) {
            _this.validateMethods(errors.badPathMethod, path.methods, ['validate', 'read', 'write', 'index']);
        });
        for (name in schema) {
            if (!util.arrayIncludes(builtinSchemaNames, name)) {
                this.validateMethods(errors.badSchemaMethod, schema[name].methods, ['validate', 'read', 'write']);
            }
        }
        if (paths.length === 0) {
            this.fatal(errors.noPaths);
        }
        paths.forEach(function (path) { return _this.updateRules(path); });
        this.convertExpressions(this.rules);
        if (this.errorCount !== 0) {
            throw new Error(errors.generateFailed + this.errorCount + " errors.");
        }
        util.deletePropName(this.rules, '.scope');
        util.pruneEmptyChildren(this.rules);
        return {
            rules: this.rules
        };
    };
    Generator.prototype.validateMethods = function (m, methods, allowed) {
        var _this = this;
        if (util.arrayIncludes(allowed, 'write')) {
            allowed = allowed.concat(Object.keys(writeAliases));
        }
        for (var method in methods) {
            if (!util.arrayIncludes(allowed, method)) {
                logger_1.warn(m + util.quoteString(method) +
                    " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
            }
        }
        if ('write' in methods) {
            Object.keys(writeAliases).forEach(function (alias) {
                if (alias in methods) {
                    _this.fatal(errors.badWriteAlias + alias);
                }
            });
        }
    };
    Generator.prototype.registerBuiltinSchema = function () {
        var self = this;
        var thisVar = ast.variable('this');
        function registerAsCall(name, methodName) {
            self.symbols.registerSchema(name, ast.typeType('Any'), undefined, {
                validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'), ast.string(methodName))))
            });
        }
        this.symbols.registerSchema('Any', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.boolean(true))
        });
        registerAsCall('Object', 'hasChildren');
        // Because of the way firebase treats Null values, there is no way to
        // write a validation rule, that will EVER be called with this == null
        // (firebase allows values to be deleted no matter their validation rules).
        // So, comparing this == null will always return false -> that is what
        // we do here, which will be optimized away if ORed with other validations.
        this.symbols.registerSchema('Null', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.boolean(false))
        });
        self.symbols.registerSchema('String', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'), ast.string('isString')))),
            includes: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('contains')), [ast.value(ast.variable('s'))])),
            startsWith: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('beginsWith')), [ast.value(ast.variable('s'))])),
            endsWith: ast.method(['this', 's'], ast.call(ast.reference(ast.value(thisVar), ast.string('endsWith')), [ast.value(ast.variable('s'))])),
            replace: ast.method(['this', 's', 'r'], ast.call(ast.reference(ast.value(thisVar), ast.string('replace')), [ast.value(ast.variable('s')), ast.value(ast.variable('r'))])),
            test: ast.method(['this', 'r'], ast.call(ast.reference(ast.value(thisVar), ast.string('matches')), [ast.call(ast.variable('@RegExp'), [ast.variable('r')])]))
        });
        registerAsCall('Number', 'isNumber');
        registerAsCall('Boolean', 'isBoolean');
        this.symbols.registerFunction('@RegExp', ['r'], ast.builtin(this.ensureType.bind(this, 'RegExp')));
        var map = this.symbols.registerSchema('Map', ast.typeType('Any'), undefined, undefined, ['Key', 'Value']);
        map.getValidator = this.getMapValidator.bind(this);
    };
    // type Map<Key, Value> => {
    //   $key: {
    //     '.validate': $key instanceof Key and this instanceof Value;
    //   '.validate': 'newData.hasChildren()'
    // }
    // Key must derive from String
    Generator.prototype.getMapValidator = function (params) {
        var keyType = params[0];
        var valueType = params[1];
        if (keyType.type !== 'type' || !this.symbols.isDerivedFrom(keyType, 'String')) {
            throw new Error(errors.invalidMapKey + "  (" + ast.decodeExpression(keyType) + " does not)");
        }
        var validator = {};
        var index = this.uniqueKey();
        validator[index] = {};
        extendValidator(validator, this.ensureValidator(ast.typeType('Object')));
        // First validate the key (omit terminal String type validation).
        while (keyType.name !== 'String') {
            var schema = this.symbols.schema[keyType.name];
            if (schema.methods['validate']) {
                var exp = this.partialEval(schema.methods['validate'].body, { 'this': ast.literal(index) });
                extendValidator(validator[index], { '.validate': [exp] });
            }
            keyType = schema.derivedFrom;
        }
        extendValidator(validator[index], this.ensureValidator(valueType));
        return validator;
    };
    Generator.prototype.uniqueKey = function () {
        this.keyIndex += 1;
        return '$key' + this.keyIndex;
    };
    // Collection schema has exactly one $wildchild property
    Generator.prototype.isCollectionSchema = function (schema) {
        var props = Object.keys(schema.properties);
        var result = props.length === 1 && props[0][0] === '$';
        return result;
    };
    // Ensure we have a definition for a validator for the given schema.
    Generator.prototype.ensureValidator = function (type) {
        var key = ast.decodeExpression(type);
        if (!this.validators[key]) {
            this.validators[key] = { '.validate': ast.literal('***TYPE RECURSION***') };
            var allowSave = this.allowUndefinedFunctions;
            this.allowUndefinedFunctions = true;
            this.validators[key] = this.createValidator(type);
            this.allowUndefinedFunctions = allowSave;
        }
        return this.validators[key];
    };
    Generator.prototype.createValidator = function (type) {
        var _this = this;
        switch (type.type) {
            case 'type':
                return this.createValidatorFromSchemaName(type.name);
            case 'union':
                var union_1 = {};
                type.types.forEach(function (typePart) {
                    // Make a copy
                    var singleType = extendValidator({}, _this.ensureValidator(typePart));
                    mapValidator(singleType, ast.andArray);
                    extendValidator(union_1, singleType);
                });
                mapValidator(union_1, ast.orArray);
                return union_1;
            case 'generic':
                var genericType = type;
                return this.createValidatorFromGeneric(genericType.name, genericType.params);
            default:
                throw new Error(errors.application + "invalid internal type: " + type.type);
        }
    };
    Generator.prototype.createValidatorFromGeneric = function (schemaName, params) {
        var schema = this.symbols.schema[schemaName];
        if (schema === undefined || !ast.Schema.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " (generic)");
        }
        var schemaParams = schema.params;
        if (params.length !== schemaParams.length) {
            throw new Error(errors.invalidGeneric + " expected <" + schemaParams.join(', ') + ">");
        }
        // Call custom validator, if given.
        if (schema.getValidator) {
            return schema.getValidator(params);
        }
        var bindings = {};
        for (var i = 0; i < params.length; i++) {
            bindings[schemaParams[i]] = params[i];
        }
        // Expand generics and generate validator from schema.
        schema = this.replaceGenericsInSchema(schema, bindings);
        return this.createValidatorFromSchema(schema);
    };
    Generator.prototype.replaceGenericsInSchema = function (schema, bindings) {
        var _this = this;
        var expandedSchema = {
            derivedFrom: this.replaceGenericsInExp(schema.derivedFrom, bindings),
            properties: {},
            methods: {}
        };
        var props = Object.keys(schema.properties);
        props.forEach(function (prop) {
            expandedSchema.properties[prop] =
                _this.replaceGenericsInExp(schema.properties[prop], bindings);
        });
        var methods = Object.keys(schema.methods);
        methods.forEach(function (methodName) {
            expandedSchema.methods[methodName] = _this.replaceGenericsInMethod(schema.methods[methodName], bindings);
        });
        return expandedSchema;
    };
    Generator.prototype.replaceGenericsInExp = function (exp, bindings) {
        var self = this;
        function replaceGenericsInArray(exps) {
            return exps.map(function (expPart) {
                return self.replaceGenericsInExp(expPart, bindings);
            });
        }
        switch (exp.type) {
            case 'op':
            case 'call':
                var opType = ast.copyExp(exp);
                opType.args = replaceGenericsInArray(opType.args);
                return opType;
            case 'type':
                var simpleType = exp;
                return bindings[simpleType.name] || simpleType;
            case 'union':
                var unionType = exp;
                return ast.unionType(replaceGenericsInArray(unionType.types));
            case 'generic':
                var genericType = exp;
                return ast.genericType(genericType.name, replaceGenericsInArray(genericType.params));
            default:
                return exp;
        }
    };
    Generator.prototype.replaceGenericsInMethod = function (method, bindings) {
        var expandedMethod = {
            params: method.params,
            body: method.body
        };
        expandedMethod.body = this.replaceGenericsInExp(method.body, bindings);
        return expandedMethod;
    };
    Generator.prototype.createValidatorFromSchemaName = function (schemaName) {
        var schema = this.symbols.schema[schemaName];
        if (!schema) {
            throw new Error(errors.noSuchType + schemaName);
        }
        if (ast.Schema.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " used as non-generic type.");
        }
        return this.createValidatorFromSchema(schema);
    };
    Generator.prototype.createValidatorFromSchema = function (schema) {
        var _this = this;
        var hasProps = Object.keys(schema.properties).length > 0 &&
            !this.isCollectionSchema(schema);
        if (hasProps && !this.symbols.isDerivedFrom(schema.derivedFrom, 'Object')) {
            this.fatal(errors.nonObject + " (is " + ast.decodeExpression(schema.derivedFrom) + ")");
            return {};
        }
        var validator = {};
        if (!(schema.derivedFrom.type === 'type' &&
            schema.derivedFrom.name === 'Any')) {
            extendValidator(validator, this.ensureValidator(schema.derivedFrom));
        }
        var requiredProperties = [];
        var wildProperties = 0;
        Object.keys(schema.properties).forEach(function (propName) {
            if (propName[0] === '$') {
                wildProperties += 1;
                if (INVALID_KEY_REGEX.test(propName.slice(1))) {
                    _this.fatal(errors.invalidPropertyName + propName);
                }
            }
            else {
                if (INVALID_KEY_REGEX.test(propName)) {
                    _this.fatal(errors.invalidPropertyName + propName);
                }
            }
            if (!validator[propName]) {
                validator[propName] = {};
            }
            var propType = schema.properties[propName];
            if (propName[0] !== '$' && !_this.isNullableType(propType)) {
                requiredProperties.push(propName);
            }
            extendValidator(validator[propName], _this.ensureValidator(propType));
        });
        if (wildProperties > 1 || wildProperties === 1 && requiredProperties.length > 0) {
            this.fatal(errors.invalidWildChildren);
        }
        if (requiredProperties.length > 0) {
            // this.hasChildren(requiredProperties)
            extendValidator(validator, { '.validate': [hasChildrenExp(requiredProperties)] });
        }
        // Disallow $other properties by default
        if (hasProps) {
            validator['$other'] = {};
            extendValidator(validator['$other'], { '.validate': ast.boolean(false) });
        }
        this.extendValidationMethods(validator, schema.methods);
        return validator;
    };
    Generator.prototype.isNullableType = function (type) {
        var result = this.symbols.isDerivedFrom(type, 'Null') ||
            this.symbols.isDerivedFrom(type, 'Map');
        return result;
    };
    // Update rules based on the given path expression.
    Generator.prototype.updateRules = function (path) {
        var i;
        var location = util.ensureObjectPath(this.rules, path.template.getLabels());
        var exp;
        extendValidator(location, this.ensureValidator(path.isType));
        location['.scope'] = path.template.getScope();
        this.extendValidationMethods(location, path.methods);
        // Write indices
        if (path.methods['index']) {
            switch (path.methods['index'].body.type) {
                case 'String':
                    exp = ast.array([path.methods['index'].body]);
                    break;
                case 'Array':
                    exp = path.methods['index'].body;
                    break;
                default:
                    this.fatal(errors.badIndex);
                    return;
            }
            var indices = [];
            for (i = 0; i < exp.value.length; i++) {
                if (exp.value[i].type !== 'String') {
                    this.fatal(errors.badIndex + " (not " + exp.value[i].type + ")");
                }
                else {
                    indices.push(exp.value[i].value);
                }
            }
            // TODO: Error check not over-writing index rules.
            location['.indexOn'] = indices;
        }
    };
    Generator.prototype.extendValidationMethods = function (validator, methods) {
        var writeMethods = [];
        ['create', 'update', 'delete'].forEach(function (method) {
            if (method in methods) {
                writeMethods.push(ast.andArray([writeAliases[method], methods[method].body]));
            }
        });
        if (writeMethods.length !== 0) {
            extendValidator(validator, { '.write': ast.orArray(writeMethods) });
        }
        ['validate', 'read', 'write'].forEach(function (method) {
            if (method in methods) {
                var methodValidator = {};
                methodValidator['.' + method] = methods[method].body;
                extendValidator(validator, methodValidator);
            }
        });
    };
    // Return union validator (||) over each schema
    Generator.prototype.unionValidators = function (schema) {
        var union = {};
        schema.forEach(function (typeName) {
            // First and the validator terms for a single type
            // Todo extend to unions and generics
            var singleType = extendValidator({}, this.ensureValidator(typeName));
            mapValidator(singleType, ast.andArray);
            extendValidator(union, singleType);
        }.bind(this));
        mapValidator(union, ast.orArray);
        return union;
    };
    // Convert expressions to text, and at the same time, apply pruning operations
    // to remove no-op rules.
    Generator.prototype.convertExpressions = function (validator) {
        var _this = this;
        var methodThisIs = { '.validate': 'newData',
            '.read': 'data',
            '.write': 'newData' };
        function hasWildcardSibling(path) {
            var parts = path.getLabels();
            var childPart = parts.pop();
            var parent = util.deepLookup(validator, parts);
            if (parent === undefined) {
                return false;
            }
            for (var _i = 0, _a = Object.keys(parent); _i < _a.length; _i++) {
                var prop = _a[_i];
                if (prop === childPart) {
                    continue;
                }
                if (prop[0] === '$') {
                    return true;
                }
            }
            return false;
        }
        mapValidator(validator, function (value, prop, scope, path) {
            if (prop in methodThisIs) {
                var result = _this.getExpressionText(ast.andArray(collapseHasChildren(value)), methodThisIs[prop], scope, path);
                // Remove no-op .read or .write rule if no sibling wildcard props.
                if ((prop === '.read' || prop === '.write') && result === 'false') {
                    if (!hasWildcardSibling(path)) {
                        return undefined;
                    }
                }
                // Remove no-op .validate rule if no sibling wildcard props.
                if (prop === '.validate' && result === 'true') {
                    if (!hasWildcardSibling(path)) {
                        return undefined;
                    }
                }
                return result;
            }
            return value;
        });
    };
    Generator.prototype.getExpressionText = function (exp, thisIs, scope, path) {
        if (!('type' in exp)) {
            throw new Error(errors.application + "Not an expression: " + util.prettyJSON(exp));
        }
        // First evaluate w/o binding of this to specific location.
        this.allowUndefinedFunctions = true;
        scope = util.extend({}, scope, { 'this': ast.cast(ast.call(ast.variable('@getThis')), 'Snapshot') });
        exp = this.partialEval(exp, scope);
        // Now re-evaluate the flattened expression.
        this.allowUndefinedFunctions = false;
        this.thisIs = thisIs;
        this.symbols.registerFunction('@getThis', [], ast.builtin(this.getThis.bind(this)));
        this.symbols.registerFunction('@root', [], ast.builtin(this.getRootReference.bind(this, path)));
        this.symbols.registerFunction('prior', ['exp'], ast.builtin(this.prior.bind(this)));
        this.symbols.registerFunction('key', [], ast.builtin(this.getKey.bind(this, path.length() === 0 ? '' : path.getPart(-1).label)));
        exp = this.partialEval(exp);
        delete this.symbols.functions['@getThis'];
        delete this.symbols.functions['@root'];
        delete this.symbols.functions['prior'];
        delete this.symbols.functions['key'];
        // Top level expressions should never be to a snapshot reference - should
        // always evaluate to a boolean.
        exp = ast.ensureBoolean(exp);
        return ast.decodeExpression(exp);
    };
    /*
     *  Wrapper for partialEval debugging.
     */
    Generator.prototype.partialEval = function (exp, params, functionCalls) {
        if (params === void 0) { params = {}; }
        if (functionCalls === void 0) { functionCalls = {}; }
        // Wrap real call for debugging.
        var result = this.partialEvalReal(exp, params, functionCalls);
        // console.log(ast.decodeExpression(exp) + " => " + ast.decodeExpression(result));
        return result;
    };
    // Partial evaluation of expressions - copy of expression tree (immutable).
    //
    // - Expand inline function calls.
    // - Replace local and global variables with their values.
    // - Expand snapshot references using child('ref').
    // - Coerce snapshot references to values as needed.
    Generator.prototype.partialEvalReal = function (exp, params, functionCalls) {
        if (params === void 0) { params = {}; }
        if (functionCalls === void 0) { functionCalls = {}; }
        var self = this;
        function subExpression(exp2) {
            return self.partialEval(exp2, params, functionCalls);
        }
        function valueExpression(exp2) {
            return ast.ensureValue(subExpression(exp2));
        }
        function booleanExpression(exp2) {
            return ast.ensureBoolean(subExpression(exp2));
        }
        function lookupVar(exp2) {
            // TODO: Unbound variable access should be an error.
            return params[exp2.name] || self.globals[exp2.name] || exp2;
        }
        // Convert ref[prop] => ref.child(prop)
        function snapshotChild(ref) {
            return ast.cast(ast.call(ast.reference(ref.base, ast.string('child')), [ref.accessor]), 'Snapshot');
        }
        switch (exp.type) {
            case 'op':
                var expOp = ast.copyExp(exp);
                // Ensure arguments are boolean (or values) where needed.
                if (expOp.op === 'value') {
                    expOp.args[0] = valueExpression(expOp.args[0]);
                }
                else if (expOp.op === '||' || expOp.op === '&&' || expOp.op === '!') {
                    for (var i = 0; i < expOp.args.length; i++) {
                        expOp.args[i] = booleanExpression(expOp.args[i]);
                    }
                }
                else if (expOp.op === '?:') {
                    expOp.args[0] = booleanExpression(expOp.args[0]);
                    expOp.args[1] = valueExpression(expOp.args[1]);
                    expOp.args[2] = valueExpression(expOp.args[2]);
                }
                else {
                    for (var i = 0; i < expOp.args.length; i++) {
                        expOp.args[i] = valueExpression(expOp.args[i]);
                    }
                }
                return expOp;
            case 'var':
                return lookupVar(exp);
            case 'ref':
                var expRef = ast.copyExp(exp);
                expRef.base = subExpression(expRef.base);
                // var[ref] => var[ref]
                if (expRef.base.valueType !== 'Snapshot') {
                    expRef.accessor = subExpression(expRef.accessor);
                    return expRef;
                }
                var propName = ast.getPropName(expRef);
                // snapshot.prop (static string property)
                if (propName !== '') {
                    // snapshot.valueMethod => snapshot.val().valueMethod
                    if (util.arrayIncludes(valueMethods, propName)) {
                        expRef.base = valueExpression(expRef.base);
                        return expRef;
                    }
                    // snapshot.ssMethod => snapshot.ssMethod
                    if (util.arrayIncludes(snapshotMethods, propName)) {
                        return expRef;
                    }
                }
                // snapshot[exp] => snapshot.child(exp) or
                // snapshot[ref] => snapshot.child(ref.val())
                expRef.accessor = valueExpression(expRef.accessor);
                return snapshotChild(expRef);
            case 'call':
                var expCall = ast.copyExp(exp);
                expCall.ref = subExpression(expCall.ref);
                var callee = this.lookupFunction(expCall.ref);
                // Expand the function call inline
                if (callee) {
                    var fn = callee.fn;
                    if (callee.self) {
                        expCall.args.unshift(ast.ensureValue(callee.self));
                    }
                    if (fn.params.length !== expCall.args.length) {
                        this.fatal(errors.mismatchParams + " ( " +
                            callee.methodName + " expects " + fn.params.length +
                            " but actually passed " + expCall.args.length + ")");
                        return exp;
                    }
                    if (fn.body.type === 'builtin') {
                        return fn.body.fn(expCall.args, params);
                    }
                    var innerParams = {};
                    for (var i = 0; i < fn.params.length; i++) {
                        innerParams[fn.params[i]] = subExpression(expCall.args[i]);
                    }
                    if (functionCalls[callee.methodName]) {
                        throw new Error(errors.recursive + " (" + callee.methodName + ")");
                    }
                    functionCalls[callee.methodName] = true;
                    var result = this.partialEval(fn.body, innerParams, functionCalls);
                    functionCalls[callee.methodName] = false;
                    return result;
                }
                // Can't expand function - but just expand the arguments.
                if (!this.allowUndefinedFunctions) {
                    var funcName = ast.getMethodName(expCall);
                    if (funcName !== '' && !(funcName in this.symbols.schema['String'].methods ||
                        util.arrayIncludes(snapshotMethods, funcName))) {
                        this.fatal(errors.undefinedFunction + ast.decodeExpression(expCall.ref));
                    }
                }
                for (var i = 0; i < expCall.args.length; i++) {
                    expCall.args[i] = subExpression(expCall.args[i]);
                }
                // Hack for snapshot.parent().val()
                // Todo - build table-based method signatures.
                if (ast.getMethodName(expCall) === 'parent') {
                    expCall = ast.cast(expCall, 'Snapshot');
                }
                return expCall;
            // Expression types (like literals) than need no expansion.
            default:
                return exp;
        }
    };
    // Builtin function - convert all 'this' to 'data' (from 'newData').
    // Args are function arguments, and params are the local (function) scope variables.
    Generator.prototype.prior = function (args, params) {
        var lastThisIs = this.thisIs;
        this.thisIs = 'data';
        var exp = this.partialEval(args[0], params);
        this.thisIs = lastThisIs;
        return exp;
    };
    // Builtin function - current value of 'this'
    Generator.prototype.getThis = function (args, params) {
        return ast.snapshotVariable(this.thisIs);
    };
    // Builtin function - ensure type of argument
    Generator.prototype.ensureType = function (type, args, params) {
        if (args.length !== 1) {
            throw new Error(errors.application + "ensureType arguments.");
        }
        var exp = this.partialEval(args[0], params);
        if (exp.type !== type) {
            throw new Error(errors.coercion + ast.decodeExpression(exp) + " => " + type);
        }
        return exp;
    };
    // Builtin function - return the parent key of 'this'.
    Generator.prototype.getKey = function (key, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.mismatchParams + "(found " + args.length + " but expected 1)");
        }
        return key[0] === '$' ? ast.literal(key) : ast.string(key);
    };
    // Builtin function - return the reference to the root
    // When in read mode - use 'root'
    // When in write/validate - use path to root via newData.parent()...
    Generator.prototype.getRootReference = function (path, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.application + "@root arguments.");
        }
        // 'data' case
        if (this.thisIs === 'data') {
            return ast.snapshotVariable('root');
        }
        // TODO(koss): Remove this special case if JSON supports newRoot instead.
        // 'newData' case - traverse to root via parent()'s.
        var result = ast.snapshotVariable('newData');
        for (var i = 0; i < path.length(); i++) {
            result = ast.snapshotParent(result);
        }
        return result;
    };
    // Lookup globally defined function.
    Generator.prototype.lookupFunction = function (ref) {
        // Function call.
        if (ref.type === 'var') {
            var refVar = ref;
            var fn = this.symbols.functions[refVar.name];
            if (!fn) {
                return undefined;
            }
            return { self: undefined, fn: fn, methodName: refVar.name };
        }
        // Method call.
        if (ref.type === 'ref') {
            var refRef = ref;
            // TODO: Require static type validation before calling String methods.
            if (refRef.base.op !== 'value' &&
                refRef.accessor.value in this.symbols.schema['String'].methods) {
                var methodName = refRef.accessor.value;
                return { self: refRef.base,
                    fn: this.symbols.schema['String'].methods[methodName],
                    methodName: 'String.' + methodName
                };
            }
        }
        return undefined;
    };
    Generator.prototype.fatal = function (s) {
        logger_1.error(s);
        this.errorCount += 1;
    };
    return Generator;
}());
exports.Generator = Generator;
;
// Merge all .X terms into target.
function extendValidator(target, src) {
    if (src === undefined) {
        throw new Error(errors.application + "Illegal validation source.");
    }
    for (var prop in src) {
        if (!src.hasOwnProperty(prop)) {
            continue;
        }
        if (prop[0] === '.') {
            if (target[prop] === undefined) {
                target[prop] = [];
            }
            if (util.isType(src[prop], 'array')) {
                util.extendArray(target[prop], src[prop]);
            }
            else {
                target[prop].push(src[prop]);
            }
        }
        else {
            if (!target[prop]) {
                target[prop] = {};
            }
            extendValidator(target[prop], src[prop]);
        }
    }
    return target;
}
exports.extendValidator = extendValidator;
// Call fn(value, prop, path) on all '.props' and assiging the value back into the
// validator.
function mapValidator(v, fn, scope, path) {
    if (!scope) {
        scope = {};
    }
    if (!path) {
        path = new ast.PathTemplate();
    }
    if ('.scope' in v) {
        scope = v['.scope'];
    }
    for (var prop in v) {
        if (!v.hasOwnProperty(prop)) {
            continue;
        }
        if (prop[0] === '.') {
            var value = fn(v[prop], prop, scope, path);
            if (value !== undefined) {
                v[prop] = value;
            }
            else {
                delete v[prop];
            }
        }
        else if (!util.isType(v[prop], 'object')) {
            continue;
        }
        else {
            var child = new ast.PathTemplate([prop]);
            path.push(child);
            mapValidator(v[prop], fn, scope, path);
            path.pop(child);
        }
    }
}
exports.mapValidator = mapValidator;
// Collapse all hasChildren calls into one (combining their arguments).
// E.g. [newData.hasChildren(), newData.hasChildren(['x']), newData.hasChildren(['y'])] =>
//      newData.hasChildren(['x', 'y'])
function collapseHasChildren(exps) {
    var hasHasChildren = false;
    var combined = [];
    var result = [];
    exps.forEach(function (exp) {
        if (exp.type !== 'call') {
            result.push(exp);
            return;
        }
        var expCall = exp;
        if (ast.getMethodName(expCall) !== 'hasChildren') {
            result.push(exp);
            return;
        }
        if (expCall.args.length === 0) {
            hasHasChildren = true;
            return;
        }
        // Expect one argument of Array type.
        if (expCall.args.length !== 1 || expCall.args[0].type !== 'Array') {
            throw new Error(errors.application + "Invalid argument to hasChildren(): " +
                expCall.args[0].type);
        }
        var args = expCall.args[0].value;
        args.forEach(function (arg) {
            hasHasChildren = true;
            if (arg.type !== 'String') {
                throw new Error(errors.application + "Expect string argument to hasChildren(), not: " +
                    arg.type);
            }
            combined.push(arg.value);
        });
    });
    if (hasHasChildren) {
        result.unshift(hasChildrenExp(combined));
    }
    return result;
}
// Generate this.hasChildren([props, ...]) or this.hasChildren()
function hasChildrenExp(props) {
    var args = props.length === 0 ? [] : [ast.array(props.map(ast.string))];
    return ast.call(ast.reference(ast.cast(ast.variable('this'), 'Any'), ast.string('hasChildren')), args);
}


},{"./ast":1,"./logger":3,"./parse-util":4,"./rules-parser":6,"./util":7}],6:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleFunctions = { start: peg$parsestart },
        peg$startRuleFunction  = peg$parsestart,

        peg$c0 = peg$FAILED,
        peg$c1 = function() {
          if (logger.hasErrors()) {
            throw(new Error(logger.errorSummary()));
          }
          return symbols;
        },
        peg$c2 = [],
        peg$c3 = { type: "other", description: "function definition" },
        peg$c4 = null,
        peg$c5 = function(func, body) {
          if (func.name === null) {
            error("Missing function name.");
            return;
          }
          if (func.params === null) {
            error("Function " + func.name + " missing parameters.");
            return;
          }
          if (body === null) {
            error("Function " + func.name + " missing or invalid function body.");
            return;
          }
          symbols.registerFunction(ensureLowerCase(func.name, "Function names"), func.params, body);
        },
        peg$c6 = "function",
        peg$c7 = { type: "literal", value: "function", description: "\"function\"" },
        peg$c8 = function(name, params) { return {name: name, params: params}; },
        peg$c9 = function(name, params) {return {name: name, params: params}; },
        peg$c10 = { type: "other", description: "path statement" },
        peg$c11 = "is",
        peg$c12 = { type: "literal", value: "is", description: "\"is\"" },
        peg$c13 = function(id) { return id; },
        peg$c14 = "{",
        peg$c15 = { type: "literal", value: "{", description: "\"{\"" },
        peg$c16 = "}",
        peg$c17 = { type: "literal", value: "}", description: "\"}\"" },
        peg$c18 = function(all) { return all; },
        peg$c19 = ";",
        peg$c20 = { type: "literal", value: ";", description: "\";\"" },
        peg$c21 = function() { return {}; },
        peg$c22 = function(path, isType, methods) {
            if (path === null) {
              return;
            }
            if (methods === null) {
              error("Missing body of path statement.");
              return;
            }
            symbols.registerPath(currentPath, isType, methods);
            currentPath.pop(path);
          },
        peg$c23 = "path",
        peg$c24 = { type: "literal", value: "path", description: "\"path\"" },
        peg$c25 = function(path) {
            if (path === null) {
              error("Missing Path Template in path statement.");
              return path;
            }
            currentPath.push(path);
            return path;
          },
        peg$c26 = function(path) {
            currentPath.push(path); return path;
          },
        peg$c27 = { type: "other", description: "path template" },
        peg$c28 = "/",
        peg$c29 = { type: "literal", value: "/", description: "\"/\"" },
        peg$c30 = function(part) { return part; },
        peg$c31 = function(parts) {
          var hasError = false;
          if (parts.length === 1 && parts[0] === null) {
            parts = [];
          }
          parts = parts.map(function(part) {
            if (part === null) {
              hasError = true;
              return '';
            }
            return part;
          });
          if (hasError) {
            error((parts[parts.length - 1] === ''
                   ? "Paths may not end in a slash (/) character"
                   : "Paths may not contain an empty part") + ": /" + parts.map(function(part) { return part.label; }).join('/'));
          }
          return new ast.PathTemplate(parts);
        },
        peg$c32 = "=",
        peg$c33 = { type: "literal", value: "=", description: "\"=\"" },
        peg$c34 = "*",
        peg$c35 = { type: "literal", value: "*", description: "\"*\"" },
        peg$c36 = function(id) {
          return new ast.PathPart(id, id);
        },
        peg$c37 = /^[^ \/;]/,
        peg$c38 = { type: "class", value: "[^ \\/;]", description: "[^ \\/;]" },
        peg$c39 = function(chars) {
          var result = chars.join('');
          if (chars[0] === '$') {
            warn("Use of " + result + " to capture a path segment is deprecated; " +
                 "use {" + result + "} or {" + result.slice(1) + "}, instead.");
          }
          return new ast.PathPart(result);
        },
        peg$c40 = function(all) {
          var result = {};
          for (var i = 0; i < all.length; i++) {
            var method = all[i];
            // Skip embedded path statements.
            if (method === undefined) {
              continue;
            }
            if (typeof method == 'string') {
              error("Invalid path or method: '" + method + "'.");
              continue;
            }
            if (method.name in result) {
              error("Duplicate method name: " + method.name);
            }
            result[method.name] = ast.method(method.params, method.body);
          }
          return result;
        },
        peg$c41 = { type: "other", description: "type statement" },
        peg$c42 = "type",
        peg$c43 = { type: "literal", value: "type", description: "\"type\"" },
        peg$c44 = "<",
        peg$c45 = { type: "literal", value: "<", description: "\"<\"" },
        peg$c46 = ">",
        peg$c47 = { type: "literal", value: ">", description: "\">\"" },
        peg$c48 = function(list) { return ensureUpperCase(list, "Type names"); },
        peg$c49 = "extends",
        peg$c50 = { type: "literal", value: "extends", description: "\"extends\"" },
        peg$c51 = function(type) { return type; },
        peg$c52 = function() { return {properties: {}, methods: {}}; },
        peg$c53 = function(type, params, ext, body) {
            if (params === null) {
              params = [];
            }
            if (type === null) {
              error("Missing type name.");
              return;
            }
            if (body === null) {
              error("Missing or invalid type statement body.");
              return;
            }
            symbols.registerSchema(ensureUpperCase(type, "Type names"),
                                   ext, body.properties, body.methods, params);
        },
        peg$c54 = function(all) {
          var result = {
             properties: {},
             methods: {}
          };

          function addPart(part) {
            // TODO: Make sure methods and properties don't shadow each other.
            if (typeof part === 'string') {
              error("Invalid property or method: '" + part + "'.");
              return;
            }
            if ('type' in part) {
              if (result.properties[part.name]) {
                error("Duplicate property name: " + part.name);
              }
              result.properties[part.name] = part.type;
            } else {
              if (result.methods[part.name]) {
                error("Duplicate method name: " + part.name);
              }
              result.methods[part.name] = ast.method(part.params, part.body);
            }
          }

          for (var i = 0; i < all.length; i++) {
            addPart(all[i]);
          }

          return result;
        },
        peg$c55 = ":",
        peg$c56 = { type: "literal", value: ":", description: "\":\"" },
        peg$c57 = function(name, type) {
          return {
            name:  name,
            type: type
          };
        },
        peg$c58 = ",",
        peg$c59 = { type: "literal", value: ",", description: "\",\"" },
        peg$c60 = function(sep) { return sep; },
        peg$c61 = { type: "other", description: "method" },
        peg$c62 = function(name, params, body, sep) {
          if (sep !== null) {
            warn("Extra separator (" + sep + ") not needed.");
          }
          return {
            name:  ensureLowerCase(name, "Method names"),
            params: params,
            body:  body
          };
        },
        peg$c63 = "return",
        peg$c64 = { type: "literal", value: "return", description: "\"return\"" },
        peg$c65 = function(exp) { return exp; },
        peg$c66 = function(exp) {
            warn("Use of fn(x) = exp; format is deprecated; use fn(x) { exp }, instead.")
            return exp;
          },
        peg$c67 = "(",
        peg$c68 = { type: "literal", value: "(", description: "\"(\"" },
        peg$c69 = ")",
        peg$c70 = { type: "literal", value: ")", description: "\")\"" },
        peg$c71 = function(list) { return ensureLowerCase(list, "Function arguments"); },
        peg$c72 = function(head, tail) {
          if (!head) {
            return [];
          }
          tail.unshift(head);
          return tail;
        },
        peg$c73 = "|",
        peg$c74 = { type: "literal", value: "|", description: "\"|\"" },
        peg$c75 = function(head, tail) {
          if (tail.length == 0) {
            return head;
          }
          tail.unshift(head);
          return ast.unionType(tail);
        },
        peg$c76 = "[]",
        peg$c77 = { type: "literal", value: "[]", description: "\"[]\"" },
        peg$c78 = function() {return {isMap: true}; },
        peg$c79 = function(types) {return {types: types};},
        peg$c80 = function(type, opt) {
          type = ensureUpperCase(type, "Type names");
          if (!opt) {
            return ast.typeType(type);
          }
          if (opt.isMap) {
            return ast.genericType('Map', [ast.typeType('String'),
                                           ast.typeType(type)]);
          }
          return ast.genericType(type, opt.types);
        },
        peg$c81 = function(head, tail) {
          var result = [head];
          util.extendArray(result, tail);
          return result;
        },
        peg$c82 = void 0,
        peg$c83 = function(name) { return ast.variable(name); },
        peg$c84 = function(expression) { return expression; },
        peg$c85 = "[",
        peg$c86 = { type: "literal", value: "[", description: "\"[\"" },
        peg$c87 = "]",
        peg$c88 = { type: "literal", value: "]", description: "\"]\"" },
        peg$c89 = function(name) { return name; },
        peg$c90 = ".",
        peg$c91 = { type: "literal", value: ".", description: "\".\"" },
        peg$c92 = function(base, accessors) {
              var result = base;
              for (var i = 0; i < accessors.length; i++) {
                var exp = typeof accessors[i] == 'string' ? ast.string(accessors[i]) : accessors[i];
                result = ast.reference(result, exp);
              }
              return result;
            },
        peg$c93 = function(ref, args) {
                return ast.call(ref, args);
              },
        peg$c94 = function(args) { return args },
        peg$c95 = function(name) { return name },
        peg$c96 = function(base, argumentsOrAccessors) {
              var result = base;
              for (var i = 0; i < argumentsOrAccessors.length; i++) {
                var part = argumentsOrAccessors[i];
                if (typeof part == 'string') {
                  result = ast.reference(result, ast.string(part));
                } else if (util.isType(part, 'array')) {
                  result = ast.call(result, part);
                } else {
                  result = ast.reference(result, part);
                }
              }
              return result;
            },
        peg$c97 = function(args) {
          return args !== null ? args : [];
        },
        peg$c98 = function(head, tail) {
          tail.unshift(head);
          return tail;
        },
        peg$c99 = function(op, expression) {
              if (op == "noop") {
                return expression;
              }
              return ast.op(op, [expression]);
            },
        peg$c100 = "+",
        peg$c101 = { type: "literal", value: "+", description: "\"+\"" },
        peg$c102 = function() { return "noop"; },
        peg$c103 = "-",
        peg$c104 = { type: "literal", value: "-", description: "\"-\"" },
        peg$c105 = function() { return "neg"; },
        peg$c106 = "!",
        peg$c107 = { type: "literal", value: "!", description: "\"!\"" },
        peg$c108 = function(op, exp) { return {op: op, exp: exp}; },
        peg$c109 = function(head, tail) {
              return leftAssociative(head, tail);
            },
        peg$c110 = "%",
        peg$c111 = { type: "literal", value: "%", description: "\"%\"" },
        peg$c112 = "<=",
        peg$c113 = { type: "literal", value: "<=", description: "\"<=\"" },
        peg$c114 = ">=",
        peg$c115 = { type: "literal", value: ">=", description: "\">=\"" },
        peg$c116 = "===",
        peg$c117 = { type: "literal", value: "===", description: "\"===\"" },
        peg$c118 = "==",
        peg$c119 = { type: "literal", value: "==", description: "\"==\"" },
        peg$c120 = function() { return "=="; },
        peg$c121 = function() { error("Equality operator should be written as ==, not =.");  return "=="; },
        peg$c122 = "!==",
        peg$c123 = { type: "literal", value: "!==", description: "\"!==\"" },
        peg$c124 = "!=",
        peg$c125 = { type: "literal", value: "!=", description: "\"!=\"" },
        peg$c126 = function() { return "!="; },
        peg$c127 = "&&",
        peg$c128 = { type: "literal", value: "&&", description: "\"&&\"" },
        peg$c129 = "and",
        peg$c130 = { type: "literal", value: "and", description: "\"and\"" },
        peg$c131 = function() { return "&&"; },
        peg$c132 = "||",
        peg$c133 = { type: "literal", value: "||", description: "\"||\"" },
        peg$c134 = "or",
        peg$c135 = { type: "literal", value: "or", description: "\"or\"" },
        peg$c136 = function() { return "||"; },
        peg$c137 = "?",
        peg$c138 = { type: "literal", value: "?", description: "\"?\"" },
        peg$c139 = function(condition, trueExpression, falseExpression) {
              return ast.op('?:', [condition, trueExpression, falseExpression]);
            },
        peg$c140 = "null",
        peg$c141 = { type: "literal", value: "null", description: "\"null\"" },
        peg$c142 = function() { return ast.nullType() },
        peg$c143 = function(elements) { return ast.array(elements); },
        peg$c144 = "true",
        peg$c145 = { type: "literal", value: "true", description: "\"true\"" },
        peg$c146 = function() { return ast.boolean(true); },
        peg$c147 = "false",
        peg$c148 = { type: "literal", value: "false", description: "\"false\"" },
        peg$c149 = function() { return ast.boolean(false); },
        peg$c150 = { type: "other", description: "number" },
        peg$c151 = /^[+\-]/,
        peg$c152 = { type: "class", value: "[+\\-]", description: "[+\\-]" },
        peg$c153 = function(unary, literal) {
              if (unary == '-') {
                 return ast.number(-literal);
              }
              return ast.number(literal);
            },
        peg$c154 = function(parts) {
              return parseFloat(parts);
            },
        peg$c155 = function(parts) { return parseFloat(parts); },
        peg$c156 = "0",
        peg$c157 = { type: "literal", value: "0", description: "\"0\"" },
        peg$c158 = /^[0-9]/,
        peg$c159 = { type: "class", value: "[0-9]", description: "[0-9]" },
        peg$c160 = /^[1-9]/,
        peg$c161 = { type: "class", value: "[1-9]", description: "[1-9]" },
        peg$c162 = /^[eE]/,
        peg$c163 = { type: "class", value: "[eE]", description: "[eE]" },
        peg$c164 = /^[\-+]/,
        peg$c165 = { type: "class", value: "[\\-+]", description: "[\\-+]" },
        peg$c166 = /^[xX]/,
        peg$c167 = { type: "class", value: "[xX]", description: "[xX]" },
        peg$c168 = function(digits) { return parseInt(digits, 16); },
        peg$c169 = /^[0-9a-fA-F]/,
        peg$c170 = { type: "class", value: "[0-9a-fA-F]", description: "[0-9a-fA-F]" },
        peg$c171 = { type: "other", description: "regexp" },
        peg$c172 = /^[a-z]/,
        peg$c173 = { type: "class", value: "[a-z]", description: "[a-z]" },
        peg$c174 = function(pattern, modifiers) {
          if (modifiers) {
            return ast.regexp(pattern, modifiers.join(""));
          }
          return ast.regexp(pattern);
        },
        peg$c175 = /^[^\\\/]/,
        peg$c176 = { type: "class", value: "[^\\\\\\/]", description: "[^\\\\\\/]" },
        peg$c177 = function(chars) { return chars.join(""); },
        peg$c178 = "\\",
        peg$c179 = { type: "literal", value: "\\", description: "\"\\\\\"" },
        peg$c180 = { type: "any", description: "any character" },
        peg$c181 = function(char_) { return "\\" + char_; },
        peg$c182 = { type: "other", description: "string" },
        peg$c183 = function(s) { return ast.string(s); },
        peg$c184 = "\"",
        peg$c185 = { type: "literal", value: "\"", description: "\"\\\"\"" },
        peg$c186 = "'",
        peg$c187 = { type: "literal", value: "'", description: "\"'\"" },
        peg$c188 = function(parts) {
            return parts[1];
          },
        peg$c189 = function(char_) { return char_;     },
        peg$c190 = function(sequence) { return sequence;  },
        peg$c191 = function(sequence) { return sequence; },
        peg$c192 = function() { return "\0"; },
        peg$c193 = /^['"\\bfnrt]/,
        peg$c194 = { type: "class", value: "['\"\\\\bfnrt]", description: "['\"\\\\bfnrt]" },
        peg$c195 = function(char_) {
              return char_
                .replace("b", "\b")
                .replace("f", "\f")
                .replace("n", "\n")
                .replace("r", "\r")
                .replace("t", "\t")
            },
        peg$c196 = function(char_) { return char_; },
        peg$c197 = "x",
        peg$c198 = { type: "literal", value: "x", description: "\"x\"" },
        peg$c199 = "u",
        peg$c200 = { type: "literal", value: "u", description: "\"u\"" },
        peg$c201 = function(digits) {
              return String.fromCharCode(parseInt(digits, 16));
            },
        peg$c202 = { type: "other", description: "identifier" },
        peg$c203 = /^[a-zA-Z_$]/,
        peg$c204 = { type: "class", value: "[a-zA-Z_$]", description: "[a-zA-Z_$]" },
        peg$c205 = /^[a-zA-Z_$0-9]/,
        peg$c206 = { type: "class", value: "[a-zA-Z_$0-9]", description: "[a-zA-Z_$0-9]" },
        peg$c207 = function(start, rest) {
          return start + rest.join("");
        },
        peg$c208 = { type: "other", description: "whitespace" },
        peg$c209 = /^[ \t\r\n]/,
        peg$c210 = { type: "class", value: "[ \\t\\r\\n]", description: "[ \\t\\r\\n]" },
        peg$c211 = { type: "other", description: "comment" },
        peg$c212 = "/*",
        peg$c213 = { type: "literal", value: "/*", description: "\"/*\"" },
        peg$c214 = "*/",
        peg$c215 = { type: "literal", value: "*/", description: "\"*/\"" },
        peg$c216 = "//",
        peg$c217 = { type: "literal", value: "//", description: "\"//\"" },
        peg$c218 = /^[;,}]/,
        peg$c219 = { type: "class", value: "[;,}]", description: "[;,}]" },
        peg$c220 = function(chars) { return chars.join(''); },
        peg$c221 = /^[\n\r]/,
        peg$c222 = { type: "class", value: "[\\n\\r]", description: "[\\n\\r]" },

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleFunctions)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$parsestart() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseStatements();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c1();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseStatements() {
      var s0, s1, s2, s3;

      s0 = [];
      s1 = peg$currPos;
      s2 = peg$parseStatement();
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s2 = [s2, s3];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$currPos;
        s2 = peg$parseStatement();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s2 = [s2, s3];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parseStatement() {
      var s0;

      s0 = peg$parseFunction();
      if (s0 === peg$FAILED) {
        s0 = peg$parsePath();
        if (s0 === peg$FAILED) {
          s0 = peg$parseSchema();
        }
      }

      return s0;
    }

    function peg$parseFunction() {
      var s0, s1, s2;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseFunctionStart();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseFunctionBody();
        if (s2 === peg$FAILED) {
          s2 = peg$c4;
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c5(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c3); }
      }

      return s0;
    }

    function peg$parseFunctionStart() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8) === peg$c6) {
        s1 = peg$c6;
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c7); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIdentifier();
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseParameterList();
              if (s5 === peg$FAILED) {
                s5 = peg$c4;
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c8(s3, s5);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseIdentifier();
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseParameterList();
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c9(s1, s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parsePath() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parsePathStart();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = peg$parse__();
        if (s3 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c11) {
            s4 = peg$c11;
            peg$currPos += 2;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c12); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseTypeExpression();
              if (s6 !== peg$FAILED) {
                peg$reportedPos = s2;
                s3 = peg$c13(s6);
                s2 = s3;
              } else {
                peg$currPos = s2;
                s2 = peg$c0;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c4;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 123) {
              s5 = peg$c14;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c15); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parsePathsAndMethods();
                if (s7 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 125) {
                    s8 = peg$c16;
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c17); }
                  }
                  if (s8 !== peg$FAILED) {
                    peg$reportedPos = s4;
                    s5 = peg$c18(s7);
                    s4 = s5;
                  } else {
                    peg$currPos = s4;
                    s4 = peg$c0;
                  }
                } else {
                  peg$currPos = s4;
                  s4 = peg$c0;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$c0;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$c0;
            }
            if (s4 === peg$FAILED) {
              s4 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 59) {
                s5 = peg$c19;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c20); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s4;
                s5 = peg$c21();
              }
              s4 = s5;
            }
            if (s4 === peg$FAILED) {
              s4 = peg$c4;
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c22(s1, s2, s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c10); }
      }

      return s0;
    }

    function peg$parsePathStart() {
      var s0, s1, s2, s3;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c23) {
        s1 = peg$c23;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c24); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsePathTemplate();
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c25(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parsePathTemplate();
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c26(s1);
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parsePathTemplate() {
      var s0, s1, s2, s3, s4;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 47) {
        s3 = peg$c28;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c29); }
      }
      if (s3 !== peg$FAILED) {
        s4 = peg$parsePathKey();
        if (s4 === peg$FAILED) {
          s4 = peg$c4;
        }
        if (s4 !== peg$FAILED) {
          peg$reportedPos = s2;
          s3 = peg$c30(s4);
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$c0;
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c28;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c29); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parsePathKey();
            if (s4 === peg$FAILED) {
              s4 = peg$c4;
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s2;
              s3 = peg$c30(s4);
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        }
      } else {
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c31(s1);
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c27); }
      }

      return s0;
    }

    function peg$parsePathKey() {
      var s0;

      s0 = peg$parseCaptureKey();
      if (s0 === peg$FAILED) {
        s0 = peg$parseLiteralPathKey();
      }

      return s0;
    }

    function peg$parseCaptureKey() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c14;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c15); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIdentifier();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$currPos;
              if (input.charCodeAt(peg$currPos) === 61) {
                s6 = peg$c32;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c33); }
              }
              if (s6 !== peg$FAILED) {
                s7 = peg$parse_();
                if (s7 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 42) {
                    s8 = peg$c34;
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c35); }
                  }
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parse_();
                    if (s9 !== peg$FAILED) {
                      s6 = [s6, s7, s8, s9];
                      s5 = s6;
                    } else {
                      peg$currPos = s5;
                      s5 = peg$c0;
                    }
                  } else {
                    peg$currPos = s5;
                    s5 = peg$c0;
                  }
                } else {
                  peg$currPos = s5;
                  s5 = peg$c0;
                }
              } else {
                peg$currPos = s5;
                s5 = peg$c0;
              }
              if (s5 === peg$FAILED) {
                s5 = peg$c4;
              }
              if (s5 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 125) {
                  s6 = peg$c16;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c17); }
                }
                if (s6 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c36(s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseLiteralPathKey() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c37.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c38); }
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c37.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c38); }
          }
        }
      } else {
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c39(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parsePathsAndMethods() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parsePath();
      if (s2 === peg$FAILED) {
        s2 = peg$parseMethod();
        if (s2 === peg$FAILED) {
          s2 = peg$parseAnyBlock();
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parsePath();
        if (s2 === peg$FAILED) {
          s2 = peg$parseMethod();
          if (s2 === peg$FAILED) {
            s2 = peg$parseAnyBlock();
          }
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c40(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseSchema() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11;

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c42) {
        s1 = peg$c42;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c43); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse__();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseIdentifier();
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$currPos;
            if (input.charCodeAt(peg$currPos) === 60) {
              s5 = peg$c44;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c45); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parseIdentifierList();
              if (s6 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 62) {
                  s7 = peg$c46;
                  peg$currPos++;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c47); }
                }
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s4;
                  s5 = peg$c48(s6);
                  s4 = s5;
                } else {
                  peg$currPos = s4;
                  s4 = peg$c0;
                }
              } else {
                peg$currPos = s4;
                s4 = peg$c0;
              }
            } else {
              peg$currPos = s4;
              s4 = peg$c0;
            }
            if (s4 === peg$FAILED) {
              s4 = peg$c4;
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$currPos;
              s6 = peg$parse__();
              if (s6 !== peg$FAILED) {
                if (input.substr(peg$currPos, 7) === peg$c49) {
                  s7 = peg$c49;
                  peg$currPos += 7;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c50); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse__();
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parseTypeExpression();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parse_();
                      if (s10 !== peg$FAILED) {
                        peg$reportedPos = s5;
                        s6 = peg$c51(s9);
                        s5 = s6;
                      } else {
                        peg$currPos = s5;
                        s5 = peg$c0;
                      }
                    } else {
                      peg$currPos = s5;
                      s5 = peg$c0;
                    }
                  } else {
                    peg$currPos = s5;
                    s5 = peg$c0;
                  }
                } else {
                  peg$currPos = s5;
                  s5 = peg$c0;
                }
              } else {
                peg$currPos = s5;
                s5 = peg$c0;
              }
              if (s5 === peg$FAILED) {
                s5 = peg$c4;
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$currPos;
                s7 = peg$parse_();
                if (s7 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 123) {
                    s8 = peg$c14;
                    peg$currPos++;
                  } else {
                    s8 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c15); }
                  }
                  if (s8 !== peg$FAILED) {
                    s9 = peg$parse_();
                    if (s9 !== peg$FAILED) {
                      s10 = peg$parsePropertiesAndMethods();
                      if (s10 !== peg$FAILED) {
                        if (input.charCodeAt(peg$currPos) === 125) {
                          s11 = peg$c16;
                          peg$currPos++;
                        } else {
                          s11 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c17); }
                        }
                        if (s11 !== peg$FAILED) {
                          peg$reportedPos = s6;
                          s7 = peg$c18(s10);
                          s6 = s7;
                        } else {
                          peg$currPos = s6;
                          s6 = peg$c0;
                        }
                      } else {
                        peg$currPos = s6;
                        s6 = peg$c0;
                      }
                    } else {
                      peg$currPos = s6;
                      s6 = peg$c0;
                    }
                  } else {
                    peg$currPos = s6;
                    s6 = peg$c0;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$c0;
                }
                if (s6 === peg$FAILED) {
                  s6 = peg$currPos;
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 59) {
                      s8 = peg$c19;
                      peg$currPos++;
                    } else {
                      s8 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c20); }
                    }
                    if (s8 !== peg$FAILED) {
                      peg$reportedPos = s6;
                      s7 = peg$c52();
                      s6 = s7;
                    } else {
                      peg$currPos = s6;
                      s6 = peg$c0;
                    }
                  } else {
                    peg$currPos = s6;
                    s6 = peg$c0;
                  }
                }
                if (s6 === peg$FAILED) {
                  s6 = peg$c4;
                }
                if (s6 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c53(s3, s4, s5, s6);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c41); }
      }

      return s0;
    }

    function peg$parsePropertiesAndMethods() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseProperty();
      if (s2 === peg$FAILED) {
        s2 = peg$parseMethod();
        if (s2 === peg$FAILED) {
          s2 = peg$parseAnyBlock();
        }
      }
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parseProperty();
        if (s2 === peg$FAILED) {
          s2 = peg$parseMethod();
          if (s2 === peg$FAILED) {
            s2 = peg$parseAnyBlock();
          }
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c54(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseProperty() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseIdentifier();
      if (s1 === peg$FAILED) {
        s1 = peg$parseString();
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 58) {
            s3 = peg$c55;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c56); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseTypeExpression();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parsePropSep();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c57(s1, s5);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parsePropSep() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 44) {
        s1 = peg$c58;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c59); }
      }
      if (s1 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 59) {
          s1 = peg$c19;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c20); }
        }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c4;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c60(s1);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseMethod() {
      var s0, s1, s2, s3, s4, s5;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseIdentifier();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseParameterList();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseFunctionBody();
            if (s4 !== peg$FAILED) {
              s5 = peg$parsePropSep();
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c62(s1, s2, s4, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c61); }
      }

      return s0;
    }

    function peg$parseFunctionBody() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 123) {
        s1 = peg$c14;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c15); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          if (input.substr(peg$currPos, 6) === peg$c63) {
            s4 = peg$c63;
            peg$currPos += 6;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c64); }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parse__();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parseConditionalExpression();
            if (s4 !== peg$FAILED) {
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 59) {
                  s6 = peg$c19;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c20); }
                }
                if (s6 === peg$FAILED) {
                  s6 = peg$c4;
                }
                if (s6 !== peg$FAILED) {
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 125) {
                      s8 = peg$c16;
                      peg$currPos++;
                    } else {
                      s8 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c17); }
                    }
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parse_();
                      if (s9 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c65(s4);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c0;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c0;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 61) {
          s1 = peg$c32;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c33); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            s3 = peg$parseConditionalExpression();
            if (s3 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 59) {
                s4 = peg$c19;
                peg$currPos++;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c20); }
              }
              if (s4 === peg$FAILED) {
                s4 = peg$c4;
              }
              if (s4 !== peg$FAILED) {
                s5 = peg$parse_();
                if (s5 !== peg$FAILED) {
                  peg$reportedPos = s0;
                  s1 = peg$c66(s3);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parseParameterList() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c67;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c68); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseIdentifierList();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 41) {
            s3 = peg$c69;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c70); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c71(s2);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseIdentifierList() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseIdentifier();
      if (s1 === peg$FAILED) {
        s1 = peg$c4;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s5 = peg$c58;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c59); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseIdentifier();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c13(s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 44) {
              s5 = peg$c58;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c59); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseIdentifier();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c13(s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c72(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseTypeExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseSingleType();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 124) {
            s5 = peg$c73;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c74); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseSingleType();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c51(s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 124) {
              s5 = peg$c73;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c74); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseSingleType();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c51(s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c75(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseSingleType() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$parseIdentifier();
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        if (input.substr(peg$currPos, 2) === peg$c76) {
          s3 = peg$c76;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c77); }
        }
        if (s3 !== peg$FAILED) {
          peg$reportedPos = s2;
          s3 = peg$c78();
        }
        s2 = s3;
        if (s2 === peg$FAILED) {
          s2 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 60) {
            s3 = peg$c44;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c45); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseTypeList();
              if (s5 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 62) {
                  s6 = peg$c46;
                  peg$currPos++;
                } else {
                  s6 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c47); }
                }
                if (s6 !== peg$FAILED) {
                  peg$reportedPos = s2;
                  s3 = peg$c79(s5);
                  s2 = s3;
                } else {
                  peg$currPos = s2;
                  s2 = peg$c0;
                }
              } else {
                peg$currPos = s2;
                s2 = peg$c0;
              }
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        }
        if (s2 === peg$FAILED) {
          s2 = peg$c4;
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c80(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseTypeList() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseTypeExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s5 = peg$c58;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c59); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseTypeExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c51(s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 44) {
              s5 = peg$c58;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c59); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseTypeExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c51(s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c81(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parsePrimaryExpression() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      s2 = peg$parseLiteral();
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c82;
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseIdentifier();
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c83(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseLiteral();
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 40) {
            s1 = peg$c67;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c68); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              s3 = peg$parseConditionalExpression();
              if (s3 !== peg$FAILED) {
                s4 = peg$parse_();
                if (s4 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 41) {
                    s5 = peg$c69;
                    peg$currPos++;
                  } else {
                    s5 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c70); }
                  }
                  if (s5 !== peg$FAILED) {
                    peg$reportedPos = s0;
                    s1 = peg$c84(s3);
                    s0 = s1;
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        }
      }

      return s0;
    }

    function peg$parseMemberExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      s1 = peg$parsePrimaryExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 91) {
            s5 = peg$c85;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c86); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseConditionalExpression();
              if (s7 !== peg$FAILED) {
                s8 = peg$parse_();
                if (s8 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 93) {
                    s9 = peg$c87;
                    peg$currPos++;
                  } else {
                    s9 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c88); }
                  }
                  if (s9 !== peg$FAILED) {
                    peg$reportedPos = s3;
                    s4 = peg$c89(s7);
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        if (s3 === peg$FAILED) {
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 46) {
              s5 = peg$c90;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c91); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseIdentifier();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c89(s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 91) {
              s5 = peg$c85;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c86); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseConditionalExpression();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse_();
                  if (s8 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 93) {
                      s9 = peg$c87;
                      peg$currPos++;
                    } else {
                      s9 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c88); }
                    }
                    if (s9 !== peg$FAILED) {
                      peg$reportedPos = s3;
                      s4 = peg$c89(s7);
                      s3 = s4;
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c0;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
          if (s3 === peg$FAILED) {
            s3 = peg$currPos;
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 46) {
                s5 = peg$c90;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c91); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseIdentifier();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s3;
                    s4 = peg$c89(s7);
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c92(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseCallExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$parseMemberExpression();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseArguments();
        if (s3 !== peg$FAILED) {
          peg$reportedPos = s1;
          s2 = peg$c93(s2, s3);
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseArguments();
          if (s5 !== peg$FAILED) {
            peg$reportedPos = s3;
            s4 = peg$c94(s5);
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        if (s3 === peg$FAILED) {
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 91) {
              s5 = peg$c85;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c86); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseConditionalExpression();
                if (s7 !== peg$FAILED) {
                  s8 = peg$parse_();
                  if (s8 !== peg$FAILED) {
                    if (input.charCodeAt(peg$currPos) === 93) {
                      s9 = peg$c87;
                      peg$currPos++;
                    } else {
                      s9 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c88); }
                    }
                    if (s9 !== peg$FAILED) {
                      peg$reportedPos = s3;
                      s4 = peg$c95(s7);
                      s3 = s4;
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c0;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
          if (s3 === peg$FAILED) {
            s3 = peg$currPos;
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 46) {
                s5 = peg$c90;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c91); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseIdentifier();
                  if (s7 !== peg$FAILED) {
                    peg$reportedPos = s3;
                    s4 = peg$c95(s7);
                    s3 = s4;
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseArguments();
            if (s5 !== peg$FAILED) {
              peg$reportedPos = s3;
              s4 = peg$c94(s5);
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
          if (s3 === peg$FAILED) {
            s3 = peg$currPos;
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 91) {
                s5 = peg$c85;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c86); }
              }
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  s7 = peg$parseConditionalExpression();
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      if (input.charCodeAt(peg$currPos) === 93) {
                        s9 = peg$c87;
                        peg$currPos++;
                      } else {
                        s9 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c88); }
                      }
                      if (s9 !== peg$FAILED) {
                        peg$reportedPos = s3;
                        s4 = peg$c95(s7);
                        s3 = s4;
                      } else {
                        peg$currPos = s3;
                        s3 = peg$c0;
                      }
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c0;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
            if (s3 === peg$FAILED) {
              s3 = peg$currPos;
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                if (input.charCodeAt(peg$currPos) === 46) {
                  s5 = peg$c90;
                  peg$currPos++;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c91); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse_();
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parseIdentifier();
                    if (s7 !== peg$FAILED) {
                      peg$reportedPos = s3;
                      s4 = peg$c95(s7);
                      s3 = s4;
                    } else {
                      peg$currPos = s3;
                      s3 = peg$c0;
                    }
                  } else {
                    peg$currPos = s3;
                    s3 = peg$c0;
                  }
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c96(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseMemberExpression();
      }

      return s0;
    }

    function peg$parseArguments() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 40) {
        s1 = peg$c67;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c68); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseArgumentList();
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 41) {
                s5 = peg$c69;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c70); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c97(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseArgumentList() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseConditionalExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s5 = peg$c58;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c59); }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseConditionalExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c65(s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 44) {
              s5 = peg$c58;
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c59); }
            }
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseConditionalExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c65(s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c98(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseUnaryExpression() {
      var s0, s1, s2;

      s0 = peg$parseCallExpression();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseUnaryOperator();
        if (s1 !== peg$FAILED) {
          s2 = peg$parseUnaryExpression();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c99(s1, s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parseUnaryOperator() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 43) {
        s1 = peg$c100;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c101); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c102();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 45) {
          s1 = peg$c103;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c104); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c105();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 33) {
            s0 = peg$c106;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c107); }
          }
        }
      }

      return s0;
    }

    function peg$parseMultiplicativeExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseUnaryExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseMultiplicativeOperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseUnaryExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseMultiplicativeOperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseUnaryExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseMultiplicativeOperator() {
      var s0;

      if (input.charCodeAt(peg$currPos) === 42) {
        s0 = peg$c34;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c35); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 47) {
          s0 = peg$c28;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c29); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 37) {
            s0 = peg$c110;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c111); }
          }
        }
      }

      return s0;
    }

    function peg$parseAdditiveExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseMultiplicativeExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseAdditiveOperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseMultiplicativeExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseAdditiveOperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseMultiplicativeExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseAdditiveOperator() {
      var s0;

      if (input.charCodeAt(peg$currPos) === 43) {
        s0 = peg$c100;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c101); }
      }
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 45) {
          s0 = peg$c103;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c104); }
        }
      }

      return s0;
    }

    function peg$parseRelationalExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseAdditiveExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseRelationalOperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseAdditiveExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseRelationalOperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseAdditiveExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseRelationalOperator() {
      var s0;

      if (input.substr(peg$currPos, 2) === peg$c112) {
        s0 = peg$c112;
        peg$currPos += 2;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c113); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c114) {
          s0 = peg$c114;
          peg$currPos += 2;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c115); }
        }
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 60) {
            s0 = peg$c44;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c45); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 62) {
              s0 = peg$c46;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c47); }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseEqualityExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseRelationalExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseEqualityOperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseRelationalExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseEqualityOperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseRelationalExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseEqualityOperator() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c116) {
        s1 = peg$c116;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c117); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c118) {
          s1 = peg$c118;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c119); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c120();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 61) {
          s1 = peg$c32;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c33); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c121();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 3) === peg$c122) {
            s1 = peg$c122;
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c123); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c124) {
              s1 = peg$c124;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c125); }
            }
          }
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c126();
          }
          s0 = s1;
        }
      }

      return s0;
    }

    function peg$parseLogicalANDExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseEqualityExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseLogicalANDOperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseEqualityExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseLogicalANDOperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseEqualityExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseLogicalANDOperator() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c127) {
        s1 = peg$c127;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c128); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c129) {
          s1 = peg$c129;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c130); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c131();
      }
      s0 = s1;

      return s0;
    }

    function peg$parseLogicalORExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      s1 = peg$parseLogicalANDExpression();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseLogicalOROperator();
          if (s5 !== peg$FAILED) {
            s6 = peg$parse_();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseLogicalANDExpression();
              if (s7 !== peg$FAILED) {
                peg$reportedPos = s3;
                s4 = peg$c108(s5, s7);
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseLogicalOROperator();
            if (s5 !== peg$FAILED) {
              s6 = peg$parse_();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseLogicalANDExpression();
                if (s7 !== peg$FAILED) {
                  peg$reportedPos = s3;
                  s4 = peg$c108(s5, s7);
                  s3 = s4;
                } else {
                  peg$currPos = s3;
                  s3 = peg$c0;
                }
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c109(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseLogicalOROperator() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c132) {
        s1 = peg$c132;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c133); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c134) {
          s1 = peg$c134;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c135); }
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c136();
      }
      s0 = s1;

      return s0;
    }

    function peg$parseConditionalExpression() {
      var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

      s0 = peg$currPos;
      s1 = peg$parseLogicalORExpression();
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 63) {
            s3 = peg$c137;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c138); }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              s5 = peg$parseConditionalExpression();
              if (s5 !== peg$FAILED) {
                s6 = peg$parse_();
                if (s6 !== peg$FAILED) {
                  if (input.charCodeAt(peg$currPos) === 58) {
                    s7 = peg$c55;
                    peg$currPos++;
                  } else {
                    s7 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c56); }
                  }
                  if (s7 !== peg$FAILED) {
                    s8 = peg$parse_();
                    if (s8 !== peg$FAILED) {
                      s9 = peg$parseConditionalExpression();
                      if (s9 !== peg$FAILED) {
                        peg$reportedPos = s0;
                        s1 = peg$c139(s1, s5, s9);
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$c0;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$c0;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$c0;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$c0;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseLogicalORExpression();
      }

      return s0;
    }

    function peg$parseLiteral() {
      var s0;

      s0 = peg$parseNull();
      if (s0 === peg$FAILED) {
        s0 = peg$parseBooleanLiteral();
        if (s0 === peg$FAILED) {
          s0 = peg$parseNumericLiteral();
          if (s0 === peg$FAILED) {
            s0 = peg$parseStringLiteral();
            if (s0 === peg$FAILED) {
              s0 = peg$parseArrayLiteral();
              if (s0 === peg$FAILED) {
                s0 = peg$parseRegExp();
              }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseNull() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c140) {
        s1 = peg$c140;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c141); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c142();
      }
      s0 = s1;

      return s0;
    }

    function peg$parseArrayLiteral() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 91) {
        s1 = peg$c85;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c86); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseArgumentList();
          if (s3 === peg$FAILED) {
            s3 = peg$c4;
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 93) {
                s5 = peg$c87;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c88); }
              }
              if (s5 !== peg$FAILED) {
                peg$reportedPos = s0;
                s1 = peg$c143(s3);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$c0;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseBooleanLiteral() {
      var s0, s1;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 4) === peg$c144) {
        s1 = peg$c144;
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c145); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c146();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 5) === peg$c147) {
          s1 = peg$c147;
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c148); }
        }
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c149();
        }
        s0 = s1;
      }

      return s0;
    }

    function peg$parseNumericLiteral() {
      var s0, s1, s2;

      peg$silentFails++;
      s0 = peg$currPos;
      if (peg$c151.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c152); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c4;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseHexIntegerLiteral();
        if (s2 === peg$FAILED) {
          s2 = peg$parseDecimalLiteral();
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c153(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c150); }
      }

      return s0;
    }

    function peg$parseDecimalLiteral() {
      var s0, s1, s2, s3, s4, s5, s6;

      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      s3 = peg$parseDecimalIntegerLiteral();
      if (s3 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 46) {
          s4 = peg$c90;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parseDecimalDigits();
          if (s5 === peg$FAILED) {
            s5 = peg$c4;
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parseExponentPart();
            if (s6 === peg$FAILED) {
              s6 = peg$c4;
            }
            if (s6 !== peg$FAILED) {
              s3 = [s3, s4, s5, s6];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$c0;
      }
      if (s2 !== peg$FAILED) {
        s2 = input.substring(s1, peg$currPos);
      }
      s1 = s2;
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c154(s1);
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$currPos;
        s2 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s3 = peg$c90;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c91); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseDecimalDigits();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseExponentPart();
            if (s5 === peg$FAILED) {
              s5 = peg$c4;
            }
            if (s5 !== peg$FAILED) {
              s3 = [s3, s4, s5];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
        if (s2 !== peg$FAILED) {
          s2 = input.substring(s1, peg$currPos);
        }
        s1 = s2;
        if (s1 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c155(s1);
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$currPos;
          s2 = peg$currPos;
          s3 = peg$parseDecimalIntegerLiteral();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseExponentPart();
            if (s4 === peg$FAILED) {
              s4 = peg$c4;
            }
            if (s4 !== peg$FAILED) {
              s3 = [s3, s4];
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
          if (s2 !== peg$FAILED) {
            s2 = input.substring(s1, peg$currPos);
          }
          s1 = s2;
          if (s1 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c155(s1);
          }
          s0 = s1;
        }
      }

      return s0;
    }

    function peg$parseDecimalIntegerLiteral() {
      var s0, s1, s2;

      if (input.charCodeAt(peg$currPos) === 48) {
        s0 = peg$c156;
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c157); }
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = peg$parseNonZeroDigit();
        if (s1 !== peg$FAILED) {
          s2 = peg$parseDecimalDigits();
          if (s2 === peg$FAILED) {
            s2 = peg$c4;
          }
          if (s2 !== peg$FAILED) {
            s1 = [s1, s2];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      }

      return s0;
    }

    function peg$parseDecimalDigits() {
      var s0, s1;

      s0 = [];
      s1 = peg$parseDecimalDigit();
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          s1 = peg$parseDecimalDigit();
        }
      } else {
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseDecimalDigit() {
      var s0;

      if (peg$c158.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c159); }
      }

      return s0;
    }

    function peg$parseNonZeroDigit() {
      var s0;

      if (peg$c160.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c161); }
      }

      return s0;
    }

    function peg$parseExponentPart() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$parseExponentIndicator();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseSignedInteger();
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseExponentIndicator() {
      var s0;

      if (peg$c162.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c163); }
      }

      return s0;
    }

    function peg$parseSignedInteger() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (peg$c164.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c165); }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$c4;
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseDecimalDigits();
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseHexIntegerLiteral() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 48) {
        s1 = peg$c156;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c157); }
      }
      if (s1 !== peg$FAILED) {
        if (peg$c166.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c167); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$currPos;
          s4 = [];
          s5 = peg$parseHexDigit();
          if (s5 !== peg$FAILED) {
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              s5 = peg$parseHexDigit();
            }
          } else {
            s4 = peg$c0;
          }
          if (s4 !== peg$FAILED) {
            s4 = input.substring(s3, peg$currPos);
          }
          s3 = s4;
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c168(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseHexDigit() {
      var s0;

      if (peg$c169.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c170); }
      }

      return s0;
    }

    function peg$parseRegExp() {
      var s0, s1, s2, s3, s4, s5;

      peg$silentFails++;
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 47) {
        s1 = peg$c28;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c29); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseRegExpCharacters();
        if (s2 === peg$FAILED) {
          s2 = peg$c4;
        }
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 47) {
            s3 = peg$c28;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c29); }
          }
          if (s3 !== peg$FAILED) {
            s4 = [];
            if (peg$c172.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c173); }
            }
            while (s5 !== peg$FAILED) {
              s4.push(s5);
              if (peg$c172.test(input.charAt(peg$currPos))) {
                s5 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c173); }
              }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s0;
              s1 = peg$c174(s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$c0;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c171); }
      }

      return s0;
    }

    function peg$parseRegExpCharacters() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      if (peg$c175.test(input.charAt(peg$currPos))) {
        s2 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c176); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$parseRegExpEscaped();
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          if (peg$c175.test(input.charAt(peg$currPos))) {
            s2 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c176); }
          }
          if (s2 === peg$FAILED) {
            s2 = peg$parseRegExpEscaped();
          }
        }
      } else {
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c177(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseRegExpEscaped() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c178;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c179); }
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c180); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c181(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseStringLiteral() {
      var s0, s1;

      peg$silentFails++;
      s0 = peg$currPos;
      s1 = peg$parseString();
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c183(s1);
      }
      s0 = s1;
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c182); }
      }

      return s0;
    }

    function peg$parseString() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 34) {
        s2 = peg$c184;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c185); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseDoubleStringCharacters();
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 34) {
            s4 = peg$c184;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c185); }
          }
          if (s4 !== peg$FAILED) {
            s2 = [s2, s3, s4];
            s1 = s2;
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 === peg$FAILED) {
        s1 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 39) {
          s2 = peg$c186;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c187); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parseSingleStringCharacters();
          if (s3 !== peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 39) {
              s4 = peg$c186;
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c187); }
            }
            if (s4 !== peg$FAILED) {
              s2 = [s2, s3, s4];
              s1 = s2;
            } else {
              peg$currPos = s1;
              s1 = peg$c0;
            }
          } else {
            peg$currPos = s1;
            s1 = peg$c0;
          }
        } else {
          peg$currPos = s1;
          s1 = peg$c0;
        }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c188(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseDoubleStringCharacters() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseDoubleStringCharacter();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parseDoubleStringCharacter();
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c177(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseSingleStringCharacters() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseSingleStringCharacter();
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = peg$parseSingleStringCharacter();
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c177(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseDoubleStringCharacter() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (input.charCodeAt(peg$currPos) === 34) {
        s2 = peg$c184;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c185); }
      }
      if (s2 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 92) {
          s2 = peg$c178;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c179); }
        }
        if (s2 === peg$FAILED) {
          s2 = peg$parseNewLine();
        }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c82;
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c180); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c189(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c178;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c179); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c190(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseLineContinuation();
        }
      }

      return s0;
    }

    function peg$parseSingleStringCharacter() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      if (input.charCodeAt(peg$currPos) === 39) {
        s2 = peg$c186;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c187); }
      }
      if (s2 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 92) {
          s2 = peg$c178;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c179); }
        }
        if (s2 === peg$FAILED) {
          s2 = peg$parseNewLine();
        }
      }
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c82;
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c180); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c189(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 92) {
          s1 = peg$c178;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c179); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parseEscapeSequence();
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c190(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseLineContinuation();
        }
      }

      return s0;
    }

    function peg$parseLineContinuation() {
      var s0, s1, s2;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 92) {
        s1 = peg$c178;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c179); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseNewLine();
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c191(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseEscapeSequence() {
      var s0, s1, s2, s3;

      s0 = peg$parseCharacterEscapeSequence();
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 48) {
          s1 = peg$c156;
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c157); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$currPos;
          peg$silentFails++;
          s3 = peg$parseDecimalDigit();
          peg$silentFails--;
          if (s3 === peg$FAILED) {
            s2 = peg$c82;
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
          if (s2 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c192();
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$parseHexEscapeSequence();
          if (s0 === peg$FAILED) {
            s0 = peg$parseUnicodeEscapeSequence();
          }
        }
      }

      return s0;
    }

    function peg$parseCharacterEscapeSequence() {
      var s0;

      s0 = peg$parseSingleEscapeCharacter();
      if (s0 === peg$FAILED) {
        s0 = peg$parseNonEscapeCharacter();
      }

      return s0;
    }

    function peg$parseSingleEscapeCharacter() {
      var s0, s1;

      s0 = peg$currPos;
      if (peg$c193.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c194); }
      }
      if (s1 !== peg$FAILED) {
        peg$reportedPos = s0;
        s1 = peg$c195(s1);
      }
      s0 = s1;

      return s0;
    }

    function peg$parseNonEscapeCharacter() {
      var s0, s1, s2;

      s0 = peg$currPos;
      s1 = peg$currPos;
      peg$silentFails++;
      s2 = peg$parseEscapeCharacter();
      peg$silentFails--;
      if (s2 === peg$FAILED) {
        s1 = peg$c82;
      } else {
        peg$currPos = s1;
        s1 = peg$c0;
      }
      if (s1 === peg$FAILED) {
        s1 = peg$parseNewLine();
      }
      if (s1 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c180); }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c196(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseEscapeCharacter() {
      var s0;

      s0 = peg$parseSingleEscapeCharacter();
      if (s0 === peg$FAILED) {
        s0 = peg$parseDecimalDigit();
        if (s0 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 120) {
            s0 = peg$c197;
            peg$currPos++;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c198); }
          }
          if (s0 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 117) {
              s0 = peg$c199;
              peg$currPos++;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c200); }
            }
          }
        }
      }

      return s0;
    }

    function peg$parseHexEscapeSequence() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 120) {
        s1 = peg$c197;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c198); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = peg$currPos;
        s4 = peg$parseHexDigit();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseHexDigit();
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        if (s3 !== peg$FAILED) {
          s3 = input.substring(s2, peg$currPos);
        }
        s2 = s3;
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c201(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseUnicodeEscapeSequence() {
      var s0, s1, s2, s3, s4, s5, s6, s7;

      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 117) {
        s1 = peg$c199;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c200); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$currPos;
        s3 = peg$currPos;
        s4 = peg$parseHexDigit();
        if (s4 !== peg$FAILED) {
          s5 = peg$parseHexDigit();
          if (s5 !== peg$FAILED) {
            s6 = peg$parseHexDigit();
            if (s6 !== peg$FAILED) {
              s7 = peg$parseHexDigit();
              if (s7 !== peg$FAILED) {
                s4 = [s4, s5, s6, s7];
                s3 = s4;
              } else {
                peg$currPos = s3;
                s3 = peg$c0;
              }
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        if (s3 !== peg$FAILED) {
          s3 = input.substring(s2, peg$currPos);
        }
        s2 = s3;
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c201(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseIdentifier() {
      var s0, s1, s2, s3;

      peg$silentFails++;
      s0 = peg$currPos;
      if (peg$c203.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c204); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        if (peg$c205.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c206); }
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          if (peg$c205.test(input.charAt(peg$currPos))) {
            s3 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c206); }
          }
        }
        if (s2 !== peg$FAILED) {
          peg$reportedPos = s0;
          s1 = peg$c207(s1, s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c202); }
      }

      return s0;
    }

    function peg$parse__() {
      var s0, s1;

      s0 = [];
      s1 = peg$parseWhitespace();
      if (s1 === peg$FAILED) {
        s1 = peg$parseComment();
      }
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          s1 = peg$parseWhitespace();
          if (s1 === peg$FAILED) {
            s1 = peg$parseComment();
          }
        }
      } else {
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parse_() {
      var s0, s1;

      s0 = [];
      s1 = peg$parseWhitespace();
      if (s1 === peg$FAILED) {
        s1 = peg$parseComment();
      }
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parseWhitespace();
        if (s1 === peg$FAILED) {
          s1 = peg$parseComment();
        }
      }

      return s0;
    }

    function peg$parseWhitespace() {
      var s0, s1;

      peg$silentFails++;
      s0 = [];
      if (peg$c209.test(input.charAt(peg$currPos))) {
        s1 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c210); }
      }
      if (s1 !== peg$FAILED) {
        while (s1 !== peg$FAILED) {
          s0.push(s1);
          if (peg$c209.test(input.charAt(peg$currPos))) {
            s1 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c210); }
          }
        }
      } else {
        s0 = peg$c0;
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c208); }
      }

      return s0;
    }

    function peg$parseComment() {
      var s0, s1;

      peg$silentFails++;
      s0 = peg$parseMultiLineComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parseSingleLineComment();
      }
      peg$silentFails--;
      if (s0 === peg$FAILED) {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c211); }
      }

      return s0;
    }

    function peg$parseMultiLineComment() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c212) {
        s1 = peg$c212;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c213); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c214) {
          s5 = peg$c214;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c215); }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = peg$c82;
        } else {
          peg$currPos = s4;
          s4 = peg$c0;
        }
        if (s4 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c180); }
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$currPos;
          peg$silentFails++;
          if (input.substr(peg$currPos, 2) === peg$c214) {
            s5 = peg$c214;
            peg$currPos += 2;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c215); }
          }
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = peg$c82;
          } else {
            peg$currPos = s4;
            s4 = peg$c0;
          }
          if (s4 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c180); }
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c214) {
            s3 = peg$c214;
            peg$currPos += 2;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c215); }
          }
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseSingleLineComment() {
      var s0, s1, s2, s3, s4, s5;

      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c216) {
        s1 = peg$c216;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c217); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        s5 = peg$parseNewLine();
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = peg$c82;
        } else {
          peg$currPos = s4;
          s4 = peg$c0;
        }
        if (s4 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c180); }
          }
          if (s5 !== peg$FAILED) {
            s4 = [s4, s5];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$c0;
        }
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$currPos;
          peg$silentFails++;
          s5 = peg$parseNewLine();
          peg$silentFails--;
          if (s5 === peg$FAILED) {
            s4 = peg$c82;
          } else {
            peg$currPos = s4;
            s4 = peg$c0;
          }
          if (s4 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c180); }
            }
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$c0;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
        }
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseAnyBlock() {
      var s0, s1, s2, s3, s4;

      s0 = peg$currPos;
      s1 = [];
      s2 = peg$currPos;
      s3 = peg$currPos;
      peg$silentFails++;
      if (peg$c218.test(input.charAt(peg$currPos))) {
        s4 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c219); }
      }
      peg$silentFails--;
      if (s4 === peg$FAILED) {
        s3 = peg$c82;
      } else {
        peg$currPos = s3;
        s3 = peg$c0;
      }
      if (s3 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c180); }
        }
        if (s4 !== peg$FAILED) {
          peg$reportedPos = s2;
          s3 = peg$c196(s4);
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$c0;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$c0;
      }
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$currPos;
          s3 = peg$currPos;
          peg$silentFails++;
          if (peg$c218.test(input.charAt(peg$currPos))) {
            s4 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c219); }
          }
          peg$silentFails--;
          if (s4 === peg$FAILED) {
            s3 = peg$c82;
          } else {
            peg$currPos = s3;
            s3 = peg$c0;
          }
          if (s3 !== peg$FAILED) {
            if (input.length > peg$currPos) {
              s4 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c180); }
            }
            if (s4 !== peg$FAILED) {
              peg$reportedPos = s2;
              s3 = peg$c196(s4);
              s2 = s3;
            } else {
              peg$currPos = s2;
              s2 = peg$c0;
            }
          } else {
            peg$currPos = s2;
            s2 = peg$c0;
          }
        }
      } else {
        s1 = peg$c0;
      }
      if (s1 !== peg$FAILED) {
        if (peg$c218.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c219); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            peg$reportedPos = s0;
            s1 = peg$c220(s1);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$c0;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$c0;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$c0;
      }

      return s0;
    }

    function peg$parseNewLine() {
      var s0;

      if (peg$c221.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c222); }
      }

      return s0;
    }


      "use strict";

      var ast = require('./ast');
      var util = require('./util');
      var logger = require('./logger');
      var error = logger.error;
      var warn = logger.warn;

      logger.setContext(function() {
        return {
          line: line(),
          column: column()
        };
      });

      // Return a left-associative binary structure
      // consisting of head (exp), and tail (op, exp)*.
      function leftAssociative(head, tail) {
        var result = head;
        for (var i = 0; i < tail.length; i++) {
          result = ast.op(tail[i].op, [result, tail[i].exp]);
        }
        return result;
      }

      var symbols = new ast.Symbols();

      var currentPath = new ast.PathTemplate();

      function ensureLowerCase(s, m) {
        if (s instanceof Array) {
          s = s.map(function(id) {
            return ensureLowerCase(id, m);
          });
          return s;
        }
        var canonical = s[0].toLowerCase() + s.slice(1);
        if (s != canonical) {
          warn(m + " should begin with a lowercase letter: ('" + s + "' should be '" + canonical + "').");
        }
        return s;
      }

      function ensureUpperCase(s, m) {
        if (s instanceof Array) {
          s = s.map(function(id) {
            return ensureUpperCase(id, m);
          });
          return s;
        }
        var canonical = s[0].toUpperCase() + s.slice(1);
        if (s != canonical) {
          warn(m + " should begin with an uppercase letter: ('" + s + "' should be '" + canonical + "').");
        }
        return s;
      }


    peg$result = peg$startRuleFunction();

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
},{"./ast":1,"./logger":3,"./util":7}],7:[function(require,module,exports){
"use strict";
exports.__esModule = true;
function extend(dest) {
    var srcs = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        srcs[_i - 1] = arguments[_i];
    }
    var i;
    var source;
    var prop;
    if (dest === undefined) {
        dest = {};
    }
    for (i = 0; i < srcs.length; i++) {
        source = srcs[i];
        for (prop in source) {
            if (source.hasOwnProperty(prop)) {
                dest[prop] = source[prop];
            }
        }
    }
    return dest;
}
exports.extend = extend;
function copyArray(arg) {
    return Array.prototype.slice.call(arg);
}
exports.copyArray = copyArray;
var baseTypes = [
    'number', 'string', 'boolean', 'array', 'function', 'date', 'regexp',
    'arguments', 'undefined', 'null'
];
function internalType(value) {
    return Object.prototype.toString.call(value)
        .match(/\[object (.*)\]/)[1]
        .toLowerCase();
}
function isType(value, type) {
    return typeOf(value) === type;
}
exports.isType = isType;
// Return one of the baseTypes as a string
function typeOf(value) {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    var type = internalType(value);
    if (!arrayIncludes(baseTypes, type)) {
        type = typeof value;
    }
    return type;
}
exports.typeOf = typeOf;
function isThenable(obj) {
    return typeOf(obj) === 'object' && 'then' in obj &&
        typeof (obj.then) === 'function';
}
exports.isThenable = isThenable;
// Converts a synchronous function to one allowing Promises
// as arguments and returning a Promise value.
//
//   fn(U, V, ...): T => fn(U | Promise<U>, V | Promise<V>, ...): Promise<T>
function lift(fn) {
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return Promise.all(args).then(function (values) {
            return fn.apply(undefined, values);
        });
    };
}
exports.lift = lift;
// Converts an asynchronous function to one allowing Promises
// as arguments.
//
//   fn(U, V, ...): Promise<T> => fn(U | Promise<U>, V | Promise<V>, ...):
//   Promise<T>
exports.liftArgs = lift;
exports.getProp = lift(function (obj, prop) { return obj[prop]; });
function ensureExtension(fileName, extension) {
    if (fileName.indexOf('.') === -1) {
        return fileName + '.' + extension;
    }
    return fileName;
}
exports.ensureExtension = ensureExtension;
function replaceExtension(fileName, extension) {
    return fileName.replace(/\.[^\.]*$/, '.' + extension);
}
exports.replaceExtension = replaceExtension;
function prettyJSON(o) {
    return JSON.stringify(o, null, 2);
}
exports.prettyJSON = prettyJSON;
function deepExtend(target, source) {
    for (var prop in source) {
        if (!source.hasOwnProperty(prop)) {
            continue;
        }
        if (target[prop] !== undefined) {
            throw new Error('Property overwrite: ' + prop);
        }
        if (isType(source[prop], 'object')) {
            target[prop] = {};
            deepExtend(target[prop], source[prop]);
        }
        else {
            target[prop] = source[prop];
        }
    }
}
function deepLookup(o, path) {
    var result = o;
    for (var i = 0; i < path.length; i++) {
        if (result === undefined) {
            return undefined;
        }
        result = result[path[i]];
    }
    return result;
}
exports.deepLookup = deepLookup;
// Like JSON.stringify - but for single-quoted strings instead of double-quoted
// ones. This just makes the compiled rules much easier to read.
// Quote all control characters, slash, single quotes, and non-ascii printables.
var quotableCharacters = /[\u0000-\u001f\\\'\u007f-\uffff]/g;
var specialQuotes = {
    '\'': '\\\'',
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r'
};
function quoteString(s) {
    s = s.replace(quotableCharacters, function (c) {
        if (specialQuotes[c]) {
            return specialQuotes[c];
        }
        return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
    });
    return '\'' + s + '\'';
}
exports.quoteString = quoteString;
function arrayIncludes(a, e) {
    return a.indexOf(e) !== -1;
}
exports.arrayIncludes = arrayIncludes;
// Like Python list.extend
function extendArray(target, src) {
    if (target === undefined) {
        target = [];
    }
    Array.prototype.push.apply(target, src);
    return target;
}
exports.extendArray = extendArray;
function or(target, src) {
    if (target === undefined) {
        return false;
    }
    return target || src;
}
exports.or = or;
function ensureObjectPath(obj, parts) {
    for (var i = 0; i < parts.length; i++) {
        var name = parts[i];
        if (!(name in obj)) {
            obj[name] = {};
        }
        obj = obj[name];
    }
    return obj;
}
exports.ensureObjectPath = ensureObjectPath;
// Remove all empty, '{}',  children and undefined - returns true iff obj is
// empty.
function pruneEmptyChildren(obj) {
    if (obj === undefined) {
        return true;
    }
    if (obj.constructor !== Object) {
        return false;
    }
    var hasChildren = false;
    for (var prop in obj) {
        if (!obj.hasOwnProperty(prop)) {
            continue;
        }
        if (pruneEmptyChildren(obj[prop])) {
            delete obj[prop];
        }
        else {
            hasChildren = true;
        }
    }
    return !hasChildren;
}
exports.pruneEmptyChildren = pruneEmptyChildren;
function deletePropName(obj, name) {
    if (obj.constructor !== Object) {
        return;
    }
    for (var prop in obj) {
        if (!obj.hasOwnProperty(prop)) {
            continue;
        }
        if (prop === name) {
            delete obj[prop];
        }
        else {
            deletePropName(obj[prop], name);
        }
    }
}
exports.deletePropName = deletePropName;
function formatColumns(indent, lines) {
    var result = [];
    var columnSize = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        for (var j = 0; j < line.length; j++) {
            if (columnSize[j] === undefined) {
                columnSize[j] = 0;
            }
            columnSize[j] = Math.max(columnSize[j], line[j].length);
        }
    }
    var prefix = repeatString(' ', indent);
    var s;
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var sep = '';
        s = '';
        for (var j = 0; j < line.length; j++) {
            if (j === 0) {
                s = prefix;
            }
            if (j === line.length - 1) {
                s += sep + line[j];
            }
            else {
                s += sep + fillString(line[j], columnSize[j]);
            }
            sep = '  ';
        }
        result.push(s);
    }
    return result;
}
exports.formatColumns = formatColumns;
function repeatString(s, n) {
    return new Array(n + 1).join(s);
}
function fillString(s, n) {
    var padding = n - s.length;
    if (padding > 0) {
        s += repeatString(' ', padding);
    }
    return s;
}


},{}],8:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   3.3.1
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  return typeof x === 'function' || typeof x === 'object' && x !== null;
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (!Array.isArray) {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
} else {
  _isArray = Array.isArray;
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  return function () {
    vertxNext(flush);
  };
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  _resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then, value, fulfillmentHandler, rejectionHandler) {
  try {
    then.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        _resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      _reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      _reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    _reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return _resolve(promise, value);
    }, function (reason) {
      return _reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$) {
  if (maybeThenable.constructor === promise.constructor && then$$ === then && maybeThenable.constructor.resolve === resolve) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$ === GET_THEN_ERROR) {
      _reject(promise, GET_THEN_ERROR.error);
    } else if (then$$ === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$)) {
      handleForeignThenable(promise, maybeThenable, then$$);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function _resolve(promise, value) {
  if (promise === value) {
    _reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function _reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      _reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      _resolve(promise, value);
    } else if (failed) {
      _reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      _reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      _resolve(promise, value);
    }, function rejectPromise(reason) {
      _reject(promise, reason);
    });
  } catch (e) {
    _reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this._input = input;
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate();
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    _reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
};

Enumerator.prototype._enumerate = function () {
  var length = this.length;
  var _input = this._input;

  for (var i = 0; this._state === PENDING && i < length; i++) {
    this._eachEntry(_input[i], i);
  }
};

Enumerator.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$ = c.resolve;

  if (resolve$$ === resolve) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$) {
        return resolve$$(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$(entry), i);
  }
};

Enumerator.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      _reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  _reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise ? initializePromise(this, resolver) : needsNew();
  }
}

Promise.all = all;
Promise.race = race;
Promise.resolve = resolve;
Promise.reject = reject;
Promise._setScheduler = setScheduler;
Promise._setAsap = setAsap;
Promise._asap = asap;

Promise.prototype = {
  constructor: Promise,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

function polyfill() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise;
}

polyfill();
// Strange compat..
Promise.polyfill = polyfill;
Promise.Promise = Promise;

return Promise;

})));

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":9}],9:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYXN0LnRzIiwibGliL2JvbHQudHMiLCJsaWIvbG9nZ2VyLnRzIiwibGliL3BhcnNlLXV0aWwudHMiLCJsaWIvcnVsZXMtZ2VuZXJhdG9yLnRzIiwibGliL3J1bGVzLXBhcnNlci5qcyIsImxpYi91dGlsLnRzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvZXM2LXByb21pc2UuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILDZCQUErQjtBQUMvQixpQ0FBbUM7QUFFbkMsSUFBSSxNQUFNLEdBQUc7SUFDWCxZQUFZLEVBQUUsbUJBQW1CO0lBQ2pDLGlCQUFpQixFQUFFLHVDQUF1QztDQUMzRCxDQUFDO0FBNEM4QyxDQUFDO0FBU08sQ0FBQztBQXVCekQ7SUFJRSx3Q0FBd0M7SUFDeEMsbUNBQW1DO0lBQ25DLHFDQUFxQztJQUNyQyxrQkFBWSxLQUFhLEVBQUUsUUFBaUI7UUFDMUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDOUMsUUFBUSxHQUFHLEtBQUssQ0FBQztTQUNsQjtRQUNELElBQUksUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDaEMsS0FBSyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUM7U0FDckI7UUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsUUFBUSxHQUFZLFFBQVEsQ0FBQztJQUNwQyxDQUFDO0lBQ0gsZUFBQztBQUFELENBakJBLEFBaUJDLElBQUE7QUFqQlksNEJBQVE7QUFtQnJCO0lBR0Usc0JBQVksS0FBa0M7UUFBbEMsc0JBQUEsRUFBQSxRQUFnQyxFQUFFO1FB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R0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDeEUsT0FBTyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsRUFDL0UsSUFBSSxDQUFDLENBQUM7QUFDeEIsQ0FBQzs7OztBQ3ZoQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2pvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvKlxuICogQVNUIGJ1aWxkZXJzIGZvciBGaXJlYmFzZSBSdWxlcyBMYW5ndWFnZS5cbiAqXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0ICogYXMgbG9nZ2VyIGZyb20gJy4vbG9nZ2VyJztcblxudmFyIGVycm9ycyA9IHtcbiAgdHlwZU1pc21hdGNoOiBcIlVuZXhwZWN0ZWQgdHlwZTogXCIsXG4gIGR1cGxpY2F0ZVBhdGhQYXJ0OiBcIkEgcGF0aCBjb21wb25lbnQgbmFtZSBpcyBkdXBsaWNhdGVkOiBcIixcbn07XG5cbmV4cG9ydCB0eXBlIE9iamVjdCA9IHsgW3Byb3A6IHN0cmluZ106IGFueSB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4cCB7XG4gIHR5cGU6IHN0cmluZztcbiAgdmFsdWVUeXBlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwVmFsdWUgZXh0ZW5kcyBFeHAge1xuICB2YWx1ZTogYW55O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlZ0V4cFZhbHVlIGV4dGVuZHMgRXhwVmFsdWUge1xuICBtb2RpZmllcnM6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHBOdWxsIGV4dGVuZHMgRXhwIHtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHBPcCBleHRlbmRzIEV4cCB7XG4gIG9wOiBzdHJpbmc7XG4gIGFyZ3M6IEV4cFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cFZhcmlhYmxlIGV4dGVuZHMgRXhwIHtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cExpdGVyYWwgZXh0ZW5kcyBFeHAge1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbi8vIGJhc2VbYWNjZXNzb3JdXG5leHBvcnQgaW50ZXJmYWNlIEV4cFJlZmVyZW5jZSBleHRlbmRzIEV4cCB7XG4gIGJhc2U6IEV4cDtcbiAgYWNjZXNzb3I6IEV4cDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHBDYWxsIGV4dGVuZHMgRXhwIHtcbiAgcmVmOiBFeHBSZWZlcmVuY2UgfCBFeHBWYXJpYWJsZTtcbiAgYXJnczogRXhwW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cDsgfTtcblxuZXhwb3J0IHR5cGUgQnVpbHRpbkZ1bmN0aW9uID0gKGFyZ3M6IEV4cFtdLCBwYXJhbXM6IFBhcmFtcykgPT4gRXhwO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4cEJ1aWx0aW4gZXh0ZW5kcyBFeHAge1xuICBmbjogQnVpbHRpbkZ1bmN0aW9uO1xufVxuXG5leHBvcnQgdHlwZSBFeHBUeXBlID0gRXhwU2ltcGxlVHlwZSB8IEV4cFVuaW9uVHlwZSB8IEV4cEdlbmVyaWNUeXBlO1xuZXhwb3J0IGludGVyZmFjZSBUeXBlUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cFR5cGU7IH07XG5cbi8vIFNpbXBsZSBUeXBlIChyZWZlcmVuY2UpXG5leHBvcnQgaW50ZXJmYWNlIEV4cFNpbXBsZVR5cGUgZXh0ZW5kcyBFeHAge1xuICBuYW1lOiBzdHJpbmc7XG59XG5cbi8vIFVuaW9uIFR5cGU6IFR5cGUxIHwgVHlwZTIgfCAuLi5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwVW5pb25UeXBlIGV4dGVuZHMgRXhwIHtcbiAgdHlwZXM6IEV4cFR5cGVbXTtcbn1cblxuLy8gR2VuZXJpYyBUeXBlIChyZWZlcmVuY2UpOiBUeXBlPFR5cGUxLCBUeXBlMiwgLi4uPlxuZXhwb3J0IGludGVyZmFjZSBFeHBHZW5lcmljVHlwZSBleHRlbmRzIEV4cCB7XG4gIG5hbWU6IHN0cmluZztcbiAgcGFyYW1zOiBFeHBUeXBlW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWV0aG9kIHtcbiAgcGFyYW1zOiBzdHJpbmdbXTtcbiAgYm9keTogRXhwO1xufVxuXG5leHBvcnQgY2xhc3MgUGF0aFBhcnQge1xuICBsYWJlbDogc3RyaW5nO1xuICB2YXJpYWJsZTogc3RyaW5nO1xuXG4gIC8vIFwibGFiZWxcIiwgdW5kZWZpbmVkIC0gc3RhdGljIHBhdGggcGFydFxuICAvLyBcIiRsYWJlbFwiLCBYIC0gdmFyaWFibGUgcGF0aCBwYXJ0XG4gIC8vIFgsICF1bmRlZmluZWQgLSB2YXJpYWJsZSBwYXRoIHBhcnRcbiAgY29uc3RydWN0b3IobGFiZWw6IHN0cmluZywgdmFyaWFibGU/OiBzdHJpbmcpIHtcbiAgICBpZiAobGFiZWxbMF0gPT09ICckJyAmJiB2YXJpYWJsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB2YXJpYWJsZSA9IGxhYmVsO1xuICAgIH1cbiAgICBpZiAodmFyaWFibGUgJiYgbGFiZWxbMF0gIT09ICckJykge1xuICAgICAgbGFiZWwgPSAnJCcgKyBsYWJlbDtcbiAgICB9XG4gICAgdGhpcy5sYWJlbCA9IGxhYmVsO1xuICAgIHRoaXMudmFyaWFibGUgPSA8c3RyaW5nPiB2YXJpYWJsZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUGF0aFRlbXBsYXRlIHtcbiAgcGFydHM6IFBhdGhQYXJ0W107XG5cbiAgY29uc3RydWN0b3IocGFydHMgPSA8KHN0cmluZyB8IFBhdGhQYXJ0KVtdPiBbXSkge1xuICAgIHRoaXMucGFydHMgPSA8UGF0aFBhcnRbXT4gcGFydHMubWFwKChwYXJ0KSA9PiB7XG4gICAgICBpZiAodXRpbC5pc1R5cGUocGFydCwgJ3N0cmluZycpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUGF0aFBhcnQoPHN0cmluZz4gcGFydCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gPFBhdGhQYXJ0PiBwYXJ0O1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgY29weSgpIHtcbiAgICBsZXQgcmVzdWx0ID0gbmV3IFBhdGhUZW1wbGF0ZSgpO1xuICAgIHJlc3VsdC5wdXNoKHRoaXMpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBnZXRMYWJlbHMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLnBhcnRzLm1hcCgocGFydCkgPT4gcGFydC5sYWJlbCk7XG4gIH1cblxuICAvLyBNYXBwaW5nIGZyb20gdmFyaWFibGVzIHRvIEpTT04gbGFiZWxzXG4gIGdldFNjb3BlKCk6IFBhcmFtcyB7XG4gICAgbGV0IHJlc3VsdCA9IDxQYXJhbXM+IHt9O1xuICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgaWYgKHBhcnQudmFyaWFibGUpIHtcbiAgICAgICAgaWYgKHJlc3VsdFtwYXJ0LnZhcmlhYmxlXSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuZHVwbGljYXRlUGF0aFBhcnQgKyBwYXJ0LnZhcmlhYmxlKTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHRbcGFydC52YXJpYWJsZV0gPSBsaXRlcmFsKHBhcnQubGFiZWwpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBwdXNoKHRlbXA6IFBhdGhUZW1wbGF0ZSkge1xuICAgIHV0aWwuZXh0ZW5kQXJyYXkodGhpcy5wYXJ0cywgdGVtcC5wYXJ0cyk7XG4gIH1cblxuICBwb3AodGVtcDogUGF0aFRlbXBsYXRlKSB7XG4gICAgdGVtcC5wYXJ0cy5mb3JFYWNoKChwYXJ0KSA9PiB7XG4gICAgICB0aGlzLnBhcnRzLnBvcCgpO1xuICAgIH0pO1xuICB9XG5cbiAgbGVuZ3RoKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMucGFydHMubGVuZ3RoO1xuICB9XG5cbiAgZ2V0UGFydChpOiBudW1iZXIpOiBQYXRoUGFydCB7XG4gICAgaWYgKGkgPiB0aGlzLnBhcnRzLmxlbmd0aCB8fCBpIDwgLXRoaXMucGFydHMubGVuZ3RoKSB7XG4gICAgICBsZXQgbCA9IHRoaXMucGFydHMubGVuZ3RoO1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGF0aCByZWZlcmVuY2Ugb3V0IG9mIGJvdW5kczogXCIgKyBpICtcbiAgICAgICAgICAgICAgICAgICAgICBcIiBbXCIgKyAtbCArIFwiIC4uIFwiICsgbCArIFwiXVwiKTtcbiAgICB9XG4gICAgaWYgKGkgPCAwKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJ0c1t0aGlzLnBhcnRzLmxlbmd0aCArIGldO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYXJ0c1tpXTtcbiAgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhdGgge1xuICB0ZW1wbGF0ZTogUGF0aFRlbXBsYXRlO1xuICBpc1R5cGU6IEV4cFR5cGU7XG4gIG1ldGhvZHM6IHsgW25hbWU6IHN0cmluZ106IE1ldGhvZCB9O1xufTtcblxuZXhwb3J0IGNsYXNzIFNjaGVtYSB7XG4gIGRlcml2ZWRGcm9tOiBFeHBUeXBlO1xuICBwcm9wZXJ0aWVzOiBUeXBlUGFyYW1zO1xuICBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcblxuICAvLyBHZW5lcmljIHBhcmFtZXRlcnMgLSBpZiBhIEdlbmVyaWMgc2NoZW1hXG4gIHBhcmFtcz86IHN0cmluZ1tdO1xuICBnZXRWYWxpZGF0b3I/OiAocGFyYW1zOiBFeHBbXSkgPT4gT2JqZWN0O1xuXG4gIHN0YXRpYyBpc0dlbmVyaWMoc2NoZW1hOiBTY2hlbWEpOiBib29sZWFuIHtcbiAgICByZXR1cm4gc2NoZW1hLnBhcmFtcyAhPT0gdW5kZWZpbmVkICYmIHNjaGVtYS5wYXJhbXMubGVuZ3RoID4gMDtcbiAgfVxufTtcblxuZXhwb3J0IHZhciBzdHJpbmc6ICh2OiBzdHJpbmcpID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ1N0cmluZycpO1xuZXhwb3J0IHZhciBib29sZWFuOiAodjogYm9vbGVhbikgPT4gRXhwVmFsdWUgPSB2YWx1ZUdlbignQm9vbGVhbicpO1xuZXhwb3J0IHZhciBudW1iZXI6ICh2OiBudW1iZXIpID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ051bWJlcicpO1xuZXhwb3J0IHZhciBhcnJheTogKHY6IEFycmF5PGFueT4pID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ0FycmF5Jyk7XG5cbmV4cG9ydCB2YXIgbmVnID0gb3BHZW4oJ25lZycsIDEpO1xuZXhwb3J0IHZhciBub3QgPSBvcEdlbignIScsIDEpO1xuZXhwb3J0IHZhciBtdWx0ID0gb3BHZW4oJyonKTtcbmV4cG9ydCB2YXIgZGl2ID0gb3BHZW4oJy8nKTtcbmV4cG9ydCB2YXIgbW9kID0gb3BHZW4oJyUnKTtcbmV4cG9ydCB2YXIgYWRkID0gb3BHZW4oJysnKTtcbmV4cG9ydCB2YXIgc3ViID0gb3BHZW4oJy0nKTtcbmV4cG9ydCB2YXIgZXEgPSBvcEdlbignPT0nKTtcbmV4cG9ydCB2YXIgbHQgPSBvcEdlbignPCcpO1xuZXhwb3J0IHZhciBsdGUgPSBvcEdlbignPD0nKTtcbmV4cG9ydCB2YXIgZ3QgPSBvcEdlbignPicpO1xuZXhwb3J0IHZhciBndGUgPSBvcEdlbignPj0nKTtcbmV4cG9ydCB2YXIgbmUgPSBvcEdlbignIT0nKTtcbmV4cG9ydCB2YXIgYW5kID0gb3BHZW4oJyYmJyk7XG5leHBvcnQgdmFyIG9yID0gb3BHZW4oJ3x8Jyk7XG5leHBvcnQgdmFyIHRlcm5hcnkgPSBvcEdlbignPzonLCAzKTtcbmV4cG9ydCB2YXIgdmFsdWUgPSBvcEdlbigndmFsdWUnLCAxKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHZhcmlhYmxlKG5hbWU6IHN0cmluZyk6IEV4cFZhcmlhYmxlIHtcbiAgcmV0dXJuIHsgdHlwZTogJ3ZhcicsIHZhbHVlVHlwZTogJ0FueScsIG5hbWU6IG5hbWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxpdGVyYWwobmFtZTogc3RyaW5nKTogRXhwTGl0ZXJhbCB7XG4gIHJldHVybiB7IHR5cGU6ICdsaXRlcmFsJywgdmFsdWVUeXBlOiAnQW55JywgbmFtZTogbmFtZSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbnVsbFR5cGUoKTogRXhwTnVsbCB7XG4gIHJldHVybiB7IHR5cGU6ICdOdWxsJywgdmFsdWVUeXBlOiAnTnVsbCcgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmVyZW5jZShiYXNlOiBFeHAsIHByb3A6IEV4cCk6IEV4cFJlZmVyZW5jZSB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ3JlZicsXG4gICAgdmFsdWVUeXBlOiAnQW55JyxcbiAgICBiYXNlOiBiYXNlLFxuICAgIGFjY2Vzc29yOiBwcm9wXG4gIH07XG59XG5cbmxldCByZUlkZW50aWZpZXIgPSAvXlthLXpBLVpfJF1bYS16QS1aMC05X10qJC87XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0lkZW50aWZpZXJTdHJpbmdFeHAoZXhwOiBFeHApIHtcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnU3RyaW5nJyAmJiByZUlkZW50aWZpZXIudGVzdCgoPEV4cFZhbHVlPiBleHApLnZhbHVlKTtcbn1cblxuLy8gU2hhbGxvdyBjb3B5IG9mIGFuIGV4cHJlc3Npb24gKHNvIGl0IGNhbiBiZSBtb2RpZmllZCBhbmQgcHJlc2VydmVcbi8vIGltbXV0YWJpbGl0eSBvZiB0aGUgb3JpZ2luYWwgZXhwcmVzc2lvbikuXG5leHBvcnQgZnVuY3Rpb24gY29weUV4cChleHA6IEV4cCk6IEV4cCB7XG4gIGV4cCA9IDxFeHA+IHV0aWwuZXh0ZW5kKHt9LCBleHApO1xuICBzd2l0Y2ggKGV4cC50eXBlKSB7XG4gIGNhc2UgJ29wJzpcbiAgY2FzZSAnY2FsbCc6XG4gICAgbGV0IG9wRXhwID0gPEV4cE9wPiBleHA7XG4gICAgb3BFeHAuYXJncyA9IHV0aWwuY29weUFycmF5KG9wRXhwLmFyZ3MpO1xuICAgIHJldHVybiBvcEV4cDtcblxuICBjYXNlICd1bmlvbic6XG4gICAgbGV0IHVuaW9uRXhwID0gPEV4cFVuaW9uVHlwZT4gZXhwO1xuICAgIHVuaW9uRXhwLnR5cGVzID0gdXRpbC5jb3B5QXJyYXkodW5pb25FeHAudHlwZXMpO1xuICAgIHJldHVybiB1bmlvbkV4cDtcblxuICBjYXNlICdnZW5lcmljJzpcbiAgICBsZXQgZ2VuZXJpY0V4cCA9IDxFeHBHZW5lcmljVHlwZT4gZXhwO1xuICAgIGdlbmVyaWNFeHAucGFyYW1zID0gdXRpbC5jb3B5QXJyYXkoZ2VuZXJpY0V4cC5wYXJhbXMpO1xuICAgIHJldHVybiBnZW5lcmljRXhwO1xuXG4gIGRlZmF1bHQ6XG4gICAgIHJldHVybiBleHA7XG4gIH1cbn1cblxuLy8gTWFrZSBhIChzaGFsbG93KSBjb3B5IG9mIHRoZSBiYXNlIGV4cHJlc3Npb24sIHNldHRpbmcgKG9yIHJlbW92aW5nKSBpdCdzXG4vLyB2YWx1ZVR5cGUuXG4vL1xuLy8gdmFsdWVUeXBlIGlzIGEgc3RyaW5nIGluZGljYXRpbmcgdGhlIHR5cGUgb2YgZXZhbHVhdGluZyBhbiBleHByZXNzaW9uIChlLmcuXG4vLyAnU25hcHNob3QnKSAtIHVzZWQgdG8ga25vdyB3aGVuIHR5cGUgY29lcmNpb24gaXMgbmVlZGVkIGluIHRoZSBjb250ZXh0XG4vLyBvZiBwYXJlbnQgZXhwcmVzc2lvbnMuXG5leHBvcnQgZnVuY3Rpb24gY2FzdChiYXNlOiBFeHAsIHZhbHVlVHlwZTogc3RyaW5nKTogRXhwIHtcbiAgdmFyIHJlc3VsdCA9IGNvcHlFeHAoYmFzZSk7XG4gIHJlc3VsdC52YWx1ZVR5cGUgPSB2YWx1ZVR5cGU7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjYWxsKHJlZjogRXhwUmVmZXJlbmNlIHwgRXhwVmFyaWFibGUsIGFyZ3M6IEV4cFtdPSBbXSk6IEV4cENhbGwge1xuICByZXR1cm4geyB0eXBlOiAnY2FsbCcsIHZhbHVlVHlwZTogJ0FueScsIHJlZjogcmVmLCBhcmdzOiBhcmdzIH07XG59XG5cbi8vIFJldHVybiBlbXB0eSBzdHJpbmcgaWYgbm90IGEgZnVuY3Rpb24uXG5leHBvcnQgZnVuY3Rpb24gZ2V0RnVuY3Rpb25OYW1lKGV4cDogRXhwQ2FsbCk6IHN0cmluZyB7XG4gIGlmIChleHAucmVmLnR5cGUgPT09ICdyZWYnKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHJldHVybiAoPEV4cFZhcmlhYmxlPiBleHAucmVmKS5uYW1lO1xufVxuXG4vLyBSZXR1cm4gZW1wdHkgc3RyaW5nIGlmIG5vdCBhIChzaW1wbGUpIG1ldGhvZCBjYWxsIC0tIHJlZi5mbigpXG5leHBvcnQgZnVuY3Rpb24gZ2V0TWV0aG9kTmFtZShleHA6IEV4cENhbGwpOiBzdHJpbmcge1xuICBpZiAoZXhwLnJlZi50eXBlID09PSAndmFyJykge1xuICAgIHJldHVybiAoPEV4cFZhcmlhYmxlPiBleHAucmVmKS5uYW1lO1xuICB9XG4gIGlmIChleHAucmVmLnR5cGUgIT09ICdyZWYnKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHJldHVybiBnZXRQcm9wTmFtZSg8RXhwUmVmZXJlbmNlPiBleHAucmVmKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb3BOYW1lKHJlZjogRXhwUmVmZXJlbmNlKTogc3RyaW5nIHtcbiAgaWYgKHJlZi5hY2Nlc3Nvci50eXBlICE9PSAnU3RyaW5nJykge1xuICAgIHJldHVybiAnJztcbiAgfVxuICByZXR1cm4gKDxFeHBWYWx1ZT4gcmVmLmFjY2Vzc29yKS52YWx1ZTtcbn1cblxuLy8gVE9ETzogVHlwZSBvZiBmdW5jdGlvbiBzaWduYXR1cmUgZG9lcyBub3QgZmFpbCB0aGlzIGRlY2xhcmF0aW9uP1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWx0aW4oZm46IEJ1aWx0aW5GdW5jdGlvbik6IEV4cEJ1aWx0aW4ge1xuICByZXR1cm4geyB0eXBlOiAnYnVpbHRpbicsIHZhbHVlVHlwZTogJ0FueScsIGZuOiBmbiB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc25hcHNob3RWYXJpYWJsZShuYW1lOiBzdHJpbmcpOiBFeHBWYXJpYWJsZSB7XG4gIHJldHVybiA8RXhwVmFyaWFibGU+IGNhc3QodmFyaWFibGUobmFtZSksICdTbmFwc2hvdCcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc25hcHNob3RQYXJlbnQoYmFzZTogRXhwKTogRXhwIHtcbiAgaWYgKGJhc2UudmFsdWVUeXBlICE9PSAnU25hcHNob3QnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy50eXBlTWlzbWF0Y2ggKyBcImV4cGVjdGVkIFNuYXBzaG90XCIpO1xuICB9XG4gIHJldHVybiBjYXN0KGNhbGwocmVmZXJlbmNlKGNhc3QoYmFzZSwgJ0FueScpLCBzdHJpbmcoJ3BhcmVudCcpKSksXG4gICAgICAgICAgICAgICdTbmFwc2hvdCcpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlVmFsdWUoZXhwOiBFeHApOiBFeHAge1xuICBpZiAoZXhwLnZhbHVlVHlwZSA9PT0gJ1NuYXBzaG90Jykge1xuICAgIHJldHVybiBzbmFwc2hvdFZhbHVlKGV4cCk7XG4gIH1cbiAgcmV0dXJuIGV4cDtcbn1cblxuLy8gcmVmLnZhbCgpXG5leHBvcnQgZnVuY3Rpb24gc25hcHNob3RWYWx1ZShleHA6IEV4cCk6IEV4cENhbGwge1xuICByZXR1cm4gY2FsbChyZWZlcmVuY2UoY2FzdChleHAsICdBbnknKSwgc3RyaW5nKCd2YWwnKSkpO1xufVxuXG4vLyBFbnN1cmUgZXhwcmVzc2lvbiBpcyBhIGJvb2xlYW4gKHdoZW4gdXNlZCBpbiBhIGJvb2xlYW4gY29udGV4dCkuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlQm9vbGVhbihleHA6IEV4cCk6IEV4cCB7XG4gIGV4cCA9IGVuc3VyZVZhbHVlKGV4cCk7XG4gIGlmIChpc0NhbGwoZXhwLCAndmFsJykpIHtcbiAgICBleHAgPSBlcShleHAsIGJvb2xlYW4odHJ1ZSkpO1xuICB9XG4gIHJldHVybiBleHA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NhbGwoZXhwOiBFeHAsIG1ldGhvZE5hbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gZXhwLnR5cGUgPT09ICdjYWxsJyAmJiAoPEV4cENhbGw+IGV4cCkucmVmLnR5cGUgPT09ICdyZWYnICYmXG4gICAgKDxFeHBSZWZlcmVuY2U+ICg8RXhwQ2FsbD4gZXhwKS5yZWYpLmFjY2Vzc29yLnR5cGUgPT09ICdTdHJpbmcnICYmXG4gICAgKDxFeHBWYWx1ZT4gKDxFeHBSZWZlcmVuY2U+ICg8RXhwQ2FsbD4gZXhwKS5yZWYpLmFjY2Vzc29yKS52YWx1ZSA9PT0gbWV0aG9kTmFtZTtcbn1cblxuLy8gUmV0dXJuIHZhbHVlIGdlbmVyYXRpbmcgZnVuY3Rpb24gZm9yIGEgZ2l2ZW4gVHlwZS5cbmZ1bmN0aW9uIHZhbHVlR2VuKHR5cGVOYW1lOiBzdHJpbmcpOiAoKHZhbDogYW55KSA9PiBFeHBWYWx1ZSkge1xuICByZXR1cm4gZnVuY3Rpb24odmFsKTogRXhwVmFsdWUge1xuICAgIHJldHVybiB7XG4gICAgICB0eXBlOiB0eXBlTmFtZSwgICAgICAvLyBFeHAgdHlwZSBpZGVudGlmeWluZyBhIGNvbnN0YW50IHZhbHVlIG9mIHRoaXMgVHlwZS5cbiAgICAgIHZhbHVlVHlwZTogdHlwZU5hbWUsIC8vIFRoZSB0eXBlIG9mIHRoZSByZXN1bHQgb2YgZXZhbHVhdGluZyB0aGlzIGV4cHJlc3Npb24uXG4gICAgICB2YWx1ZTogdmFsICAgICAgICAgICAvLyBUaGUgKGNvbnN0YW50KSB2YWx1ZSBpdHNlbGYuXG4gICAgfTtcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2V4cChwYXR0ZXJuOiBzdHJpbmcsIG1vZGlmaWVycyA9IFwiXCIpOiBSZWdFeHBWYWx1ZSB7XG4gIHN3aXRjaCAobW9kaWZpZXJzKSB7XG4gIGNhc2UgXCJcIjpcbiAgY2FzZSBcImlcIjpcbiAgICBicmVhaztcbiAgZGVmYXVsdDpcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnN1cHBvcnRlZCBSZWdFeHAgbW9kaWZpZXI6IFwiICsgbW9kaWZpZXJzKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHR5cGU6ICdSZWdFeHAnLFxuICAgIHZhbHVlVHlwZTogJ1JlZ0V4cCcsXG4gICAgdmFsdWU6IHBhdHRlcm4sXG4gICAgbW9kaWZpZXJzOiBtb2RpZmllcnNcbiAgfTtcbn1cblxuZnVuY3Rpb24gY21wVmFsdWVzKHYxOiBFeHAsIHYyOiBFeHBWYWx1ZSk6IGJvb2xlYW4ge1xuICBpZiAodjEudHlwZSAhPT0gdjIudHlwZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gKDxFeHBWYWx1ZT4gdjEpLnZhbHVlID09PSB2Mi52YWx1ZTtcbn1cblxuZnVuY3Rpb24gaXNPcChvcFR5cGU6IHN0cmluZywgZXhwOiBFeHApOiBib29sZWFuIHtcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnb3AnICYmICg8RXhwT3A+IGV4cCkub3AgPT09IG9wVHlwZTtcbn1cblxuLy8gUmV0dXJuIGEgZ2VuZXJhdGluZyBmdW5jdGlvbiB0byBtYWtlIGFuIG9wZXJhdG9yIGV4cCBub2RlLlxuZnVuY3Rpb24gb3BHZW4ob3BUeXBlOiBzdHJpbmcsIGFyaXR5OiBudW1iZXIgPSAyKTogKCguLi5hcmdzOiBFeHBbXSkgPT4gRXhwT3ApIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpOiBFeHBPcCB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSBhcml0eSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiT3BlcmF0b3IgaGFzIFwiICsgYXJncy5sZW5ndGggK1xuICAgICAgICAgICAgICAgICAgICAgIFwiIGFyZ3VtZW50cyAoZXhwZWN0aW5nIFwiICsgYXJpdHkgKyBcIikuXCIpO1xuICAgIH1cbiAgICByZXR1cm4gb3Aob3BUeXBlLCBhcmdzKTtcbiAgfTtcbn1cblxuZXhwb3J0IHZhciBhbmRBcnJheSA9IGxlZnRBc3NvY2lhdGVHZW4oJyYmJywgYm9vbGVhbih0cnVlKSwgYm9vbGVhbihmYWxzZSkpO1xuZXhwb3J0IHZhciBvckFycmF5ID0gbGVmdEFzc29jaWF0ZUdlbignfHwnLCBib29sZWFuKGZhbHNlKSwgYm9vbGVhbih0cnVlKSk7XG5cbi8vIENyZWF0ZSBhbiBleHByZXNzaW9uIGJ1aWxkZXIgZnVuY3Rpb24gd2hpY2ggb3BlcmF0ZXMgb24gYXJyYXlzIG9mIHZhbHVlcy5cbi8vIFJldHVybnMgbmV3IGV4cHJlc3Npb24gbGlrZSB2MSBvcCB2MiBvcCB2MyAuLi5cbi8vXG4vLyAtIEFueSBpZGVudGl0eVZhbHVlJ3MgaW4gYXJyYXkgaW5wdXQgYXJlIGlnbm9yZWQuXG4vLyAtIElmIHplcm9WYWx1ZSBpcyBmb3VuZCAtIGp1c3QgcmV0dXJuIHplcm9WYWx1ZS5cbi8vXG4vLyBPdXIgZnVuY3Rpb24gcmUtb3JkZXJzIHRvcC1sZXZlbCBvcCBpbiBhcnJheSBlbGVtZW50cyB0byB0aGUgcmVzdWx0aW5nXG4vLyBleHByZXNzaW9uIGlzIGxlZnQtYXNzb2NpYXRpbmcuICBFLmcuOlxuLy9cbi8vICAgIFthICYmIGIsIGMgJiYgZF0gPT4gKCgoYSAmJiBiKSAmJiBjKSAmJiBkKVxuLy8gICAgKE5PVCAoYSAmJiBiKSAmJiAoYyAmJiBkKSlcbmZ1bmN0aW9uIGxlZnRBc3NvY2lhdGVHZW4ob3BUeXBlOiBzdHJpbmcsIGlkZW50aXR5VmFsdWU6IEV4cFZhbHVlLCB6ZXJvVmFsdWU6IEV4cFZhbHVlKSB7XG4gIHJldHVybiBmdW5jdGlvbihhOiBFeHBbXSk6IEV4cCB7XG4gICAgdmFyIGk6IG51bWJlcjtcblxuICAgIGZ1bmN0aW9uIHJlZHVjZXIocmVzdWx0OiBFeHAsIGN1cnJlbnQ6IEV4cCkge1xuICAgICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBjdXJyZW50O1xuICAgICAgfVxuICAgICAgcmV0dXJuIG9wKG9wVHlwZSwgW3Jlc3VsdCwgY3VycmVudF0pO1xuICAgIH1cblxuICAgIC8vIEZpcnN0IGZsYXR0ZW4gYWxsIHRvcC1sZXZlbCBvcCB2YWx1ZXMgdG8gb25lIGZsYXQgYXJyYXkuXG4gICAgdmFyIGZsYXQgPSA8RXhwW10+W107XG4gICAgZm9yIChpID0gMDsgaSA8IGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZsYXR0ZW4ob3BUeXBlLCBhW2ldLCBmbGF0KTtcbiAgICB9XG5cbiAgICB2YXIgcmVzdWx0ID0gPEV4cFtdPltdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBmbGF0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyBSZW1vdmUgaWRlbnRpZnlWYWx1ZXMgZnJvbSBhcnJheS5cbiAgICAgIGlmIChjbXBWYWx1ZXMoZmxhdFtpXSwgaWRlbnRpdHlWYWx1ZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBKdXN0IHJldHVybiB6ZXJvVmFsdWUgaWYgZm91bmRcbiAgICAgIGlmIChjbXBWYWx1ZXMoZmxhdFtpXSwgemVyb1ZhbHVlKSkge1xuICAgICAgICByZXR1cm4gemVyb1ZhbHVlO1xuICAgICAgfVxuICAgICAgcmVzdWx0LnB1c2goZmxhdFtpXSk7XG4gICAgfVxuXG4gICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiBpZGVudGl0eVZhbHVlO1xuICAgIH1cblxuICAgIC8vIFJldHVybiBsZWZ0LWFzc29jaWF0aXZlIGV4cHJlc3Npb24gb2Ygb3BUeXBlLlxuICAgIHJldHVybiByZXN1bHQucmVkdWNlKHJlZHVjZXIpO1xuICB9O1xufVxuXG4vLyBGbGF0dGVuIHRoZSB0b3AgbGV2ZWwgdHJlZSBvZiBvcCBpbnRvIGEgc2luZ2xlIGZsYXQgYXJyYXkgb2YgZXhwcmVzc2lvbnMuXG5leHBvcnQgZnVuY3Rpb24gZmxhdHRlbihvcFR5cGU6IHN0cmluZywgZXhwOiBFeHAsIGZsYXQ/OiBFeHBbXSk6IEV4cFtdIHtcbiAgdmFyIGk6IG51bWJlcjtcblxuICBpZiAoZmxhdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZmxhdCA9IFtdO1xuICB9XG5cbiAgaWYgKCFpc09wKG9wVHlwZSwgZXhwKSkge1xuICAgIGZsYXQucHVzaChleHApO1xuICAgIHJldHVybiBmbGF0O1xuICB9XG5cbiAgZm9yIChpID0gMDsgaSA8ICg8RXhwT3A+IGV4cCkuYXJncy5sZW5ndGg7IGkrKykge1xuICAgIGZsYXR0ZW4ob3BUeXBlLCAoPEV4cE9wPiBleHApLmFyZ3NbaV0sIGZsYXQpO1xuICB9XG5cbiAgcmV0dXJuIGZsYXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcChvcFR5cGU6IHN0cmluZywgYXJnczogRXhwW10pOiBFeHBPcCB7XG4gIHJldHVybiB7XG4gICAgdHlwZTogJ29wJywgICAgIC8vIFRoaXMgaXMgKG11bHRpLWFyZ3VtZW50KSBvcGVyYXRvci5cbiAgICB2YWx1ZVR5cGU6ICdBbnknLFxuICAgIG9wOiBvcFR5cGUsICAgICAvLyBUaGUgb3BlcmF0b3IgKHN0cmluZywgZS5nLiAnKycpLlxuICAgIGFyZ3M6IGFyZ3MgICAgICAvLyBBcmd1bWVudHMgdG8gdGhlIG9wZXJhdG9yIEFycmF5PGV4cD5cbiAgfTtcbn1cblxuLy8gV2FybmluZzogTk9UIGFuIGV4cHJlc3Npb24gdHlwZSFcbmV4cG9ydCBmdW5jdGlvbiBtZXRob2QocGFyYW1zOiBzdHJpbmdbXSwgYm9keTogRXhwKTogTWV0aG9kIHtcbiAgcmV0dXJuIHtcbiAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICBib2R5OiBib2R5XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0eXBlVHlwZSh0eXBlTmFtZTogc3RyaW5nKTogRXhwU2ltcGxlVHlwZSB7XG4gIHJldHVybiB7IHR5cGU6IFwidHlwZVwiLCB2YWx1ZVR5cGU6IFwidHlwZVwiLCBuYW1lOiB0eXBlTmFtZSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdW5pb25UeXBlKHR5cGVzOiBFeHBUeXBlW10pOiBFeHBVbmlvblR5cGUge1xuICByZXR1cm4geyB0eXBlOiBcInVuaW9uXCIsIHZhbHVlVHlwZTogXCJ0eXBlXCIsIHR5cGVzOiB0eXBlcyB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJpY1R5cGUodHlwZU5hbWU6IHN0cmluZywgcGFyYW1zOiBFeHBUeXBlW10pOiBFeHBHZW5lcmljVHlwZSB7XG4gIHJldHVybiB7IHR5cGU6IFwiZ2VuZXJpY1wiLCB2YWx1ZVR5cGU6IFwidHlwZVwiLCBuYW1lOiB0eXBlTmFtZSwgcGFyYW1zOiBwYXJhbXMgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFN5bWJvbHMge1xuICBmdW5jdGlvbnM6IHsgW25hbWU6IHN0cmluZ106IE1ldGhvZCB9O1xuICBwYXRoczogUGF0aFtdO1xuICBzY2hlbWE6IHsgW25hbWU6IHN0cmluZ106IFNjaGVtYSB9O1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHRoaXMuZnVuY3Rpb25zID0ge307XG4gICAgdGhpcy5wYXRocyA9IFtdO1xuICAgIHRoaXMuc2NoZW1hID0ge307XG4gIH1cblxuICByZWdpc3RlcjxUPihtYXA6IHtbbmFtZTogc3RyaW5nXTogVH0sIHR5cGVOYW1lOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgb2JqZWN0OiBUKTogVCB7XG4gICAgaWYgKG1hcFtuYW1lXSkge1xuICAgICAgbG9nZ2VyLmVycm9yKFwiRHVwbGljYXRlZCBcIiArIHR5cGVOYW1lICsgXCIgZGVmaW5pdGlvbjogXCIgKyBuYW1lICsgXCIuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBtYXBbbmFtZV0gPSBvYmplY3Q7XG4gICAgfVxuICAgIHJldHVybiBtYXBbbmFtZV07XG4gIH1cblxuICByZWdpc3RlckZ1bmN0aW9uKG5hbWU6IHN0cmluZywgcGFyYW1zOiBzdHJpbmdbXSwgYm9keTogRXhwKTogTWV0aG9kIHtcbiAgICByZXR1cm4gdGhpcy5yZWdpc3RlcjxNZXRob2Q+KHRoaXMuZnVuY3Rpb25zLCAnZnVuY3Rpb25zJywgbmFtZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZChwYXJhbXMsIGJvZHkpKTtcbiAgfVxuXG4gIHJlZ2lzdGVyUGF0aCh0ZW1wbGF0ZTogUGF0aFRlbXBsYXRlLCBpc1R5cGU6IEV4cFR5cGUgfCB2b2lkLCBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2Q7IH0gPSB7fSk6IFBhdGgge1xuICAgIGlzVHlwZSA9IGlzVHlwZSB8fCB0eXBlVHlwZSgnQW55Jyk7XG4gICAgdmFyIHA6IFBhdGggPSB7XG4gICAgICB0ZW1wbGF0ZTogdGVtcGxhdGUuY29weSgpLFxuICAgICAgaXNUeXBlOiA8RXhwVHlwZT4gaXNUeXBlLFxuICAgICAgbWV0aG9kczogbWV0aG9kc1xuICAgIH07XG4gICAgdGhpcy5wYXRocy5wdXNoKHApO1xuICAgIHJldHVybiBwO1xuICB9XG5cbiAgcmVnaXN0ZXJTY2hlbWEobmFtZTogc3RyaW5nLFxuICAgICAgICAgICAgICAgICBkZXJpdmVkRnJvbT86IEV4cFR5cGUsXG4gICAgICAgICAgICAgICAgIHByb3BlcnRpZXMgPSA8VHlwZVBhcmFtcz4ge30sXG4gICAgICAgICAgICAgICAgIG1ldGhvZHMgPSA8eyBbbmFtZTogc3RyaW5nXTogTWV0aG9kIH0+IHt9LFxuICAgICAgICAgICAgICAgICBwYXJhbXMgPSA8c3RyaW5nW10+IFtdKVxuICA6IFNjaGVtYSB7XG4gICAgZGVyaXZlZEZyb20gPSBkZXJpdmVkRnJvbSB8fCB0eXBlVHlwZShPYmplY3Qua2V5cyhwcm9wZXJ0aWVzKS5sZW5ndGggPiAwID8gJ09iamVjdCcgOiAnQW55Jyk7XG5cbiAgICB2YXIgczogU2NoZW1hID0ge1xuICAgICAgZGVyaXZlZEZyb206IDxFeHBUeXBlPiBkZXJpdmVkRnJvbSxcbiAgICAgIHByb3BlcnRpZXM6IHByb3BlcnRpZXMsXG4gICAgICBtZXRob2RzOiBtZXRob2RzLFxuICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgfTtcbiAgICByZXR1cm4gdGhpcy5yZWdpc3RlcjxTY2hlbWE+KHRoaXMuc2NoZW1hLCAnc2NoZW1hJywgbmFtZSwgcyk7XG4gIH1cblxuICBpc0Rlcml2ZWRGcm9tKHR5cGU6IEV4cFR5cGUsIGFuY2VzdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICBpZiAoYW5jZXN0b3IgPT09ICdBbnknKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKHR5cGUudHlwZSkge1xuICAgIGNhc2UgJ3R5cGUnOlxuICAgIGNhc2UgJ2dlbmVyaWMnOlxuICAgICAgbGV0IHNpbXBsZVR5cGUgPSA8RXhwU2ltcGxlVHlwZT4gdHlwZTtcbiAgICAgIGlmIChzaW1wbGVUeXBlLm5hbWUgPT09IGFuY2VzdG9yKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKHNpbXBsZVR5cGUubmFtZSA9PT0gJ0FueScpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgbGV0IHNjaGVtYSA9IHRoaXMuc2NoZW1hW3NpbXBsZVR5cGUubmFtZV07XG4gICAgICBpZiAoIXNjaGVtYSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5pc0Rlcml2ZWRGcm9tKHNjaGVtYS5kZXJpdmVkRnJvbSwgYW5jZXN0b3IpO1xuXG4gICAgY2FzZSAndW5pb24nOlxuICAgICAgcmV0dXJuICg8RXhwVW5pb25UeXBlPiB0eXBlKS50eXBlc1xuICAgICAgICAubWFwKChzdWJUeXBlKSA9PiB0aGlzLmlzRGVyaXZlZEZyb20oc3ViVHlwZSwgYW5jZXN0b3IpKVxuICAgICAgICAucmVkdWNlKHV0aWwub3IpO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdHlwZTogXCIgKyB0eXBlLnR5cGUpO1xuICAgICAgfVxuICB9XG59XG5cbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL09wZXJhdG9ycy9PcGVyYXRvcl9QcmVjZWRlbmNlXG5pbnRlcmZhY2UgT3BQcmlvcml0eSB7XG4gIHJlcD86IHN0cmluZztcbiAgcDogbnVtYmVyO1xufVxuXG52YXIgSlNfT1BTOiB7IFtvcDogc3RyaW5nXTogT3BQcmlvcml0eTsgfSA9IHtcbiAgJ3ZhbHVlJzogeyByZXA6IFwiXCIsIHA6IDE4IH0sXG5cbiAgJ25lZyc6IHsgcmVwOiBcIi1cIiwgcDogMTV9LFxuICAnISc6IHsgcDogMTV9LFxuICAnKic6IHsgcDogMTR9LFxuICAnLyc6IHsgcDogMTR9LFxuICAnJSc6IHsgcDogMTR9LFxuICAnKyc6IHsgcDogMTMgfSxcbiAgJy0nOiB7IHA6IDEzIH0sXG4gICc8JzogeyBwOiAxMSB9LFxuICAnPD0nOiB7IHA6IDExIH0sXG4gICc+JzogeyBwOiAxMSB9LFxuICAnPj0nOiB7IHA6IDExIH0sXG4gICdpbic6IHsgcDogMTEgfSxcbiAgJz09JzogeyBwOiAxMCB9LFxuICBcIiE9XCI6IHsgcDogMTAgfSxcbiAgJyYmJzogeyBwOiA2IH0sXG4gICd8fCc6IHsgcDogNSB9LFxuICAnPzonOiB7IHA6IDQgfSxcbiAgJywnOiB7IHA6IDB9LFxufTtcblxuLy8gRnJvbSBhbiBBU1QsIGRlY29kZSBhcyBhbiBleHByZXNzaW9uIChzdHJpbmcpLlxuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZUV4cHJlc3Npb24oZXhwOiBFeHAsIG91dGVyUHJlY2VkZW5jZT86IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChvdXRlclByZWNlZGVuY2UgPT09IHVuZGVmaW5lZCkge1xuICAgIG91dGVyUHJlY2VkZW5jZSA9IDA7XG4gIH1cbiAgdmFyIGlubmVyUHJlY2VkZW5jZSA9IHByZWNlZGVuY2VPZihleHApO1xuICB2YXIgcmVzdWx0ID0gJyc7XG5cbiAgc3dpdGNoIChleHAudHlwZSkge1xuICBjYXNlICdCb29sZWFuJzpcbiAgY2FzZSAnTnVtYmVyJzpcbiAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeSgoPEV4cFZhbHVlPiBleHApLnZhbHVlKTtcbiAgICBicmVhaztcblxuICBjYXNlICdTdHJpbmcnOlxuICAgIHJlc3VsdCA9IHV0aWwucXVvdGVTdHJpbmcoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XG4gICAgYnJlYWs7XG5cbiAgLy8gUmVnRXhwIGFzc3VtZWQgdG8gYmUgaW4gcHJlLXF1b3RlZCBmb3JtYXQuXG4gIGNhc2UgJ1JlZ0V4cCc6XG4gICAgbGV0IHJlZ2V4cCA9IDxSZWdFeHBWYWx1ZT4gZXhwO1xuICAgIHJlc3VsdCA9ICcvJyArIHJlZ2V4cC52YWx1ZSArICcvJztcbiAgICBpZiAocmVnZXhwLm1vZGlmaWVycyAhPT0gJycpIHtcbiAgICAgIHJlc3VsdCArPSByZWdleHAubW9kaWZpZXJzO1xuICAgIH1cbiAgICBicmVhaztcblxuICBjYXNlICdBcnJheSc6XG4gICAgcmVzdWx0ID0gJ1snICsgZGVjb2RlQXJyYXkoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSkgKyAnXSc7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnTnVsbCc6XG4gICAgcmVzdWx0ID0gJ251bGwnO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ3Zhcic6XG4gIGNhc2UgJ2xpdGVyYWwnOlxuICAgIHJlc3VsdCA9ICg8RXhwVmFyaWFibGU+IGV4cCkubmFtZTtcbiAgICBicmVhaztcblxuICBjYXNlICdyZWYnOlxuICAgIGxldCBleHBSZWYgPSA8RXhwUmVmZXJlbmNlPiBleHA7XG4gICAgaWYgKGlzSWRlbnRpZmllclN0cmluZ0V4cChleHBSZWYuYWNjZXNzb3IpKSB7XG4gICAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cFJlZi5iYXNlLCBpbm5lclByZWNlZGVuY2UpICsgJy4nICsgKDxFeHBWYWx1ZT4gZXhwUmVmLmFjY2Vzc29yKS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHBSZWYuYmFzZSwgaW5uZXJQcmVjZWRlbmNlKSArXG4gICAgICAgICdbJyArIGRlY29kZUV4cHJlc3Npb24oZXhwUmVmLmFjY2Vzc29yKSArICddJztcbiAgICB9XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnY2FsbCc6XG4gICAgbGV0IGV4cENhbGwgPSA8RXhwQ2FsbD4gZXhwO1xuICAgIHJlc3VsdCA9IGRlY29kZUV4cHJlc3Npb24oZXhwQ2FsbC5yZWYpICsgJygnICsgZGVjb2RlQXJyYXkoZXhwQ2FsbC5hcmdzKSArICcpJztcbiAgICBicmVhaztcblxuICBjYXNlICdidWlsdGluJzpcbiAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cCk7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnb3AnOlxuICAgIGxldCBleHBPcCA9IDxFeHBPcD4gZXhwO1xuICAgIHZhciByZXAgPSBKU19PUFNbZXhwT3Aub3BdLnJlcCA9PT0gdW5kZWZpbmVkID8gZXhwT3Aub3AgOiBKU19PUFNbZXhwT3Aub3BdLnJlcDtcbiAgICBpZiAoZXhwT3AuYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgIHJlc3VsdCA9IHJlcCArIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSwgaW5uZXJQcmVjZWRlbmNlKTtcbiAgICB9IGVsc2UgaWYgKGV4cE9wLmFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICByZXN1bHQgPVxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMF0sIGlubmVyUHJlY2VkZW5jZSkgK1xuICAgICAgICAnICcgKyByZXAgKyAnICcgK1xuICAgICAgICAvLyBBbGwgb3BzIGFyZSBsZWZ0IGFzc29jaWF0aXZlIC0gc28gbnVkZ2UgdGhlIGlubmVyUHJlY2VuZGVuY2VcbiAgICAgICAgLy8gZG93biBvbiB0aGUgcmlnaHQgaGFuZCBzaWRlIHRvIGZvcmNlICgpIGZvciByaWdodC1hc3NvY2lhdGluZ1xuICAgICAgICAvLyBvcGVyYXRpb25zLlxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0sIGlubmVyUHJlY2VkZW5jZSArIDEpO1xuICAgIH0gZWxzZSBpZiAoZXhwT3AuYXJncy5sZW5ndGggPT09IDMpIHtcbiAgICAgIHJlc3VsdCA9XG4gICAgICAgIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSwgaW5uZXJQcmVjZWRlbmNlKSArICcgPyAnICtcbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzFdLCBpbm5lclByZWNlZGVuY2UpICsgJyA6ICcgK1xuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMl0sIGlubmVyUHJlY2VkZW5jZSk7XG4gICAgfVxuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ3R5cGUnOlxuICAgIHJlc3VsdCA9ICg8RXhwU2ltcGxlVHlwZT4gZXhwKS5uYW1lO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ3VuaW9uJzpcbiAgICByZXN1bHQgPSAoPEV4cFVuaW9uVHlwZT4gZXhwKS50eXBlcy5tYXAoZGVjb2RlRXhwcmVzc2lvbikuam9pbignIHwgJyk7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnZ2VuZXJpYyc6XG4gICAgbGV0IGdlbmVyaWNUeXBlID0gPEV4cEdlbmVyaWNUeXBlPiBleHA7XG4gICAgcmV0dXJuIGdlbmVyaWNUeXBlLm5hbWUgKyAnPCcgKyBkZWNvZGVBcnJheShnZW5lcmljVHlwZS5wYXJhbXMpICsgJz4nO1xuXG4gIGRlZmF1bHQ6XG4gICAgcmVzdWx0ID0gXCIqKipVTktOT1dOIFRZUEUqKiogKFwiICsgZXhwLnR5cGUgKyBcIilcIjtcbiAgICBicmVhaztcbiAgfVxuXG4gIGlmIChpbm5lclByZWNlZGVuY2UgPCBvdXRlclByZWNlZGVuY2UpIHtcbiAgICByZXN1bHQgPSAnKCcgKyByZXN1bHQgKyAnKSc7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBkZWNvZGVBcnJheShhcmdzOiBFeHBbXSk6IHN0cmluZyB7XG4gIHJldHVybiBhcmdzLm1hcChkZWNvZGVFeHByZXNzaW9uKS5qb2luKCcsICcpO1xufVxuXG5mdW5jdGlvbiBwcmVjZWRlbmNlT2YoZXhwOiBFeHApOiBudW1iZXIge1xuICBsZXQgcmVzdWx0OiBudW1iZXI7XG5cbiAgc3dpdGNoIChleHAudHlwZSkge1xuICBjYXNlICdvcCc6XG4gICAgcmVzdWx0ID0gSlNfT1BTWyg8RXhwT3A+IGV4cCkub3BdLnA7XG4gICAgYnJlYWs7XG5cbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvT3BlcmF0b3JzL09wZXJhdG9yX1ByZWNlZGVuY2VcbiAgLy8gbGlzdHMgY2FsbCBhcyAxNyBhbmQgcmVmIGFzIDE4IC0gYnV0IGhvdyBjb3VsZCB0aGV5IGJlIGFueXRoaW5nIG90aGVyIHRoYW4gbGVmdCB0byByaWdodD9cbiAgLy8gaHR0cDovL3d3dy5zY3JpcHRpbmdtYXN0ZXIuY29tL2phdmFzY3JpcHQvb3BlcmF0b3ItcHJlY2VkZW5jZS5hc3AgLSBhZ3JlZXMuXG4gIGNhc2UgJ2NhbGwnOlxuICAgIHJlc3VsdCA9IDE4O1xuICAgIGJyZWFrO1xuICBjYXNlICdyZWYnOlxuICAgIHJlc3VsdCA9IDE4O1xuICAgIGJyZWFrO1xuICBkZWZhdWx0OlxuICAgIHJlc3VsdCA9IDE5O1xuICAgIGJyZWFrO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG4vLyBUT0RPKGtvc3MpOiBBZnRlciBub2RlIDAuMTAgbGVhdmVzIExUUyAtIHJlbW92ZSBwb2x5ZmlsbGVkIFByb21pc2UgbGlicmFyeS5cbmlmICh0eXBlb2YgUHJvbWlzZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgcmVxdWlyZSgnZXM2LXByb21pc2UnKS5wb2x5ZmlsbCgpO1xufVxuXG5sZXQgcGFyc2VyID0gcmVxdWlyZSgnLi9ydWxlcy1wYXJzZXInKTtcbmltcG9ydCAqIGFzIGdlbmVyYXRvciBmcm9tICcuL3J1bGVzLWdlbmVyYXRvcic7XG5pbXBvcnQgKiBhcyBhc3RJbXBvcnQgZnJvbSAnLi9hc3QnO1xuXG5leHBvcnQgbGV0IEZJTEVfRVhURU5TSU9OID0gJ2JvbHQnO1xuXG5leHBvcnQgbGV0IGFzdCA9IGFzdEltcG9ydDtcbmV4cG9ydCBsZXQgcGFyc2UgPSBwYXJzZXIucGFyc2U7XG5leHBvcnQgbGV0IEdlbmVyYXRvciA9IGdlbmVyYXRvci5HZW5lcmF0b3I7XG5leHBvcnQgbGV0IGRlY29kZUV4cHJlc3Npb24gPSBhc3QuZGVjb2RlRXhwcmVzc2lvbjtcbmV4cG9ydCBsZXQgZ2VuZXJhdGUgPSBnZW5lcmF0b3IuZ2VuZXJhdGU7XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbmxldCBsYXN0RXJyb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcbmxldCBsYXN0TWVzc2FnZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xubGV0IGVycm9yQ291bnQ6IG51bWJlcjtcbmxldCBzaWxlbmNlT3V0cHV0OiBib29sZWFuO1xuXG5sZXQgREVCVUcgPSBmYWxzZTtcblxubGV0IGdldENvbnRleHQgPSAoKSA9PiAoPEVycm9yQ29udGV4dD4ge30pO1xuXG5yZXNldCgpO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVzZXQoKSB7XG4gIGxhc3RFcnJvciA9IHVuZGVmaW5lZDtcbiAgbGFzdE1lc3NhZ2UgPSB1bmRlZmluZWQ7XG4gIGVycm9yQ291bnQgPSAwO1xuICBzaWxlbmNlT3V0cHV0ID0gZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXREZWJ1ZyhkZWJ1ZyA9IHRydWUpIHtcbiAgREVCVUcgPSBkZWJ1Zztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpbGVudChmID0gdHJ1ZSkge1xuICBzaWxlbmNlT3V0cHV0ID0gZjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFcnJvckNvbnRleHQge1xuICBsaW5lPzogbnVtYmVyO1xuICBjb2x1bW4/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb250ZXh0KGZuOiAoKSA9PiBFcnJvckNvbnRleHQpIHtcbiAgZ2V0Q29udGV4dCA9IGZuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXJyb3Ioczogc3RyaW5nKSB7XG4gIGxldCBlcnIgPSBlcnJvclN0cmluZyhzKTtcbiAgLy8gRGUtZHVwIGlkZW50aWNhbCBtZXNzYWdlc1xuICBpZiAoZXJyICA9PT0gbGFzdE1lc3NhZ2UpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgbGFzdE1lc3NhZ2UgPSBlcnI7XG4gIGxhc3RFcnJvciA9IGxhc3RNZXNzYWdlO1xuICBpZiAoIXNpbGVuY2VPdXRwdXQpIHtcbiAgICBjb25zb2xlLmVycm9yKGxhc3RFcnJvcik7XG4gICAgaWYgKERFQlVHKSB7XG4gICAgICBsZXQgZSA9IG5ldyBFcnJvcihcIlN0YWNrIHRyYWNlXCIpO1xuICAgICAgY29uc29sZS5lcnJvcihlLnN0YWNrKTtcbiAgICB9XG4gIH1cbiAgZXJyb3JDb3VudCArPSAxO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gd2FybihzOiBzdHJpbmcpIHtcbiAgbGV0IGVyciA9IGVycm9yU3RyaW5nKHMpO1xuICAvLyBEZS1kdXAgaWRlbnRpY2FsIG1lc3NhZ2VzXG4gIGlmIChlcnIgPT09IGxhc3RNZXNzYWdlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxhc3RNZXNzYWdlID0gZXJyO1xuICBpZiAoIXNpbGVuY2VPdXRwdXQpIHtcbiAgICBjb25zb2xlLndhcm4obGFzdE1lc3NhZ2UpO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYXN0TWVzc2FnZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gbGFzdE1lc3NhZ2U7XG59XG5cbmZ1bmN0aW9uIGVycm9yU3RyaW5nKHM6IHN0cmluZykge1xuICBsZXQgY3R4ID0gZ2V0Q29udGV4dCgpO1xuICBpZiAoY3R4LmxpbmUgIT09IHVuZGVmaW5lZCAmJiBjdHguY29sdW1uICE9PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gJ2JvbHQ6JyArIGN0eC5saW5lICsgJzonICsgY3R4LmNvbHVtbiArICc6ICcgKyBzO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiAnYm9sdDogJyArIHM7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0Vycm9ycygpOiBib29sZWFuIHtcbiAgcmV0dXJuIGVycm9yQ291bnQgPiAwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXJyb3JTdW1tYXJ5KCk6IHN0cmluZyB7XG4gIGlmIChlcnJvckNvdW50ID09PSAxKSB7XG4gICAgcmV0dXJuIDxzdHJpbmc+IGxhc3RFcnJvcjtcbiAgfVxuXG4gIGlmIChlcnJvckNvdW50ICE9PSAwKSB7XG4gICAgcmV0dXJuIFwiRmF0YWwgZXJyb3JzOiBcIiArIGVycm9yQ291bnQ7XG4gIH1cbiAgcmV0dXJuIFwiXCI7XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbmxldCBwYXJzZXIgPSByZXF1aXJlKCcuL3J1bGVzLXBhcnNlcicpO1xuaW1wb3J0ICogYXMgYXN0IGZyb20gJy4vYXN0JztcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXhwcmVzc2lvbihleHByZXNzaW9uOiBzdHJpbmcpOiBhc3QuRXhwIHtcbiAgdmFyIHJlc3VsdCA9IHBhcnNlci5wYXJzZSgnZnVuY3Rpb24gZigpIHtyZXR1cm4gJyArIGV4cHJlc3Npb24gKyAnO30nKTtcbiAgcmV0dXJuIHJlc3VsdC5mdW5jdGlvbnMuZi5ib2R5O1xufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgKiBhcyBhc3QgZnJvbSAnLi9hc3QnO1xuaW1wb3J0IHt3YXJuLCBlcnJvcn0gZnJvbSAnLi9sb2dnZXInO1xubGV0IHBhcnNlciA9IHJlcXVpcmUoJy4vcnVsZXMtcGFyc2VyJyk7XG5pbXBvcnQge3BhcnNlRXhwcmVzc2lvbn0gZnJvbSAnLi9wYXJzZS11dGlsJztcblxudmFyIGVycm9ycyA9IHtcbiAgYmFkSW5kZXg6IFwiVGhlIGluZGV4IGZ1bmN0aW9uIG11c3QgcmV0dXJuIGEgU3RyaW5nIG9yIGFuIGFycmF5IG9mIFN0cmluZ3MuXCIsXG4gIG5vUGF0aHM6IFwiTXVzdCBoYXZlIGF0IGxlYXN0IG9uZSBwYXRoIGV4cHJlc3Npb24uXCIsXG4gIG5vbk9iamVjdDogXCJUeXBlIGNvbnRhaW5zIHByb3BlcnRpZXMgYW5kIG11c3QgZXh0ZW5kICdPYmplY3QnLlwiLFxuICBtaXNzaW5nU2NoZW1hOiBcIk1pc3NpbmcgZGVmaW5pdGlvbiBmb3IgdHlwZS5cIixcbiAgcmVjdXJzaXZlOiBcIlJlY3Vyc2l2ZSBmdW5jdGlvbiBjYWxsLlwiLFxuICBtaXNtYXRjaFBhcmFtczogXCJJbmNvcnJlY3QgbnVtYmVyIG9mIGZ1bmN0aW9uIGFyZ3VtZW50cy5cIixcbiAgZ2VuZXJhdGVGYWlsZWQ6IFwiQ291bGQgbm90IGdlbmVyYXRlIEpTT046IFwiLFxuICBub1N1Y2hUeXBlOiBcIk5vIHR5cGUgZGVmaW5pdGlvbiBmb3I6IFwiLFxuICBiYWRTY2hlbWFNZXRob2Q6IFwiVW5zdXBwb3J0ZWQgbWV0aG9kIG5hbWUgaW4gdHlwZSBzdGF0ZW1lbnQ6IFwiLFxuICBiYWRQYXRoTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHBhdGggc3RhdGVtZW50OiBcIixcbiAgYmFkV3JpdGVBbGlhczogXCJDYW5ub3QgaGF2ZSBib3RoIGEgd3JpdGUoKSBtZXRob2QgYW5kIGEgd3JpdGUtYWxpYXNpbmcgbWV0aG9kOiBcIixcbiAgY29lcmNpb246IFwiQ2Fubm90IGNvbnZlcnQgdmFsdWU6IFwiLFxuICB1bmRlZmluZWRGdW5jdGlvbjogXCJVbmRlZmluZWQgZnVuY3Rpb246IFwiLFxuICBhcHBsaWNhdGlvbjogXCJCb2x0IGFwcGxpY2F0aW9uIGVycm9yOiBcIixcbiAgaW52YWxpZEdlbmVyaWM6IFwiSW52YWxpZCBnZW5lcmljIHNjaGVtYSB1c2FnZTogXCIsXG4gIGludmFsaWRNYXBLZXk6IFwiTWFwPEtleSwgVD4gLSBLZXkgbXVzdCBkZXJpdmUgZnJvbSBTdHJpbmcgdHlwZS5cIixcbiAgaW52YWxpZFdpbGRDaGlsZHJlbjogXCJUeXBlcyBjYW4gaGF2ZSBhdCBtb3N0IG9uZSAkd2lsZCBwcm9wZXJ0eSBhbmQgY2Fubm90IG1peCB3aXRoIG90aGVyIHByb3BlcnRpZXMuXCIsXG4gIGludmFsaWRQcm9wZXJ0eU5hbWU6IFwiUHJvcGVydHkgbmFtZXMgY2Fubm90IGNvbnRhaW4gYW55IG9mOiAuICQgIyBbIF0gLyBvciBjb250cm9sIGNoYXJhY3RlcnM6IFwiLFxufTtcblxubGV0IElOVkFMSURfS0VZX1JFR0VYID0gL1tcXFtcXF0uIyRcXC9cXHUwMDAwLVxcdTAwMUZcXHUwMDdGXS87XG5cbi8qXG4gICBBIFZhbGlkYXRvciBpcyBhIEpTT04gaGVyaWFyY2hpY2FsIHN0cnVjdHVyZS4gVGhlIFwibGVhdmVzXCIgYXJlIFwiZG90LXByb3BlcnRpZXNcIlxuICAgKHNlZSBiZWxvdykuIFRoZSBpbnRlcm1lZGlhdGUgbm9kZXMgaW4gdGhlIHRyZWUgYXJlIFwicHJvcFwiIG9yIFwiJHByb3BcIlxuICAgcHJvcGVydGllcy5cblxuICAgQSBWYWxpZGF0b3IgaXMgbXV0YXRlZCB0byBoYXZlIGRpZmZlcmVudCBmb3JtcyBiYXNlZCBvbiB0aGUgdGhlIHBoYXNlIG9mXG4gICBnZW5lcmF0aW9uLlxuXG4gICBJbiB0aGUgZmlyc3QgcGhhc2UsIHRoZXkgYXJlIEV4cFtdLiBMYXRlciB0aGUgRXhwW10gYXJlIEFORGVkIHRvZ2V0aGVyIGFuZFxuICAgY29tYmluZWQgaW50byBleHByZXNzaW9uIHRleHQgKGFuZCByZXR1cm5lZCBhcyB0aGUgZmluYWwgSlNPTi1ydWxlcyB0aGF0XG4gICBGaXJlYmFzZSB1c2VzLlxuXG4gICBOb3RlOiBUUyBkb2VzIG5vdCBhbGxvdyBmb3Igc3BlY2lhbCBwcm9wZXJ0aWVzIHRvIGhhdmUgZGlzdGluY3RcbiAgIHR5cGVzIGZyb20gdGhlICdpbmRleCcgcHJvcGVydHkgZ2l2ZW4gZm9yIHRoZSBpbnRlcmZhY2UuICA6LShcblxuICAgJy5yZWFkJzogYXN0LkV4cFtdIHwgc3RyaW5nO1xuICAgJy53cml0ZSc6IGFzdC5FeHBbXSB8IHN0cmluZztcbiAgICcudmFsaWRhdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XG4gICAnLmluZGV4T24nOiBzdHJpbmdbXTtcbiAgICcuc2NvcGUnOiB7IFt2YXJpYWJsZTogc3RyaW5nXTogc3RyaW5nIH1cbiovXG5leHBvcnQgdHlwZSBWYWxpZGF0b3JWYWx1ZSA9IGFzdC5FeHAgfCBhc3QuRXhwW10gfCBzdHJpbmcgfCBzdHJpbmdbXSB8IFZhbGlkYXRvcjtcbmV4cG9ydCBpbnRlcmZhY2UgVmFsaWRhdG9yIHtcbiAgW25hbWU6IHN0cmluZ106IFZhbGlkYXRvclZhbHVlO1xufTtcblxudmFyIGJ1aWx0aW5TY2hlbWFOYW1lcyA9IFsnQW55JywgJ051bGwnLCAnU3RyaW5nJywgJ051bWJlcicsICdCb29sZWFuJywgJ09iamVjdCddO1xuLy8gTWV0aG9kIG5hbWVzIGFsbG93ZWQgaW4gQm9sdCBmaWxlcy5cbnZhciB2YWx1ZU1ldGhvZHMgPSBbJ2xlbmd0aCcsICdpbmNsdWRlcycsICdzdGFydHNXaXRoJywgJ2JlZ2luc1dpdGgnLCAnZW5kc1dpdGgnLFxuICAgICAgICAgICAgICAgICAgICAncmVwbGFjZScsICd0b0xvd2VyQ2FzZScsICd0b1VwcGVyQ2FzZScsICd0ZXN0JywgJ2NvbnRhaW5zJyxcbiAgICAgICAgICAgICAgICAgICAgJ21hdGNoZXMnXTtcbi8vIFRPRE86IE1ha2Ugc3VyZSB1c2VycyBkb24ndCBjYWxsIGludGVybmFsIG1ldGhvZHMuLi5tYWtlIHByaXZhdGUgdG8gaW1wbC5cbnZhciBzbmFwc2hvdE1ldGhvZHMgPSBbJ3BhcmVudCcsICdjaGlsZCcsICdoYXNDaGlsZHJlbicsICd2YWwnLCAnaXNTdHJpbmcnLCAnaXNOdW1iZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAnaXNCb29sZWFuJ10uY29uY2F0KHZhbHVlTWV0aG9kcyk7XG5cbnZhciB3cml0ZUFsaWFzZXMgPSA8eyBbbWV0aG9kOiBzdHJpbmddOiBhc3QuRXhwIH0+IHtcbiAgJ2NyZWF0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgPT0gbnVsbCcpLFxuICAndXBkYXRlJzogcGFyc2VFeHByZXNzaW9uKCdwcmlvcih0aGlzKSAhPSBudWxsICYmIHRoaXMgIT0gbnVsbCcpLFxuICAnZGVsZXRlJzogcGFyc2VFeHByZXNzaW9uKCdwcmlvcih0aGlzKSAhPSBudWxsICYmIHRoaXMgPT0gbnVsbCcpXG59O1xuXG4vLyBVc2FnZTpcbi8vICAganNvbiA9IGJvbHQuZ2VuZXJhdGUoYm9sdC10ZXh0KVxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyYXRlKHN5bWJvbHM6IHN0cmluZyB8IGFzdC5TeW1ib2xzKTogVmFsaWRhdG9yIHtcbiAgaWYgKHR5cGVvZiBzeW1ib2xzID09PSAnc3RyaW5nJykge1xuICAgIHN5bWJvbHMgPSBwYXJzZXIucGFyc2Uoc3ltYm9scyk7XG4gIH1cbiAgdmFyIGdlbiA9IG5ldyBHZW5lcmF0b3IoPGFzdC5TeW1ib2xzPiBzeW1ib2xzKTtcbiAgcmV0dXJuIGdlbi5nZW5lcmF0ZVJ1bGVzKCk7XG59XG5cbi8vIFN5bWJvbHMgY29udGFpbnM6XG4vLyAgIGZ1bmN0aW9uczoge31cbi8vICAgc2NoZW1hOiB7fVxuLy8gICBwYXRoczoge31cbmV4cG9ydCBjbGFzcyBHZW5lcmF0b3Ige1xuICBzeW1ib2xzOiBhc3QuU3ltYm9scztcbiAgdmFsaWRhdG9yczogeyBbc2NoZW1hTmFtZTogc3RyaW5nXTogVmFsaWRhdG9yOyB9O1xuICBydWxlczogVmFsaWRhdG9yO1xuICBlcnJvckNvdW50OiBudW1iZXI7XG4gIHJ1blNpbGVudGx5OiBib29sZWFuO1xuICBhbGxvd1VuZGVmaW5lZEZ1bmN0aW9uczogYm9vbGVhbjtcbiAgZ2xvYmFsczogYXN0LlBhcmFtcztcbiAgdGhpc0lzOiBzdHJpbmc7XG4gIGtleUluZGV4OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3Ioc3ltYm9sczogYXN0LlN5bWJvbHMpIHtcbiAgICB0aGlzLnN5bWJvbHMgPSBzeW1ib2xzO1xuICAgIHRoaXMudmFsaWRhdG9ycyA9IHt9O1xuICAgIHRoaXMucnVsZXMgPSB7fTtcbiAgICB0aGlzLmVycm9yQ291bnQgPSAwO1xuICAgIHRoaXMucnVuU2lsZW50bHkgPSBmYWxzZTtcbiAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gZmFsc2U7XG4gICAgdGhpcy5rZXlJbmRleCA9IDA7XG5cbiAgICAvLyBUT0RPOiBnbG9iYWxzIHNob3VsZCBiZSBwYXJ0IG9mIHRoaXMuc3ltYm9scyAobmVzdGVkIHNjb3BlcylcbiAgICB0aGlzLmdsb2JhbHMgPSB7XG4gICAgICBcInJvb3RcIjogYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAcm9vdCcpKSxcbiAgICB9O1xuXG4gICAgdGhpcy5yZWdpc3RlckJ1aWx0aW5TY2hlbWEoKTtcbiAgfVxuXG4gIC8vIFJldHVybiBGaXJlYmFzZSBjb21wYXRpYmxlIFJ1bGVzIEpTT04gZm9yIGEgdGhlIGdpdmVuIHN5bWJvbHMgZGVmaW5pdGlvbnMuXG4gIGdlbmVyYXRlUnVsZXMoKTogVmFsaWRhdG9yIHtcbiAgICB0aGlzLmVycm9yQ291bnQgPSAwO1xuICAgIHZhciBwYXRocyA9IHRoaXMuc3ltYm9scy5wYXRocztcbiAgICB2YXIgc2NoZW1hID0gdGhpcy5zeW1ib2xzLnNjaGVtYTtcbiAgICB2YXIgbmFtZTogc3RyaW5nO1xuXG4gICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xuICAgICAgdGhpcy52YWxpZGF0ZU1ldGhvZHMoZXJyb3JzLmJhZFBhdGhNZXRob2QsIHBhdGgubWV0aG9kcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFsndmFsaWRhdGUnLCAncmVhZCcsICd3cml0ZScsICdpbmRleCddKTtcbiAgICB9KTtcblxuICAgIGZvciAobmFtZSBpbiBzY2hlbWEpIHtcbiAgICAgIGlmICghdXRpbC5hcnJheUluY2x1ZGVzKGJ1aWx0aW5TY2hlbWFOYW1lcywgbmFtZSkpIHtcbiAgICAgICAgdGhpcy52YWxpZGF0ZU1ldGhvZHMoZXJyb3JzLmJhZFNjaGVtYU1ldGhvZCwgc2NoZW1hW25hbWVdLm1ldGhvZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsndmFsaWRhdGUnLCAncmVhZCcsICd3cml0ZSddKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocGF0aHMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLmZhdGFsKGVycm9ycy5ub1BhdGhzKTtcbiAgICB9XG5cbiAgICBwYXRocy5mb3JFYWNoKChwYXRoKSA9PiB0aGlzLnVwZGF0ZVJ1bGVzKHBhdGgpKTtcbiAgICB0aGlzLmNvbnZlcnRFeHByZXNzaW9ucyh0aGlzLnJ1bGVzKTtcblxuICAgIGlmICh0aGlzLmVycm9yQ291bnQgIT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuZ2VuZXJhdGVGYWlsZWQgKyB0aGlzLmVycm9yQ291bnQgKyBcIiBlcnJvcnMuXCIpO1xuICAgIH1cblxuICAgIHV0aWwuZGVsZXRlUHJvcE5hbWUodGhpcy5ydWxlcywgJy5zY29wZScpO1xuICAgIHV0aWwucHJ1bmVFbXB0eUNoaWxkcmVuKHRoaXMucnVsZXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHJ1bGVzOiB0aGlzLnJ1bGVzXG4gICAgfTtcbiAgfVxuXG4gIHZhbGlkYXRlTWV0aG9kcyhtOiBzdHJpbmcsIG1ldGhvZHM6IHsgW25hbWU6IHN0cmluZ106IGFzdC5NZXRob2QgfSwgYWxsb3dlZDogc3RyaW5nW10pIHtcbiAgICBpZiAodXRpbC5hcnJheUluY2x1ZGVzKGFsbG93ZWQsICd3cml0ZScpKSB7XG4gICAgICBhbGxvd2VkID0gYWxsb3dlZC5jb25jYXQoT2JqZWN0LmtleXMod3JpdGVBbGlhc2VzKSk7XG4gICAgfVxuICAgIGZvciAodmFyIG1ldGhvZCBpbiBtZXRob2RzKSB7XG4gICAgICBpZiAoIXV0aWwuYXJyYXlJbmNsdWRlcyhhbGxvd2VkLCBtZXRob2QpKSB7XG4gICAgICAgIHdhcm4obSArIHV0aWwucXVvdGVTdHJpbmcobWV0aG9kKSArXG4gICAgICAgICAgICAgXCIgKGFsbG93ZWQ6IFwiICsgYWxsb3dlZC5tYXAodXRpbC5xdW90ZVN0cmluZykuam9pbignLCAnKSArIFwiKVwiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCd3cml0ZScgaW4gbWV0aG9kcykge1xuICAgICAgT2JqZWN0LmtleXMod3JpdGVBbGlhc2VzKS5mb3JFYWNoKChhbGlhcykgPT4ge1xuICAgICAgICBpZiAoYWxpYXMgaW4gbWV0aG9kcykge1xuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZFdyaXRlQWxpYXMgKyBhbGlhcyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlZ2lzdGVyQnVpbHRpblNjaGVtYSgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIHRoaXNWYXIgPSBhc3QudmFyaWFibGUoJ3RoaXMnKTtcblxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyQXNDYWxsKG5hbWU6IHN0cmluZywgbWV0aG9kTmFtZTogc3RyaW5nKTogdm9pZCB7XG4gICAgICBzZWxmLnN5bWJvbHMucmVnaXN0ZXJTY2hlbWEobmFtZSwgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XG4gICAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC5jYXN0KHRoaXNWYXIsICdBbnknKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LnN0cmluZyhtZXRob2ROYW1lKSkpKVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKCdBbnknLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHtcbiAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuYm9vbGVhbih0cnVlKSlcbiAgICB9KTtcblxuICAgIHJlZ2lzdGVyQXNDYWxsKCdPYmplY3QnLCAnaGFzQ2hpbGRyZW4nKTtcblxuICAgIC8vIEJlY2F1c2Ugb2YgdGhlIHdheSBmaXJlYmFzZSB0cmVhdHMgTnVsbCB2YWx1ZXMsIHRoZXJlIGlzIG5vIHdheSB0b1xuICAgIC8vIHdyaXRlIGEgdmFsaWRhdGlvbiBydWxlLCB0aGF0IHdpbGwgRVZFUiBiZSBjYWxsZWQgd2l0aCB0aGlzID09IG51bGxcbiAgICAvLyAoZmlyZWJhc2UgYWxsb3dzIHZhbHVlcyB0byBiZSBkZWxldGVkIG5vIG1hdHRlciB0aGVpciB2YWxpZGF0aW9uIHJ1bGVzKS5cbiAgICAvLyBTbywgY29tcGFyaW5nIHRoaXMgPT0gbnVsbCB3aWxsIGFsd2F5cyByZXR1cm4gZmFsc2UgLT4gdGhhdCBpcyB3aGF0XG4gICAgLy8gd2UgZG8gaGVyZSwgd2hpY2ggd2lsbCBiZSBvcHRpbWl6ZWQgYXdheSBpZiBPUmVkIHdpdGggb3RoZXIgdmFsaWRhdGlvbnMuXG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKCdOdWxsJywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XG4gICAgICB2YWxpZGF0ZTogYXN0Lm1ldGhvZChbJ3RoaXMnXSwgYXN0LmJvb2xlYW4oZmFsc2UpKVxuICAgIH0pO1xuXG4gICAgc2VsZi5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKCdTdHJpbmcnLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHtcbiAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdCh0aGlzVmFyLCAnQW55JyksIGFzdC5zdHJpbmcoJ2lzU3RyaW5nJykpKSksXG4gICAgICBpbmNsdWRlczogYXN0Lm1ldGhvZChbJ3RoaXMnLCAncyddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2NvbnRhaW5zJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpIF0pKSxcbiAgICAgIHN0YXJ0c1dpdGg6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2JlZ2luc1dpdGgnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncycpKSBdKSksXG4gICAgICBlbmRzV2l0aDogYXN0Lm1ldGhvZChbJ3RoaXMnLCAncyddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ2VuZHNXaXRoJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpIF0pKSxcbiAgICAgIHJlcGxhY2U6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnLCAnciddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC52YWx1ZSh0aGlzVmFyKSwgYXN0LnN0cmluZygncmVwbGFjZScpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpLCBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdyJykpIF0pKSxcbiAgICAgIHRlc3Q6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3InXSxcbiAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ21hdGNoZXMnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAUmVnRXhwJyksIFthc3QudmFyaWFibGUoJ3InKV0pIF0pKSxcbiAgICB9KTtcblxuICAgIHJlZ2lzdGVyQXNDYWxsKCdOdW1iZXInLCAnaXNOdW1iZXInKTtcbiAgICByZWdpc3RlckFzQ2FsbCgnQm9vbGVhbicsICdpc0Jvb2xlYW4nKTtcblxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdAUmVnRXhwJywgWydyJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5lbnN1cmVUeXBlLmJpbmQodGhpcywgJ1JlZ0V4cCcpKSk7XG5cbiAgICBsZXQgbWFwID0gdGhpcy5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKCdNYXAnLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsnS2V5JywgJ1ZhbHVlJ10pO1xuICAgIG1hcC5nZXRWYWxpZGF0b3IgPSB0aGlzLmdldE1hcFZhbGlkYXRvci5iaW5kKHRoaXMpO1xuICB9XG5cbiAgLy8gdHlwZSBNYXA8S2V5LCBWYWx1ZT4gPT4ge1xuICAvLyAgICRrZXk6IHtcbiAgLy8gICAgICcudmFsaWRhdGUnOiAka2V5IGluc3RhbmNlb2YgS2V5IGFuZCB0aGlzIGluc3RhbmNlb2YgVmFsdWU7XG4gIC8vICAgJy52YWxpZGF0ZSc6ICduZXdEYXRhLmhhc0NoaWxkcmVuKCknXG4gIC8vIH1cbiAgLy8gS2V5IG11c3QgZGVyaXZlIGZyb20gU3RyaW5nXG4gIGdldE1hcFZhbGlkYXRvcihwYXJhbXM6IGFzdC5FeHBbXSk6IFZhbGlkYXRvciB7XG4gICAgbGV0IGtleVR5cGUgPSA8YXN0LkV4cFNpbXBsZVR5cGU+IHBhcmFtc1swXTtcbiAgICBsZXQgdmFsdWVUeXBlID0gPGFzdC5FeHBUeXBlPiBwYXJhbXNbMV07XG4gICAgaWYgKGtleVR5cGUudHlwZSAhPT0gJ3R5cGUnIHx8ICF0aGlzLnN5bWJvbHMuaXNEZXJpdmVkRnJvbShrZXlUeXBlLCAnU3RyaW5nJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuaW52YWxpZE1hcEtleSArIFwiICAoXCIgKyBhc3QuZGVjb2RlRXhwcmVzc2lvbihrZXlUeXBlKSArIFwiIGRvZXMgbm90KVwiKTtcbiAgICB9XG5cbiAgICBsZXQgdmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XG4gICAgbGV0IGluZGV4ID0gdGhpcy51bmlxdWVLZXkoKTtcbiAgICB2YWxpZGF0b3JbaW5kZXhdID0gPFZhbGlkYXRvcj4ge307XG4gICAgZXh0ZW5kVmFsaWRhdG9yKHZhbGlkYXRvciwgdGhpcy5lbnN1cmVWYWxpZGF0b3IoYXN0LnR5cGVUeXBlKCdPYmplY3QnKSkpO1xuXG4gICAgLy8gRmlyc3QgdmFsaWRhdGUgdGhlIGtleSAob21pdCB0ZXJtaW5hbCBTdHJpbmcgdHlwZSB2YWxpZGF0aW9uKS5cbiAgICB3aGlsZSAoa2V5VHlwZS5uYW1lICE9PSAnU3RyaW5nJykge1xuICAgICAgbGV0IHNjaGVtYSA9IHRoaXMuc3ltYm9scy5zY2hlbWFba2V5VHlwZS5uYW1lXTtcbiAgICAgIGlmIChzY2hlbWEubWV0aG9kc1sndmFsaWRhdGUnXSkge1xuICAgICAgICBsZXQgZXhwID0gdGhpcy5wYXJ0aWFsRXZhbChzY2hlbWEubWV0aG9kc1sndmFsaWRhdGUnXS5ib2R5LCB7J3RoaXMnOiBhc3QubGl0ZXJhbChpbmRleCl9KTtcbiAgICAgICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZhbGlkYXRvcltpbmRleF0sIDxWYWxpZGF0b3I+IHsnLnZhbGlkYXRlJzogW2V4cF19KTtcbiAgICAgIH1cbiAgICAgIGtleVR5cGUgPSA8YXN0LkV4cFNpbXBsZVR5cGU+IHNjaGVtYS5kZXJpdmVkRnJvbTtcbiAgICB9XG5cbiAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdmFsaWRhdG9yW2luZGV4XSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IodmFsdWVUeXBlKSk7XG4gICAgcmV0dXJuIHZhbGlkYXRvcjtcbiAgfVxuXG4gIHVuaXF1ZUtleSgpOiBzdHJpbmcge1xuICAgIHRoaXMua2V5SW5kZXggKz0gMTtcbiAgICByZXR1cm4gJyRrZXknICsgdGhpcy5rZXlJbmRleDtcbiAgfVxuXG4gIC8vIENvbGxlY3Rpb24gc2NoZW1hIGhhcyBleGFjdGx5IG9uZSAkd2lsZGNoaWxkIHByb3BlcnR5XG4gIGlzQ29sbGVjdGlvblNjaGVtYShzY2hlbWE6IGFzdC5TY2hlbWEpOiBib29sZWFuIHtcbiAgICBsZXQgcHJvcHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucHJvcGVydGllcyk7XG4gICAgbGV0IHJlc3VsdCA9IHByb3BzLmxlbmd0aCA9PT0gMSAmJiBwcm9wc1swXVswXSA9PT0gJyQnO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBFbnN1cmUgd2UgaGF2ZSBhIGRlZmluaXRpb24gZm9yIGEgdmFsaWRhdG9yIGZvciB0aGUgZ2l2ZW4gc2NoZW1hLlxuICBlbnN1cmVWYWxpZGF0b3IodHlwZTogYXN0LkV4cFR5cGUpOiBWYWxpZGF0b3Ige1xuICAgIHZhciBrZXkgPSBhc3QuZGVjb2RlRXhwcmVzc2lvbih0eXBlKTtcbiAgICBpZiAoIXRoaXMudmFsaWRhdG9yc1trZXldKSB7XG4gICAgICB0aGlzLnZhbGlkYXRvcnNba2V5XSA9IHsnLnZhbGlkYXRlJzogYXN0LmxpdGVyYWwoJyoqKlRZUEUgUkVDVVJTSU9OKioqJykgfTtcblxuICAgICAgbGV0IGFsbG93U2F2ZSA9IHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnM7XG4gICAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gdHJ1ZTtcbiAgICAgIHRoaXMudmFsaWRhdG9yc1trZXldID0gdGhpcy5jcmVhdGVWYWxpZGF0b3IodHlwZSk7XG4gICAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gYWxsb3dTYXZlO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy52YWxpZGF0b3JzW2tleV07XG4gIH1cblxuICBjcmVhdGVWYWxpZGF0b3IodHlwZTogYXN0LkV4cFR5cGUpOiBWYWxpZGF0b3Ige1xuICAgIHN3aXRjaCAodHlwZS50eXBlKSB7XG4gICAgY2FzZSAndHlwZSc6XG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hTmFtZSgoPGFzdC5FeHBTaW1wbGVUeXBlPiB0eXBlKS5uYW1lKTtcblxuICAgIGNhc2UgJ3VuaW9uJzpcbiAgICAgIGxldCB1bmlvbiA9IDxWYWxpZGF0b3I+IHt9O1xuICAgICAgKDxhc3QuRXhwVW5pb25UeXBlPiB0eXBlKS50eXBlcy5mb3JFYWNoKCh0eXBlUGFydDogYXN0LkV4cFR5cGUpID0+IHtcbiAgICAgICAgLy8gTWFrZSBhIGNvcHlcbiAgICAgICAgdmFyIHNpbmdsZVR5cGUgPSBleHRlbmRWYWxpZGF0b3Ioe30sIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHR5cGVQYXJ0KSk7XG4gICAgICAgIG1hcFZhbGlkYXRvcihzaW5nbGVUeXBlLCBhc3QuYW5kQXJyYXkpO1xuICAgICAgICBleHRlbmRWYWxpZGF0b3IodW5pb24sIHNpbmdsZVR5cGUpO1xuICAgICAgfSk7XG4gICAgICBtYXBWYWxpZGF0b3IodW5pb24sIGFzdC5vckFycmF5KTtcbiAgICAgIHJldHVybiB1bmlvbjtcblxuICAgIGNhc2UgJ2dlbmVyaWMnOlxuICAgICAgbGV0IGdlbmVyaWNUeXBlID0gPGFzdC5FeHBHZW5lcmljVHlwZT4gdHlwZTtcbiAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVZhbGlkYXRvckZyb21HZW5lcmljKGdlbmVyaWNUeXBlLm5hbWUsIGdlbmVyaWNUeXBlLnBhcmFtcyk7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiaW52YWxpZCBpbnRlcm5hbCB0eXBlOiBcIiArIHR5cGUudHlwZSk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlVmFsaWRhdG9yRnJvbUdlbmVyaWMoc2NoZW1hTmFtZTogc3RyaW5nLCBwYXJhbXM6IGFzdC5FeHBUeXBlW10pOiBWYWxpZGF0b3Ige1xuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW3NjaGVtYU5hbWVdO1xuXG4gICAgaWYgKHNjaGVtYSA9PT0gdW5kZWZpbmVkIHx8ICFhc3QuU2NoZW1hLmlzR2VuZXJpYyhzY2hlbWEpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lICsgXCIgKGdlbmVyaWMpXCIpO1xuICAgIH1cblxuICAgIGxldCBzY2hlbWFQYXJhbXMgPSA8c3RyaW5nW10+IHNjaGVtYS5wYXJhbXM7XG5cbiAgICBpZiAocGFyYW1zLmxlbmd0aCAhPT0gc2NoZW1hUGFyYW1zLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5pbnZhbGlkR2VuZXJpYyArIFwiIGV4cGVjdGVkIDxcIiArIHNjaGVtYVBhcmFtcy5qb2luKCcsICcpICsgXCI+XCIpO1xuICAgIH1cblxuICAgIC8vIENhbGwgY3VzdG9tIHZhbGlkYXRvciwgaWYgZ2l2ZW4uXG4gICAgaWYgKHNjaGVtYS5nZXRWYWxpZGF0b3IpIHtcbiAgICAgIHJldHVybiBzY2hlbWEuZ2V0VmFsaWRhdG9yKHBhcmFtcyk7XG4gICAgfVxuXG4gICAgbGV0IGJpbmRpbmdzID0gPGFzdC5UeXBlUGFyYW1zPiB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgYmluZGluZ3Nbc2NoZW1hUGFyYW1zW2ldXSA9IHBhcmFtc1tpXTtcbiAgICB9XG5cbiAgICAvLyBFeHBhbmQgZ2VuZXJpY3MgYW5kIGdlbmVyYXRlIHZhbGlkYXRvciBmcm9tIHNjaGVtYS5cbiAgICBzY2hlbWEgPSB0aGlzLnJlcGxhY2VHZW5lcmljc0luU2NoZW1hKHNjaGVtYSwgYmluZGluZ3MpO1xuICAgIHJldHVybiB0aGlzLmNyZWF0ZVZhbGlkYXRvckZyb21TY2hlbWEoc2NoZW1hKTtcbiAgfVxuXG4gIHJlcGxhY2VHZW5lcmljc0luU2NoZW1hKHNjaGVtYTogYXN0LlNjaGVtYSwgYmluZGluZ3M6IGFzdC5UeXBlUGFyYW1zKTogYXN0LlNjaGVtYSB7XG4gICAgdmFyIGV4cGFuZGVkU2NoZW1hID0gPGFzdC5TY2hlbWE+IHtcbiAgICAgIGRlcml2ZWRGcm9tOiA8YXN0LkV4cFR5cGU+IHRoaXMucmVwbGFjZUdlbmVyaWNzSW5FeHAoc2NoZW1hLmRlcml2ZWRGcm9tLCBiaW5kaW5ncyksXG4gICAgICBwcm9wZXJ0aWVzOiB7IH0sXG4gICAgICBtZXRob2RzOiB7fSxcbiAgICB9O1xuICAgIGxldCBwcm9wcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKTtcbiAgICBwcm9wcy5mb3JFYWNoKChwcm9wKSA9PiB7XG4gICAgICBleHBhbmRlZFNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BdID1cbiAgICAgICAgPGFzdC5FeHBUeXBlPiB0aGlzLnJlcGxhY2VHZW5lcmljc0luRXhwKHNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BdLCBiaW5kaW5ncyk7XG4gICAgfSk7XG5cbiAgICBsZXQgbWV0aG9kcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5tZXRob2RzKTtcbiAgICBtZXRob2RzLmZvckVhY2goKG1ldGhvZE5hbWUpID0+IHtcbiAgICAgIGV4cGFuZGVkU2NoZW1hLm1ldGhvZHNbbWV0aG9kTmFtZV0gPSB0aGlzLnJlcGxhY2VHZW5lcmljc0luTWV0aG9kKHNjaGVtYS5tZXRob2RzW21ldGhvZE5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiaW5kaW5ncyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGV4cGFuZGVkU2NoZW1hO1xuICB9XG5cbiAgcmVwbGFjZUdlbmVyaWNzSW5FeHAoZXhwOiBhc3QuRXhwLCBiaW5kaW5nczogYXN0LlR5cGVQYXJhbXMpOiBhc3QuRXhwIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KGV4cHM6IGFzdC5FeHBbXSk6IGFzdC5FeHBbXSB7XG4gICAgICByZXR1cm4gZXhwcy5tYXAoZnVuY3Rpb24oZXhwUGFydCkge1xuICAgICAgICByZXR1cm4gc2VsZi5yZXBsYWNlR2VuZXJpY3NJbkV4cChleHBQYXJ0LCBiaW5kaW5ncyk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKGV4cC50eXBlKSB7XG4gICAgY2FzZSAnb3AnOlxuICAgIGNhc2UgJ2NhbGwnOlxuICAgICAgbGV0IG9wVHlwZSA9IDxhc3QuRXhwT3A+IGFzdC5jb3B5RXhwKGV4cCk7XG4gICAgICBvcFR5cGUuYXJncyA9IHJlcGxhY2VHZW5lcmljc0luQXJyYXkob3BUeXBlLmFyZ3MpO1xuICAgICAgcmV0dXJuIG9wVHlwZTtcblxuICAgIGNhc2UgJ3R5cGUnOlxuICAgICAgbGV0IHNpbXBsZVR5cGUgPSA8YXN0LkV4cFNpbXBsZVR5cGU+IGV4cDtcbiAgICAgIHJldHVybiBiaW5kaW5nc1tzaW1wbGVUeXBlLm5hbWVdIHx8IHNpbXBsZVR5cGU7XG5cbiAgICBjYXNlICd1bmlvbic6XG4gICAgICBsZXQgdW5pb25UeXBlID0gPGFzdC5FeHBVbmlvblR5cGU+IGV4cDtcbiAgICAgIHJldHVybiBhc3QudW5pb25UeXBlKDxhc3QuRXhwVHlwZVtdPiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KHVuaW9uVHlwZS50eXBlcykpO1xuXG4gICAgY2FzZSAnZ2VuZXJpYyc6XG4gICAgICBsZXQgZ2VuZXJpY1R5cGUgPSA8YXN0LkV4cEdlbmVyaWNUeXBlPiBleHA7XG4gICAgICByZXR1cm4gYXN0LmdlbmVyaWNUeXBlKGdlbmVyaWNUeXBlLm5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhc3QuRXhwVHlwZVtdPiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KGdlbmVyaWNUeXBlLnBhcmFtcykpO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBleHA7XG4gICAgfVxuICB9XG5cbiAgcmVwbGFjZUdlbmVyaWNzSW5NZXRob2QobWV0aG9kOiBhc3QuTWV0aG9kLCBiaW5kaW5nczogYXN0LlR5cGVQYXJhbXMpOiBhc3QuTWV0aG9kIHtcbiAgICB2YXIgZXhwYW5kZWRNZXRob2QgPSA8YXN0Lk1ldGhvZD4ge1xuICAgICAgcGFyYW1zOiBtZXRob2QucGFyYW1zLFxuICAgICAgYm9keTogbWV0aG9kLmJvZHlcbiAgICB9O1xuXG4gICAgZXhwYW5kZWRNZXRob2QuYm9keSA9IHRoaXMucmVwbGFjZUdlbmVyaWNzSW5FeHAobWV0aG9kLmJvZHksIGJpbmRpbmdzKTtcbiAgICByZXR1cm4gZXhwYW5kZWRNZXRob2Q7XG4gIH1cblxuICBjcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hTmFtZShzY2hlbWFOYW1lOiBzdHJpbmcpOiBWYWxpZGF0b3Ige1xuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW3NjaGVtYU5hbWVdO1xuXG4gICAgaWYgKCFzY2hlbWEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubm9TdWNoVHlwZSArIHNjaGVtYU5hbWUpO1xuICAgIH1cblxuICAgIGlmIChhc3QuU2NoZW1hLmlzR2VuZXJpYyhzY2hlbWEpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lICsgXCIgdXNlZCBhcyBub24tZ2VuZXJpYyB0eXBlLlwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYSk7XG4gIH1cblxuICBjcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYTogYXN0LlNjaGVtYSk6IFZhbGlkYXRvciB7XG4gICAgdmFyIGhhc1Byb3BzID0gT2JqZWN0LmtleXMoc2NoZW1hLnByb3BlcnRpZXMpLmxlbmd0aCA+IDAgJiZcbiAgICAgICF0aGlzLmlzQ29sbGVjdGlvblNjaGVtYShzY2hlbWEpO1xuXG4gICAgaWYgKGhhc1Byb3BzICYmICF0aGlzLnN5bWJvbHMuaXNEZXJpdmVkRnJvbShzY2hlbWEuZGVyaXZlZEZyb20sICdPYmplY3QnKSkge1xuICAgICAgdGhpcy5mYXRhbChlcnJvcnMubm9uT2JqZWN0ICsgXCIgKGlzIFwiICsgYXN0LmRlY29kZUV4cHJlc3Npb24oc2NoZW1hLmRlcml2ZWRGcm9tKSArIFwiKVwiKTtcbiAgICAgIHJldHVybiB7fTtcbiAgICB9XG5cbiAgICBsZXQgdmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XG5cbiAgICBpZiAoIShzY2hlbWEuZGVyaXZlZEZyb20udHlwZSA9PT0gJ3R5cGUnICYmXG4gICAgICAgICAgKDxhc3QuRXhwU2ltcGxlVHlwZT4gc2NoZW1hLmRlcml2ZWRGcm9tKS5uYW1lID09PSAnQW55JykpIHtcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHNjaGVtYS5kZXJpdmVkRnJvbSkpO1xuICAgIH1cblxuICAgIGxldCByZXF1aXJlZFByb3BlcnRpZXMgPSA8c3RyaW5nW10+IFtdO1xuICAgIGxldCB3aWxkUHJvcGVydGllcyA9IDA7XG4gICAgT2JqZWN0LmtleXMoc2NoZW1hLnByb3BlcnRpZXMpLmZvckVhY2goKHByb3BOYW1lKSA9PiB7XG4gICAgICBpZiAocHJvcE5hbWVbMF0gPT09ICckJykge1xuICAgICAgICB3aWxkUHJvcGVydGllcyArPSAxO1xuICAgICAgICBpZiAoSU5WQUxJRF9LRVlfUkVHRVgudGVzdChwcm9wTmFtZS5zbGljZSgxKSkpIHtcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5pbnZhbGlkUHJvcGVydHlOYW1lICsgcHJvcE5hbWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoSU5WQUxJRF9LRVlfUkVHRVgudGVzdChwcm9wTmFtZSkpIHtcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5pbnZhbGlkUHJvcGVydHlOYW1lICsgcHJvcE5hbWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIXZhbGlkYXRvcltwcm9wTmFtZV0pIHtcbiAgICAgICAgdmFsaWRhdG9yW3Byb3BOYW1lXSA9IHt9O1xuICAgICAgfVxuICAgICAgdmFyIHByb3BUeXBlID0gc2NoZW1hLnByb3BlcnRpZXNbcHJvcE5hbWVdO1xuICAgICAgaWYgKHByb3BOYW1lWzBdICE9PSAnJCcgJiYgIXRoaXMuaXNOdWxsYWJsZVR5cGUocHJvcFR5cGUpKSB7XG4gICAgICAgIHJlcXVpcmVkUHJvcGVydGllcy5wdXNoKHByb3BOYW1lKTtcbiAgICAgIH1cbiAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbcHJvcE5hbWVdLCB0aGlzLmVuc3VyZVZhbGlkYXRvcihwcm9wVHlwZSkpO1xuICAgIH0pO1xuXG4gICAgaWYgKHdpbGRQcm9wZXJ0aWVzID4gMSB8fCB3aWxkUHJvcGVydGllcyA9PT0gMSAmJiByZXF1aXJlZFByb3BlcnRpZXMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5mYXRhbChlcnJvcnMuaW52YWxpZFdpbGRDaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYgKHJlcXVpcmVkUHJvcGVydGllcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyB0aGlzLmhhc0NoaWxkcmVuKHJlcXVpcmVkUHJvcGVydGllcylcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsXG4gICAgICAgICAgICAgICAgICAgICAgeycudmFsaWRhdGUnOiBbaGFzQ2hpbGRyZW5FeHAocmVxdWlyZWRQcm9wZXJ0aWVzKV19KTtcbiAgICB9XG5cbiAgICAvLyBEaXNhbGxvdyAkb3RoZXIgcHJvcGVydGllcyBieSBkZWZhdWx0XG4gICAgaWYgKGhhc1Byb3BzKSB7XG4gICAgICB2YWxpZGF0b3JbJyRvdGhlciddID0ge307XG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdmFsaWRhdG9yWyckb3RoZXInXSxcbiAgICAgICAgICAgICAgICAgICAgICA8VmFsaWRhdG9yPiB7Jy52YWxpZGF0ZSc6IGFzdC5ib29sZWFuKGZhbHNlKX0pO1xuICAgIH1cblxuICAgIHRoaXMuZXh0ZW5kVmFsaWRhdGlvbk1ldGhvZHModmFsaWRhdG9yLCBzY2hlbWEubWV0aG9kcyk7XG5cbiAgICByZXR1cm4gdmFsaWRhdG9yO1xuICB9XG5cbiAgaXNOdWxsYWJsZVR5cGUodHlwZTogYXN0LkV4cFR5cGUpOiBib29sZWFuIHtcbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5zeW1ib2xzLmlzRGVyaXZlZEZyb20odHlwZSwgJ051bGwnKSB8fFxuICAgICAgdGhpcy5zeW1ib2xzLmlzRGVyaXZlZEZyb20odHlwZSwgJ01hcCcpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBVcGRhdGUgcnVsZXMgYmFzZWQgb24gdGhlIGdpdmVuIHBhdGggZXhwcmVzc2lvbi5cbiAgdXBkYXRlUnVsZXMocGF0aDogYXN0LlBhdGgpIHtcbiAgICB2YXIgaTogbnVtYmVyO1xuICAgIHZhciBsb2NhdGlvbiA9IDxWYWxpZGF0b3I+IHV0aWwuZW5zdXJlT2JqZWN0UGF0aCh0aGlzLnJ1bGVzLCBwYXRoLnRlbXBsYXRlLmdldExhYmVscygpKTtcbiAgICB2YXIgZXhwOiBhc3QuRXhwVmFsdWU7XG5cbiAgICBleHRlbmRWYWxpZGF0b3IobG9jYXRpb24sIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHBhdGguaXNUeXBlKSk7XG4gICAgbG9jYXRpb25bJy5zY29wZSddID0gcGF0aC50ZW1wbGF0ZS5nZXRTY29wZSgpO1xuXG4gICAgdGhpcy5leHRlbmRWYWxpZGF0aW9uTWV0aG9kcyhsb2NhdGlvbiwgcGF0aC5tZXRob2RzKTtcblxuICAgIC8vIFdyaXRlIGluZGljZXNcbiAgICBpZiAocGF0aC5tZXRob2RzWydpbmRleCddKSB7XG4gICAgICBzd2l0Y2ggKHBhdGgubWV0aG9kc1snaW5kZXgnXS5ib2R5LnR5cGUpIHtcbiAgICAgIGNhc2UgJ1N0cmluZyc6XG4gICAgICAgIGV4cCA9IGFzdC5hcnJheShbcGF0aC5tZXRob2RzWydpbmRleCddLmJvZHldKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdBcnJheSc6XG4gICAgICAgIGV4cCA9IDxhc3QuRXhwVmFsdWU+IHBhdGgubWV0aG9kc1snaW5kZXgnXS5ib2R5O1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZEluZGV4KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIGluZGljZXMgPSA8c3RyaW5nW10+IFtdO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGV4cC52YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZXhwLnZhbHVlW2ldLnR5cGUgIT09ICdTdHJpbmcnKSB7XG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMuYmFkSW5kZXggKyBcIiAobm90IFwiICsgZXhwLnZhbHVlW2ldLnR5cGUgKyBcIilcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaW5kaWNlcy5wdXNoKGV4cC52YWx1ZVtpXS52YWx1ZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIFRPRE86IEVycm9yIGNoZWNrIG5vdCBvdmVyLXdyaXRpbmcgaW5kZXggcnVsZXMuXG4gICAgICBsb2NhdGlvblsnLmluZGV4T24nXSA9IGluZGljZXM7XG4gICAgfVxuICB9XG5cbiAgZXh0ZW5kVmFsaWRhdGlvbk1ldGhvZHModmFsaWRhdG9yOiBWYWxpZGF0b3IsIG1ldGhvZHM6IHsgW21ldGhvZDogc3RyaW5nXTogYXN0Lk1ldGhvZCB9KSB7XG4gICAgbGV0IHdyaXRlTWV0aG9kcyA9IDxhc3QuRXhwW10+IFtdO1xuICAgIFsnY3JlYXRlJywgJ3VwZGF0ZScsICdkZWxldGUnXS5mb3JFYWNoKChtZXRob2QpID0+IHtcbiAgICAgIGlmIChtZXRob2QgaW4gbWV0aG9kcykge1xuICAgICAgICB3cml0ZU1ldGhvZHMucHVzaChhc3QuYW5kQXJyYXkoW3dyaXRlQWxpYXNlc1ttZXRob2RdLCBtZXRob2RzW21ldGhvZF0uYm9keV0pKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAod3JpdGVNZXRob2RzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgZXh0ZW5kVmFsaWRhdG9yKHZhbGlkYXRvciwgPFZhbGlkYXRvcj4geyAnLndyaXRlJzogYXN0Lm9yQXJyYXkod3JpdGVNZXRob2RzKSB9KTtcbiAgICB9XG5cbiAgICBbJ3ZhbGlkYXRlJywgJ3JlYWQnLCAnd3JpdGUnXS5mb3JFYWNoKChtZXRob2QpID0+IHtcbiAgICAgIGlmIChtZXRob2QgaW4gbWV0aG9kcykge1xuICAgICAgICB2YXIgbWV0aG9kVmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XG4gICAgICAgIG1ldGhvZFZhbGlkYXRvclsnLicgKyBtZXRob2RdID0gbWV0aG9kc1ttZXRob2RdLmJvZHk7XG4gICAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIG1ldGhvZFZhbGlkYXRvcik7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvLyBSZXR1cm4gdW5pb24gdmFsaWRhdG9yICh8fCkgb3ZlciBlYWNoIHNjaGVtYVxuICB1bmlvblZhbGlkYXRvcnMoc2NoZW1hOiBzdHJpbmdbXSk6IFZhbGlkYXRvciB7XG4gICAgdmFyIHVuaW9uID0gPFZhbGlkYXRvcj4ge307XG4gICAgc2NoZW1hLmZvckVhY2goZnVuY3Rpb24odHlwZU5hbWU6IHN0cmluZykge1xuICAgICAgLy8gRmlyc3QgYW5kIHRoZSB2YWxpZGF0b3IgdGVybXMgZm9yIGEgc2luZ2xlIHR5cGVcbiAgICAgIC8vIFRvZG8gZXh0ZW5kIHRvIHVuaW9ucyBhbmQgZ2VuZXJpY3NcbiAgICAgIHZhciBzaW5nbGVUeXBlID0gZXh0ZW5kVmFsaWRhdG9yKHt9LCB0aGlzLmVuc3VyZVZhbGlkYXRvcih0eXBlTmFtZSkpO1xuICAgICAgbWFwVmFsaWRhdG9yKHNpbmdsZVR5cGUsIGFzdC5hbmRBcnJheSk7XG4gICAgICBleHRlbmRWYWxpZGF0b3IodW5pb24sIHNpbmdsZVR5cGUpO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgbWFwVmFsaWRhdG9yKHVuaW9uLCBhc3Qub3JBcnJheSk7XG4gICAgcmV0dXJuIHVuaW9uO1xuICB9XG5cbiAgLy8gQ29udmVydCBleHByZXNzaW9ucyB0byB0ZXh0LCBhbmQgYXQgdGhlIHNhbWUgdGltZSwgYXBwbHkgcHJ1bmluZyBvcGVyYXRpb25zXG4gIC8vIHRvIHJlbW92ZSBuby1vcCBydWxlcy5cbiAgY29udmVydEV4cHJlc3Npb25zKHZhbGlkYXRvcjogVmFsaWRhdG9yKSB7XG4gICAgdmFyIG1ldGhvZFRoaXNJcyA9IDx7W3Byb3A6IHN0cmluZ106IHN0cmluZ30+IHsgJy52YWxpZGF0ZSc6ICduZXdEYXRhJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAnLnJlYWQnOiAnZGF0YScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJy53cml0ZSc6ICduZXdEYXRhJyB9O1xuXG4gICAgZnVuY3Rpb24gaGFzV2lsZGNhcmRTaWJsaW5nKHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpOiBib29sZWFuIHtcbiAgICAgIGxldCBwYXJ0cyA9IHBhdGguZ2V0TGFiZWxzKCk7XG4gICAgICBsZXQgY2hpbGRQYXJ0ID0gcGFydHMucG9wKCk7XG4gICAgICBsZXQgcGFyZW50ID0gdXRpbC5kZWVwTG9va3VwKHZhbGlkYXRvciwgcGFydHMpO1xuICAgICAgaWYgKHBhcmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGZvciAobGV0IHByb3Agb2YgT2JqZWN0LmtleXMocGFyZW50KSkge1xuICAgICAgICBpZiAocHJvcCA9PT0gY2hpbGRQYXJ0KSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHByb3BbMF0gPT09ICckJykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgbWFwVmFsaWRhdG9yKHZhbGlkYXRvciwgKHZhbHVlOiBhc3QuRXhwW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3A6IHN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IGFzdC5QYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpID0+IHtcbiAgICAgIGlmIChwcm9wIGluIG1ldGhvZFRoaXNJcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcy5nZXRFeHByZXNzaW9uVGV4dChhc3QuYW5kQXJyYXkoY29sbGFwc2VIYXNDaGlsZHJlbih2YWx1ZSkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2RUaGlzSXNbcHJvcF0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoKTtcbiAgICAgICAgLy8gUmVtb3ZlIG5vLW9wIC5yZWFkIG9yIC53cml0ZSBydWxlIGlmIG5vIHNpYmxpbmcgd2lsZGNhcmQgcHJvcHMuXG4gICAgICAgIGlmICgocHJvcCA9PT0gJy5yZWFkJyB8fCBwcm9wID09PSAnLndyaXRlJykgJiYgcmVzdWx0ID09PSAnZmFsc2UnKSB7XG4gICAgICAgICAgaWYgKCFoYXNXaWxkY2FyZFNpYmxpbmcocGF0aCkpIHtcbiAgICAgICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVtb3ZlIG5vLW9wIC52YWxpZGF0ZSBydWxlIGlmIG5vIHNpYmxpbmcgd2lsZGNhcmQgcHJvcHMuXG4gICAgICAgIGlmIChwcm9wID09PSAnLnZhbGlkYXRlJyAmJiByZXN1bHQgPT09ICd0cnVlJykge1xuICAgICAgICAgIGlmICghaGFzV2lsZGNhcmRTaWJsaW5nKHBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSk7XG4gIH1cblxuICBnZXRFeHByZXNzaW9uVGV4dChleHA6IGFzdC5FeHAsIHRoaXNJczogc3RyaW5nLCBzY29wZTogYXN0LlBhcmFtcywgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSk6IHN0cmluZyB7XG4gICAgaWYgKCEoJ3R5cGUnIGluIGV4cCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcIk5vdCBhbiBleHByZXNzaW9uOiBcIiArIHV0aWwucHJldHR5SlNPTihleHApKTtcbiAgICB9XG4gICAgLy8gRmlyc3QgZXZhbHVhdGUgdy9vIGJpbmRpbmcgb2YgdGhpcyB0byBzcGVjaWZpYyBsb2NhdGlvbi5cbiAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gdHJ1ZTtcbiAgICBzY29wZSA9IDxhc3QuUGFyYW1zPiB1dGlsLmV4dGVuZCh7fSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7ICd0aGlzJzogYXN0LmNhc3QoYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAZ2V0VGhpcycpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ1NuYXBzaG90JykgfSk7XG4gICAgZXhwID0gdGhpcy5wYXJ0aWFsRXZhbChleHAsIHNjb3BlKTtcbiAgICAvLyBOb3cgcmUtZXZhbHVhdGUgdGhlIGZsYXR0ZW5lZCBleHByZXNzaW9uLlxuICAgIHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMgPSBmYWxzZTtcbiAgICB0aGlzLnRoaXNJcyA9IHRoaXNJcztcbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJGdW5jdGlvbignQGdldFRoaXMnLCBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLmdldFRoaXMuYmluZCh0aGlzKSkpO1xuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdAcm9vdCcsIFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMuZ2V0Um9vdFJlZmVyZW5jZS5iaW5kKHRoaXMsIHBhdGgpKSk7XG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ3ByaW9yJywgWydleHAnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLnByaW9yLmJpbmQodGhpcykpKTtcbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJGdW5jdGlvbigna2V5JywgW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5nZXRLZXkuYmluZChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoLmxlbmd0aCgpID09PSAwID8gJycgOiBwYXRoLmdldFBhcnQoLTEpLmxhYmVsKSkpO1xuXG4gICAgZXhwID0gdGhpcy5wYXJ0aWFsRXZhbChleHApO1xuXG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ0BnZXRUaGlzJ107XG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ0Byb290J107XG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ3ByaW9yJ107XG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ2tleSddO1xuXG4gICAgLy8gVG9wIGxldmVsIGV4cHJlc3Npb25zIHNob3VsZCBuZXZlciBiZSB0byBhIHNuYXBzaG90IHJlZmVyZW5jZSAtIHNob3VsZFxuICAgIC8vIGFsd2F5cyBldmFsdWF0ZSB0byBhIGJvb2xlYW4uXG4gICAgZXhwID0gYXN0LmVuc3VyZUJvb2xlYW4oZXhwKTtcbiAgICByZXR1cm4gYXN0LmRlY29kZUV4cHJlc3Npb24oZXhwKTtcbiAgfVxuXG4gIC8qXG4gICAqICBXcmFwcGVyIGZvciBwYXJ0aWFsRXZhbCBkZWJ1Z2dpbmcuXG4gICAqL1xuXG4gIHBhcnRpYWxFdmFsKGV4cDogYXN0LkV4cCxcbiAgICAgICAgICAgICAgcGFyYW1zID0gPGFzdC5QYXJhbXM+IHt9LFxuICAgICAgICAgICAgICBmdW5jdGlvbkNhbGxzOiB7IFtuYW1lOiBzdHJpbmddOiBib29sZWFuIH0gPSB7fSlcbiAgOiBhc3QuRXhwIHtcbiAgICAvLyBXcmFwIHJlYWwgY2FsbCBmb3IgZGVidWdnaW5nLlxuICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnRpYWxFdmFsUmVhbChleHAsIHBhcmFtcywgZnVuY3Rpb25DYWxscyk7XG4gICAgLy8gY29uc29sZS5sb2coYXN0LmRlY29kZUV4cHJlc3Npb24oZXhwKSArIFwiID0+IFwiICsgYXN0LmRlY29kZUV4cHJlc3Npb24ocmVzdWx0KSk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIFBhcnRpYWwgZXZhbHVhdGlvbiBvZiBleHByZXNzaW9ucyAtIGNvcHkgb2YgZXhwcmVzc2lvbiB0cmVlIChpbW11dGFibGUpLlxuICAvL1xuICAvLyAtIEV4cGFuZCBpbmxpbmUgZnVuY3Rpb24gY2FsbHMuXG4gIC8vIC0gUmVwbGFjZSBsb2NhbCBhbmQgZ2xvYmFsIHZhcmlhYmxlcyB3aXRoIHRoZWlyIHZhbHVlcy5cbiAgLy8gLSBFeHBhbmQgc25hcHNob3QgcmVmZXJlbmNlcyB1c2luZyBjaGlsZCgncmVmJykuXG4gIC8vIC0gQ29lcmNlIHNuYXBzaG90IHJlZmVyZW5jZXMgdG8gdmFsdWVzIGFzIG5lZWRlZC5cbiAgcGFydGlhbEV2YWxSZWFsKGV4cDogYXN0LkV4cCxcbiAgICAgICAgICAgICAgcGFyYW1zID0gPGFzdC5QYXJhbXM+IHt9LFxuICAgICAgICAgICAgICBmdW5jdGlvbkNhbGxzID0gPHsgW25hbWU6IHN0cmluZ106IGJvb2xlYW4gfT4ge30pXG4gIDogYXN0LkV4cCB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gc3ViRXhwcmVzc2lvbihleHAyOiBhc3QuRXhwKTogYXN0LkV4cCB7XG4gICAgICByZXR1cm4gc2VsZi5wYXJ0aWFsRXZhbChleHAyLCBwYXJhbXMsIGZ1bmN0aW9uQ2FsbHMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHZhbHVlRXhwcmVzc2lvbihleHAyOiBhc3QuRXhwKTogYXN0LkV4cCB7XG4gICAgICByZXR1cm4gYXN0LmVuc3VyZVZhbHVlKHN1YkV4cHJlc3Npb24oZXhwMikpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJvb2xlYW5FeHByZXNzaW9uKGV4cDI6IGFzdC5FeHApOiBhc3QuRXhwIHtcbiAgICAgIHJldHVybiBhc3QuZW5zdXJlQm9vbGVhbihzdWJFeHByZXNzaW9uKGV4cDIpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb29rdXBWYXIoZXhwMjogYXN0LkV4cFZhcmlhYmxlKSB7XG4gICAgICAvLyBUT0RPOiBVbmJvdW5kIHZhcmlhYmxlIGFjY2VzcyBzaG91bGQgYmUgYW4gZXJyb3IuXG4gICAgICByZXR1cm4gcGFyYW1zW2V4cDIubmFtZV0gfHwgc2VsZi5nbG9iYWxzW2V4cDIubmFtZV0gfHwgZXhwMjtcbiAgICB9XG5cbiAgICAvLyBDb252ZXJ0IHJlZltwcm9wXSA9PiByZWYuY2hpbGQocHJvcClcbiAgICBmdW5jdGlvbiBzbmFwc2hvdENoaWxkKHJlZjogYXN0LkV4cFJlZmVyZW5jZSk6IGFzdC5FeHAge1xuICAgICAgcmV0dXJuIGFzdC5jYXN0KGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UocmVmLmJhc2UsIGFzdC5zdHJpbmcoJ2NoaWxkJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFtyZWYuYWNjZXNzb3JdKSxcbiAgICAgICAgICAgICAgICAgICAgICAnU25hcHNob3QnKTtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKGV4cC50eXBlKSB7XG4gICAgY2FzZSAnb3AnOlxuICAgICAgbGV0IGV4cE9wID0gPGFzdC5FeHBPcD4gYXN0LmNvcHlFeHAoZXhwKTtcbiAgICAgIC8vIEVuc3VyZSBhcmd1bWVudHMgYXJlIGJvb2xlYW4gKG9yIHZhbHVlcykgd2hlcmUgbmVlZGVkLlxuICAgICAgaWYgKGV4cE9wLm9wID09PSAndmFsdWUnKSB7XG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSk7XG4gICAgICB9IGVsc2UgaWYgKGV4cE9wLm9wID09PSAnfHwnIHx8IGV4cE9wLm9wID09PSAnJiYnIHx8IGV4cE9wLm9wID09PSAnIScpIHtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBPcC5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZXhwT3AuYXJnc1tpXSA9IGJvb2xlYW5FeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGV4cE9wLm9wID09PSAnPzonKSB7XG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSBib29sZWFuRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdKTtcbiAgICAgICAgZXhwT3AuYXJnc1sxXSA9IHZhbHVlRXhwcmVzc2lvbihleHBPcC5hcmdzWzFdKTtcbiAgICAgICAgZXhwT3AuYXJnc1syXSA9IHZhbHVlRXhwcmVzc2lvbihleHBPcC5hcmdzWzJdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwT3AuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGV4cE9wLmFyZ3NbaV0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBleHBPcDtcblxuICAgIGNhc2UgJ3Zhcic6XG4gICAgICByZXR1cm4gbG9va3VwVmFyKDxhc3QuRXhwVmFyaWFibGU+IGV4cCk7XG5cbiAgICBjYXNlICdyZWYnOlxuICAgICAgbGV0IGV4cFJlZiA9IDxhc3QuRXhwUmVmZXJlbmNlPiBhc3QuY29weUV4cChleHApO1xuICAgICAgZXhwUmVmLmJhc2UgPSBzdWJFeHByZXNzaW9uKGV4cFJlZi5iYXNlKTtcblxuICAgICAgLy8gdmFyW3JlZl0gPT4gdmFyW3JlZl1cbiAgICAgIGlmIChleHBSZWYuYmFzZS52YWx1ZVR5cGUgIT09ICdTbmFwc2hvdCcpIHtcbiAgICAgICAgZXhwUmVmLmFjY2Vzc29yID0gc3ViRXhwcmVzc2lvbihleHBSZWYuYWNjZXNzb3IpO1xuICAgICAgICByZXR1cm4gZXhwUmVmO1xuICAgICAgfVxuXG4gICAgICBsZXQgcHJvcE5hbWUgPSBhc3QuZ2V0UHJvcE5hbWUoZXhwUmVmKTtcblxuICAgICAgLy8gc25hcHNob3QucHJvcCAoc3RhdGljIHN0cmluZyBwcm9wZXJ0eSlcbiAgICAgIGlmIChwcm9wTmFtZSAhPT0gJycpIHtcbiAgICAgICAgLy8gc25hcHNob3QudmFsdWVNZXRob2QgPT4gc25hcHNob3QudmFsKCkudmFsdWVNZXRob2RcbiAgICAgICAgaWYgKHV0aWwuYXJyYXlJbmNsdWRlcyh2YWx1ZU1ldGhvZHMsIHByb3BOYW1lKSkge1xuICAgICAgICAgIGV4cFJlZi5iYXNlID0gdmFsdWVFeHByZXNzaW9uKGV4cFJlZi5iYXNlKTtcbiAgICAgICAgICByZXR1cm4gZXhwUmVmO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc25hcHNob3Quc3NNZXRob2QgPT4gc25hcHNob3Quc3NNZXRob2RcbiAgICAgICAgaWYgKHV0aWwuYXJyYXlJbmNsdWRlcyhzbmFwc2hvdE1ldGhvZHMsIHByb3BOYW1lKSkge1xuICAgICAgICAgIHJldHVybiBleHBSZWY7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gc25hcHNob3RbZXhwXSA9PiBzbmFwc2hvdC5jaGlsZChleHApIG9yXG4gICAgICAvLyBzbmFwc2hvdFtyZWZdID0+IHNuYXBzaG90LmNoaWxkKHJlZi52YWwoKSlcbiAgICAgIGV4cFJlZi5hY2Nlc3NvciA9IHZhbHVlRXhwcmVzc2lvbihleHBSZWYuYWNjZXNzb3IpO1xuICAgICAgcmV0dXJuIHNuYXBzaG90Q2hpbGQoZXhwUmVmKTtcblxuICAgIGNhc2UgJ2NhbGwnOlxuICAgICAgbGV0IGV4cENhbGwgPSA8YXN0LkV4cENhbGw+IGFzdC5jb3B5RXhwKGV4cCk7XG4gICAgICBleHBDYWxsLnJlZiA9IDxhc3QuRXhwVmFyaWFibGUgfCBhc3QuRXhwUmVmZXJlbmNlPiBzdWJFeHByZXNzaW9uKGV4cENhbGwucmVmKTtcbiAgICAgIHZhciBjYWxsZWUgPSB0aGlzLmxvb2t1cEZ1bmN0aW9uKGV4cENhbGwucmVmKTtcblxuICAgICAgLy8gRXhwYW5kIHRoZSBmdW5jdGlvbiBjYWxsIGlubGluZVxuICAgICAgaWYgKGNhbGxlZSkge1xuICAgICAgICB2YXIgZm4gPSBjYWxsZWUuZm47XG5cbiAgICAgICAgaWYgKGNhbGxlZS5zZWxmKSB7XG4gICAgICAgICAgZXhwQ2FsbC5hcmdzLnVuc2hpZnQoYXN0LmVuc3VyZVZhbHVlKGNhbGxlZS5zZWxmKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm4ucGFyYW1zLmxlbmd0aCAhPT0gZXhwQ2FsbC5hcmdzLmxlbmd0aCkge1xuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLm1pc21hdGNoUGFyYW1zICsgXCIgKCBcIiArXG4gICAgICAgICAgICAgICAgICAgICBjYWxsZWUubWV0aG9kTmFtZSArIFwiIGV4cGVjdHMgXCIgKyBmbi5wYXJhbXMubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgIFwiIGJ1dCBhY3R1YWxseSBwYXNzZWQgXCIgKyBleHBDYWxsLmFyZ3MubGVuZ3RoICsgXCIpXCIpO1xuICAgICAgICAgIHJldHVybiBleHA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZm4uYm9keS50eXBlID09PSAnYnVpbHRpbicpIHtcbiAgICAgICAgICByZXR1cm4gKDxhc3QuRXhwQnVpbHRpbj4gZm4uYm9keSkuZm4oZXhwQ2FsbC5hcmdzLCBwYXJhbXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGlubmVyUGFyYW1zID0gPGFzdC5QYXJhbXM+IHt9O1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZm4ucGFyYW1zLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaW5uZXJQYXJhbXNbZm4ucGFyYW1zW2ldXSA9IHN1YkV4cHJlc3Npb24oZXhwQ2FsbC5hcmdzW2ldKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoZnVuY3Rpb25DYWxsc1tjYWxsZWUubWV0aG9kTmFtZV0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLnJlY3Vyc2l2ZSArIFwiIChcIiArIGNhbGxlZS5tZXRob2ROYW1lICsgXCIpXCIpO1xuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uQ2FsbHNbY2FsbGVlLm1ldGhvZE5hbWVdID0gdHJ1ZTtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMucGFydGlhbEV2YWwoZm4uYm9keSwgaW5uZXJQYXJhbXMsIGZ1bmN0aW9uQ2FsbHMpO1xuICAgICAgICBmdW5jdGlvbkNhbGxzW2NhbGxlZS5tZXRob2ROYW1lXSA9IGZhbHNlO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuXG4gICAgICAvLyBDYW4ndCBleHBhbmQgZnVuY3Rpb24gLSBidXQganVzdCBleHBhbmQgdGhlIGFyZ3VtZW50cy5cbiAgICAgIGlmICghdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucykge1xuICAgICAgICB2YXIgZnVuY05hbWUgPSBhc3QuZ2V0TWV0aG9kTmFtZShleHBDYWxsKTtcbiAgICAgICAgaWYgKGZ1bmNOYW1lICE9PSAnJyAmJiAhKGZ1bmNOYW1lIGluIHRoaXMuc3ltYm9scy5zY2hlbWFbJ1N0cmluZyddLm1ldGhvZHMgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHV0aWwuYXJyYXlJbmNsdWRlcyhzbmFwc2hvdE1ldGhvZHMsIGZ1bmNOYW1lKSkpIHtcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy51bmRlZmluZWRGdW5jdGlvbiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cENhbGwucmVmKSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBDYWxsLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgZXhwQ2FsbC5hcmdzW2ldID0gc3ViRXhwcmVzc2lvbihleHBDYWxsLmFyZ3NbaV0pO1xuICAgICAgfVxuXG4gICAgICAvLyBIYWNrIGZvciBzbmFwc2hvdC5wYXJlbnQoKS52YWwoKVxuICAgICAgLy8gVG9kbyAtIGJ1aWxkIHRhYmxlLWJhc2VkIG1ldGhvZCBzaWduYXR1cmVzLlxuICAgICAgaWYgKGFzdC5nZXRNZXRob2ROYW1lKGV4cENhbGwpID09PSAncGFyZW50Jykge1xuICAgICAgICBleHBDYWxsID0gPGFzdC5FeHBDYWxsPiBhc3QuY2FzdChleHBDYWxsLCAnU25hcHNob3QnKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGV4cENhbGw7XG5cbiAgICAvLyBFeHByZXNzaW9uIHR5cGVzIChsaWtlIGxpdGVyYWxzKSB0aGFuIG5lZWQgbm8gZXhwYW5zaW9uLlxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZXhwO1xuICAgIH1cbiAgfVxuXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSBjb252ZXJ0IGFsbCAndGhpcycgdG8gJ2RhdGEnIChmcm9tICduZXdEYXRhJykuXG4gIC8vIEFyZ3MgYXJlIGZ1bmN0aW9uIGFyZ3VtZW50cywgYW5kIHBhcmFtcyBhcmUgdGhlIGxvY2FsIChmdW5jdGlvbikgc2NvcGUgdmFyaWFibGVzLlxuICBwcmlvcihhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcyk6IGFzdC5FeHAge1xuICAgIHZhciBsYXN0VGhpc0lzID0gdGhpcy50aGlzSXM7XG4gICAgdGhpcy50aGlzSXMgPSAnZGF0YSc7XG4gICAgdmFyIGV4cCA9IHRoaXMucGFydGlhbEV2YWwoYXJnc1swXSwgcGFyYW1zKTtcbiAgICB0aGlzLnRoaXNJcyA9IGxhc3RUaGlzSXM7XG4gICAgcmV0dXJuIGV4cDtcbiAgfVxuXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSBjdXJyZW50IHZhbHVlIG9mICd0aGlzJ1xuICBnZXRUaGlzKGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKTogYXN0LkV4cCB7XG4gICAgcmV0dXJuIGFzdC5zbmFwc2hvdFZhcmlhYmxlKHRoaXMudGhpc0lzKTtcbiAgfVxuXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSBlbnN1cmUgdHlwZSBvZiBhcmd1bWVudFxuICBlbnN1cmVUeXBlKHR5cGU6IHN0cmluZywgYXJnczogYXN0LkV4cFtdLCBwYXJhbXM6IGFzdC5QYXJhbXMpIHtcbiAgICBpZiAoYXJncy5sZW5ndGggIT09IDEpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcImVuc3VyZVR5cGUgYXJndW1lbnRzLlwiKTtcbiAgICB9XG4gICAgdmFyIGV4cCA9IDxhc3QuRXhwVmFsdWU+IHRoaXMucGFydGlhbEV2YWwoYXJnc1swXSwgcGFyYW1zKTtcbiAgICBpZiAoZXhwLnR5cGUgIT09IHR5cGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuY29lcmNpb24gKyBhc3QuZGVjb2RlRXhwcmVzc2lvbihleHApICsgXCIgPT4gXCIgKyB0eXBlKTtcbiAgICB9XG4gICAgcmV0dXJuIGV4cDtcbiAgfVxuXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSByZXR1cm4gdGhlIHBhcmVudCBrZXkgb2YgJ3RoaXMnLlxuICBnZXRLZXkoa2V5OiBzdHJpbmcsIGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1pc21hdGNoUGFyYW1zICsgXCIoZm91bmQgXCIgKyBhcmdzLmxlbmd0aCArIFwiIGJ1dCBleHBlY3RlZCAxKVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4ga2V5WzBdID09PSAnJCcgPyBhc3QubGl0ZXJhbChrZXkpIDogYXN0LnN0cmluZyhrZXkpO1xuICB9XG5cbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIHJldHVybiB0aGUgcmVmZXJlbmNlIHRvIHRoZSByb290XG4gIC8vIFdoZW4gaW4gcmVhZCBtb2RlIC0gdXNlICdyb290J1xuICAvLyBXaGVuIGluIHdyaXRlL3ZhbGlkYXRlIC0gdXNlIHBhdGggdG8gcm9vdCB2aWEgbmV3RGF0YS5wYXJlbnQoKS4uLlxuICBnZXRSb290UmVmZXJlbmNlKHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUsIGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJAcm9vdCBhcmd1bWVudHMuXCIpO1xuICAgIH1cblxuICAgIC8vICdkYXRhJyBjYXNlXG4gICAgaWYgKHRoaXMudGhpc0lzID09PSAnZGF0YScpIHtcbiAgICAgIHJldHVybiBhc3Quc25hcHNob3RWYXJpYWJsZSgncm9vdCcpO1xuICAgIH1cblxuICAgIC8vIFRPRE8oa29zcyk6IFJlbW92ZSB0aGlzIHNwZWNpYWwgY2FzZSBpZiBKU09OIHN1cHBvcnRzIG5ld1Jvb3QgaW5zdGVhZC5cbiAgICAvLyAnbmV3RGF0YScgY2FzZSAtIHRyYXZlcnNlIHRvIHJvb3QgdmlhIHBhcmVudCgpJ3MuXG4gICAgbGV0IHJlc3VsdDogYXN0LkV4cCA9IGFzdC5zbmFwc2hvdFZhcmlhYmxlKCduZXdEYXRhJyk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aCgpOyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IGFzdC5zbmFwc2hvdFBhcmVudChyZXN1bHQpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gTG9va3VwIGdsb2JhbGx5IGRlZmluZWQgZnVuY3Rpb24uXG4gIGxvb2t1cEZ1bmN0aW9uKHJlZjogYXN0LkV4cFZhcmlhYmxlIHwgYXN0LkV4cFJlZmVyZW5jZSk6IHtcbiAgICBzZWxmPzogYXN0LkV4cCxcbiAgICBmbjogYXN0Lk1ldGhvZCxcbiAgICBtZXRob2ROYW1lOiBzdHJpbmdcbiAgfSB8IHVuZGVmaW5lZCB7XG4gICAgLy8gRnVuY3Rpb24gY2FsbC5cbiAgICBpZiAocmVmLnR5cGUgPT09ICd2YXInKSB7XG4gICAgICBsZXQgcmVmVmFyID0gPGFzdC5FeHBWYXJpYWJsZT4gcmVmO1xuICAgICAgdmFyIGZuID0gdGhpcy5zeW1ib2xzLmZ1bmN0aW9uc1tyZWZWYXIubmFtZV07XG4gICAgICBpZiAoIWZuKSB7XG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBzZWxmOiB1bmRlZmluZWQsIGZuOiBmbiwgbWV0aG9kTmFtZTogcmVmVmFyLm5hbWV9O1xuICAgIH1cblxuICAgIC8vIE1ldGhvZCBjYWxsLlxuICAgIGlmIChyZWYudHlwZSA9PT0gJ3JlZicpIHtcbiAgICAgIGxldCByZWZSZWYgPSA8YXN0LkV4cFJlZmVyZW5jZT4gcmVmO1xuICAgICAgLy8gVE9ETzogUmVxdWlyZSBzdGF0aWMgdHlwZSB2YWxpZGF0aW9uIGJlZm9yZSBjYWxsaW5nIFN0cmluZyBtZXRob2RzLlxuICAgICAgaWYgKCg8YXN0LkV4cE9wPiByZWZSZWYuYmFzZSkub3AgIT09ICd2YWx1ZScgJiZcbiAgICAgICAgICA8c3RyaW5nPiAoPGFzdC5FeHBWYWx1ZT4gcmVmUmVmLmFjY2Vzc29yKS52YWx1ZSBpbiB0aGlzLnN5bWJvbHMuc2NoZW1hWydTdHJpbmcnXS5tZXRob2RzKSB7XG4gICAgICAgIGxldCBtZXRob2ROYW1lID0gPHN0cmluZz4gKDxhc3QuRXhwVmFsdWU+IHJlZlJlZi5hY2Nlc3NvcikudmFsdWU7XG4gICAgICAgIHJldHVybiB7IHNlbGY6IHJlZlJlZi5iYXNlLFxuICAgICAgICAgICAgICAgICBmbjogdGhpcy5zeW1ib2xzLnNjaGVtYVsnU3RyaW5nJ10ubWV0aG9kc1ttZXRob2ROYW1lXSxcbiAgICAgICAgICAgICAgICAgbWV0aG9kTmFtZTogJ1N0cmluZy4nICsgbWV0aG9kTmFtZVxuICAgICAgICAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxuXG4gIGZhdGFsKHM6IHN0cmluZykge1xuICAgIGVycm9yKHMpO1xuICAgIHRoaXMuZXJyb3JDb3VudCArPSAxO1xuICB9XG59O1xuXG4vLyBNZXJnZSBhbGwgLlggdGVybXMgaW50byB0YXJnZXQuXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kVmFsaWRhdG9yKHRhcmdldDogVmFsaWRhdG9yLCBzcmM6IFZhbGlkYXRvcik6IFZhbGlkYXRvciB7XG4gIGlmIChzcmMgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcIklsbGVnYWwgdmFsaWRhdGlvbiBzb3VyY2UuXCIpO1xuICB9XG4gIGZvciAodmFyIHByb3AgaW4gc3JjKSB7XG4gICAgaWYgKCFzcmMuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAocHJvcFswXSA9PT0gJy4nKSB7XG4gICAgICBpZiAodGFyZ2V0W3Byb3BdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdGFyZ2V0W3Byb3BdID0gW107XG4gICAgICB9XG4gICAgICBpZiAodXRpbC5pc1R5cGUoc3JjW3Byb3BdLCAnYXJyYXknKSkge1xuICAgICAgICB1dGlsLmV4dGVuZEFycmF5KDxhbnlbXT4gdGFyZ2V0W3Byb3BdLCA8YW55W10+IHNyY1twcm9wXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAoPGFzdC5FeHBbXT4gdGFyZ2V0W3Byb3BdKS5wdXNoKDxhc3QuRXhwPiBzcmNbcHJvcF0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIXRhcmdldFtwcm9wXSkge1xuICAgICAgICB0YXJnZXRbcHJvcF0gPSB7fTtcbiAgICAgIH1cbiAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB0YXJnZXRbcHJvcF0sIDxWYWxpZGF0b3I+IHNyY1twcm9wXSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuLy8gQ2FsbCBmbih2YWx1ZSwgcHJvcCwgcGF0aCkgb24gYWxsICcucHJvcHMnIGFuZCBhc3NpZ2luZyB0aGUgdmFsdWUgYmFjayBpbnRvIHRoZVxuLy8gdmFsaWRhdG9yLlxuZXhwb3J0IGZ1bmN0aW9uIG1hcFZhbGlkYXRvcih2OiBWYWxpZGF0b3IsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZuOiAodmFsOiBWYWxpZGF0b3JWYWx1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGU6IGFzdC5QYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSkgPT4gVmFsaWRhdG9yVmFsdWUgfCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlPzogYXN0LlBhcmFtcyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aD86IGFzdC5QYXRoVGVtcGxhdGUpIHtcbiAgaWYgKCFzY29wZSkge1xuICAgIHNjb3BlID0gPGFzdC5QYXJhbXM+IHt9O1xuICB9XG4gIGlmICghcGF0aCkge1xuICAgIHBhdGggPSBuZXcgYXN0LlBhdGhUZW1wbGF0ZSgpO1xuICB9XG4gIGlmICgnLnNjb3BlJyBpbiB2KSB7XG4gICAgc2NvcGUgPSA8YXN0LlBhcmFtcz4gdlsnLnNjb3BlJ107XG4gIH1cbiAgZm9yICh2YXIgcHJvcCBpbiB2KSB7XG4gICAgaWYgKCF2Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHByb3BbMF0gPT09ICcuJykge1xuICAgICAgbGV0IHZhbHVlID0gZm4odltwcm9wXSwgcHJvcCwgc2NvcGUsIHBhdGgpO1xuICAgICAgaWYgKHZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdltwcm9wXSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVsZXRlIHZbcHJvcF07XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghdXRpbC5pc1R5cGUodltwcm9wXSwgJ29iamVjdCcpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGNoaWxkID0gbmV3IGFzdC5QYXRoVGVtcGxhdGUoW3Byb3BdKTtcbiAgICAgIHBhdGgucHVzaChjaGlsZCk7XG4gICAgICBtYXBWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdltwcm9wXSwgZm4sIHNjb3BlLCBwYXRoKTtcbiAgICAgIHBhdGgucG9wKGNoaWxkKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gQ29sbGFwc2UgYWxsIGhhc0NoaWxkcmVuIGNhbGxzIGludG8gb25lIChjb21iaW5pbmcgdGhlaXIgYXJndW1lbnRzKS5cbi8vIEUuZy4gW25ld0RhdGEuaGFzQ2hpbGRyZW4oKSwgbmV3RGF0YS5oYXNDaGlsZHJlbihbJ3gnXSksIG5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd5J10pXSA9PlxuLy8gICAgICBuZXdEYXRhLmhhc0NoaWxkcmVuKFsneCcsICd5J10pXG5mdW5jdGlvbiBjb2xsYXBzZUhhc0NoaWxkcmVuKGV4cHM6IGFzdC5FeHBbXSk6IGFzdC5FeHBbXSB7XG4gIHZhciBoYXNIYXNDaGlsZHJlbjogYm9vbGVhbiA9IGZhbHNlO1xuICB2YXIgY29tYmluZWQgPSA8c3RyaW5nW10+IFtdO1xuICB2YXIgcmVzdWx0ID0gPGFzdC5FeHBbXT4gW107XG4gIGV4cHMuZm9yRWFjaChmdW5jdGlvbihleHApIHtcbiAgICBpZiAoZXhwLnR5cGUgIT09ICdjYWxsJykge1xuICAgICAgcmVzdWx0LnB1c2goZXhwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBsZXQgZXhwQ2FsbCA9IDxhc3QuRXhwQ2FsbD4gZXhwO1xuICAgIGlmIChhc3QuZ2V0TWV0aG9kTmFtZShleHBDYWxsKSAhPT0gJ2hhc0NoaWxkcmVuJykge1xuICAgICAgcmVzdWx0LnB1c2goZXhwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoZXhwQ2FsbC5hcmdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgaGFzSGFzQ2hpbGRyZW4gPSB0cnVlO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEV4cGVjdCBvbmUgYXJndW1lbnQgb2YgQXJyYXkgdHlwZS5cbiAgICBpZiAoZXhwQ2FsbC5hcmdzLmxlbmd0aCAhPT0gMSB8fCBleHBDYWxsLmFyZ3NbMF0udHlwZSAhPT0gJ0FycmF5Jykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiSW52YWxpZCBhcmd1bWVudCB0byBoYXNDaGlsZHJlbigpOiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgZXhwQ2FsbC5hcmdzWzBdLnR5cGUpO1xuICAgIH1cbiAgICBsZXQgYXJncyA9ICg8YXN0LkV4cFZhbHVlPiBleHBDYWxsLmFyZ3NbMF0pLnZhbHVlO1xuXG4gICAgYXJncy5mb3JFYWNoKGZ1bmN0aW9uKGFyZzogYXN0LkV4cFZhbHVlKSB7XG4gICAgICBoYXNIYXNDaGlsZHJlbiA9IHRydWU7XG4gICAgICBpZiAoYXJnLnR5cGUgIT09ICdTdHJpbmcnKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcIkV4cGVjdCBzdHJpbmcgYXJndW1lbnQgdG8gaGFzQ2hpbGRyZW4oKSwgbm90OiBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmcudHlwZSk7XG4gICAgICB9XG4gICAgICBjb21iaW5lZC5wdXNoKGFyZy52YWx1ZSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGlmIChoYXNIYXNDaGlsZHJlbikge1xuICAgIHJlc3VsdC51bnNoaWZ0KGhhc0NoaWxkcmVuRXhwKGNvbWJpbmVkKSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gR2VuZXJhdGUgdGhpcy5oYXNDaGlsZHJlbihbcHJvcHMsIC4uLl0pIG9yIHRoaXMuaGFzQ2hpbGRyZW4oKVxuZnVuY3Rpb24gaGFzQ2hpbGRyZW5FeHAocHJvcHM6IHN0cmluZ1tdKTogYXN0LkV4cCB7XG4gIHZhciBhcmdzID0gcHJvcHMubGVuZ3RoID09PSAwID8gW10gOiBbYXN0LmFycmF5KHByb3BzLm1hcChhc3Quc3RyaW5nKSldO1xuICByZXR1cm4gYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdChhc3QudmFyaWFibGUoJ3RoaXMnKSwgJ0FueScpLCBhc3Quc3RyaW5nKCdoYXNDaGlsZHJlbicpKSxcbiAgICAgICAgICAgICAgICAgIGFyZ3MpO1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSAoZnVuY3Rpb24oKSB7XG4gIC8qXG4gICAqIEdlbmVyYXRlZCBieSBQRUcuanMgMC44LjAuXG4gICAqXG4gICAqIGh0dHA6Ly9wZWdqcy5tYWpkYS5jei9cbiAgICovXG5cbiAgZnVuY3Rpb24gcGVnJHN1YmNsYXNzKGNoaWxkLCBwYXJlbnQpIHtcbiAgICBmdW5jdGlvbiBjdG9yKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gY2hpbGQ7IH1cbiAgICBjdG9yLnByb3RvdHlwZSA9IHBhcmVudC5wcm90b3R5cGU7XG4gICAgY2hpbGQucHJvdG90eXBlID0gbmV3IGN0b3IoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIFN5bnRheEVycm9yKG1lc3NhZ2UsIGV4cGVjdGVkLCBmb3VuZCwgb2Zmc2V0LCBsaW5lLCBjb2x1bW4pIHtcbiAgICB0aGlzLm1lc3NhZ2UgID0gbWVzc2FnZTtcbiAgICB0aGlzLmV4cGVjdGVkID0gZXhwZWN0ZWQ7XG4gICAgdGhpcy5mb3VuZCAgICA9IGZvdW5kO1xuICAgIHRoaXMub2Zmc2V0ICAgPSBvZmZzZXQ7XG4gICAgdGhpcy5saW5lICAgICA9IGxpbmU7XG4gICAgdGhpcy5jb2x1bW4gICA9IGNvbHVtbjtcblxuICAgIHRoaXMubmFtZSAgICAgPSBcIlN5bnRheEVycm9yXCI7XG4gIH1cblxuICBwZWckc3ViY2xhc3MoU3ludGF4RXJyb3IsIEVycm9yKTtcblxuICBmdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAgIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiB7fSxcblxuICAgICAgICBwZWckRkFJTEVEID0ge30sXG5cbiAgICAgICAgcGVnJHN0YXJ0UnVsZUZ1bmN0aW9ucyA9IHsgc3RhcnQ6IHBlZyRwYXJzZXN0YXJ0IH0sXG4gICAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiAgPSBwZWckcGFyc2VzdGFydCxcblxuICAgICAgICBwZWckYzAgPSBwZWckRkFJTEVELFxuICAgICAgICBwZWckYzEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAobG9nZ2VyLmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgICB0aHJvdyhuZXcgRXJyb3IobG9nZ2VyLmVycm9yU3VtbWFyeSgpKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBzeW1ib2xzO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzIgPSBbXSxcbiAgICAgICAgcGVnJGMzID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcImZ1bmN0aW9uIGRlZmluaXRpb25cIiB9LFxuICAgICAgICBwZWckYzQgPSBudWxsLFxuICAgICAgICBwZWckYzUgPSBmdW5jdGlvbihmdW5jLCBib2R5KSB7XG4gICAgICAgICAgaWYgKGZ1bmMubmFtZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3IoXCJNaXNzaW5nIGZ1bmN0aW9uIG5hbWUuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoZnVuYy5wYXJhbXMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGVycm9yKFwiRnVuY3Rpb24gXCIgKyBmdW5jLm5hbWUgKyBcIiBtaXNzaW5nIHBhcmFtZXRlcnMuXCIpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoYm9keSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZXJyb3IoXCJGdW5jdGlvbiBcIiArIGZ1bmMubmFtZSArIFwiIG1pc3Npbmcgb3IgaW52YWxpZCBmdW5jdGlvbiBib2R5LlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKGVuc3VyZUxvd2VyQ2FzZShmdW5jLm5hbWUsIFwiRnVuY3Rpb24gbmFtZXNcIiksIGZ1bmMucGFyYW1zLCBib2R5KTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM2ID0gXCJmdW5jdGlvblwiLFxuICAgICAgICBwZWckYzcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJmdW5jdGlvblwiLCBkZXNjcmlwdGlvbjogXCJcXFwiZnVuY3Rpb25cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7IHJldHVybiB7bmFtZTogbmFtZSwgcGFyYW1zOiBwYXJhbXN9OyB9LFxuICAgICAgICBwZWckYzkgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMpIHtyZXR1cm4ge25hbWU6IG5hbWUsIHBhcmFtczogcGFyYW1zfTsgfSxcbiAgICAgICAgcGVnJGMxMCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJwYXRoIHN0YXRlbWVudFwiIH0sXG4gICAgICAgIHBlZyRjMTEgPSBcImlzXCIsXG4gICAgICAgIHBlZyRjMTIgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJpc1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiaXNcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMyA9IGZ1bmN0aW9uKGlkKSB7IHJldHVybiBpZDsgfSxcbiAgICAgICAgcGVnJGMxNCA9IFwie1wiLFxuICAgICAgICBwZWckYzE1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwie1wiLCBkZXNjcmlwdGlvbjogXCJcXFwie1xcXCJcIiB9LFxuICAgICAgICBwZWckYzE2ID0gXCJ9XCIsXG4gICAgICAgIHBlZyRjMTcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ9XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ9XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTggPSBmdW5jdGlvbihhbGwpIHsgcmV0dXJuIGFsbDsgfSxcbiAgICAgICAgcGVnJGMxOSA9IFwiO1wiLFxuICAgICAgICBwZWckYzIwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiO1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiO1xcXCJcIiB9LFxuICAgICAgICBwZWckYzIxID0gZnVuY3Rpb24oKSB7IHJldHVybiB7fTsgfSxcbiAgICAgICAgcGVnJGMyMiA9IGZ1bmN0aW9uKHBhdGgsIGlzVHlwZSwgbWV0aG9kcykge1xuICAgICAgICAgICAgaWYgKHBhdGggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1ldGhvZHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgZXJyb3IoXCJNaXNzaW5nIGJvZHkgb2YgcGF0aCBzdGF0ZW1lbnQuXCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzeW1ib2xzLnJlZ2lzdGVyUGF0aChjdXJyZW50UGF0aCwgaXNUeXBlLCBtZXRob2RzKTtcbiAgICAgICAgICAgIGN1cnJlbnRQYXRoLnBvcChwYXRoKTtcbiAgICAgICAgICB9LFxuICAgICAgICBwZWckYzIzID0gXCJwYXRoXCIsXG4gICAgICAgIHBlZyRjMjQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJwYXRoXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJwYXRoXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjUgPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgICAgICBpZiAocGF0aCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBlcnJvcihcIk1pc3NpbmcgUGF0aCBUZW1wbGF0ZSBpbiBwYXRoIHN0YXRlbWVudC5cIik7XG4gICAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY3VycmVudFBhdGgucHVzaChwYXRoKTtcbiAgICAgICAgICAgIHJldHVybiBwYXRoO1xuICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjMjYgPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgICAgICAgICBjdXJyZW50UGF0aC5wdXNoKHBhdGgpOyByZXR1cm4gcGF0aDtcbiAgICAgICAgICB9LFxuICAgICAgICBwZWckYzI3ID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcInBhdGggdGVtcGxhdGVcIiB9LFxuICAgICAgICBwZWckYzI4ID0gXCIvXCIsXG4gICAgICAgIHBlZyRjMjkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIvXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIvXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzAgPSBmdW5jdGlvbihwYXJ0KSB7IHJldHVybiBwYXJ0OyB9LFxuICAgICAgICBwZWckYzMxID0gZnVuY3Rpb24ocGFydHMpIHtcbiAgICAgICAgICB2YXIgaGFzRXJyb3IgPSBmYWxzZTtcbiAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAxICYmIHBhcnRzWzBdID09PSBudWxsKSB7XG4gICAgICAgICAgICBwYXJ0cyA9IFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICBwYXJ0cyA9IHBhcnRzLm1hcChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgICAgICBpZiAocGFydCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBoYXNFcnJvciA9IHRydWU7XG4gICAgICAgICAgICAgIHJldHVybiAnJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBwYXJ0O1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChoYXNFcnJvcikge1xuICAgICAgICAgICAgZXJyb3IoKHBhcnRzW3BhcnRzLmxlbmd0aCAtIDFdID09PSAnJ1xuICAgICAgICAgICAgICAgICAgID8gXCJQYXRocyBtYXkgbm90IGVuZCBpbiBhIHNsYXNoICgvKSBjaGFyYWN0ZXJcIlxuICAgICAgICAgICAgICAgICAgIDogXCJQYXRocyBtYXkgbm90IGNvbnRhaW4gYW4gZW1wdHkgcGFydFwiKSArIFwiOiAvXCIgKyBwYXJ0cy5tYXAoZnVuY3Rpb24ocGFydCkgeyByZXR1cm4gcGFydC5sYWJlbDsgfSkuam9pbignLycpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIG5ldyBhc3QuUGF0aFRlbXBsYXRlKHBhcnRzKTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGMzMiA9IFwiPVwiLFxuICAgICAgICBwZWckYzMzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPVxcXCJcIiB9LFxuICAgICAgICBwZWckYzM0ID0gXCIqXCIsXG4gICAgICAgIHBlZyRjMzUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIqXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIqXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMzYgPSBmdW5jdGlvbihpZCkge1xuICAgICAgICAgIHJldHVybiBuZXcgYXN0LlBhdGhQYXJ0KGlkLCBpZCk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjMzcgPSAvXlteIFxcLztdLyxcbiAgICAgICAgcGVnJGMzOCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXiBcXFxcLztdXCIsIGRlc2NyaXB0aW9uOiBcIlteIFxcXFwvO11cIiB9LFxuICAgICAgICBwZWckYzM5ID0gZnVuY3Rpb24oY2hhcnMpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0gY2hhcnMuam9pbignJyk7XG4gICAgICAgICAgaWYgKGNoYXJzWzBdID09PSAnJCcpIHtcbiAgICAgICAgICAgIHdhcm4oXCJVc2Ugb2YgXCIgKyByZXN1bHQgKyBcIiB0byBjYXB0dXJlIGEgcGF0aCBzZWdtZW50IGlzIGRlcHJlY2F0ZWQ7IFwiICtcbiAgICAgICAgICAgICAgICAgXCJ1c2Uge1wiICsgcmVzdWx0ICsgXCJ9IG9yIHtcIiArIHJlc3VsdC5zbGljZSgxKSArIFwifSwgaW5zdGVhZC5cIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBuZXcgYXN0LlBhdGhQYXJ0KHJlc3VsdCk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNDAgPSBmdW5jdGlvbihhbGwpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0ge307XG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbGwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBtZXRob2QgPSBhbGxbaV07XG4gICAgICAgICAgICAvLyBTa2lwIGVtYmVkZGVkIHBhdGggc3RhdGVtZW50cy5cbiAgICAgICAgICAgIGlmIChtZXRob2QgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWV0aG9kID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiSW52YWxpZCBwYXRoIG9yIG1ldGhvZDogJ1wiICsgbWV0aG9kICsgXCInLlwiKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobWV0aG9kLm5hbWUgaW4gcmVzdWx0KSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiRHVwbGljYXRlIG1ldGhvZCBuYW1lOiBcIiArIG1ldGhvZC5uYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdFttZXRob2QubmFtZV0gPSBhc3QubWV0aG9kKG1ldGhvZC5wYXJhbXMsIG1ldGhvZC5ib2R5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM0MSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJ0eXBlIHN0YXRlbWVudFwiIH0sXG4gICAgICAgIHBlZyRjNDIgPSBcInR5cGVcIixcbiAgICAgICAgcGVnJGM0MyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInR5cGVcIiwgZGVzY3JpcHRpb246IFwiXFxcInR5cGVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0NCA9IFwiPFwiLFxuICAgICAgICBwZWckYzQ1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPFxcXCJcIiB9LFxuICAgICAgICBwZWckYzQ2ID0gXCI+XCIsXG4gICAgICAgIHBlZyRjNDcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI+XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI+XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDggPSBmdW5jdGlvbihsaXN0KSB7IHJldHVybiBlbnN1cmVVcHBlckNhc2UobGlzdCwgXCJUeXBlIG5hbWVzXCIpOyB9LFxuICAgICAgICBwZWckYzQ5ID0gXCJleHRlbmRzXCIsXG4gICAgICAgIHBlZyRjNTAgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJleHRlbmRzXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJleHRlbmRzXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTEgPSBmdW5jdGlvbih0eXBlKSB7IHJldHVybiB0eXBlOyB9LFxuICAgICAgICBwZWckYzUyID0gZnVuY3Rpb24oKSB7IHJldHVybiB7cHJvcGVydGllczoge30sIG1ldGhvZHM6IHt9fTsgfSxcbiAgICAgICAgcGVnJGM1MyA9IGZ1bmN0aW9uKHR5cGUsIHBhcmFtcywgZXh0LCBib2R5KSB7XG4gICAgICAgICAgICBpZiAocGFyYW1zID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHBhcmFtcyA9IFtdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHR5cGUgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgZXJyb3IoXCJNaXNzaW5nIHR5cGUgbmFtZS5cIik7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChib2R5ID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiTWlzc2luZyBvciBpbnZhbGlkIHR5cGUgc3RhdGVtZW50IGJvZHkuXCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKGVuc3VyZVVwcGVyQ2FzZSh0eXBlLCBcIlR5cGUgbmFtZXNcIiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGV4dCwgYm9keS5wcm9wZXJ0aWVzLCBib2R5Lm1ldGhvZHMsIHBhcmFtcyk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNTQgPSBmdW5jdGlvbihhbGwpIHtcbiAgICAgICAgICB2YXIgcmVzdWx0ID0ge1xuICAgICAgICAgICAgIHByb3BlcnRpZXM6IHt9LFxuICAgICAgICAgICAgIG1ldGhvZHM6IHt9XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIGZ1bmN0aW9uIGFkZFBhcnQocGFydCkge1xuICAgICAgICAgICAgLy8gVE9ETzogTWFrZSBzdXJlIG1ldGhvZHMgYW5kIHByb3BlcnRpZXMgZG9uJ3Qgc2hhZG93IGVhY2ggb3RoZXIuXG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiSW52YWxpZCBwcm9wZXJ0eSBvciBtZXRob2Q6ICdcIiArIHBhcnQgKyBcIicuXCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoJ3R5cGUnIGluIHBhcnQpIHtcbiAgICAgICAgICAgICAgaWYgKHJlc3VsdC5wcm9wZXJ0aWVzW3BhcnQubmFtZV0pIHtcbiAgICAgICAgICAgICAgICBlcnJvcihcIkR1cGxpY2F0ZSBwcm9wZXJ0eSBuYW1lOiBcIiArIHBhcnQubmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVzdWx0LnByb3BlcnRpZXNbcGFydC5uYW1lXSA9IHBhcnQudHlwZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGlmIChyZXN1bHQubWV0aG9kc1twYXJ0Lm5hbWVdKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IoXCJEdXBsaWNhdGUgbWV0aG9kIG5hbWU6IFwiICsgcGFydC5uYW1lKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXN1bHQubWV0aG9kc1twYXJ0Lm5hbWVdID0gYXN0Lm1ldGhvZChwYXJ0LnBhcmFtcywgcGFydC5ib2R5KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFsbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWRkUGFydChhbGxbaV0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNTUgPSBcIjpcIixcbiAgICAgICAgcGVnJGM1NiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIjpcIiwgZGVzY3JpcHRpb246IFwiXFxcIjpcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM1NyA9IGZ1bmN0aW9uKG5hbWUsIHR5cGUpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmFtZTogIG5hbWUsXG4gICAgICAgICAgICB0eXBlOiB0eXBlXG4gICAgICAgICAgfTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM1OCA9IFwiLFwiLFxuICAgICAgICBwZWckYzU5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiLFxcXCJcIiB9LFxuICAgICAgICBwZWckYzYwID0gZnVuY3Rpb24oc2VwKSB7IHJldHVybiBzZXA7IH0sXG4gICAgICAgIHBlZyRjNjEgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwibWV0aG9kXCIgfSxcbiAgICAgICAgcGVnJGM2MiA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcywgYm9keSwgc2VwKSB7XG4gICAgICAgICAgaWYgKHNlcCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgd2FybihcIkV4dHJhIHNlcGFyYXRvciAoXCIgKyBzZXAgKyBcIikgbm90IG5lZWRlZC5cIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBuYW1lOiAgZW5zdXJlTG93ZXJDYXNlKG5hbWUsIFwiTWV0aG9kIG5hbWVzXCIpLFxuICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgICBib2R5OiAgYm9keVxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNjMgPSBcInJldHVyblwiLFxuICAgICAgICBwZWckYzY0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwicmV0dXJuXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJyZXR1cm5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2NSA9IGZ1bmN0aW9uKGV4cCkgeyByZXR1cm4gZXhwOyB9LFxuICAgICAgICBwZWckYzY2ID0gZnVuY3Rpb24oZXhwKSB7XG4gICAgICAgICAgICB3YXJuKFwiVXNlIG9mIGZuKHgpID0gZXhwOyBmb3JtYXQgaXMgZGVwcmVjYXRlZDsgdXNlIGZuKHgpIHsgZXhwIH0sIGluc3RlYWQuXCIpXG4gICAgICAgICAgICByZXR1cm4gZXhwO1xuICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjNjcgPSBcIihcIixcbiAgICAgICAgcGVnJGM2OCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIihcIiwgZGVzY3JpcHRpb246IFwiXFxcIihcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2OSA9IFwiKVwiLFxuICAgICAgICBwZWckYzcwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiKVxcXCJcIiB9LFxuICAgICAgICBwZWckYzcxID0gZnVuY3Rpb24obGlzdCkgeyByZXR1cm4gZW5zdXJlTG93ZXJDYXNlKGxpc3QsIFwiRnVuY3Rpb24gYXJndW1lbnRzXCIpOyB9LFxuICAgICAgICBwZWckYzcyID0gZnVuY3Rpb24oaGVhZCwgdGFpbCkge1xuICAgICAgICAgIGlmICghaGVhZCkge1xuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0YWlsLnVuc2hpZnQoaGVhZCk7XG4gICAgICAgICAgcmV0dXJuIHRhaWw7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNzMgPSBcInxcIixcbiAgICAgICAgcGVnJGM3NCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInxcIiwgZGVzY3JpcHRpb246IFwiXFxcInxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3NSA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgICBpZiAodGFpbC5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIGhlYWQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRhaWwudW5zaGlmdChoZWFkKTtcbiAgICAgICAgICByZXR1cm4gYXN0LnVuaW9uVHlwZSh0YWlsKTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM3NiA9IFwiW11cIixcbiAgICAgICAgcGVnJGM3NyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIltdXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJbXVxcXCJcIiB9LFxuICAgICAgICBwZWckYzc4ID0gZnVuY3Rpb24oKSB7cmV0dXJuIHtpc01hcDogdHJ1ZX07IH0sXG4gICAgICAgIHBlZyRjNzkgPSBmdW5jdGlvbih0eXBlcykge3JldHVybiB7dHlwZXM6IHR5cGVzfTt9LFxuICAgICAgICBwZWckYzgwID0gZnVuY3Rpb24odHlwZSwgb3B0KSB7XG4gICAgICAgICAgdHlwZSA9IGVuc3VyZVVwcGVyQ2FzZSh0eXBlLCBcIlR5cGUgbmFtZXNcIik7XG4gICAgICAgICAgaWYgKCFvcHQpIHtcbiAgICAgICAgICAgIHJldHVybiBhc3QudHlwZVR5cGUodHlwZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChvcHQuaXNNYXApIHtcbiAgICAgICAgICAgIHJldHVybiBhc3QuZ2VuZXJpY1R5cGUoJ01hcCcsIFthc3QudHlwZVR5cGUoJ1N0cmluZycpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC50eXBlVHlwZSh0eXBlKV0pO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYXN0LmdlbmVyaWNUeXBlKHR5cGUsIG9wdC50eXBlcyk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjODEgPSBmdW5jdGlvbihoZWFkLCB0YWlsKSB7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IFtoZWFkXTtcbiAgICAgICAgICB1dGlsLmV4dGVuZEFycmF5KHJlc3VsdCwgdGFpbCk7XG4gICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM4MiA9IHZvaWQgMCxcbiAgICAgICAgcGVnJGM4MyA9IGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIGFzdC52YXJpYWJsZShuYW1lKTsgfSxcbiAgICAgICAgcGVnJGM4NCA9IGZ1bmN0aW9uKGV4cHJlc3Npb24pIHsgcmV0dXJuIGV4cHJlc3Npb247IH0sXG4gICAgICAgIHBlZyRjODUgPSBcIltcIixcbiAgICAgICAgcGVnJGM4NiA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIltcIiwgZGVzY3JpcHRpb246IFwiXFxcIltcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4NyA9IFwiXVwiLFxuICAgICAgICBwZWckYzg4ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiXVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiXVxcXCJcIiB9LFxuICAgICAgICBwZWckYzg5ID0gZnVuY3Rpb24obmFtZSkgeyByZXR1cm4gbmFtZTsgfSxcbiAgICAgICAgcGVnJGM5MCA9IFwiLlwiLFxuICAgICAgICBwZWckYzkxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiLlxcXCJcIiB9LFxuICAgICAgICBwZWckYzkyID0gZnVuY3Rpb24oYmFzZSwgYWNjZXNzb3JzKSB7XG4gICAgICAgICAgICAgIHZhciByZXN1bHQgPSBiYXNlO1xuICAgICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFjY2Vzc29ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBleHAgPSB0eXBlb2YgYWNjZXNzb3JzW2ldID09ICdzdHJpbmcnID8gYXN0LnN0cmluZyhhY2Nlc3NvcnNbaV0pIDogYWNjZXNzb3JzW2ldO1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGFzdC5yZWZlcmVuY2UocmVzdWx0LCBleHApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzkzID0gZnVuY3Rpb24ocmVmLCBhcmdzKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFzdC5jYWxsKHJlZiwgYXJncyk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjOTQgPSBmdW5jdGlvbihhcmdzKSB7IHJldHVybiBhcmdzIH0sXG4gICAgICAgIHBlZyRjOTUgPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiBuYW1lIH0sXG4gICAgICAgIHBlZyRjOTYgPSBmdW5jdGlvbihiYXNlLCBhcmd1bWVudHNPckFjY2Vzc29ycykge1xuICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYmFzZTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcmd1bWVudHNPckFjY2Vzc29ycy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIHZhciBwYXJ0ID0gYXJndW1lbnRzT3JBY2Nlc3NvcnNbaV07XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXJ0ID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICByZXN1bHQgPSBhc3QucmVmZXJlbmNlKHJlc3VsdCwgYXN0LnN0cmluZyhwYXJ0KSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh1dGlsLmlzVHlwZShwYXJ0LCAnYXJyYXknKSkge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXN0LmNhbGwocmVzdWx0LCBwYXJ0KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXN0LnJlZmVyZW5jZShyZXN1bHQsIHBhcnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM5NyA9IGZ1bmN0aW9uKGFyZ3MpIHtcbiAgICAgICAgICByZXR1cm4gYXJncyAhPT0gbnVsbCA/IGFyZ3MgOiBbXTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGM5OCA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgICB0YWlsLnVuc2hpZnQoaGVhZCk7XG4gICAgICAgICAgcmV0dXJuIHRhaWw7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjOTkgPSBmdW5jdGlvbihvcCwgZXhwcmVzc2lvbikge1xuICAgICAgICAgICAgICBpZiAob3AgPT0gXCJub29wXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gYXN0Lm9wKG9wLCBbZXhwcmVzc2lvbl0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxMDAgPSBcIitcIixcbiAgICAgICAgcGVnJGMxMDEgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIrXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIrXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTAyID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIm5vb3BcIjsgfSxcbiAgICAgICAgcGVnJGMxMDMgPSBcIi1cIixcbiAgICAgICAgcGVnJGMxMDQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCItXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCItXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTA1ID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIm5lZ1wiOyB9LFxuICAgICAgICBwZWckYzEwNiA9IFwiIVwiLFxuICAgICAgICBwZWckYzEwNyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiFcIiwgZGVzY3JpcHRpb246IFwiXFxcIiFcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMDggPSBmdW5jdGlvbihvcCwgZXhwKSB7IHJldHVybiB7b3A6IG9wLCBleHA6IGV4cH07IH0sXG4gICAgICAgIHBlZyRjMTA5ID0gZnVuY3Rpb24oaGVhZCwgdGFpbCkge1xuICAgICAgICAgICAgICByZXR1cm4gbGVmdEFzc29jaWF0aXZlKGhlYWQsIHRhaWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxMTAgPSBcIiVcIixcbiAgICAgICAgcGVnJGMxMTEgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIlXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIlXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTEyID0gXCI8PVwiLFxuICAgICAgICBwZWckYzExMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIjw9XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI8PVxcXCJcIiB9LFxuICAgICAgICBwZWckYzExNCA9IFwiPj1cIixcbiAgICAgICAgcGVnJGMxMTUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI+PVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPj1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMTYgPSBcIj09PVwiLFxuICAgICAgICBwZWckYzExNyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIj09PVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPT09XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTE4ID0gXCI9PVwiLFxuICAgICAgICBwZWckYzExOSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIj09XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI9PVxcXCJcIiB9LFxuICAgICAgICBwZWckYzEyMCA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCI9PVwiOyB9LFxuICAgICAgICBwZWckYzEyMSA9IGZ1bmN0aW9uKCkgeyBlcnJvcihcIkVxdWFsaXR5IG9wZXJhdG9yIHNob3VsZCBiZSB3cml0dGVuIGFzID09LCBub3QgPS5cIik7ICByZXR1cm4gXCI9PVwiOyB9LFxuICAgICAgICBwZWckYzEyMiA9IFwiIT09XCIsXG4gICAgICAgIHBlZyRjMTIzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiIT09XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIhPT1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMjQgPSBcIiE9XCIsXG4gICAgICAgIHBlZyRjMTI1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiIT1cIiwgZGVzY3JpcHRpb246IFwiXFxcIiE9XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTI2ID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIiE9XCI7IH0sXG4gICAgICAgIHBlZyRjMTI3ID0gXCImJlwiLFxuICAgICAgICBwZWckYzEyOCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiYmXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCImJlxcXCJcIiB9LFxuICAgICAgICBwZWckYzEyOSA9IFwiYW5kXCIsXG4gICAgICAgIHBlZyRjMTMwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiYW5kXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJhbmRcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMzEgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwiJiZcIjsgfSxcbiAgICAgICAgcGVnJGMxMzIgPSBcInx8XCIsXG4gICAgICAgIHBlZyRjMTMzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifHxcIiwgZGVzY3JpcHRpb246IFwiXFxcInx8XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTM0ID0gXCJvclwiLFxuICAgICAgICBwZWckYzEzNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIm9yXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJvclxcXCJcIiB9LFxuICAgICAgICBwZWckYzEzNiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJ8fFwiOyB9LFxuICAgICAgICBwZWckYzEzNyA9IFwiP1wiLFxuICAgICAgICBwZWckYzEzOCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIj9cIiwgZGVzY3JpcHRpb246IFwiXFxcIj9cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMzkgPSBmdW5jdGlvbihjb25kaXRpb24sIHRydWVFeHByZXNzaW9uLCBmYWxzZUV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGFzdC5vcCgnPzonLCBbY29uZGl0aW9uLCB0cnVlRXhwcmVzc2lvbiwgZmFsc2VFeHByZXNzaW9uXSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzE0MCA9IFwibnVsbFwiLFxuICAgICAgICBwZWckYzE0MSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIm51bGxcIiwgZGVzY3JpcHRpb246IFwiXFxcIm51bGxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNDIgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGFzdC5udWxsVHlwZSgpIH0sXG4gICAgICAgIHBlZyRjMTQzID0gZnVuY3Rpb24oZWxlbWVudHMpIHsgcmV0dXJuIGFzdC5hcnJheShlbGVtZW50cyk7IH0sXG4gICAgICAgIHBlZyRjMTQ0ID0gXCJ0cnVlXCIsXG4gICAgICAgIHBlZyRjMTQ1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwidHJ1ZVwiLCBkZXNjcmlwdGlvbjogXCJcXFwidHJ1ZVxcXCJcIiB9LFxuICAgICAgICBwZWckYzE0NiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gYXN0LmJvb2xlYW4odHJ1ZSk7IH0sXG4gICAgICAgIHBlZyRjMTQ3ID0gXCJmYWxzZVwiLFxuICAgICAgICBwZWckYzE0OCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcImZhbHNlXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJmYWxzZVxcXCJcIiB9LFxuICAgICAgICBwZWckYzE0OSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gYXN0LmJvb2xlYW4oZmFsc2UpOyB9LFxuICAgICAgICBwZWckYzE1MCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJudW1iZXJcIiB9LFxuICAgICAgICBwZWckYzE1MSA9IC9eWytcXC1dLyxcbiAgICAgICAgcGVnJGMxNTIgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWytcXFxcLV1cIiwgZGVzY3JpcHRpb246IFwiWytcXFxcLV1cIiB9LFxuICAgICAgICBwZWckYzE1MyA9IGZ1bmN0aW9uKHVuYXJ5LCBsaXRlcmFsKSB7XG4gICAgICAgICAgICAgIGlmICh1bmFyeSA9PSAnLScpIHtcbiAgICAgICAgICAgICAgICAgcmV0dXJuIGFzdC5udW1iZXIoLWxpdGVyYWwpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBhc3QubnVtYmVyKGxpdGVyYWwpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxNTQgPSBmdW5jdGlvbihwYXJ0cykge1xuICAgICAgICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChwYXJ0cyk7XG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzE1NSA9IGZ1bmN0aW9uKHBhcnRzKSB7IHJldHVybiBwYXJzZUZsb2F0KHBhcnRzKTsgfSxcbiAgICAgICAgcGVnJGMxNTYgPSBcIjBcIixcbiAgICAgICAgcGVnJGMxNTcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIwXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIwXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTU4ID0gL15bMC05XS8sXG4gICAgICAgIHBlZyRjMTU5ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlswLTldXCIsIGRlc2NyaXB0aW9uOiBcIlswLTldXCIgfSxcbiAgICAgICAgcGVnJGMxNjAgPSAvXlsxLTldLyxcbiAgICAgICAgcGVnJGMxNjEgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzEtOV1cIiwgZGVzY3JpcHRpb246IFwiWzEtOV1cIiB9LFxuICAgICAgICBwZWckYzE2MiA9IC9eW2VFXS8sXG4gICAgICAgIHBlZyRjMTYzID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIltlRV1cIiwgZGVzY3JpcHRpb246IFwiW2VFXVwiIH0sXG4gICAgICAgIHBlZyRjMTY0ID0gL15bXFwtK10vLFxuICAgICAgICBwZWckYzE2NSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXFxcXC0rXVwiLCBkZXNjcmlwdGlvbjogXCJbXFxcXC0rXVwiIH0sXG4gICAgICAgIHBlZyRjMTY2ID0gL15beFhdLyxcbiAgICAgICAgcGVnJGMxNjcgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW3hYXVwiLCBkZXNjcmlwdGlvbjogXCJbeFhdXCIgfSxcbiAgICAgICAgcGVnJGMxNjggPSBmdW5jdGlvbihkaWdpdHMpIHsgcmV0dXJuIHBhcnNlSW50KGRpZ2l0cywgMTYpOyB9LFxuICAgICAgICBwZWckYzE2OSA9IC9eWzAtOWEtZkEtRl0vLFxuICAgICAgICBwZWckYzE3MCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbMC05YS1mQS1GXVwiLCBkZXNjcmlwdGlvbjogXCJbMC05YS1mQS1GXVwiIH0sXG4gICAgICAgIHBlZyRjMTcxID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcInJlZ2V4cFwiIH0sXG4gICAgICAgIHBlZyRjMTcyID0gL15bYS16XS8sXG4gICAgICAgIHBlZyRjMTczID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlthLXpdXCIsIGRlc2NyaXB0aW9uOiBcIlthLXpdXCIgfSxcbiAgICAgICAgcGVnJGMxNzQgPSBmdW5jdGlvbihwYXR0ZXJuLCBtb2RpZmllcnMpIHtcbiAgICAgICAgICBpZiAobW9kaWZpZXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gYXN0LnJlZ2V4cChwYXR0ZXJuLCBtb2RpZmllcnMuam9pbihcIlwiKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBhc3QucmVnZXhwKHBhdHRlcm4pO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzE3NSA9IC9eW15cXFxcXFwvXS8sXG4gICAgICAgIHBlZyRjMTc2ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlteXFxcXFxcXFxcXFxcL11cIiwgZGVzY3JpcHRpb246IFwiW15cXFxcXFxcXFxcXFwvXVwiIH0sXG4gICAgICAgIHBlZyRjMTc3ID0gZnVuY3Rpb24oY2hhcnMpIHsgcmV0dXJuIGNoYXJzLmpvaW4oXCJcIik7IH0sXG4gICAgICAgIHBlZyRjMTc4ID0gXCJcXFxcXCIsXG4gICAgICAgIHBlZyRjMTc5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiXFxcXFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiXFxcXFxcXFxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxODAgPSB7IHR5cGU6IFwiYW55XCIsIGRlc2NyaXB0aW9uOiBcImFueSBjaGFyYWN0ZXJcIiB9LFxuICAgICAgICBwZWckYzE4MSA9IGZ1bmN0aW9uKGNoYXJfKSB7IHJldHVybiBcIlxcXFxcIiArIGNoYXJfOyB9LFxuICAgICAgICBwZWckYzE4MiA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJzdHJpbmdcIiB9LFxuICAgICAgICBwZWckYzE4MyA9IGZ1bmN0aW9uKHMpIHsgcmV0dXJuIGFzdC5zdHJpbmcocyk7IH0sXG4gICAgICAgIHBlZyRjMTg0ID0gXCJcXFwiXCIsXG4gICAgICAgIHBlZyRjMTg1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiXFxcIlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiXFxcXFxcXCJcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxODYgPSBcIidcIixcbiAgICAgICAgcGVnJGMxODcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCInXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCInXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTg4ID0gZnVuY3Rpb24ocGFydHMpIHtcbiAgICAgICAgICAgIHJldHVybiBwYXJ0c1sxXTtcbiAgICAgICAgICB9LFxuICAgICAgICBwZWckYzE4OSA9IGZ1bmN0aW9uKGNoYXJfKSB7IHJldHVybiBjaGFyXzsgICAgIH0sXG4gICAgICAgIHBlZyRjMTkwID0gZnVuY3Rpb24oc2VxdWVuY2UpIHsgcmV0dXJuIHNlcXVlbmNlOyAgfSxcbiAgICAgICAgcGVnJGMxOTEgPSBmdW5jdGlvbihzZXF1ZW5jZSkgeyByZXR1cm4gc2VxdWVuY2U7IH0sXG4gICAgICAgIHBlZyRjMTkyID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIlxcMFwiOyB9LFxuICAgICAgICBwZWckYzE5MyA9IC9eWydcIlxcXFxiZm5ydF0vLFxuICAgICAgICBwZWckYzE5NCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbJ1xcXCJcXFxcXFxcXGJmbnJ0XVwiLCBkZXNjcmlwdGlvbjogXCJbJ1xcXCJcXFxcXFxcXGJmbnJ0XVwiIH0sXG4gICAgICAgIHBlZyRjMTk1ID0gZnVuY3Rpb24oY2hhcl8pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGNoYXJfXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCJiXCIsIFwiXFxiXCIpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCJmXCIsIFwiXFxmXCIpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCJuXCIsIFwiXFxuXCIpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCJyXCIsIFwiXFxyXCIpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoXCJ0XCIsIFwiXFx0XCIpXG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzE5NiA9IGZ1bmN0aW9uKGNoYXJfKSB7IHJldHVybiBjaGFyXzsgfSxcbiAgICAgICAgcGVnJGMxOTcgPSBcInhcIixcbiAgICAgICAgcGVnJGMxOTggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ4XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ4XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTk5ID0gXCJ1XCIsXG4gICAgICAgIHBlZyRjMjAwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwidVwiLCBkZXNjcmlwdGlvbjogXCJcXFwidVxcXCJcIiB9LFxuICAgICAgICBwZWckYzIwMSA9IGZ1bmN0aW9uKGRpZ2l0cykge1xuICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZShwYXJzZUludChkaWdpdHMsIDE2KSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzIwMiA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJpZGVudGlmaWVyXCIgfSxcbiAgICAgICAgcGVnJGMyMDMgPSAvXlthLXpBLVpfJF0vLFxuICAgICAgICBwZWckYzIwNCA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbYS16QS1aXyRdXCIsIGRlc2NyaXB0aW9uOiBcIlthLXpBLVpfJF1cIiB9LFxuICAgICAgICBwZWckYzIwNSA9IC9eW2EtekEtWl8kMC05XS8sXG4gICAgICAgIHBlZyRjMjA2ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlthLXpBLVpfJDAtOV1cIiwgZGVzY3JpcHRpb246IFwiW2EtekEtWl8kMC05XVwiIH0sXG4gICAgICAgIHBlZyRjMjA3ID0gZnVuY3Rpb24oc3RhcnQsIHJlc3QpIHtcbiAgICAgICAgICByZXR1cm4gc3RhcnQgKyByZXN0LmpvaW4oXCJcIik7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjMjA4ID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcIndoaXRlc3BhY2VcIiB9LFxuICAgICAgICBwZWckYzIwOSA9IC9eWyBcXHRcXHJcXG5dLyxcbiAgICAgICAgcGVnJGMyMTAgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWyBcXFxcdFxcXFxyXFxcXG5dXCIsIGRlc2NyaXB0aW9uOiBcIlsgXFxcXHRcXFxcclxcXFxuXVwiIH0sXG4gICAgICAgIHBlZyRjMjExID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcImNvbW1lbnRcIiB9LFxuICAgICAgICBwZWckYzIxMiA9IFwiLypcIixcbiAgICAgICAgcGVnJGMyMTMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIvKlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiLypcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMTQgPSBcIiovXCIsXG4gICAgICAgIHBlZyRjMjE1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKi9cIiwgZGVzY3JpcHRpb246IFwiXFxcIiovXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjE2ID0gXCIvL1wiLFxuICAgICAgICBwZWckYzIxNyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi8vXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIvL1xcXCJcIiB9LFxuICAgICAgICBwZWckYzIxOCA9IC9eWzssfV0vLFxuICAgICAgICBwZWckYzIxOSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbOyx9XVwiLCBkZXNjcmlwdGlvbjogXCJbOyx9XVwiIH0sXG4gICAgICAgIHBlZyRjMjIwID0gZnVuY3Rpb24oY2hhcnMpIHsgcmV0dXJuIGNoYXJzLmpvaW4oJycpOyB9LFxuICAgICAgICBwZWckYzIyMSA9IC9eW1xcblxccl0vLFxuICAgICAgICBwZWckYzIyMiA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXFxcXG5cXFxccl1cIiwgZGVzY3JpcHRpb246IFwiW1xcXFxuXFxcXHJdXCIgfSxcblxuICAgICAgICBwZWckY3VyclBvcyAgICAgICAgICA9IDAsXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyAgICAgID0gMCxcbiAgICAgICAgcGVnJGNhY2hlZFBvcyAgICAgICAgPSAwLFxuICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH0sXG4gICAgICAgIHBlZyRtYXhGYWlsUG9zICAgICAgID0gMCxcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCAgPSBbXSxcbiAgICAgICAgcGVnJHNpbGVudEZhaWxzICAgICAgPSAwLFxuXG4gICAgICAgIHBlZyRyZXN1bHQ7XG5cbiAgICBpZiAoXCJzdGFydFJ1bGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICBpZiAoIShvcHRpb25zLnN0YXJ0UnVsZSBpbiBwZWckc3RhcnRSdWxlRnVuY3Rpb25zKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBzdGFydCBwYXJzaW5nIGZyb20gcnVsZSBcXFwiXCIgKyBvcHRpb25zLnN0YXJ0UnVsZSArIFwiXFxcIi5cIik7XG4gICAgICB9XG5cbiAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbiA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbnNbb3B0aW9ucy5zdGFydFJ1bGVdO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRleHQoKSB7XG4gICAgICByZXR1cm4gaW5wdXQuc3Vic3RyaW5nKHBlZyRyZXBvcnRlZFBvcywgcGVnJGN1cnJQb3MpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9mZnNldCgpIHtcbiAgICAgIHJldHVybiBwZWckcmVwb3J0ZWRQb3M7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGluZSgpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5saW5lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvbHVtbigpIHtcbiAgICAgIHJldHVybiBwZWckY29tcHV0ZVBvc0RldGFpbHMocGVnJHJlcG9ydGVkUG9zKS5jb2x1bW47XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXhwZWN0ZWQoZGVzY3JpcHRpb24pIHtcbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihcbiAgICAgICAgbnVsbCxcbiAgICAgICAgW3sgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gfV0sXG4gICAgICAgIHBlZyRyZXBvcnRlZFBvc1xuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBlcnJvcihtZXNzYWdlKSB7XG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24obWVzc2FnZSwgbnVsbCwgcGVnJHJlcG9ydGVkUG9zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckY29tcHV0ZVBvc0RldGFpbHMocG9zKSB7XG4gICAgICBmdW5jdGlvbiBhZHZhbmNlKGRldGFpbHMsIHN0YXJ0UG9zLCBlbmRQb3MpIHtcbiAgICAgICAgdmFyIHAsIGNoO1xuXG4gICAgICAgIGZvciAocCA9IHN0YXJ0UG9zOyBwIDwgZW5kUG9zOyBwKyspIHtcbiAgICAgICAgICBjaCA9IGlucHV0LmNoYXJBdChwKTtcbiAgICAgICAgICBpZiAoY2ggPT09IFwiXFxuXCIpIHtcbiAgICAgICAgICAgIGlmICghZGV0YWlscy5zZWVuQ1IpIHsgZGV0YWlscy5saW5lKys7IH1cbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfSBlbHNlIGlmIChjaCA9PT0gXCJcXHJcIiB8fCBjaCA9PT0gXCJcXHUyMDI4XCIgfHwgY2ggPT09IFwiXFx1MjAyOVwiKSB7XG4gICAgICAgICAgICBkZXRhaWxzLmxpbmUrKztcbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uID0gMTtcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGV0YWlscy5jb2x1bW4rKztcbiAgICAgICAgICAgIGRldGFpbHMuc2VlbkNSID0gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwZWckY2FjaGVkUG9zICE9PSBwb3MpIHtcbiAgICAgICAgaWYgKHBlZyRjYWNoZWRQb3MgPiBwb3MpIHtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zID0gMDtcbiAgICAgICAgICBwZWckY2FjaGVkUG9zRGV0YWlscyA9IHsgbGluZTogMSwgY29sdW1uOiAxLCBzZWVuQ1I6IGZhbHNlIH07XG4gICAgICAgIH1cbiAgICAgICAgYWR2YW5jZShwZWckY2FjaGVkUG9zRGV0YWlscywgcGVnJGNhY2hlZFBvcywgcG9zKTtcbiAgICAgICAgcGVnJGNhY2hlZFBvcyA9IHBvcztcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBlZyRjYWNoZWRQb3NEZXRhaWxzO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRmYWlsKGV4cGVjdGVkKSB7XG4gICAgICBpZiAocGVnJGN1cnJQb3MgPCBwZWckbWF4RmFpbFBvcykgeyByZXR1cm47IH1cblxuICAgICAgaWYgKHBlZyRjdXJyUG9zID4gcGVnJG1heEZhaWxQb3MpIHtcbiAgICAgICAgcGVnJG1heEZhaWxQb3MgPSBwZWckY3VyclBvcztcbiAgICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZCA9IFtdO1xuICAgICAgfVxuXG4gICAgICBwZWckbWF4RmFpbEV4cGVjdGVkLnB1c2goZXhwZWN0ZWQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRidWlsZEV4Y2VwdGlvbihtZXNzYWdlLCBleHBlY3RlZCwgcG9zKSB7XG4gICAgICBmdW5jdGlvbiBjbGVhbnVwRXhwZWN0ZWQoZXhwZWN0ZWQpIHtcbiAgICAgICAgdmFyIGkgPSAxO1xuXG4gICAgICAgIGV4cGVjdGVkLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgIGlmIChhLmRlc2NyaXB0aW9uIDwgYi5kZXNjcmlwdGlvbikge1xuICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgIH0gZWxzZSBpZiAoYS5kZXNjcmlwdGlvbiA+IGIuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHdoaWxlIChpIDwgZXhwZWN0ZWQubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKGV4cGVjdGVkW2kgLSAxXSA9PT0gZXhwZWN0ZWRbaV0pIHtcbiAgICAgICAgICAgIGV4cGVjdGVkLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBidWlsZE1lc3NhZ2UoZXhwZWN0ZWQsIGZvdW5kKSB7XG4gICAgICAgIGZ1bmN0aW9uIHN0cmluZ0VzY2FwZShzKSB7XG4gICAgICAgICAgZnVuY3Rpb24gaGV4KGNoKSB7IHJldHVybiBjaC5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpOyB9XG5cbiAgICAgICAgICByZXR1cm4gc1xuICAgICAgICAgICAgLnJlcGxhY2UoL1xcXFwvZywgICAnXFxcXFxcXFwnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1wiL2csICAgICdcXFxcXCInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xceDA4L2csICdcXFxcYicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFx0L2csICAgJ1xcXFx0JylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgICAnXFxcXG4nKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcZi9nLCAgICdcXFxcZicpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxyL2csICAgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx4MDAtXFx4MDdcXHgwQlxceDBFXFx4MEZdL2csIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgwJyArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xceDEwLVxceDFGXFx4ODAtXFx4RkZdL2csICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHgnICArIGhleChjaCk7IH0pXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xcdTAxODAtXFx1MEZGRl0vZywgICAgICAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx1MCcgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHUxMDgwLVxcdUZGRkZdL2csICAgICAgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxcdScgICsgaGV4KGNoKTsgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZXhwZWN0ZWREZXNjcyA9IG5ldyBBcnJheShleHBlY3RlZC5sZW5ndGgpLFxuICAgICAgICAgICAgZXhwZWN0ZWREZXNjLCBmb3VuZERlc2MsIGk7XG5cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGV4cGVjdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgZXhwZWN0ZWREZXNjc1tpXSA9IGV4cGVjdGVkW2ldLmRlc2NyaXB0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgZXhwZWN0ZWREZXNjID0gZXhwZWN0ZWQubGVuZ3RoID4gMVxuICAgICAgICAgID8gZXhwZWN0ZWREZXNjcy5zbGljZSgwLCAtMSkuam9pbihcIiwgXCIpXG4gICAgICAgICAgICAgICsgXCIgb3IgXCJcbiAgICAgICAgICAgICAgKyBleHBlY3RlZERlc2NzW2V4cGVjdGVkLmxlbmd0aCAtIDFdXG4gICAgICAgICAgOiBleHBlY3RlZERlc2NzWzBdO1xuXG4gICAgICAgIGZvdW5kRGVzYyA9IGZvdW5kID8gXCJcXFwiXCIgKyBzdHJpbmdFc2NhcGUoZm91bmQpICsgXCJcXFwiXCIgOiBcImVuZCBvZiBpbnB1dFwiO1xuXG4gICAgICAgIHJldHVybiBcIkV4cGVjdGVkIFwiICsgZXhwZWN0ZWREZXNjICsgXCIgYnV0IFwiICsgZm91bmREZXNjICsgXCIgZm91bmQuXCI7XG4gICAgICB9XG5cbiAgICAgIHZhciBwb3NEZXRhaWxzID0gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBvcyksXG4gICAgICAgICAgZm91bmQgICAgICA9IHBvcyA8IGlucHV0Lmxlbmd0aCA/IGlucHV0LmNoYXJBdChwb3MpIDogbnVsbDtcblxuICAgICAgaWYgKGV4cGVjdGVkICE9PSBudWxsKSB7XG4gICAgICAgIGNsZWFudXBFeHBlY3RlZChleHBlY3RlZCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBuZXcgU3ludGF4RXJyb3IoXG4gICAgICAgIG1lc3NhZ2UgIT09IG51bGwgPyBtZXNzYWdlIDogYnVpbGRNZXNzYWdlKGV4cGVjdGVkLCBmb3VuZCksXG4gICAgICAgIGV4cGVjdGVkLFxuICAgICAgICBmb3VuZCxcbiAgICAgICAgcG9zLFxuICAgICAgICBwb3NEZXRhaWxzLmxpbmUsXG4gICAgICAgIHBvc0RldGFpbHMuY29sdW1uXG4gICAgICApO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZXN0YXJ0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VfKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VTdGF0ZW1lbnRzKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMSgpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVN0YXRlbWVudHMoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gW107XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgczIgPSBwZWckcGFyc2VTdGF0ZW1lbnQoKTtcbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBbczIsIHMzXTtcbiAgICAgICAgICBzMSA9IHMyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMiA9IHBlZyRwYXJzZVN0YXRlbWVudCgpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gW3MyLCBzM107XG4gICAgICAgICAgICBzMSA9IHMyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVN0YXRlbWVudCgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VGdW5jdGlvbigpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlUGF0aCgpO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRwYXJzZVNjaGVtYSgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VGdW5jdGlvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUZ1bmN0aW9uU3RhcnQoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZUZ1bmN0aW9uQm9keSgpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNShzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRnVuY3Rpb25TdGFydCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDgpID09PSBwZWckYzYpIHtcbiAgICAgICAgczEgPSBwZWckYzY7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDg7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZVBhcmFtZXRlckxpc3QoKTtcbiAgICAgICAgICAgICAgaWYgKHM1ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM4KHMzLCBzNSk7XG4gICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlUGFyYW1ldGVyTGlzdCgpO1xuICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjOShzMSwgczMpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUGF0aCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4O1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZVBhdGhTdGFydCgpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMzID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTEpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGMxMTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMjtcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMTMoczYpO1xuICAgICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyMykge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjMTQ7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VQYXRoc0FuZE1ldGhvZHMoKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTI1KSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJGMxNjtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHM0O1xuICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMTgoczcpO1xuICAgICAgICAgICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA1OSkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMxOTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjApOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzIxKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzIyKHMxLCBzMiwgczQpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVBhdGhTdGFydCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDQpID09PSBwZWckYzIzKSB7XG4gICAgICAgIHMxID0gcGVnJGMyMztcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gNDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI0KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VQYXRoVGVtcGxhdGUoKTtcbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzI1KHMzKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBwZWckcGFyc2VQYXRoVGVtcGxhdGUoKTtcbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzI2KHMxKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUGF0aFRlbXBsYXRlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNDtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ3KSB7XG4gICAgICAgIHMzID0gcGVnJGMyODtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlUGF0aEtleSgpO1xuICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNCA9IHBlZyRjNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMjtcbiAgICAgICAgICBzMyA9IHBlZyRjMzAoczQpO1xuICAgICAgICAgIHMyID0gczM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ3KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMjg7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjkpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VQYXRoS2V5KCk7XG4gICAgICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckYzQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMzMChzNCk7XG4gICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMzMShzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjcpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQYXRoS2V5KCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZUNhcHR1cmVLZXkoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUxpdGVyYWxQYXRoS2V5KCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VDYXB0dXJlS2V5KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczgsIHM5O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjMpIHtcbiAgICAgICAgczEgPSBwZWckYzE0O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MSkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMzMjtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzMpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQyKSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJGMzNDtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM1KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzNiA9IFtzNiwgczcsIHM4LCBzOV07XG4gICAgICAgICAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTI1KSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMTY7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTcpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMzYoczMpO1xuICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUxpdGVyYWxQYXRoS2V5KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgaWYgKHBlZyRjMzcudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzOCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgICBpZiAocGVnJGMzNy50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzgpOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzM5KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQYXRoc0FuZE1ldGhvZHMoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBzMiA9IHBlZyRwYXJzZVBhdGgoKTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZU1ldGhvZCgpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUFueUJsb2NrKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgczIgPSBwZWckcGFyc2VQYXRoKCk7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlTWV0aG9kKCk7XG4gICAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRwYXJzZUFueUJsb2NrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM0MChzMSk7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNjaGVtYSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOSwgczEwLCBzMTE7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDQpID09PSBwZWckYzQyKSB7XG4gICAgICAgIHMxID0gcGVnJGM0MjtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gNDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQzKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNDQ7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0NSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZUlkZW50aWZpZXJMaXN0KCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjIpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGM0NjtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0Nyk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzNDtcbiAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM0OChzNik7XG4gICAgICAgICAgICAgICAgICBzNCA9IHM1O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGM0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNykgPT09IHBlZyRjNDkpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGM0OTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1MCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzMTAgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMxMCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczU7XG4gICAgICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjNTEoczkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczUgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM1O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyMykge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRjMTQ7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNSk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczEwID0gcGVnJHBhcnNlUHJvcGVydGllc0FuZE1ldGhvZHMoKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczEwICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzMTEgPSBwZWckYzE2O1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczExID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3KTsgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHMxMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzE4KHMxMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHM2ID0gczc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDU5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgczggPSBwZWckYzE5O1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMCk7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjNTIoKTtcbiAgICAgICAgICAgICAgICAgICAgICBzNiA9IHM3O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGM0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzUzKHMzLCBzNCwgczUsIHM2KTtcbiAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0MSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVByb3BlcnRpZXNBbmRNZXRob2RzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgczIgPSBwZWckcGFyc2VQcm9wZXJ0eSgpO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlTWV0aG9kKCk7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlQW55QmxvY2soKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxLnB1c2goczIpO1xuICAgICAgICBzMiA9IHBlZyRwYXJzZVByb3BlcnR5KCk7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlTWV0aG9kKCk7XG4gICAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRwYXJzZUFueUJsb2NrKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM1NChzMSk7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVByb3BlcnR5KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlU3RyaW5nKCk7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTgpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM1NTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1Nik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZVR5cGVFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VQcm9wU2VwKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1NyhzMSwgczUpO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQcm9wU2VwKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ0KSB7XG4gICAgICAgIHMxID0gcGVnJGM1ODtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTkpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMTk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwKTsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzQ7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM2MChzMSk7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU1ldGhvZCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZVBhcmFtZXRlckxpc3QoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZUZ1bmN0aW9uQm9keSgpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlUHJvcFNlcCgpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjIoczEsIHMyLCBzNCwgczUpO1xuICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2MSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUZ1bmN0aW9uQm9keSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTIzKSB7XG4gICAgICAgIHMxID0gcGVnJGMxNDtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDYpID09PSBwZWckYzYzKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjNjM7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSA2O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjQpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gW3M0LCBzNV07XG4gICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTkpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMxOTtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMCk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjNDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNSkge1xuICAgICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJGMxNjtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTcpOyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NShzNCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjEpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMzI7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMzKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDU5KSB7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzE5O1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjNDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzY2KHMzKTtcbiAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUGFyYW1ldGVyTGlzdCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQ7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQwKSB7XG4gICAgICAgIHMxID0gcGVnJGM2NztcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY4KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlSWRlbnRpZmllckxpc3QoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MSkge1xuICAgICAgICAgICAgczMgPSBwZWckYzY5O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcwKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjNzEoczIpO1xuICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VJZGVudGlmaWVyTGlzdCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjNDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICAgICAgczUgPSBwZWckYzU4O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU5KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTMoczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNTg7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMyhzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNzIoczEsIHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZVNpbmdsZVR5cGUoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJGM3MztcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3NCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVNpbmdsZVR5cGUoKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzUxKHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTI0KSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGM3MztcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc0KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVNpbmdsZVR5cGUoKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzUxKHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM3NShzMSwgczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNpbmdsZVR5cGUoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGM3Nikge1xuICAgICAgICAgIHMzID0gcGVnJGM3NjtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgczMgPSBwZWckYzc4KCk7XG4gICAgICAgIH1cbiAgICAgICAgczIgPSBzMztcbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYwKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDQ7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDUpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VUeXBlTGlzdCgpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYyKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjNDY7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDcpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjNzkoczUpO1xuICAgICAgICAgICAgICAgICAgczIgPSBzMztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgwKHMxLCBzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlVHlwZUxpc3QoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ0KSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjNTg7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTkpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjNTEoczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNTg7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjNTEoczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgxKHMxLCBzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUHJpbWFyeUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMyID0gcGVnJHBhcnNlTGl0ZXJhbCgpO1xuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzgyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjODMoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUxpdGVyYWwoKTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQwKSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNjc7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjgpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQxKSB7XG4gICAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM2OTtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcwKTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjODQoczMpO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU1lbWJlckV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzOCwgczk7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZVByaW1hcnlFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTEpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJGM4NTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Nik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTMpIHtcbiAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzg3O1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODgpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM4OShzNyk7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGM5MDtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkxKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzg5KHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTEpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzg1O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzg3O1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4OCk7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjODkoczcpO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM5MDtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTEpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzg5KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjOTIoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQ2FsbEV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzOCwgczk7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgczIgPSBwZWckcGFyc2VNZW1iZXJFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczMgPSBwZWckcGFyc2VBcmd1bWVudHMoKTtcbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczE7XG4gICAgICAgICAgczIgPSBwZWckYzkzKHMyLCBzMyk7XG4gICAgICAgICAgczEgPSBzMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VBcmd1bWVudHMoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgczQgPSBwZWckYzk0KHM1KTtcbiAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5MSkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjODU7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4Nik7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTMpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRjODc7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg4KTsgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM5NShzNyk7XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ2KSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzkwO1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MSk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjOTUoczcpO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUFyZ3VtZW50cygpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjOTQoczUpO1xuICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5MSkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM4NTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRjODc7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODgpOyB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjOTUoczcpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgICAgczUgPSBwZWckYzkwO1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkxKTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjOTUoczcpO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjOTYoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlTWVtYmVyRXhwcmVzc2lvbigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQXJndW1lbnRzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQwKSB7XG4gICAgICAgIHMxID0gcGVnJGM2NztcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY4KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZUFyZ3VtZW50TGlzdCgpO1xuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MSkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM2OTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzApOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzk3KHMzKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQXJndW1lbnRMaXN0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJGM1ODtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjNjUoczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNTg7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzY1KHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzk4KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVVuYXJ5RXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZUNhbGxFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBwZWckcGFyc2VVbmFyeU9wZXJhdG9yKCk7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlVW5hcnlFeHByZXNzaW9uKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM5OShzMSwgczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VVbmFyeU9wZXJhdG9yKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDMpIHtcbiAgICAgICAgczEgPSBwZWckYzEwMDtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwMSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzEwMigpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ1KSB7XG4gICAgICAgICAgczEgPSBwZWckYzEwMztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTA0KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDUoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDMzKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTA2O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwNyk7IH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZVVuYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlT3BlcmF0b3IoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlVW5hcnlFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlTXVsdGlwbGljYXRpdmVPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVVuYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDkoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTXVsdGlwbGljYXRpdmVPcGVyYXRvcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Mikge1xuICAgICAgICBzMCA9IHBlZyRjMzQ7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzNSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ3KSB7XG4gICAgICAgICAgczAgPSBwZWckYzI4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyOSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM3KSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTEwO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzExMSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZUFkZGl0aXZlT3BlcmF0b3IoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlTXVsdGlwbGljYXRpdmVFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlQWRkaXRpdmVPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDkoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQWRkaXRpdmVPcGVyYXRvcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Mykge1xuICAgICAgICBzMCA9IHBlZyRjMTAwO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTAxKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDUpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjMTAzO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMDQpOyB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVJlbGF0aW9uYWxFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlQWRkaXRpdmVFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlUmVsYXRpb25hbE9wZXJhdG9yKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZVJlbGF0aW9uYWxPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDkoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUmVsYXRpb25hbE9wZXJhdG9yKCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxMTIpIHtcbiAgICAgICAgczAgPSBwZWckYzExMjtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzExMyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxMTQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjMTE0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMTUpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MCkge1xuICAgICAgICAgICAgczAgPSBwZWckYzQ0O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ1KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjIpIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzQ2O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDcpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFcXVhbGl0eUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZUVxdWFsaXR5T3BlcmF0b3IoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VFcXVhbGl0eU9wZXJhdG9yKCk7XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA5KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUVxdWFsaXR5T3BlcmF0b3IoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjMTE2KSB7XG4gICAgICAgIHMxID0gcGVnJGMxMTY7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMTcpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTE4KSB7XG4gICAgICAgICAgczEgPSBwZWckYzExODtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTE5KTsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxMjAoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MSkge1xuICAgICAgICAgIHMxID0gcGVnJGMzMjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzMpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzEyMSgpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjMTIyKSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTIyO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEyMyk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxMjQpIHtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzEyNDtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEyNSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxMjYoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VFcXVhbGl0eUV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VMb2dpY2FsQU5ET3BlcmF0b3IoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlRXF1YWxpdHlFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlTG9naWNhbEFORE9wZXJhdG9yKCk7XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlRXF1YWxpdHlFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzEwOShzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMb2dpY2FsQU5ET3BlcmF0b3IoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTI3KSB7XG4gICAgICAgIHMxID0gcGVnJGMxMjc7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMjgpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMykgPT09IHBlZyRjMTI5KSB7XG4gICAgICAgICAgczEgPSBwZWckYzEyOTtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTMwKTsgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxMzEoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VMb2dpY2FsT1JPcGVyYXRvcigpO1xuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VMb2dpY2FsQU5ERXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUxvZ2ljYWxPUk9wZXJhdG9yKCk7XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA5KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUxvZ2ljYWxPUk9wZXJhdG9yKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzEzMikge1xuICAgICAgICBzMSA9IHBlZyRjMTMyO1xuICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTMzKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzEzNCkge1xuICAgICAgICAgIHMxID0gcGVnJGMxMzQ7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzNSk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTM2KCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczgsIHM5O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjMpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGMxMzc7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTM4KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA1OCkge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjNTU7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1Nik7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzEzOShzMSwgczUsIHM5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VMb2dpY2FsT1JFeHByZXNzaW9uKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZU51bGwoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZUJvb2xlYW5MaXRlcmFsKCk7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJHBhcnNlTnVtZXJpY0xpdGVyYWwoKTtcbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlU3RyaW5nTGl0ZXJhbCgpO1xuICAgICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlQXJyYXlMaXRlcmFsKCk7XG4gICAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlUmVnRXhwKCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU51bGwoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNCkgPT09IHBlZyRjMTQwKSB7XG4gICAgICAgIHMxID0gcGVnJGMxNDA7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNDEpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxNDIoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VBcnJheUxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTEpIHtcbiAgICAgICAgczEgPSBwZWckYzg1O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlQXJndW1lbnRMaXN0KCk7XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkzKSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckYzg3O1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4OCk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMSA9IHBlZyRjMTQzKHMzKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQm9vbGVhbkxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNCkgPT09IHBlZyRjMTQ0KSB7XG4gICAgICAgIHMxID0gcGVnJGMxNDQ7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNDUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxNDYoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgNSkgPT09IHBlZyRjMTQ3KSB7XG4gICAgICAgICAgczEgPSBwZWckYzE0NztcbiAgICAgICAgICBwZWckY3VyclBvcyArPSA1O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTQ4KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxNDkoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTnVtZXJpY0xpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKHBlZyRjMTUxLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTUyKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM0O1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlSGV4SW50ZWdlckxpdGVyYWwoKTtcbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VEZWNpbWFsTGl0ZXJhbCgpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxNTMoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTUwKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRGVjaW1hbExpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgIHMzID0gcGVnJHBhcnNlRGVjaW1hbEludGVnZXJMaXRlcmFsKCk7XG4gICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgIHM0ID0gcGVnJGM5MDtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTEpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VEZWNpbWFsRGlnaXRzKCk7XG4gICAgICAgICAgaWYgKHM1ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZUV4cG9uZW50UGFydCgpO1xuICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJGM0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzID0gW3MzLCBzNCwgczUsIHM2XTtcbiAgICAgICAgICAgICAgczIgPSBzMztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gaW5wdXQuc3Vic3RyaW5nKHMxLCBwZWckY3VyclBvcyk7XG4gICAgICB9XG4gICAgICBzMSA9IHMyO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTU0KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgIHMzID0gcGVnJGM5MDtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTEpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VEZWNpbWFsRGlnaXRzKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUV4cG9uZW50UGFydCgpO1xuICAgICAgICAgICAgaWYgKHM1ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGM0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzID0gW3MzLCBzNCwgczVdO1xuICAgICAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LnN1YnN0cmluZyhzMSwgcGVnJGN1cnJQb3MpO1xuICAgICAgICB9XG4gICAgICAgIHMxID0gczI7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxNTUoczEpO1xuICAgICAgICB9XG4gICAgICAgIHMwID0gczE7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlRGVjaW1hbEludGVnZXJMaXRlcmFsKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZUV4cG9uZW50UGFydCgpO1xuICAgICAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGM0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzID0gW3MzLCBzNF07XG4gICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gaW5wdXQuc3Vic3RyaW5nKHMxLCBwZWckY3VyclBvcyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMxID0gczI7XG4gICAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxNTUoczEpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VEZWNpbWFsSW50ZWdlckxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0OCkge1xuICAgICAgICBzMCA9IHBlZyRjMTU2O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTU3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlTm9uWmVyb0RpZ2l0KCk7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0cygpO1xuICAgICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczEgPSBbczEsIHMyXTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRGVjaW1hbERpZ2l0cygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gW107XG4gICAgICBzMSA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdCgpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICAgIHMxID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0KCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRGVjaW1hbERpZ2l0KCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBpZiAocGVnJGMxNTgudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNTkpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VOb25aZXJvRGlnaXQoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChwZWckYzE2MC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE2MSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUV4cG9uZW50UGFydCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VFeHBvbmVudEluZGljYXRvcigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlU2lnbmVkSW50ZWdlcigpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMSA9IFtzMSwgczJdO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFeHBvbmVudEluZGljYXRvcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKHBlZyRjMTYyLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTYzKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU2lnbmVkSW50ZWdlcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKHBlZyRjMTY0LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTY1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM0O1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0cygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMSA9IFtzMSwgczJdO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VIZXhJbnRlZ2VyTGl0ZXJhbCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0OCkge1xuICAgICAgICBzMSA9IHBlZyRjMTU2O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTU3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChwZWckYzE2Ni50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNjcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IFtdO1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHdoaWxlIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNC5wdXNoKHM1KTtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VIZXhEaWdpdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IGlucHV0LnN1YnN0cmluZyhzMywgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTY4KHMzKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VIZXhEaWdpdCgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKHBlZyRjMTY5LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTcwKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUmVnRXhwKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDcpIHtcbiAgICAgICAgczEgPSBwZWckYzI4O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VSZWdFeHBDaGFyYWN0ZXJzKCk7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJGM0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDcpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGMyODtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyOSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IFtdO1xuICAgICAgICAgICAgaWYgKHBlZyRjMTcyLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTczKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgd2hpbGUgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0LnB1c2goczUpO1xuICAgICAgICAgICAgICBpZiAocGVnJGMxNzIudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgICAgIHM1ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTczKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMxNzQoczIsIHM0KTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTcxKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUmVnRXhwQ2hhcmFjdGVycygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIGlmIChwZWckYzE3NS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3Nik7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZVJlZ0V4cEVzY2FwZWQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgICBpZiAocGVnJGMxNzUudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3Nik7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IHBlZyRwYXJzZVJlZ0V4cEVzY2FwZWQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTc3KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VSZWdFeHBFc2NhcGVkKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgIHMxID0gcGVnJGMxNzg7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzE4MShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZVN0cmluZygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTgzKHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODIpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTdHJpbmcoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzQpIHtcbiAgICAgICAgczIgPSBwZWckYzE4NDtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4NSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMyA9IHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXJhY3RlcnMoKTtcbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzNCkge1xuICAgICAgICAgICAgczQgPSBwZWckYzE4NDtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODUpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBbczIsIHMzLCBzNF07XG4gICAgICAgICAgICBzMSA9IHMyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzkpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMTg2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyYWN0ZXJzKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM5KSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGMxODY7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODcpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczIgPSBbczIsIHMzLCBzNF07XG4gICAgICAgICAgICAgIHMxID0gczI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxODgoczEpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXJhY3RlcnMoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBzMiA9IHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXJhY3RlcigpO1xuICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxLnB1c2goczIpO1xuICAgICAgICBzMiA9IHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXJhY3RlcigpO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTc3KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyYWN0ZXJzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgczIgPSBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyYWN0ZXIoKTtcbiAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgczIgPSBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyYWN0ZXIoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE3NyhzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRG91YmxlU3RyaW5nQ2hhcmFjdGVyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM0KSB7XG4gICAgICAgIHMyID0gcGVnJGMxODQ7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICAgIHMyID0gcGVnJGMxNzg7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZU5ld0xpbmUoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzgyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzE4OShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgICAgczEgPSBwZWckYzE3ODtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTc5KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlRXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzE5MChzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckcGFyc2VMaW5lQ29udGludWF0aW9uKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNpbmdsZVN0cmluZ0NoYXJhY3RlcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzOSkge1xuICAgICAgICBzMiA9IHBlZyRjMTg2O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTg3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTIpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMTc4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4MjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxODkoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICAgIHMxID0gcGVnJGMxNzg7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUVzY2FwZVNlcXVlbmNlKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxOTAoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJHBhcnNlTGluZUNvbnRpbnVhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMaW5lQ29udGludWF0aW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgIHMxID0gcGVnJGMxNzg7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzkpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxOTEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFc2NhcGVTZXF1ZW5jZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckcGFyc2VDaGFyYWN0ZXJFc2NhcGVTZXF1ZW5jZSgpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDgpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMTU2O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNTcpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdCgpO1xuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckYzgyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTkyKCk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckcGFyc2VIZXhFc2NhcGVTZXF1ZW5jZSgpO1xuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczAgPSBwZWckcGFyc2VVbmljb2RlRXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUNoYXJhY3RlckVzY2FwZVNlcXVlbmNlKCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZVNpbmdsZUVzY2FwZUNoYXJhY3RlcigpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlTm9uRXNjYXBlQ2hhcmFjdGVyKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTaW5nbGVFc2NhcGVDaGFyYWN0ZXIoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKHBlZyRjMTkzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTk0KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTk1KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VOb25Fc2NhcGVDaGFyYWN0ZXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMyID0gcGVnJHBhcnNlRXNjYXBlQ2hhcmFjdGVyKCk7XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjODI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRwYXJzZU5ld0xpbmUoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTk2KHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXNjYXBlQ2hhcmFjdGVyKCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBzMCA9IHBlZyRwYXJzZVNpbmdsZUVzY2FwZUNoYXJhY3RlcigpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0KCk7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTIwKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMTk3O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE5OCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExNykge1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMTk5O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjAwKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSGV4RXNjYXBlU2VxdWVuY2UoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTIwKSB7XG4gICAgICAgIHMxID0gcGVnJGMxOTc7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxOTgpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VIZXhEaWdpdCgpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZUhleERpZ2l0KCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IFtzNCwgczVdO1xuICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gaW5wdXQuc3Vic3RyaW5nKHMyLCBwZWckY3VyclBvcyk7XG4gICAgICAgIH1cbiAgICAgICAgczIgPSBzMztcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzIwMShzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVVuaWNvZGVFc2NhcGVTZXF1ZW5jZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDExNykge1xuICAgICAgICBzMSA9IHBlZyRjMTk5O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjAwKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VIZXhEaWdpdCgpO1xuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VIZXhEaWdpdCgpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczQgPSBbczQsIHM1LCBzNiwgczddO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IGlucHV0LnN1YnN0cmluZyhzMiwgcGVnJGN1cnJQb3MpO1xuICAgICAgICB9XG4gICAgICAgIHMyID0gczM7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyMDEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VJZGVudGlmaWVyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAocGVnJGMyMDMudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMDQpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgaWYgKHBlZyRjMjA1LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICBzMyA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwNik7IH1cbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBpZiAocGVnJGMyMDUudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgczMgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwNik7IH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzIwNyhzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMDIpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VfXygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gW107XG4gICAgICBzMSA9IHBlZyRwYXJzZVdoaXRlc3BhY2UoKTtcbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRwYXJzZUNvbW1lbnQoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgICBzMSA9IHBlZyRwYXJzZVdoaXRlc3BhY2UoKTtcbiAgICAgICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMxID0gcGVnJHBhcnNlQ29tbWVudCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VfKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBbXTtcbiAgICAgIHMxID0gcGVnJHBhcnNlV2hpdGVzcGFjZSgpO1xuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlQ29tbWVudCgpO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICBzMSA9IHBlZyRwYXJzZVdoaXRlc3BhY2UoKTtcbiAgICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEgPSBwZWckcGFyc2VDb21tZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVdoaXRlc3BhY2UoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gW107XG4gICAgICBpZiAocGVnJGMyMDkudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTApOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAucHVzaChzMSk7XG4gICAgICAgICAgaWYgKHBlZyRjMjA5LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTApOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwOCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUNvbW1lbnQoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJHBhcnNlTXVsdGlMaW5lQ29tbWVudCgpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlU2luZ2xlTGluZUNvbW1lbnQoKTtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxMSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU11bHRpTGluZUNvbW1lbnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzIxMikge1xuICAgICAgICBzMSA9IHBlZyRjMjEyO1xuICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjEzKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyMTQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRjMjE0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTUpOyB9XG4gICAgICAgIH1cbiAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM0ID0gcGVnJGM4MjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4MCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IFtzNCwgczVdO1xuICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyMTQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJGMyMTQ7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE1KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGM4MjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBbczQsIHM1XTtcbiAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzIxNCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzIxNDtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTUpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczEgPSBbczEsIHMyLCBzM107XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU2luZ2xlTGluZUNvbW1lbnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzIxNikge1xuICAgICAgICBzMSA9IHBlZyRjMjE2O1xuICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICBzNSA9IHBlZyRwYXJzZU5ld0xpbmUoKTtcbiAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM0ID0gcGVnJGM4MjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4MCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IFtzNCwgczVdO1xuICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZU5ld0xpbmUoKTtcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGM4MjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgICAgICBzNSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBbczQsIHM1XTtcbiAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMxID0gW3MxLCBzMl07XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFueUJsb2NrKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNDtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKHBlZyRjMjE4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczQgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE5KTsgfVxuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczMgPSBwZWckYzgyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczQgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgczMgPSBwZWckYzE5NihzNCk7XG4gICAgICAgICAgczIgPSBzMztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgaWYgKHBlZyRjMjE4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTkpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICAgIGlmIChzNCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzgyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4MCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczMgPSBwZWckYzE5NihzNCk7XG4gICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKHBlZyRjMjE4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxOSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzIyMChzMSk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTmV3TGluZSgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKHBlZyRjMjIxLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjIyKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG5cbiAgICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgICB2YXIgYXN0ID0gcmVxdWlyZSgnLi9hc3QnKTtcbiAgICAgIHZhciB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG4gICAgICB2YXIgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcbiAgICAgIHZhciBlcnJvciA9IGxvZ2dlci5lcnJvcjtcbiAgICAgIHZhciB3YXJuID0gbG9nZ2VyLndhcm47XG5cbiAgICAgIGxvZ2dlci5zZXRDb250ZXh0KGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGxpbmU6IGxpbmUoKSxcbiAgICAgICAgICBjb2x1bW46IGNvbHVtbigpXG4gICAgICAgIH07XG4gICAgICB9KTtcblxuICAgICAgLy8gUmV0dXJuIGEgbGVmdC1hc3NvY2lhdGl2ZSBiaW5hcnkgc3RydWN0dXJlXG4gICAgICAvLyBjb25zaXN0aW5nIG9mIGhlYWQgKGV4cCksIGFuZCB0YWlsIChvcCwgZXhwKSouXG4gICAgICBmdW5jdGlvbiBsZWZ0QXNzb2NpYXRpdmUoaGVhZCwgdGFpbCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gaGVhZDtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0YWlsLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgcmVzdWx0ID0gYXN0Lm9wKHRhaWxbaV0ub3AsIFtyZXN1bHQsIHRhaWxbaV0uZXhwXSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgdmFyIHN5bWJvbHMgPSBuZXcgYXN0LlN5bWJvbHMoKTtcblxuICAgICAgdmFyIGN1cnJlbnRQYXRoID0gbmV3IGFzdC5QYXRoVGVtcGxhdGUoKTtcblxuICAgICAgZnVuY3Rpb24gZW5zdXJlTG93ZXJDYXNlKHMsIG0pIHtcbiAgICAgICAgaWYgKHMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgIHMgPSBzLm1hcChmdW5jdGlvbihpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVuc3VyZUxvd2VyQ2FzZShpZCwgbSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIHM7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNhbm9uaWNhbCA9IHNbMF0udG9Mb3dlckNhc2UoKSArIHMuc2xpY2UoMSk7XG4gICAgICAgIGlmIChzICE9IGNhbm9uaWNhbCkge1xuICAgICAgICAgIHdhcm4obSArIFwiIHNob3VsZCBiZWdpbiB3aXRoIGEgbG93ZXJjYXNlIGxldHRlcjogKCdcIiArIHMgKyBcIicgc2hvdWxkIGJlICdcIiArIGNhbm9uaWNhbCArIFwiJykuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBlbnN1cmVVcHBlckNhc2UocywgbSkge1xuICAgICAgICBpZiAocyBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgICAgcyA9IHMubWFwKGZ1bmN0aW9uKGlkKSB7XG4gICAgICAgICAgICByZXR1cm4gZW5zdXJlVXBwZXJDYXNlKGlkLCBtKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm4gcztcbiAgICAgICAgfVxuICAgICAgICB2YXIgY2Fub25pY2FsID0gc1swXS50b1VwcGVyQ2FzZSgpICsgcy5zbGljZSgxKTtcbiAgICAgICAgaWYgKHMgIT0gY2Fub25pY2FsKSB7XG4gICAgICAgICAgd2FybihtICsgXCIgc2hvdWxkIGJlZ2luIHdpdGggYW4gdXBwZXJjYXNlIGxldHRlcjogKCdcIiArIHMgKyBcIicgc2hvdWxkIGJlICdcIiArIGNhbm9uaWNhbCArIFwiJykuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzO1xuICAgICAgfVxuXG5cbiAgICBwZWckcmVzdWx0ID0gcGVnJHN0YXJ0UnVsZUZ1bmN0aW9uKCk7XG5cbiAgICBpZiAocGVnJHJlc3VsdCAhPT0gcGVnJEZBSUxFRCAmJiBwZWckY3VyclBvcyA9PT0gaW5wdXQubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gcGVnJHJlc3VsdDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHBlZyRyZXN1bHQgIT09IHBlZyRGQUlMRUQgJiYgcGVnJGN1cnJQb3MgPCBpbnB1dC5sZW5ndGgpIHtcbiAgICAgICAgcGVnJGZhaWwoeyB0eXBlOiBcImVuZFwiLCBkZXNjcmlwdGlvbjogXCJlbmQgb2YgaW5wdXRcIiB9KTtcbiAgICAgIH1cblxuICAgICAgdGhyb3cgcGVnJGJ1aWxkRXhjZXB0aW9uKG51bGwsIHBlZyRtYXhGYWlsRXhwZWN0ZWQsIHBlZyRtYXhGYWlsUG9zKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4ge1xuICAgIFN5bnRheEVycm9yOiBTeW50YXhFcnJvcixcbiAgICBwYXJzZTogICAgICAgcGFyc2VcbiAgfTtcbn0pKCk7IiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5leHBvcnQgdHlwZSBPYmplY3QgPSB7XG4gIFtwcm9wOiBzdHJpbmddOiBhbnlcbn07XG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kKGRlc3Q6IE9iamVjdCwgLi4uc3JjczogT2JqZWN0W10pOiBPYmplY3Qge1xuICB2YXIgaTogbnVtYmVyO1xuICB2YXIgc291cmNlOiBhbnk7XG4gIHZhciBwcm9wOiBzdHJpbmc7XG5cbiAgaWYgKGRlc3QgPT09IHVuZGVmaW5lZCkge1xuICAgIGRlc3QgPSB7fTtcbiAgfVxuICBmb3IgKGkgPSAwOyBpIDwgc3Jjcy5sZW5ndGg7IGkrKykge1xuICAgIHNvdXJjZSA9IHNyY3NbaV07XG4gICAgZm9yIChwcm9wIGluIHNvdXJjZSkge1xuICAgICAgaWYgKHNvdXJjZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICBkZXN0W3Byb3BdID0gc291cmNlW3Byb3BdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29weUFycmF5KGFyZzogQXJyYXlMaWtlPGFueT4pOiBhbnlbXSB7XG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmcpO1xufVxuXG52YXIgYmFzZVR5cGVzID0gW1xuICAnbnVtYmVyJywgJ3N0cmluZycsICdib29sZWFuJywgJ2FycmF5JywgJ2Z1bmN0aW9uJywgJ2RhdGUnLCAncmVnZXhwJyxcbiAgJ2FyZ3VtZW50cycsICd1bmRlZmluZWQnLCAnbnVsbCdcbl07XG5cbmZ1bmN0aW9uIGludGVybmFsVHlwZSh2YWx1ZTogYW55KTogc3RyaW5nIHtcbiAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSlcbiAgICAgIC5tYXRjaCgvXFxbb2JqZWN0ICguKilcXF0vKVsxXVxuICAgICAgLnRvTG93ZXJDYXNlKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1R5cGUodmFsdWU6IGFueSwgdHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlT2YodmFsdWUpID09PSB0eXBlO1xufVxuXG4vLyBSZXR1cm4gb25lIG9mIHRoZSBiYXNlVHlwZXMgYXMgYSBzdHJpbmdcbmV4cG9ydCBmdW5jdGlvbiB0eXBlT2YodmFsdWU6IGFueSk6IHN0cmluZyB7XG4gIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICd1bmRlZmluZWQnO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgIHJldHVybiAnbnVsbCc7XG4gIH1cbiAgdmFyIHR5cGUgPSBpbnRlcm5hbFR5cGUodmFsdWUpO1xuICBpZiAoIWFycmF5SW5jbHVkZXMoYmFzZVR5cGVzLCB0eXBlKSkge1xuICAgIHR5cGUgPSB0eXBlb2YgdmFsdWU7XG4gIH1cbiAgcmV0dXJuIHR5cGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1RoZW5hYmxlKG9iajogYW55KTogYm9vbGVhbiB7XG4gIHJldHVybiB0eXBlT2Yob2JqKSA9PT0gJ29iamVjdCcgJiYgJ3RoZW4nIGluIG9iaiAmJlxuICAgICAgdHlwZW9mIChvYmoudGhlbikgPT09ICdmdW5jdGlvbic7XG59XG5cbi8vIENvbnZlcnRzIGEgc3luY2hyb25vdXMgZnVuY3Rpb24gdG8gb25lIGFsbG93aW5nIFByb21pc2VzXG4vLyBhcyBhcmd1bWVudHMgYW5kIHJldHVybmluZyBhIFByb21pc2UgdmFsdWUuXG4vL1xuLy8gICBmbihVLCBWLCAuLi4pOiBUID0+IGZuKFUgfCBQcm9taXNlPFU+LCBWIHwgUHJvbWlzZTxWPiwgLi4uKTogUHJvbWlzZTxUPlxuZXhwb3J0IGZ1bmN0aW9uIGxpZnQ8VD4oZm46ICguLi5hcmdzOiBhbnlbXSkgPT4gVCk6ICguLi5hcmdzOiBhbnlbXSkgPT5cbiAgICBQcm9taXNlPFQ+IHtcbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxUPiB7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKGFyZ3MpLnRoZW4oKHZhbHVlczogYW55W10pID0+IHtcbiAgICAgIHJldHVybiBmbi5hcHBseSh1bmRlZmluZWQsIHZhbHVlcyk7XG4gICAgfSk7XG4gIH07XG59XG5cbi8vIENvbnZlcnRzIGFuIGFzeW5jaHJvbm91cyBmdW5jdGlvbiB0byBvbmUgYWxsb3dpbmcgUHJvbWlzZXNcbi8vIGFzIGFyZ3VtZW50cy5cbi8vXG4vLyAgIGZuKFUsIFYsIC4uLik6IFByb21pc2U8VD4gPT4gZm4oVSB8IFByb21pc2U8VT4sIFYgfCBQcm9taXNlPFY+LCAuLi4pOlxuLy8gICBQcm9taXNlPFQ+XG5leHBvcnQgbGV0IGxpZnRBcmdzOiA8VD4oZm46ICguLi5hcmdzOiBhbnlbXSkgPT4gUHJvbWlzZTxUPikgPT5cbiAgICAoKC4uLmFyZ3M6IGFueVtdKSA9PiBQcm9taXNlPFQ+KSA9IDxhbnk+bGlmdDtcblxuZXhwb3J0IGxldCBnZXRQcm9wID0gbGlmdCgob2JqLCBwcm9wKSA9PiBvYmpbcHJvcF0pO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlRXh0ZW5zaW9uKGZpbGVOYW1lOiBzdHJpbmcsIGV4dGVuc2lvbjogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKGZpbGVOYW1lLmluZGV4T2YoJy4nKSA9PT0gLTEpIHtcbiAgICByZXR1cm4gZmlsZU5hbWUgKyAnLicgKyBleHRlbnNpb247XG4gIH1cbiAgcmV0dXJuIGZpbGVOYW1lO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVwbGFjZUV4dGVuc2lvbihmaWxlTmFtZTogc3RyaW5nLCBleHRlbnNpb246IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBmaWxlTmFtZS5yZXBsYWNlKC9cXC5bXlxcLl0qJC8sICcuJyArIGV4dGVuc2lvbik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcmV0dHlKU09OKG86IGFueSk6IHN0cmluZyB7XG4gIHJldHVybiBKU09OLnN0cmluZ2lmeShvLCBudWxsLCAyKTtcbn1cblxuZnVuY3Rpb24gZGVlcEV4dGVuZCh0YXJnZXQ6IE9iamVjdCwgc291cmNlOiBPYmplY3QpOiB2b2lkIHtcbiAgZm9yICh2YXIgcHJvcCBpbiBzb3VyY2UpIHtcbiAgICBpZiAoIXNvdXJjZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHRhcmdldFtwcm9wXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb3BlcnR5IG92ZXJ3cml0ZTogJyArIHByb3ApO1xuICAgIH1cblxuICAgIGlmIChpc1R5cGUoc291cmNlW3Byb3BdLCAnb2JqZWN0JykpIHtcbiAgICAgIHRhcmdldFtwcm9wXSA9IHt9O1xuICAgICAgZGVlcEV4dGVuZCh0YXJnZXRbcHJvcF0sIHNvdXJjZVtwcm9wXSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZXBMb29rdXAobzogT2JqZWN0LCBwYXRoOiBzdHJpbmdbXSk6IE9iamVjdHx1bmRlZmluZWQge1xuICBsZXQgcmVzdWx0ID0gbztcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICAgIHJlc3VsdCA9IHJlc3VsdFtwYXRoW2ldXTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBMaWtlIEpTT04uc3RyaW5naWZ5IC0gYnV0IGZvciBzaW5nbGUtcXVvdGVkIHN0cmluZ3MgaW5zdGVhZCBvZiBkb3VibGUtcXVvdGVkXG4vLyBvbmVzLiBUaGlzIGp1c3QgbWFrZXMgdGhlIGNvbXBpbGVkIHJ1bGVzIG11Y2ggZWFzaWVyIHRvIHJlYWQuXG5cbi8vIFF1b3RlIGFsbCBjb250cm9sIGNoYXJhY3RlcnMsIHNsYXNoLCBzaW5nbGUgcXVvdGVzLCBhbmQgbm9uLWFzY2lpIHByaW50YWJsZXMuXG52YXIgcXVvdGFibGVDaGFyYWN0ZXJzID0gL1tcXHUwMDAwLVxcdTAwMWZcXFxcXFwnXFx1MDA3Zi1cXHVmZmZmXS9nO1xudmFyIHNwZWNpYWxRdW90ZXMgPSA8e1tjOiBzdHJpbmddOiBzdHJpbmd9PntcbiAgJ1xcJyc6ICdcXFxcXFwnJyxcbiAgJ1xcYic6ICdcXFxcYicsXG4gICdcXHQnOiAnXFxcXHQnLFxuICAnXFxuJzogJ1xcXFxuJyxcbiAgJ1xcZic6ICdcXFxcZicsXG4gICdcXHInOiAnXFxcXHInXG59O1xuXG5leHBvcnQgZnVuY3Rpb24gcXVvdGVTdHJpbmcoczogc3RyaW5nKTogc3RyaW5nIHtcbiAgcyA9IHMucmVwbGFjZShxdW90YWJsZUNoYXJhY3RlcnMsIGZ1bmN0aW9uKGMpIHtcbiAgICBpZiAoc3BlY2lhbFF1b3Rlc1tjXSkge1xuICAgICAgcmV0dXJuIHNwZWNpYWxRdW90ZXNbY107XG4gICAgfVxuICAgIHJldHVybiAnXFxcXHUnICsgKCcwMDAwJyArIGMuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikpLnNsaWNlKC00KTtcbiAgfSk7XG4gIHJldHVybiAnXFwnJyArIHMgKyAnXFwnJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFycmF5SW5jbHVkZXMoYTogYW55W10sIGU6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gYS5pbmRleE9mKGUpICE9PSAtMTtcbn1cblxuLy8gTGlrZSBQeXRob24gbGlzdC5leHRlbmRcbmV4cG9ydCBmdW5jdGlvbiBleHRlbmRBcnJheSh0YXJnZXQ6IGFueVtdLCBzcmM6IGFueVtdKSB7XG4gIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRhcmdldCA9IFtdO1xuICB9XG4gIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KHRhcmdldCwgc3JjKTtcbiAgcmV0dXJuIHRhcmdldDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9yKHRhcmdldDogYW55LCBzcmM6IGFueSkge1xuICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRhcmdldCB8fCBzcmM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbnN1cmVPYmplY3RQYXRoKG9iajogT2JqZWN0LCBwYXJ0czogc3RyaW5nW10pOiBPYmplY3Qge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG5hbWUgPSBwYXJ0c1tpXTtcbiAgICBpZiAoIShuYW1lIGluIG9iaikpIHtcbiAgICAgIG9ialtuYW1lXSA9IHt9O1xuICAgIH1cbiAgICBvYmogPSBvYmpbbmFtZV07XG4gIH1cbiAgcmV0dXJuIG9iajtcbn1cblxuLy8gUmVtb3ZlIGFsbCBlbXB0eSwgJ3t9JywgIGNoaWxkcmVuIGFuZCB1bmRlZmluZWQgLSByZXR1cm5zIHRydWUgaWZmIG9iaiBpc1xuLy8gZW1wdHkuXG5leHBvcnQgZnVuY3Rpb24gcHJ1bmVFbXB0eUNoaWxkcmVuKG9iajogT2JqZWN0KTogYm9vbGVhbiB7XG4gIGlmIChvYmogPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIGlmIChvYmouY29uc3RydWN0b3IgIT09IE9iamVjdCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgaGFzQ2hpbGRyZW4gPSBmYWxzZTtcbiAgZm9yICh2YXIgcHJvcCBpbiBvYmopIHtcbiAgICBpZiAoIW9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChwcnVuZUVtcHR5Q2hpbGRyZW4ob2JqW3Byb3BdKSkge1xuICAgICAgZGVsZXRlIG9ialtwcm9wXTtcbiAgICB9IGVsc2Uge1xuICAgICAgaGFzQ2hpbGRyZW4gPSB0cnVlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gIWhhc0NoaWxkcmVuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVsZXRlUHJvcE5hbWUob2JqOiBPYmplY3QsIG5hbWU6IHN0cmluZykge1xuICBpZiAob2JqLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZm9yICh2YXIgcHJvcCBpbiBvYmopIHtcbiAgICBpZiAoIW9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChwcm9wID09PSBuYW1lKSB7XG4gICAgICBkZWxldGUgb2JqW3Byb3BdO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGVQcm9wTmFtZShvYmpbcHJvcF0sIG5hbWUpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0Q29sdW1ucyhpbmRlbnQ6IG51bWJlciwgbGluZXM6IHN0cmluZ1tdW10pOiBzdHJpbmdbXSB7XG4gIGxldCByZXN1bHQ6IHN0cmluZ1tdID0gW107XG4gIGxldCBjb2x1bW5TaXplID0gPG51bWJlcltdPltdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGluZS5sZW5ndGg7IGorKykge1xuICAgICAgaWYgKGNvbHVtblNpemVbal0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb2x1bW5TaXplW2pdID0gMDtcbiAgICAgIH1cbiAgICAgIGNvbHVtblNpemVbal0gPSBNYXRoLm1heChjb2x1bW5TaXplW2pdLCBsaW5lW2pdLmxlbmd0aCk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHByZWZpeCA9IHJlcGVhdFN0cmluZygnICcsIGluZGVudCk7XG4gIHZhciBzOiBzdHJpbmc7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgbGluZSA9IGxpbmVzW2ldO1xuICAgIGxldCBzZXAgPSAnJztcbiAgICBzID0gJyc7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBsaW5lLmxlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoaiA9PT0gMCkge1xuICAgICAgICBzID0gcHJlZml4O1xuICAgICAgfVxuICAgICAgaWYgKGogPT09IGxpbmUubGVuZ3RoIC0gMSkge1xuICAgICAgICBzICs9IHNlcCArIGxpbmVbal07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzICs9IHNlcCArIGZpbGxTdHJpbmcobGluZVtqXSwgY29sdW1uU2l6ZVtqXSk7XG4gICAgICB9XG4gICAgICBzZXAgPSAnICAnO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChzKTtcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlcGVhdFN0cmluZyhzOiBzdHJpbmcsIG46IG51bWJlcik6IHN0cmluZyB7XG4gIHJldHVybiBuZXcgQXJyYXkobiArIDEpLmpvaW4ocyk7XG59XG5cbmZ1bmN0aW9uIGZpbGxTdHJpbmcoczogc3RyaW5nLCBuOiBudW1iZXIpOiBzdHJpbmcge1xuICBsZXQgcGFkZGluZyA9IG4gLSBzLmxlbmd0aDtcbiAgaWYgKHBhZGRpbmcgPiAwKSB7XG4gICAgcyArPSByZXBlYXRTdHJpbmcoJyAnLCBwYWRkaW5nKTtcbiAgfVxuICByZXR1cm4gcztcbn1cbiIsIi8qIVxuICogQG92ZXJ2aWV3IGVzNi1wcm9taXNlIC0gYSB0aW55IGltcGxlbWVudGF0aW9uIG9mIFByb21pc2VzL0ErLlxuICogQGNvcHlyaWdodCBDb3B5cmlnaHQgKGMpIDIwMTQgWWVodWRhIEthdHosIFRvbSBEYWxlLCBTdGVmYW4gUGVubmVyIGFuZCBjb250cmlidXRvcnMgKENvbnZlcnNpb24gdG8gRVM2IEFQSSBieSBKYWtlIEFyY2hpYmFsZClcbiAqIEBsaWNlbnNlICAgTGljZW5zZWQgdW5kZXIgTUlUIGxpY2Vuc2VcbiAqICAgICAgICAgICAgU2VlIGh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9zdGVmYW5wZW5uZXIvZXM2LXByb21pc2UvbWFzdGVyL0xJQ0VOU0VcbiAqIEB2ZXJzaW9uICAgMy4zLjFcbiAqL1xuXG4oZnVuY3Rpb24gKGdsb2JhbCwgZmFjdG9yeSkge1xuICAgIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyA/IG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpIDpcbiAgICB0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQgPyBkZWZpbmUoZmFjdG9yeSkgOlxuICAgIChnbG9iYWwuRVM2UHJvbWlzZSA9IGZhY3RvcnkoKSk7XG59KHRoaXMsIChmdW5jdGlvbiAoKSB7ICd1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gb2JqZWN0T3JGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJyB8fCB0eXBlb2YgeCA9PT0gJ29iamVjdCcgJiYgeCAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNGdW5jdGlvbih4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gJ2Z1bmN0aW9uJztcbn1cblxudmFyIF9pc0FycmF5ID0gdW5kZWZpbmVkO1xuaWYgKCFBcnJheS5pc0FycmF5KSB7XG4gIF9pc0FycmF5ID0gZnVuY3Rpb24gKHgpIHtcbiAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHgpID09PSAnW29iamVjdCBBcnJheV0nO1xuICB9O1xufSBlbHNlIHtcbiAgX2lzQXJyYXkgPSBBcnJheS5pc0FycmF5O1xufVxuXG52YXIgaXNBcnJheSA9IF9pc0FycmF5O1xuXG52YXIgbGVuID0gMDtcbnZhciB2ZXJ0eE5leHQgPSB1bmRlZmluZWQ7XG52YXIgY3VzdG9tU2NoZWR1bGVyRm4gPSB1bmRlZmluZWQ7XG5cbnZhciBhc2FwID0gZnVuY3Rpb24gYXNhcChjYWxsYmFjaywgYXJnKSB7XG4gIHF1ZXVlW2xlbl0gPSBjYWxsYmFjaztcbiAgcXVldWVbbGVuICsgMV0gPSBhcmc7XG4gIGxlbiArPSAyO1xuICBpZiAobGVuID09PSAyKSB7XG4gICAgLy8gSWYgbGVuIGlzIDIsIHRoYXQgbWVhbnMgdGhhdCB3ZSBuZWVkIHRvIHNjaGVkdWxlIGFuIGFzeW5jIGZsdXNoLlxuICAgIC8vIElmIGFkZGl0aW9uYWwgY2FsbGJhY2tzIGFyZSBxdWV1ZWQgYmVmb3JlIHRoZSBxdWV1ZSBpcyBmbHVzaGVkLCB0aGV5XG4gICAgLy8gd2lsbCBiZSBwcm9jZXNzZWQgYnkgdGhpcyBmbHVzaCB0aGF0IHdlIGFyZSBzY2hlZHVsaW5nLlxuICAgIGlmIChjdXN0b21TY2hlZHVsZXJGbikge1xuICAgICAgY3VzdG9tU2NoZWR1bGVyRm4oZmx1c2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzY2hlZHVsZUZsdXNoKCk7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiBzZXRTY2hlZHVsZXIoc2NoZWR1bGVGbikge1xuICBjdXN0b21TY2hlZHVsZXJGbiA9IHNjaGVkdWxlRm47XG59XG5cbmZ1bmN0aW9uIHNldEFzYXAoYXNhcEZuKSB7XG4gIGFzYXAgPSBhc2FwRm47XG59XG5cbnZhciBicm93c2VyV2luZG93ID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB1bmRlZmluZWQ7XG52YXIgYnJvd3Nlckdsb2JhbCA9IGJyb3dzZXJXaW5kb3cgfHwge307XG52YXIgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIgPSBicm93c2VyR2xvYmFsLk11dGF0aW9uT2JzZXJ2ZXIgfHwgYnJvd3Nlckdsb2JhbC5XZWJLaXRNdXRhdGlvbk9ic2VydmVyO1xudmFyIGlzTm9kZSA9IHR5cGVvZiBzZWxmID09PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgKHt9KS50b1N0cmluZy5jYWxsKHByb2Nlc3MpID09PSAnW29iamVjdCBwcm9jZXNzXSc7XG5cbi8vIHRlc3QgZm9yIHdlYiB3b3JrZXIgYnV0IG5vdCBpbiBJRTEwXG52YXIgaXNXb3JrZXIgPSB0eXBlb2YgVWludDhDbGFtcGVkQXJyYXkgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgTWVzc2FnZUNoYW5uZWwgIT09ICd1bmRlZmluZWQnO1xuXG4vLyBub2RlXG5mdW5jdGlvbiB1c2VOZXh0VGljaygpIHtcbiAgLy8gbm9kZSB2ZXJzaW9uIDAuMTAueCBkaXNwbGF5cyBhIGRlcHJlY2F0aW9uIHdhcm5pbmcgd2hlbiBuZXh0VGljayBpcyB1c2VkIHJlY3Vyc2l2ZWx5XG4gIC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vY3Vqb2pzL3doZW4vaXNzdWVzLzQxMCBmb3IgZGV0YWlsc1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGZsdXNoKTtcbiAgfTtcbn1cblxuLy8gdmVydHhcbmZ1bmN0aW9uIHVzZVZlcnR4VGltZXIoKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmVydHhOZXh0KGZsdXNoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXNlTXV0YXRpb25PYnNlcnZlcigpIHtcbiAgdmFyIGl0ZXJhdGlvbnMgPSAwO1xuICB2YXIgb2JzZXJ2ZXIgPSBuZXcgQnJvd3Nlck11dGF0aW9uT2JzZXJ2ZXIoZmx1c2gpO1xuICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKCcnKTtcbiAgb2JzZXJ2ZXIub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBub2RlLmRhdGEgPSBpdGVyYXRpb25zID0gKytpdGVyYXRpb25zICUgMjtcbiAgfTtcbn1cblxuLy8gd2ViIHdvcmtlclxuZnVuY3Rpb24gdXNlTWVzc2FnZUNoYW5uZWwoKSB7XG4gIHZhciBjaGFubmVsID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG4gIGNoYW5uZWwucG9ydDEub25tZXNzYWdlID0gZmx1c2g7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZVNldFRpbWVvdXQoKSB7XG4gIC8vIFN0b3JlIHNldFRpbWVvdXQgcmVmZXJlbmNlIHNvIGVzNi1wcm9taXNlIHdpbGwgYmUgdW5hZmZlY3RlZCBieVxuICAvLyBvdGhlciBjb2RlIG1vZGlmeWluZyBzZXRUaW1lb3V0IChsaWtlIHNpbm9uLnVzZUZha2VUaW1lcnMoKSlcbiAgdmFyIGdsb2JhbFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBnbG9iYWxTZXRUaW1lb3V0KGZsdXNoLCAxKTtcbiAgfTtcbn1cblxudmFyIHF1ZXVlID0gbmV3IEFycmF5KDEwMDApO1xuZnVuY3Rpb24gZmx1c2goKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDIpIHtcbiAgICB2YXIgY2FsbGJhY2sgPSBxdWV1ZVtpXTtcbiAgICB2YXIgYXJnID0gcXVldWVbaSArIDFdO1xuXG4gICAgY2FsbGJhY2soYXJnKTtcblxuICAgIHF1ZXVlW2ldID0gdW5kZWZpbmVkO1xuICAgIHF1ZXVlW2kgKyAxXSA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGxlbiA9IDA7XG59XG5cbmZ1bmN0aW9uIGF0dGVtcHRWZXJ0eCgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgciA9IHJlcXVpcmU7XG4gICAgdmFyIHZlcnR4ID0gcigndmVydHgnKTtcbiAgICB2ZXJ0eE5leHQgPSB2ZXJ0eC5ydW5Pbkxvb3AgfHwgdmVydHgucnVuT25Db250ZXh0O1xuICAgIHJldHVybiB1c2VWZXJ0eFRpbWVyKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gdXNlU2V0VGltZW91dCgpO1xuICB9XG59XG5cbnZhciBzY2hlZHVsZUZsdXNoID0gdW5kZWZpbmVkO1xuLy8gRGVjaWRlIHdoYXQgYXN5bmMgbWV0aG9kIHRvIHVzZSB0byB0cmlnZ2VyaW5nIHByb2Nlc3Npbmcgb2YgcXVldWVkIGNhbGxiYWNrczpcbmlmIChpc05vZGUpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZU5leHRUaWNrKCk7XG59IGVsc2UgaWYgKEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNdXRhdGlvbk9ic2VydmVyKCk7XG59IGVsc2UgaWYgKGlzV29ya2VyKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VNZXNzYWdlQ2hhbm5lbCgpO1xufSBlbHNlIGlmIChicm93c2VyV2luZG93ID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIHJlcXVpcmUgPT09ICdmdW5jdGlvbicpIHtcbiAgc2NoZWR1bGVGbHVzaCA9IGF0dGVtcHRWZXJ0eCgpO1xufSBlbHNlIHtcbiAgc2NoZWR1bGVGbHVzaCA9IHVzZVNldFRpbWVvdXQoKTtcbn1cblxuZnVuY3Rpb24gdGhlbihvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgX2FyZ3VtZW50cyA9IGFyZ3VtZW50cztcblxuICB2YXIgcGFyZW50ID0gdGhpcztcblxuICB2YXIgY2hpbGQgPSBuZXcgdGhpcy5jb25zdHJ1Y3Rvcihub29wKTtcblxuICBpZiAoY2hpbGRbUFJPTUlTRV9JRF0gPT09IHVuZGVmaW5lZCkge1xuICAgIG1ha2VQcm9taXNlKGNoaWxkKTtcbiAgfVxuXG4gIHZhciBfc3RhdGUgPSBwYXJlbnQuX3N0YXRlO1xuXG4gIGlmIChfc3RhdGUpIHtcbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGNhbGxiYWNrID0gX2FyZ3VtZW50c1tfc3RhdGUgLSAxXTtcbiAgICAgIGFzYXAoZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gaW52b2tlQ2FsbGJhY2soX3N0YXRlLCBjaGlsZCwgY2FsbGJhY2ssIHBhcmVudC5fcmVzdWx0KTtcbiAgICAgIH0pO1xuICAgIH0pKCk7XG4gIH0gZWxzZSB7XG4gICAgc3Vic2NyaWJlKHBhcmVudCwgY2hpbGQsIG9uRnVsZmlsbG1lbnQsIG9uUmVqZWN0aW9uKTtcbiAgfVxuXG4gIHJldHVybiBjaGlsZDtcbn1cblxuLyoqXG4gIGBQcm9taXNlLnJlc29sdmVgIHJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgcmVzb2x2ZWQgd2l0aCB0aGVcbiAgcGFzc2VkIGB2YWx1ZWAuIEl0IGlzIHNob3J0aGFuZCBmb3IgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICByZXNvbHZlKDEpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBJbnN0ZWFkIG9mIHdyaXRpbmcgdGhlIGFib3ZlLCB5b3VyIGNvZGUgbm93IHNpbXBseSBiZWNvbWVzIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgxKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIHZhbHVlID09PSAxXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIHJlc29sdmVcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FueX0gdmFsdWUgdmFsdWUgdGhhdCB0aGUgcmV0dXJuZWQgcHJvbWlzZSB3aWxsIGJlIHJlc29sdmVkIHdpdGhcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgdGhhdCB3aWxsIGJlY29tZSBmdWxmaWxsZWQgd2l0aCB0aGUgZ2l2ZW5cbiAgYHZhbHVlYFxuKi9cbmZ1bmN0aW9uIHJlc29sdmUob2JqZWN0KSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKG9iamVjdCAmJiB0eXBlb2Ygb2JqZWN0ID09PSAnb2JqZWN0JyAmJiBvYmplY3QuY29uc3RydWN0b3IgPT09IENvbnN0cnVjdG9yKSB7XG4gICAgcmV0dXJuIG9iamVjdDtcbiAgfVxuXG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICBfcmVzb2x2ZShwcm9taXNlLCBvYmplY3QpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxudmFyIFBST01JU0VfSUQgPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMTYpO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxudmFyIFBFTkRJTkcgPSB2b2lkIDA7XG52YXIgRlVMRklMTEVEID0gMTtcbnZhciBSRUpFQ1RFRCA9IDI7XG5cbnZhciBHRVRfVEhFTl9FUlJPUiA9IG5ldyBFcnJvck9iamVjdCgpO1xuXG5mdW5jdGlvbiBzZWxmRnVsZmlsbG1lbnQoKSB7XG4gIHJldHVybiBuZXcgVHlwZUVycm9yKFwiWW91IGNhbm5vdCByZXNvbHZlIGEgcHJvbWlzZSB3aXRoIGl0c2VsZlwiKTtcbn1cblxuZnVuY3Rpb24gY2Fubm90UmV0dXJuT3duKCkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcignQSBwcm9taXNlcyBjYWxsYmFjayBjYW5ub3QgcmV0dXJuIHRoYXQgc2FtZSBwcm9taXNlLicpO1xufVxuXG5mdW5jdGlvbiBnZXRUaGVuKHByb21pc2UpIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gcHJvbWlzZS50aGVuO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIEdFVF9USEVOX0VSUk9SLmVycm9yID0gZXJyb3I7XG4gICAgcmV0dXJuIEdFVF9USEVOX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRyeVRoZW4odGhlbiwgdmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcikge1xuICB0cnkge1xuICAgIHRoZW4uY2FsbCh2YWx1ZSwgZnVsZmlsbG1lbnRIYW5kbGVyLCByZWplY3Rpb25IYW5kbGVyKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSwgdGhlbikge1xuICBhc2FwKGZ1bmN0aW9uIChwcm9taXNlKSB7XG4gICAgdmFyIHNlYWxlZCA9IGZhbHNlO1xuICAgIHZhciBlcnJvciA9IHRyeVRoZW4odGhlbiwgdGhlbmFibGUsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgaWYgKHRoZW5hYmxlICE9PSB2YWx1ZSkge1xuICAgICAgICBfcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICBpZiAoc2VhbGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHNlYWxlZCA9IHRydWU7XG5cbiAgICAgIF9yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9LCAnU2V0dGxlOiAnICsgKHByb21pc2UuX2xhYmVsIHx8ICcgdW5rbm93biBwcm9taXNlJykpO1xuXG4gICAgaWYgKCFzZWFsZWQgJiYgZXJyb3IpIHtcbiAgICAgIHNlYWxlZCA9IHRydWU7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICB9XG4gIH0sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGVPd25UaGVuYWJsZShwcm9taXNlLCB0aGVuYWJsZSkge1xuICBpZiAodGhlbmFibGUuX3N0YXRlID09PSBGVUxGSUxMRUQpIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICB9IGVsc2UgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gUkVKRUNURUQpIHtcbiAgICBfcmVqZWN0KHByb21pc2UsIHRoZW5hYmxlLl9yZXN1bHQpO1xuICB9IGVsc2Uge1xuICAgIHN1YnNjcmliZSh0aGVuYWJsZSwgdW5kZWZpbmVkLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIHJldHVybiBfcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuIF9yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUsIHRoZW4kJCkge1xuICBpZiAobWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3RvciA9PT0gcHJvbWlzZS5jb25zdHJ1Y3RvciAmJiB0aGVuJCQgPT09IHRoZW4gJiYgbWF5YmVUaGVuYWJsZS5jb25zdHJ1Y3Rvci5yZXNvbHZlID09PSByZXNvbHZlKSB7XG4gICAgaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoZW4kJCA9PT0gR0VUX1RIRU5fRVJST1IpIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgR0VUX1RIRU5fRVJST1IuZXJyb3IpO1xuICAgIH0gZWxzZSBpZiAodGhlbiQkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGZ1bGZpbGwocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSk7XG4gICAgfSBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoZW4kJCkpIHtcbiAgICAgIGhhbmRsZUZvcmVpZ25UaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBfcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICBfcmVqZWN0KHByb21pc2UsIHNlbGZGdWxmaWxsbWVudCgpKTtcbiAgfSBlbHNlIGlmIChvYmplY3RPckZ1bmN0aW9uKHZhbHVlKSkge1xuICAgIGhhbmRsZU1heWJlVGhlbmFibGUocHJvbWlzZSwgdmFsdWUsIGdldFRoZW4odmFsdWUpKTtcbiAgfSBlbHNlIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHZhbHVlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwdWJsaXNoUmVqZWN0aW9uKHByb21pc2UpIHtcbiAgaWYgKHByb21pc2UuX29uZXJyb3IpIHtcbiAgICBwcm9taXNlLl9vbmVycm9yKHByb21pc2UuX3Jlc3VsdCk7XG4gIH1cblxuICBwdWJsaXNoKHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBmdWxmaWxsKHByb21pc2UsIHZhbHVlKSB7XG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHByb21pc2UuX3Jlc3VsdCA9IHZhbHVlO1xuICBwcm9taXNlLl9zdGF0ZSA9IEZVTEZJTExFRDtcblxuICBpZiAocHJvbWlzZS5fc3Vic2NyaWJlcnMubGVuZ3RoICE9PSAwKSB7XG4gICAgYXNhcChwdWJsaXNoLCBwcm9taXNlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBfcmVqZWN0KHByb21pc2UsIHJlYXNvbikge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgcHJvbWlzZS5fc3RhdGUgPSBSRUpFQ1RFRDtcbiAgcHJvbWlzZS5fcmVzdWx0ID0gcmVhc29uO1xuXG4gIGFzYXAocHVibGlzaFJlamVjdGlvbiwgcHJvbWlzZSk7XG59XG5cbmZ1bmN0aW9uIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbikge1xuICB2YXIgX3N1YnNjcmliZXJzID0gcGFyZW50Ll9zdWJzY3JpYmVycztcbiAgdmFyIGxlbmd0aCA9IF9zdWJzY3JpYmVycy5sZW5ndGg7XG5cbiAgcGFyZW50Ll9vbmVycm9yID0gbnVsbDtcblxuICBfc3Vic2NyaWJlcnNbbGVuZ3RoXSA9IGNoaWxkO1xuICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgRlVMRklMTEVEXSA9IG9uRnVsZmlsbG1lbnQ7XG4gIF9zdWJzY3JpYmVyc1tsZW5ndGggKyBSRUpFQ1RFRF0gPSBvblJlamVjdGlvbjtcblxuICBpZiAobGVuZ3RoID09PSAwICYmIHBhcmVudC5fc3RhdGUpIHtcbiAgICBhc2FwKHB1Ymxpc2gsIHBhcmVudCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaChwcm9taXNlKSB7XG4gIHZhciBzdWJzY3JpYmVycyA9IHByb21pc2UuX3N1YnNjcmliZXJzO1xuICB2YXIgc2V0dGxlZCA9IHByb21pc2UuX3N0YXRlO1xuXG4gIGlmIChzdWJzY3JpYmVycy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgY2hpbGQgPSB1bmRlZmluZWQsXG4gICAgICBjYWxsYmFjayA9IHVuZGVmaW5lZCxcbiAgICAgIGRldGFpbCA9IHByb21pc2UuX3Jlc3VsdDtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN1YnNjcmliZXJzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgY2hpbGQgPSBzdWJzY3JpYmVyc1tpXTtcbiAgICBjYWxsYmFjayA9IHN1YnNjcmliZXJzW2kgKyBzZXR0bGVkXTtcblxuICAgIGlmIChjaGlsZCkge1xuICAgICAgaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgY2hpbGQsIGNhbGxiYWNrLCBkZXRhaWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsYmFjayhkZXRhaWwpO1xuICAgIH1cbiAgfVxuXG4gIHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCA9IDA7XG59XG5cbmZ1bmN0aW9uIEVycm9yT2JqZWN0KCkge1xuICB0aGlzLmVycm9yID0gbnVsbDtcbn1cblxudmFyIFRSWV9DQVRDSF9FUlJPUiA9IG5ldyBFcnJvck9iamVjdCgpO1xuXG5mdW5jdGlvbiB0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIGNhbGxiYWNrKGRldGFpbCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBUUllfQ0FUQ0hfRVJST1IuZXJyb3IgPSBlO1xuICAgIHJldHVybiBUUllfQ0FUQ0hfRVJST1I7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW52b2tlQ2FsbGJhY2soc2V0dGxlZCwgcHJvbWlzZSwgY2FsbGJhY2ssIGRldGFpbCkge1xuICB2YXIgaGFzQ2FsbGJhY2sgPSBpc0Z1bmN0aW9uKGNhbGxiYWNrKSxcbiAgICAgIHZhbHVlID0gdW5kZWZpbmVkLFxuICAgICAgZXJyb3IgPSB1bmRlZmluZWQsXG4gICAgICBzdWNjZWVkZWQgPSB1bmRlZmluZWQsXG4gICAgICBmYWlsZWQgPSB1bmRlZmluZWQ7XG5cbiAgaWYgKGhhc0NhbGxiYWNrKSB7XG4gICAgdmFsdWUgPSB0cnlDYXRjaChjYWxsYmFjaywgZGV0YWlsKTtcblxuICAgIGlmICh2YWx1ZSA9PT0gVFJZX0NBVENIX0VSUk9SKSB7XG4gICAgICBmYWlsZWQgPSB0cnVlO1xuICAgICAgZXJyb3IgPSB2YWx1ZS5lcnJvcjtcbiAgICAgIHZhbHVlID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAocHJvbWlzZSA9PT0gdmFsdWUpIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgY2Fubm90UmV0dXJuT3duKCkpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YWx1ZSA9IGRldGFpbDtcbiAgICBzdWNjZWVkZWQgPSB0cnVlO1xuICB9XG5cbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgLy8gbm9vcFxuICB9IGVsc2UgaWYgKGhhc0NhbGxiYWNrICYmIHN1Y2NlZWRlZCkge1xuICAgICAgX3Jlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoZmFpbGVkKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIGVycm9yKTtcbiAgICB9IGVsc2UgaWYgKHNldHRsZWQgPT09IEZVTEZJTExFRCkge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBSRUpFQ1RFRCkge1xuICAgICAgX3JlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpbml0aWFsaXplUHJvbWlzZShwcm9taXNlLCByZXNvbHZlcikge1xuICB0cnkge1xuICAgIHJlc29sdmVyKGZ1bmN0aW9uIHJlc29sdmVQcm9taXNlKHZhbHVlKSB7XG4gICAgICBfcmVzb2x2ZShwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSwgZnVuY3Rpb24gcmVqZWN0UHJvbWlzZShyZWFzb24pIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgcmVhc29uKTtcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIF9yZWplY3QocHJvbWlzZSwgZSk7XG4gIH1cbn1cblxudmFyIGlkID0gMDtcbmZ1bmN0aW9uIG5leHRJZCgpIHtcbiAgcmV0dXJuIGlkKys7XG59XG5cbmZ1bmN0aW9uIG1ha2VQcm9taXNlKHByb21pc2UpIHtcbiAgcHJvbWlzZVtQUk9NSVNFX0lEXSA9IGlkKys7XG4gIHByb21pc2UuX3N0YXRlID0gdW5kZWZpbmVkO1xuICBwcm9taXNlLl9yZXN1bHQgPSB1bmRlZmluZWQ7XG4gIHByb21pc2UuX3N1YnNjcmliZXJzID0gW107XG59XG5cbmZ1bmN0aW9uIEVudW1lcmF0b3IoQ29uc3RydWN0b3IsIGlucHV0KSB7XG4gIHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3IgPSBDb25zdHJ1Y3RvcjtcbiAgdGhpcy5wcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuXG4gIGlmICghdGhpcy5wcm9taXNlW1BST01JU0VfSURdKSB7XG4gICAgbWFrZVByb21pc2UodGhpcy5wcm9taXNlKTtcbiAgfVxuXG4gIGlmIChpc0FycmF5KGlucHV0KSkge1xuICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XG4gICAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gICAgdGhpcy5fcmVtYWluaW5nID0gaW5wdXQubGVuZ3RoO1xuXG4gICAgdGhpcy5fcmVzdWx0ID0gbmV3IEFycmF5KHRoaXMubGVuZ3RoKTtcblxuICAgIGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGVuZ3RoID0gdGhpcy5sZW5ndGggfHwgMDtcbiAgICAgIHRoaXMuX2VudW1lcmF0ZSgpO1xuICAgICAgaWYgKHRoaXMuX3JlbWFpbmluZyA9PT0gMCkge1xuICAgICAgICBmdWxmaWxsKHRoaXMucHJvbWlzZSwgdGhpcy5fcmVzdWx0KTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgX3JlamVjdCh0aGlzLnByb21pc2UsIHZhbGlkYXRpb25FcnJvcigpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB2YWxpZGF0aW9uRXJyb3IoKSB7XG4gIHJldHVybiBuZXcgRXJyb3IoJ0FycmF5IE1ldGhvZHMgbXVzdCBiZSBwcm92aWRlZCBhbiBBcnJheScpO1xufTtcblxuRW51bWVyYXRvci5wcm90b3R5cGUuX2VudW1lcmF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoO1xuICB2YXIgX2lucHV0ID0gdGhpcy5faW5wdXQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IHRoaXMuX3N0YXRlID09PSBQRU5ESU5HICYmIGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHRoaXMuX2VhY2hFbnRyeShfaW5wdXRbaV0sIGkpO1xuICB9XG59O1xuXG5FbnVtZXJhdG9yLnByb3RvdHlwZS5fZWFjaEVudHJ5ID0gZnVuY3Rpb24gKGVudHJ5LCBpKSB7XG4gIHZhciBjID0gdGhpcy5faW5zdGFuY2VDb25zdHJ1Y3RvcjtcbiAgdmFyIHJlc29sdmUkJCA9IGMucmVzb2x2ZTtcblxuICBpZiAocmVzb2x2ZSQkID09PSByZXNvbHZlKSB7XG4gICAgdmFyIF90aGVuID0gZ2V0VGhlbihlbnRyeSk7XG5cbiAgICBpZiAoX3RoZW4gPT09IHRoZW4gJiYgZW50cnkuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgICB0aGlzLl9zZXR0bGVkQXQoZW50cnkuX3N0YXRlLCBpLCBlbnRyeS5fcmVzdWx0KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBfdGhlbiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5fcmVtYWluaW5nLS07XG4gICAgICB0aGlzLl9yZXN1bHRbaV0gPSBlbnRyeTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IFByb21pc2UpIHtcbiAgICAgIHZhciBwcm9taXNlID0gbmV3IGMobm9vcCk7XG4gICAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIGVudHJ5LCBfdGhlbik7XG4gICAgICB0aGlzLl93aWxsU2V0dGxlQXQocHJvbWlzZSwgaSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3dpbGxTZXR0bGVBdChuZXcgYyhmdW5jdGlvbiAocmVzb2x2ZSQkKSB7XG4gICAgICAgIHJldHVybiByZXNvbHZlJCQoZW50cnkpO1xuICAgICAgfSksIGkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aGlzLl93aWxsU2V0dGxlQXQocmVzb2x2ZSQkKGVudHJ5KSwgaSk7XG4gIH1cbn07XG5cbkVudW1lcmF0b3IucHJvdG90eXBlLl9zZXR0bGVkQXQgPSBmdW5jdGlvbiAoc3RhdGUsIGksIHZhbHVlKSB7XG4gIHZhciBwcm9taXNlID0gdGhpcy5wcm9taXNlO1xuXG4gIGlmIChwcm9taXNlLl9zdGF0ZSA9PT0gUEVORElORykge1xuICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuXG4gICAgaWYgKHN0YXRlID09PSBSRUpFQ1RFRCkge1xuICAgICAgX3JlamVjdChwcm9taXNlLCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3Jlc3VsdFtpXSA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICBmdWxmaWxsKHByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gIH1cbn07XG5cbkVudW1lcmF0b3IucHJvdG90eXBlLl93aWxsU2V0dGxlQXQgPSBmdW5jdGlvbiAocHJvbWlzZSwgaSkge1xuICB2YXIgZW51bWVyYXRvciA9IHRoaXM7XG5cbiAgc3Vic2NyaWJlKHByb21pc2UsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgcmV0dXJuIGVudW1lcmF0b3IuX3NldHRsZWRBdChGVUxGSUxMRUQsIGksIHZhbHVlKTtcbiAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoUkVKRUNURUQsIGksIHJlYXNvbik7XG4gIH0pO1xufTtcblxuLyoqXG4gIGBQcm9taXNlLmFsbGAgYWNjZXB0cyBhbiBhcnJheSBvZiBwcm9taXNlcywgYW5kIHJldHVybnMgYSBuZXcgcHJvbWlzZSB3aGljaFxuICBpcyBmdWxmaWxsZWQgd2l0aCBhbiBhcnJheSBvZiBmdWxmaWxsbWVudCB2YWx1ZXMgZm9yIHRoZSBwYXNzZWQgcHJvbWlzZXMsIG9yXG4gIHJlamVjdGVkIHdpdGggdGhlIHJlYXNvbiBvZiB0aGUgZmlyc3QgcGFzc2VkIHByb21pc2UgdG8gYmUgcmVqZWN0ZWQuIEl0IGNhc3RzIGFsbFxuICBlbGVtZW50cyBvZiB0aGUgcGFzc2VkIGl0ZXJhYmxlIHRvIHByb21pc2VzIGFzIGl0IHJ1bnMgdGhpcyBhbGdvcml0aG0uXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG4gIGxldCBwcm9taXNlMiA9IHJlc29sdmUoMik7XG4gIGxldCBwcm9taXNlMyA9IHJlc29sdmUoMyk7XG4gIGxldCBwcm9taXNlcyA9IFsgcHJvbWlzZTEsIHByb21pc2UyLCBwcm9taXNlMyBdO1xuXG4gIFByb21pc2UuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyBUaGUgYXJyYXkgaGVyZSB3b3VsZCBiZSBbIDEsIDIsIDMgXTtcbiAgfSk7XG4gIGBgYFxuXG4gIElmIGFueSBvZiB0aGUgYHByb21pc2VzYCBnaXZlbiB0byBgYWxsYCBhcmUgcmVqZWN0ZWQsIHRoZSBmaXJzdCBwcm9taXNlXG4gIHRoYXQgaXMgcmVqZWN0ZWQgd2lsbCBiZSBnaXZlbiBhcyBhbiBhcmd1bWVudCB0byB0aGUgcmV0dXJuZWQgcHJvbWlzZXMnc1xuICByZWplY3Rpb24gaGFuZGxlci4gRm9yIGV4YW1wbGU6XG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IHJlc29sdmUoMSk7XG4gIGxldCBwcm9taXNlMiA9IHJlamVjdChuZXcgRXJyb3IoXCIyXCIpKTtcbiAgbGV0IHByb21pc2UzID0gcmVqZWN0KG5ldyBFcnJvcihcIjNcIikpO1xuICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gQ29kZSBoZXJlIG5ldmVyIHJ1bnMgYmVjYXVzZSB0aGVyZSBhcmUgcmVqZWN0ZWQgcHJvbWlzZXMhXG4gIH0sIGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgLy8gZXJyb3IubWVzc2FnZSA9PT0gXCIyXCJcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgYWxsXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBcnJheX0gZW50cmllcyBhcnJheSBvZiBwcm9taXNlc1xuICBAcGFyYW0ge1N0cmluZ30gbGFiZWwgb3B0aW9uYWwgc3RyaW5nIGZvciBsYWJlbGluZyB0aGUgcHJvbWlzZS5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBwcm9taXNlIHRoYXQgaXMgZnVsZmlsbGVkIHdoZW4gYWxsIGBwcm9taXNlc2AgaGF2ZSBiZWVuXG4gIGZ1bGZpbGxlZCwgb3IgcmVqZWN0ZWQgaWYgYW55IG9mIHRoZW0gYmVjb21lIHJlamVjdGVkLlxuICBAc3RhdGljXG4qL1xuZnVuY3Rpb24gYWxsKGVudHJpZXMpIHtcbiAgcmV0dXJuIG5ldyBFbnVtZXJhdG9yKHRoaXMsIGVudHJpZXMpLnByb21pc2U7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yYWNlYCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2ggaXMgc2V0dGxlZCBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlXG4gIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIHNldHRsZS5cblxuICBFeGFtcGxlOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMicpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIHJlc3VsdCA9PT0gJ3Byb21pc2UgMicgYmVjYXVzZSBpdCB3YXMgcmVzb2x2ZWQgYmVmb3JlIHByb21pc2UxXG4gICAgLy8gd2FzIHJlc29sdmVkLlxuICB9KTtcbiAgYGBgXG5cbiAgYFByb21pc2UucmFjZWAgaXMgZGV0ZXJtaW5pc3RpYyBpbiB0aGF0IG9ubHkgdGhlIHN0YXRlIG9mIHRoZSBmaXJzdFxuICBzZXR0bGVkIHByb21pc2UgbWF0dGVycy4gRm9yIGV4YW1wbGUsIGV2ZW4gaWYgb3RoZXIgcHJvbWlzZXMgZ2l2ZW4gdG8gdGhlXG4gIGBwcm9taXNlc2AgYXJyYXkgYXJndW1lbnQgYXJlIHJlc29sdmVkLCBidXQgdGhlIGZpcnN0IHNldHRsZWQgcHJvbWlzZSBoYXNcbiAgYmVjb21lIHJlamVjdGVkIGJlZm9yZSB0aGUgb3RoZXIgcHJvbWlzZXMgYmVjYW1lIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkXG4gIHByb21pc2Ugd2lsbCBiZWNvbWUgcmVqZWN0ZWQ6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlc29sdmUoJ3Byb21pc2UgMScpO1xuICAgIH0sIDIwMCk7XG4gIH0pO1xuXG4gIGxldCBwcm9taXNlMiA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVqZWN0KG5ldyBFcnJvcigncHJvbWlzZSAyJykpO1xuICAgIH0sIDEwMCk7XG4gIH0pO1xuXG4gIFByb21pc2UucmFjZShbcHJvbWlzZTEsIHByb21pc2UyXSkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zXG4gIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgLy8gcmVhc29uLm1lc3NhZ2UgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgcHJvbWlzZSAyIGJlY2FtZSByZWplY3RlZCBiZWZvcmVcbiAgICAvLyBwcm9taXNlIDEgYmVjYW1lIGZ1bGZpbGxlZFxuICB9KTtcbiAgYGBgXG5cbiAgQW4gZXhhbXBsZSByZWFsLXdvcmxkIHVzZSBjYXNlIGlzIGltcGxlbWVudGluZyB0aW1lb3V0czpcblxuICBgYGBqYXZhc2NyaXB0XG4gIFByb21pc2UucmFjZShbYWpheCgnZm9vLmpzb24nKSwgdGltZW91dCg1MDAwKV0pXG4gIGBgYFxuXG4gIEBtZXRob2QgcmFjZVxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIG9ic2VydmVcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2Ugd2hpY2ggc2V0dGxlcyBpbiB0aGUgc2FtZSB3YXkgYXMgdGhlIGZpcnN0IHBhc3NlZFxuICBwcm9taXNlIHRvIHNldHRsZS5cbiovXG5mdW5jdGlvbiByYWNlKGVudHJpZXMpIHtcbiAgLypqc2hpbnQgdmFsaWR0aGlzOnRydWUgKi9cbiAgdmFyIENvbnN0cnVjdG9yID0gdGhpcztcblxuICBpZiAoIWlzQXJyYXkoZW50cmllcykpIHtcbiAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChfLCByZWplY3QpIHtcbiAgICAgIHJldHVybiByZWplY3QobmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhbiBhcnJheSB0byByYWNlLicpKTtcbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbmV3IENvbnN0cnVjdG9yKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgIHZhciBsZW5ndGggPSBlbnRyaWVzLmxlbmd0aDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgQ29uc3RydWN0b3IucmVzb2x2ZShlbnRyaWVzW2ldKS50aGVuKHJlc29sdmUsIHJlamVjdCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuLyoqXG4gIGBQcm9taXNlLnJlamVjdGAgcmV0dXJucyBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgcGFzc2VkIGByZWFzb25gLlxuICBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVqZWN0KG5ldyBFcnJvcignV0hPT1BTJykpO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpe1xuICAgIC8vIENvZGUgaGVyZSBkb2Vzbid0IHJ1biBiZWNhdXNlIHRoZSBwcm9taXNlIGlzIHJlamVjdGVkIVxuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAnV0hPT1BTJ1xuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZWplY3RcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FueX0gcmVhc29uIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZWplY3RlZCB3aXRoLlxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEByZXR1cm4ge1Byb21pc2V9IGEgcHJvbWlzZSByZWplY3RlZCB3aXRoIHRoZSBnaXZlbiBgcmVhc29uYC5cbiovXG5mdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG4gIHZhciBwcm9taXNlID0gbmV3IENvbnN0cnVjdG9yKG5vb3ApO1xuICBfcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gIHJldHVybiBwcm9taXNlO1xufVxuXG5mdW5jdGlvbiBuZWVkc1Jlc29sdmVyKCkge1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdZb3UgbXVzdCBwYXNzIGEgcmVzb2x2ZXIgZnVuY3Rpb24gYXMgdGhlIGZpcnN0IGFyZ3VtZW50IHRvIHRoZSBwcm9taXNlIGNvbnN0cnVjdG9yJyk7XG59XG5cbmZ1bmN0aW9uIG5lZWRzTmV3KCkge1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiRmFpbGVkIHRvIGNvbnN0cnVjdCAnUHJvbWlzZSc6IFBsZWFzZSB1c2UgdGhlICduZXcnIG9wZXJhdG9yLCB0aGlzIG9iamVjdCBjb25zdHJ1Y3RvciBjYW5ub3QgYmUgY2FsbGVkIGFzIGEgZnVuY3Rpb24uXCIpO1xufVxuXG4vKipcbiAgUHJvbWlzZSBvYmplY3RzIHJlcHJlc2VudCB0aGUgZXZlbnR1YWwgcmVzdWx0IG9mIGFuIGFzeW5jaHJvbm91cyBvcGVyYXRpb24uIFRoZVxuICBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLCB3aGljaFxuICByZWdpc3RlcnMgY2FsbGJhY2tzIHRvIHJlY2VpdmUgZWl0aGVyIGEgcHJvbWlzZSdzIGV2ZW50dWFsIHZhbHVlIG9yIHRoZSByZWFzb25cbiAgd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG5cbiAgVGVybWlub2xvZ3lcbiAgLS0tLS0tLS0tLS1cblxuICAtIGBwcm9taXNlYCBpcyBhbiBvYmplY3Qgb3IgZnVuY3Rpb24gd2l0aCBhIGB0aGVuYCBtZXRob2Qgd2hvc2UgYmVoYXZpb3IgY29uZm9ybXMgdG8gdGhpcyBzcGVjaWZpY2F0aW9uLlxuICAtIGB0aGVuYWJsZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHRoYXQgZGVmaW5lcyBhIGB0aGVuYCBtZXRob2QuXG4gIC0gYHZhbHVlYCBpcyBhbnkgbGVnYWwgSmF2YVNjcmlwdCB2YWx1ZSAoaW5jbHVkaW5nIHVuZGVmaW5lZCwgYSB0aGVuYWJsZSwgb3IgYSBwcm9taXNlKS5cbiAgLSBgZXhjZXB0aW9uYCBpcyBhIHZhbHVlIHRoYXQgaXMgdGhyb3duIHVzaW5nIHRoZSB0aHJvdyBzdGF0ZW1lbnQuXG4gIC0gYHJlYXNvbmAgaXMgYSB2YWx1ZSB0aGF0IGluZGljYXRlcyB3aHkgYSBwcm9taXNlIHdhcyByZWplY3RlZC5cbiAgLSBgc2V0dGxlZGAgdGhlIGZpbmFsIHJlc3Rpbmcgc3RhdGUgb2YgYSBwcm9taXNlLCBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG5cbiAgQSBwcm9taXNlIGNhbiBiZSBpbiBvbmUgb2YgdGhyZWUgc3RhdGVzOiBwZW5kaW5nLCBmdWxmaWxsZWQsIG9yIHJlamVjdGVkLlxuXG4gIFByb21pc2VzIHRoYXQgYXJlIGZ1bGZpbGxlZCBoYXZlIGEgZnVsZmlsbG1lbnQgdmFsdWUgYW5kIGFyZSBpbiB0aGUgZnVsZmlsbGVkXG4gIHN0YXRlLiAgUHJvbWlzZXMgdGhhdCBhcmUgcmVqZWN0ZWQgaGF2ZSBhIHJlamVjdGlvbiByZWFzb24gYW5kIGFyZSBpbiB0aGVcbiAgcmVqZWN0ZWQgc3RhdGUuICBBIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5ldmVyIGEgdGhlbmFibGUuXG5cbiAgUHJvbWlzZXMgY2FuIGFsc28gYmUgc2FpZCB0byAqcmVzb2x2ZSogYSB2YWx1ZS4gIElmIHRoaXMgdmFsdWUgaXMgYWxzbyBhXG4gIHByb21pc2UsIHRoZW4gdGhlIG9yaWdpbmFsIHByb21pc2UncyBzZXR0bGVkIHN0YXRlIHdpbGwgbWF0Y2ggdGhlIHZhbHVlJ3NcbiAgc2V0dGxlZCBzdGF0ZS4gIFNvIGEgcHJvbWlzZSB0aGF0ICpyZXNvbHZlcyogYSBwcm9taXNlIHRoYXQgcmVqZWN0cyB3aWxsXG4gIGl0c2VsZiByZWplY3QsIGFuZCBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IGZ1bGZpbGxzIHdpbGxcbiAgaXRzZWxmIGZ1bGZpbGwuXG5cblxuICBCYXNpYyBVc2FnZTpcbiAgLS0tLS0tLS0tLS0tXG5cbiAgYGBganNcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICAvLyBvbiBzdWNjZXNzXG4gICAgcmVzb2x2ZSh2YWx1ZSk7XG5cbiAgICAvLyBvbiBmYWlsdXJlXG4gICAgcmVqZWN0KHJlYXNvbik7XG4gIH0pO1xuXG4gIHByb21pc2UudGhlbihmdW5jdGlvbih2YWx1ZSkge1xuICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vIG9uIHJlamVjdGlvblxuICB9KTtcbiAgYGBgXG5cbiAgQWR2YW5jZWQgVXNhZ2U6XG4gIC0tLS0tLS0tLS0tLS0tLVxuXG4gIFByb21pc2VzIHNoaW5lIHdoZW4gYWJzdHJhY3RpbmcgYXdheSBhc3luY2hyb25vdXMgaW50ZXJhY3Rpb25zIHN1Y2ggYXNcbiAgYFhNTEh0dHBSZXF1ZXN0YHMuXG5cbiAgYGBganNcbiAgZnVuY3Rpb24gZ2V0SlNPTih1cmwpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICAgIGxldCB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgeGhyLm9wZW4oJ0dFVCcsIHVybCk7XG4gICAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gaGFuZGxlcjtcbiAgICAgIHhoci5yZXNwb25zZVR5cGUgPSAnanNvbic7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignQWNjZXB0JywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgIHhoci5zZW5kKCk7XG5cbiAgICAgIGZ1bmN0aW9uIGhhbmRsZXIoKSB7XG4gICAgICAgIGlmICh0aGlzLnJlYWR5U3RhdGUgPT09IHRoaXMuRE9ORSkge1xuICAgICAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMjAwKSB7XG4gICAgICAgICAgICByZXNvbHZlKHRoaXMucmVzcG9uc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZWplY3QobmV3IEVycm9yKCdnZXRKU09OOiBgJyArIHVybCArICdgIGZhaWxlZCB3aXRoIHN0YXR1czogWycgKyB0aGlzLnN0YXR1cyArICddJykpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldEpTT04oJy9wb3N0cy5qc29uJykudGhlbihmdW5jdGlvbihqc29uKSB7XG4gICAgLy8gb24gZnVsZmlsbG1lbnRcbiAgfSwgZnVuY3Rpb24ocmVhc29uKSB7XG4gICAgLy8gb24gcmVqZWN0aW9uXG4gIH0pO1xuICBgYGBcblxuICBVbmxpa2UgY2FsbGJhY2tzLCBwcm9taXNlcyBhcmUgZ3JlYXQgY29tcG9zYWJsZSBwcmltaXRpdmVzLlxuXG4gIGBgYGpzXG4gIFByb21pc2UuYWxsKFtcbiAgICBnZXRKU09OKCcvcG9zdHMnKSxcbiAgICBnZXRKU09OKCcvY29tbWVudHMnKVxuICBdKS50aGVuKGZ1bmN0aW9uKHZhbHVlcyl7XG4gICAgdmFsdWVzWzBdIC8vID0+IHBvc3RzSlNPTlxuICAgIHZhbHVlc1sxXSAvLyA9PiBjb21tZW50c0pTT05cblxuICAgIHJldHVybiB2YWx1ZXM7XG4gIH0pO1xuICBgYGBcblxuICBAY2xhc3MgUHJvbWlzZVxuICBAcGFyYW0ge2Z1bmN0aW9ufSByZXNvbHZlclxuICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gIEBjb25zdHJ1Y3RvclxuKi9cbmZ1bmN0aW9uIFByb21pc2UocmVzb2x2ZXIpIHtcbiAgdGhpc1tQUk9NSVNFX0lEXSA9IG5leHRJZCgpO1xuICB0aGlzLl9yZXN1bHQgPSB0aGlzLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgdGhpcy5fc3Vic2NyaWJlcnMgPSBbXTtcblxuICBpZiAobm9vcCAhPT0gcmVzb2x2ZXIpIHtcbiAgICB0eXBlb2YgcmVzb2x2ZXIgIT09ICdmdW5jdGlvbicgJiYgbmVlZHNSZXNvbHZlcigpO1xuICAgIHRoaXMgaW5zdGFuY2VvZiBQcm9taXNlID8gaW5pdGlhbGl6ZVByb21pc2UodGhpcywgcmVzb2x2ZXIpIDogbmVlZHNOZXcoKTtcbiAgfVxufVxuXG5Qcm9taXNlLmFsbCA9IGFsbDtcblByb21pc2UucmFjZSA9IHJhY2U7XG5Qcm9taXNlLnJlc29sdmUgPSByZXNvbHZlO1xuUHJvbWlzZS5yZWplY3QgPSByZWplY3Q7XG5Qcm9taXNlLl9zZXRTY2hlZHVsZXIgPSBzZXRTY2hlZHVsZXI7XG5Qcm9taXNlLl9zZXRBc2FwID0gc2V0QXNhcDtcblByb21pc2UuX2FzYXAgPSBhc2FwO1xuXG5Qcm9taXNlLnByb3RvdHlwZSA9IHtcbiAgY29uc3RydWN0b3I6IFByb21pc2UsXG5cbiAgLyoqXG4gICAgVGhlIHByaW1hcnkgd2F5IG9mIGludGVyYWN0aW5nIHdpdGggYSBwcm9taXNlIGlzIHRocm91Z2ggaXRzIGB0aGVuYCBtZXRob2QsXG4gICAgd2hpY2ggcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGVcbiAgICByZWFzb24gd2h5IHRoZSBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQuXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uKHVzZXIpe1xuICAgICAgLy8gdXNlciBpcyBhdmFpbGFibGVcbiAgICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gdXNlciBpcyB1bmF2YWlsYWJsZSwgYW5kIHlvdSBhcmUgZ2l2ZW4gdGhlIHJlYXNvbiB3aHlcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQ2hhaW5pbmdcbiAgICAtLS0tLS0tLVxuICBcbiAgICBUaGUgcmV0dXJuIHZhbHVlIG9mIGB0aGVuYCBpcyBpdHNlbGYgYSBwcm9taXNlLiAgVGhpcyBzZWNvbmQsICdkb3duc3RyZWFtJ1xuICAgIHByb21pc2UgaXMgcmVzb2x2ZWQgd2l0aCB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBmaXJzdCBwcm9taXNlJ3MgZnVsZmlsbG1lbnRcbiAgICBvciByZWplY3Rpb24gaGFuZGxlciwgb3IgcmVqZWN0ZWQgaWYgdGhlIGhhbmRsZXIgdGhyb3dzIGFuIGV4Y2VwdGlvbi5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHJldHVybiB1c2VyLm5hbWU7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgcmV0dXJuICdkZWZhdWx0IG5hbWUnO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHVzZXJOYW1lKSB7XG4gICAgICAvLyBJZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHVzZXJOYW1lYCB3aWxsIGJlIHRoZSB1c2VyJ3MgbmFtZSwgb3RoZXJ3aXNlIGl0XG4gICAgICAvLyB3aWxsIGJlIGAnZGVmYXVsdCBuYW1lJ2BcbiAgICB9KTtcbiAgXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jyk7XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdgZmluZFVzZXJgIHJlamVjdGVkIGFuZCB3ZSdyZSB1bmhhcHB5Jyk7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAvLyBpZiBgZmluZFVzZXJgIGZ1bGZpbGxlZCwgYHJlYXNvbmAgd2lsbCBiZSAnRm91bmQgdXNlciwgYnV0IHN0aWxsIHVuaGFwcHknLlxuICAgICAgLy8gSWYgYGZpbmRVc2VyYCByZWplY3RlZCwgYHJlYXNvbmAgd2lsbCBiZSAnYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScuXG4gICAgfSk7XG4gICAgYGBgXG4gICAgSWYgdGhlIGRvd25zdHJlYW0gcHJvbWlzZSBkb2VzIG5vdCBzcGVjaWZ5IGEgcmVqZWN0aW9uIGhhbmRsZXIsIHJlamVjdGlvbiByZWFzb25zIHdpbGwgYmUgcHJvcGFnYXRlZCBmdXJ0aGVyIGRvd25zdHJlYW0uXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICB0aHJvdyBuZXcgUGVkYWdvZ2ljYWxFeGNlcHRpb24oJ1Vwc3RyZWFtIGVycm9yJyk7XG4gICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgLy8gbmV2ZXIgcmVhY2hlZFxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIC8vIFRoZSBgUGVkZ2Fnb2NpYWxFeGNlcHRpb25gIGlzIHByb3BhZ2F0ZWQgYWxsIHRoZSB3YXkgZG93biB0byBoZXJlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEFzc2ltaWxhdGlvblxuICAgIC0tLS0tLS0tLS0tLVxuICBcbiAgICBTb21ldGltZXMgdGhlIHZhbHVlIHlvdSB3YW50IHRvIHByb3BhZ2F0ZSB0byBhIGRvd25zdHJlYW0gcHJvbWlzZSBjYW4gb25seSBiZVxuICAgIHJldHJpZXZlZCBhc3luY2hyb25vdXNseS4gVGhpcyBjYW4gYmUgYWNoaWV2ZWQgYnkgcmV0dXJuaW5nIGEgcHJvbWlzZSBpbiB0aGVcbiAgICBmdWxmaWxsbWVudCBvciByZWplY3Rpb24gaGFuZGxlci4gVGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIHRoZW4gYmUgcGVuZGluZ1xuICAgIHVudGlsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlzIHNldHRsZWQuIFRoaXMgaXMgY2FsbGVkICphc3NpbWlsYXRpb24qLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAvLyBUaGUgdXNlcidzIGNvbW1lbnRzIGFyZSBub3cgYXZhaWxhYmxlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIElmIHRoZSBhc3NpbWxpYXRlZCBwcm9taXNlIHJlamVjdHMsIHRoZW4gdGhlIGRvd25zdHJlYW0gcHJvbWlzZSB3aWxsIGFsc28gcmVqZWN0LlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgcmV0dXJuIGZpbmRDb21tZW50c0J5QXV0aG9yKHVzZXIpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKGNvbW1lbnRzKSB7XG4gICAgICAvLyBJZiBgZmluZENvbW1lbnRzQnlBdXRob3JgIGZ1bGZpbGxzLCB3ZSdsbCBoYXZlIHRoZSB2YWx1ZSBoZXJlXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCByZWplY3RzLCB3ZSdsbCBoYXZlIHRoZSByZWFzb24gaGVyZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBTaW1wbGUgRXhhbXBsZVxuICAgIC0tLS0tLS0tLS0tLS0tXG4gIFxuICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGxldCByZXN1bHQ7XG4gIFxuICAgIHRyeSB7XG4gICAgICByZXN1bHQgPSBmaW5kUmVzdWx0KCk7XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9XG4gICAgYGBgXG4gIFxuICAgIEVycmJhY2sgRXhhbXBsZVxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRSZXN1bHQoZnVuY3Rpb24ocmVzdWx0LCBlcnIpe1xuICAgICAgaWYgKGVycikge1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9XG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIFByb21pc2UgRXhhbXBsZTtcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGZpbmRSZXN1bHQoKS50aGVuKGZ1bmN0aW9uKHJlc3VsdCl7XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQWR2YW5jZWQgRXhhbXBsZVxuICAgIC0tLS0tLS0tLS0tLS0tXG4gIFxuICAgIFN5bmNocm9ub3VzIEV4YW1wbGVcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGxldCBhdXRob3IsIGJvb2tzO1xuICBcbiAgICB0cnkge1xuICAgICAgYXV0aG9yID0gZmluZEF1dGhvcigpO1xuICAgICAgYm9va3MgID0gZmluZEJvb2tzQnlBdXRob3IoYXV0aG9yKTtcbiAgICAgIC8vIHN1Y2Nlc3NcbiAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgLy8gZmFpbHVyZVxuICAgIH1cbiAgICBgYGBcbiAgXG4gICAgRXJyYmFjayBFeGFtcGxlXG4gIFxuICAgIGBgYGpzXG4gIFxuICAgIGZ1bmN0aW9uIGZvdW5kQm9va3MoYm9va3MpIHtcbiAgXG4gICAgfVxuICBcbiAgICBmdW5jdGlvbiBmYWlsdXJlKHJlYXNvbikge1xuICBcbiAgICB9XG4gIFxuICAgIGZpbmRBdXRob3IoZnVuY3Rpb24oYXV0aG9yLCBlcnIpe1xuICAgICAgaWYgKGVycikge1xuICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgIC8vIGZhaWx1cmVcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgZmluZEJvb29rc0J5QXV0aG9yKGF1dGhvciwgZnVuY3Rpb24oYm9va3MsIGVycikge1xuICAgICAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgICAgICBmYWlsdXJlKGVycik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGZvdW5kQm9va3MoYm9va3MpO1xuICAgICAgICAgICAgICB9IGNhdGNoKHJlYXNvbikge1xuICAgICAgICAgICAgICAgIGZhaWx1cmUocmVhc29uKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9IGNhdGNoKGVycm9yKSB7XG4gICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIHN1Y2Nlc3NcbiAgICAgIH1cbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgUHJvbWlzZSBFeGFtcGxlO1xuICBcbiAgICBgYGBqYXZhc2NyaXB0XG4gICAgZmluZEF1dGhvcigpLlxuICAgICAgdGhlbihmaW5kQm9va3NCeUF1dGhvcikuXG4gICAgICB0aGVuKGZ1bmN0aW9uKGJvb2tzKXtcbiAgICAgICAgLy8gZm91bmQgYm9va3NcbiAgICB9KS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQG1ldGhvZCB0aGVuXG4gICAgQHBhcmFtIHtGdW5jdGlvbn0gb25GdWxmaWxsZWRcbiAgICBAcGFyYW0ge0Z1bmN0aW9ufSBvblJlamVjdGVkXG4gICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICovXG4gIHRoZW46IHRoZW4sXG5cbiAgLyoqXG4gICAgYGNhdGNoYCBpcyBzaW1wbHkgc3VnYXIgZm9yIGB0aGVuKHVuZGVmaW5lZCwgb25SZWplY3Rpb24pYCB3aGljaCBtYWtlcyBpdCB0aGUgc2FtZVxuICAgIGFzIHRoZSBjYXRjaCBibG9jayBvZiBhIHRyeS9jYXRjaCBzdGF0ZW1lbnQuXG4gIFxuICAgIGBgYGpzXG4gICAgZnVuY3Rpb24gZmluZEF1dGhvcigpe1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdjb3VsZG4ndCBmaW5kIHRoYXQgYXV0aG9yJyk7XG4gICAgfVxuICBcbiAgICAvLyBzeW5jaHJvbm91c1xuICAgIHRyeSB7XG4gICAgICBmaW5kQXV0aG9yKCk7XG4gICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgfVxuICBcbiAgICAvLyBhc3luYyB3aXRoIHByb21pc2VzXG4gICAgZmluZEF1dGhvcigpLmNhdGNoKGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBAbWV0aG9kIGNhdGNoXG4gICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3Rpb25cbiAgICBVc2VmdWwgZm9yIHRvb2xpbmcuXG4gICAgQHJldHVybiB7UHJvbWlzZX1cbiAgKi9cbiAgJ2NhdGNoJzogZnVuY3Rpb24gX2NhdGNoKG9uUmVqZWN0aW9uKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihudWxsLCBvblJlamVjdGlvbik7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHBvbHlmaWxsKCkge1xuICAgIHZhciBsb2NhbCA9IHVuZGVmaW5lZDtcblxuICAgIGlmICh0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2NhbCA9IGdsb2JhbDtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBsb2NhbCA9IHNlbGY7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxvY2FsID0gRnVuY3Rpb24oJ3JldHVybiB0aGlzJykoKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwb2x5ZmlsbCBmYWlsZWQgYmVjYXVzZSBnbG9iYWwgb2JqZWN0IGlzIHVuYXZhaWxhYmxlIGluIHRoaXMgZW52aXJvbm1lbnQnKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBQID0gbG9jYWwuUHJvbWlzZTtcblxuICAgIGlmIChQKSB7XG4gICAgICAgIHZhciBwcm9taXNlVG9TdHJpbmcgPSBudWxsO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJvbWlzZVRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKFAucmVzb2x2ZSgpKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gc2lsZW50bHkgaWdub3JlZFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHByb21pc2VUb1N0cmluZyA9PT0gJ1tvYmplY3QgUHJvbWlzZV0nICYmICFQLmNhc3QpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGxvY2FsLlByb21pc2UgPSBQcm9taXNlO1xufVxuXG5wb2x5ZmlsbCgpO1xuLy8gU3RyYW5nZSBjb21wYXQuLlxuUHJvbWlzZS5wb2x5ZmlsbCA9IHBvbHlmaWxsO1xuUHJvbWlzZS5Qcm9taXNlID0gUHJvbWlzZTtcblxucmV0dXJuIFByb21pc2U7XG5cbn0pKSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lczYtcHJvbWlzZS5tYXAiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIl19
