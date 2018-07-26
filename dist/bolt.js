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
                if ((innerPrecedence >= outerPrecedence) && ((expOp.op === '&&') || (expOp.op === '||'))) {
                    result = '(' + result + ')';
                }
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJsaWIvYXN0LnRzIiwibGliL2JvbHQudHMiLCJsaWIvbG9nZ2VyLnRzIiwibGliL3BhcnNlLXV0aWwudHMiLCJsaWIvcnVsZXMtZ2VuZXJhdG9yLnRzIiwibGliL3J1bGVzLXBhcnNlci5qcyIsImxpYi91dGlsLnRzIiwibm9kZV9tb2R1bGVzL2VzNi1wcm9taXNlL2Rpc3QvZXM2LXByb21pc2UuanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUNBQTs7Ozs7Ozs7Ozs7Ozs7OztHQWdCRztBQUNILDZCQUErQjtBQUMvQixpQ0FBbUM7QUFFbkMsSUFBSSxNQUFNLEdBQUc7SUFDWCxZQUFZLEVBQUUsbUJBQW1CO0lBQ2pDLGlCQUFpQixFQUFFLHVDQUF1QztDQUMzRCxDQUFDO0FBNEM4QyxDQUFDO0FBU08sQ0FBQztBQXVCekQ7SUFJRSx3Q0FBd0M7SUFDeEMsbUNBQW1DO0lBQ25DLHFDQUFxQztJQUNyQyxrQkFBWSxLQUFhLEVBQUUsUUFBaUI7UUFDMUMsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLFFBQVEsS0FBSyxTQUFTLEVBQUU7WUFDOUMsUUFBUSxHQUFHLEtBQUssQ0FBQztTQUNsQjtRQUNELElBQUksUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7WUFDaEMsS0FBSyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUM7U0FDckI7UUFDRCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsUUFBUSxHQUFZLFFBQVEsQ0FBQztJQUNwQyxDQUFDO0lBQ0gsZUFBQztBQUFELENBakJBLEFBaUJDLElBQUE7QUFqQlksNEJBQVE7QUFtQnJCO0lBR0Usc0JBQVksS0FBa0M7UUFBbEMsc0JBQUEsRUFBQSxRQUFnQyxFQUFFO1FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNqb0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLypcbiAqIEFTVCBidWlsZGVycyBmb3IgRmlyZWJhc2UgUnVsZXMgTGFuZ3VhZ2UuXG4gKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cbmltcG9ydCAqIGFzIHV0aWwgZnJvbSAnLi91dGlsJztcbmltcG9ydCAqIGFzIGxvZ2dlciBmcm9tICcuL2xvZ2dlcic7XG5cbnZhciBlcnJvcnMgPSB7XG4gIHR5cGVNaXNtYXRjaDogXCJVbmV4cGVjdGVkIHR5cGU6IFwiLFxuICBkdXBsaWNhdGVQYXRoUGFydDogXCJBIHBhdGggY29tcG9uZW50IG5hbWUgaXMgZHVwbGljYXRlZDogXCIsXG59O1xuXG5leHBvcnQgdHlwZSBPYmplY3QgPSB7IFtwcm9wOiBzdHJpbmddOiBhbnkgfTtcblxuZXhwb3J0IGludGVyZmFjZSBFeHAge1xuICB0eXBlOiBzdHJpbmc7XG4gIHZhbHVlVHlwZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEV4cFZhbHVlIGV4dGVuZHMgRXhwIHtcbiAgdmFsdWU6IGFueTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWdFeHBWYWx1ZSBleHRlbmRzIEV4cFZhbHVlIHtcbiAgbW9kaWZpZXJzOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwTnVsbCBleHRlbmRzIEV4cCB7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwT3AgZXh0ZW5kcyBFeHAge1xuICBvcDogc3RyaW5nO1xuICBhcmdzOiBFeHBbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHBWYXJpYWJsZSBleHRlbmRzIEV4cCB7XG4gIG5hbWU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHBMaXRlcmFsIGV4dGVuZHMgRXhwIHtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG4vLyBiYXNlW2FjY2Vzc29yXVxuZXhwb3J0IGludGVyZmFjZSBFeHBSZWZlcmVuY2UgZXh0ZW5kcyBFeHAge1xuICBiYXNlOiBFeHA7XG4gIGFjY2Vzc29yOiBFeHA7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwQ2FsbCBleHRlbmRzIEV4cCB7XG4gIHJlZjogRXhwUmVmZXJlbmNlIHwgRXhwVmFyaWFibGU7XG4gIGFyZ3M6IEV4cFtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBhcmFtcyB7IFtuYW1lOiBzdHJpbmddOiBFeHA7IH07XG5cbmV4cG9ydCB0eXBlIEJ1aWx0aW5GdW5jdGlvbiA9IChhcmdzOiBFeHBbXSwgcGFyYW1zOiBQYXJhbXMpID0+IEV4cDtcblxuZXhwb3J0IGludGVyZmFjZSBFeHBCdWlsdGluIGV4dGVuZHMgRXhwIHtcbiAgZm46IEJ1aWx0aW5GdW5jdGlvbjtcbn1cblxuZXhwb3J0IHR5cGUgRXhwVHlwZSA9IEV4cFNpbXBsZVR5cGUgfCBFeHBVbmlvblR5cGUgfCBFeHBHZW5lcmljVHlwZTtcbmV4cG9ydCBpbnRlcmZhY2UgVHlwZVBhcmFtcyB7IFtuYW1lOiBzdHJpbmddOiBFeHBUeXBlOyB9O1xuXG4vLyBTaW1wbGUgVHlwZSAocmVmZXJlbmNlKVxuZXhwb3J0IGludGVyZmFjZSBFeHBTaW1wbGVUeXBlIGV4dGVuZHMgRXhwIHtcbiAgbmFtZTogc3RyaW5nO1xufVxuXG4vLyBVbmlvbiBUeXBlOiBUeXBlMSB8IFR5cGUyIHwgLi4uXG5leHBvcnQgaW50ZXJmYWNlIEV4cFVuaW9uVHlwZSBleHRlbmRzIEV4cCB7XG4gIHR5cGVzOiBFeHBUeXBlW107XG59XG5cbi8vIEdlbmVyaWMgVHlwZSAocmVmZXJlbmNlKTogVHlwZTxUeXBlMSwgVHlwZTIsIC4uLj5cbmV4cG9ydCBpbnRlcmZhY2UgRXhwR2VuZXJpY1R5cGUgZXh0ZW5kcyBFeHAge1xuICBuYW1lOiBzdHJpbmc7XG4gIHBhcmFtczogRXhwVHlwZVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE1ldGhvZCB7XG4gIHBhcmFtczogc3RyaW5nW107XG4gIGJvZHk6IEV4cDtcbn1cblxuZXhwb3J0IGNsYXNzIFBhdGhQYXJ0IHtcbiAgbGFiZWw6IHN0cmluZztcbiAgdmFyaWFibGU6IHN0cmluZztcblxuICAvLyBcImxhYmVsXCIsIHVuZGVmaW5lZCAtIHN0YXRpYyBwYXRoIHBhcnRcbiAgLy8gXCIkbGFiZWxcIiwgWCAtIHZhcmlhYmxlIHBhdGggcGFydFxuICAvLyBYLCAhdW5kZWZpbmVkIC0gdmFyaWFibGUgcGF0aCBwYXJ0XG4gIGNvbnN0cnVjdG9yKGxhYmVsOiBzdHJpbmcsIHZhcmlhYmxlPzogc3RyaW5nKSB7XG4gICAgaWYgKGxhYmVsWzBdID09PSAnJCcgJiYgdmFyaWFibGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFyaWFibGUgPSBsYWJlbDtcbiAgICB9XG4gICAgaWYgKHZhcmlhYmxlICYmIGxhYmVsWzBdICE9PSAnJCcpIHtcbiAgICAgIGxhYmVsID0gJyQnICsgbGFiZWw7XG4gICAgfVxuICAgIHRoaXMubGFiZWwgPSBsYWJlbDtcbiAgICB0aGlzLnZhcmlhYmxlID0gPHN0cmluZz4gdmFyaWFibGU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhdGhUZW1wbGF0ZSB7XG4gIHBhcnRzOiBQYXRoUGFydFtdO1xuXG4gIGNvbnN0cnVjdG9yKHBhcnRzID0gPChzdHJpbmcgfCBQYXRoUGFydClbXT4gW10pIHtcbiAgICB0aGlzLnBhcnRzID0gPFBhdGhQYXJ0W10+IHBhcnRzLm1hcCgocGFydCkgPT4ge1xuICAgICAgaWYgKHV0aWwuaXNUeXBlKHBhcnQsICdzdHJpbmcnKSkge1xuICAgICAgICByZXR1cm4gbmV3IFBhdGhQYXJ0KDxzdHJpbmc+IHBhcnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIDxQYXRoUGFydD4gcGFydDtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGNvcHkoKSB7XG4gICAgbGV0IHJlc3VsdCA9IG5ldyBQYXRoVGVtcGxhdGUoKTtcbiAgICByZXN1bHQucHVzaCh0aGlzKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZ2V0TGFiZWxzKCk6IHN0cmluZ1tdIHtcbiAgICByZXR1cm4gdGhpcy5wYXJ0cy5tYXAoKHBhcnQpID0+IHBhcnQubGFiZWwpO1xuICB9XG5cbiAgLy8gTWFwcGluZyBmcm9tIHZhcmlhYmxlcyB0byBKU09OIGxhYmVsc1xuICBnZXRTY29wZSgpOiBQYXJhbXMge1xuICAgIGxldCByZXN1bHQgPSA8UGFyYW1zPiB7fTtcbiAgICB0aGlzLnBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcbiAgICAgIGlmIChwYXJ0LnZhcmlhYmxlKSB7XG4gICAgICAgIGlmIChyZXN1bHRbcGFydC52YXJpYWJsZV0pIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmR1cGxpY2F0ZVBhdGhQYXJ0ICsgcGFydC52YXJpYWJsZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0W3BhcnQudmFyaWFibGVdID0gbGl0ZXJhbChwYXJ0LmxhYmVsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHVzaCh0ZW1wOiBQYXRoVGVtcGxhdGUpIHtcbiAgICB1dGlsLmV4dGVuZEFycmF5KHRoaXMucGFydHMsIHRlbXAucGFydHMpO1xuICB9XG5cbiAgcG9wKHRlbXA6IFBhdGhUZW1wbGF0ZSkge1xuICAgIHRlbXAucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xuICAgICAgdGhpcy5wYXJ0cy5wb3AoKTtcbiAgICB9KTtcbiAgfVxuXG4gIGxlbmd0aCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLnBhcnRzLmxlbmd0aDtcbiAgfVxuXG4gIGdldFBhcnQoaTogbnVtYmVyKTogUGF0aFBhcnQge1xuICAgIGlmIChpID4gdGhpcy5wYXJ0cy5sZW5ndGggfHwgaSA8IC10aGlzLnBhcnRzLmxlbmd0aCkge1xuICAgICAgbGV0IGwgPSB0aGlzLnBhcnRzLmxlbmd0aDtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlBhdGggcmVmZXJlbmNlIG91dCBvZiBib3VuZHM6IFwiICsgaSArXG4gICAgICAgICAgICAgICAgICAgICAgXCIgW1wiICsgLWwgKyBcIiAuLiBcIiArIGwgKyBcIl1cIik7XG4gICAgfVxuICAgIGlmIChpIDwgMCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFydHNbdGhpcy5wYXJ0cy5sZW5ndGggKyBpXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFydHNbaV07XG4gIH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBQYXRoIHtcbiAgdGVtcGxhdGU6IFBhdGhUZW1wbGF0ZTtcbiAgaXNUeXBlOiBFeHBUeXBlO1xuICBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcbn07XG5cbmV4cG9ydCBjbGFzcyBTY2hlbWEge1xuICBkZXJpdmVkRnJvbTogRXhwVHlwZTtcbiAgcHJvcGVydGllczogVHlwZVBhcmFtcztcbiAgbWV0aG9kczogeyBbbmFtZTogc3RyaW5nXTogTWV0aG9kIH07XG5cbiAgLy8gR2VuZXJpYyBwYXJhbWV0ZXJzIC0gaWYgYSBHZW5lcmljIHNjaGVtYVxuICBwYXJhbXM/OiBzdHJpbmdbXTtcbiAgZ2V0VmFsaWRhdG9yPzogKHBhcmFtczogRXhwW10pID0+IE9iamVjdDtcblxuICBzdGF0aWMgaXNHZW5lcmljKHNjaGVtYTogU2NoZW1hKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHNjaGVtYS5wYXJhbXMgIT09IHVuZGVmaW5lZCAmJiBzY2hlbWEucGFyYW1zLmxlbmd0aCA+IDA7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgc3RyaW5nOiAodjogc3RyaW5nKSA9PiBFeHBWYWx1ZSA9IHZhbHVlR2VuKCdTdHJpbmcnKTtcbmV4cG9ydCB2YXIgYm9vbGVhbjogKHY6IGJvb2xlYW4pID0+IEV4cFZhbHVlID0gdmFsdWVHZW4oJ0Jvb2xlYW4nKTtcbmV4cG9ydCB2YXIgbnVtYmVyOiAodjogbnVtYmVyKSA9PiBFeHBWYWx1ZSA9IHZhbHVlR2VuKCdOdW1iZXInKTtcbmV4cG9ydCB2YXIgYXJyYXk6ICh2OiBBcnJheTxhbnk+KSA9PiBFeHBWYWx1ZSA9IHZhbHVlR2VuKCdBcnJheScpO1xuXG5leHBvcnQgdmFyIG5lZyA9IG9wR2VuKCduZWcnLCAxKTtcbmV4cG9ydCB2YXIgbm90ID0gb3BHZW4oJyEnLCAxKTtcbmV4cG9ydCB2YXIgbXVsdCA9IG9wR2VuKCcqJyk7XG5leHBvcnQgdmFyIGRpdiA9IG9wR2VuKCcvJyk7XG5leHBvcnQgdmFyIG1vZCA9IG9wR2VuKCclJyk7XG5leHBvcnQgdmFyIGFkZCA9IG9wR2VuKCcrJyk7XG5leHBvcnQgdmFyIHN1YiA9IG9wR2VuKCctJyk7XG5leHBvcnQgdmFyIGVxID0gb3BHZW4oJz09Jyk7XG5leHBvcnQgdmFyIGx0ID0gb3BHZW4oJzwnKTtcbmV4cG9ydCB2YXIgbHRlID0gb3BHZW4oJzw9Jyk7XG5leHBvcnQgdmFyIGd0ID0gb3BHZW4oJz4nKTtcbmV4cG9ydCB2YXIgZ3RlID0gb3BHZW4oJz49Jyk7XG5leHBvcnQgdmFyIG5lID0gb3BHZW4oJyE9Jyk7XG5leHBvcnQgdmFyIGFuZCA9IG9wR2VuKCcmJicpO1xuZXhwb3J0IHZhciBvciA9IG9wR2VuKCd8fCcpO1xuZXhwb3J0IHZhciB0ZXJuYXJ5ID0gb3BHZW4oJz86JywgMyk7XG5leHBvcnQgdmFyIHZhbHVlID0gb3BHZW4oJ3ZhbHVlJywgMSk7XG5cbmV4cG9ydCBmdW5jdGlvbiB2YXJpYWJsZShuYW1lOiBzdHJpbmcpOiBFeHBWYXJpYWJsZSB7XG4gIHJldHVybiB7IHR5cGU6ICd2YXInLCB2YWx1ZVR5cGU6ICdBbnknLCBuYW1lOiBuYW1lIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsaXRlcmFsKG5hbWU6IHN0cmluZyk6IEV4cExpdGVyYWwge1xuICByZXR1cm4geyB0eXBlOiAnbGl0ZXJhbCcsIHZhbHVlVHlwZTogJ0FueScsIG5hbWU6IG5hbWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG51bGxUeXBlKCk6IEV4cE51bGwge1xuICByZXR1cm4geyB0eXBlOiAnTnVsbCcsIHZhbHVlVHlwZTogJ051bGwnIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZlcmVuY2UoYmFzZTogRXhwLCBwcm9wOiBFeHApOiBFeHBSZWZlcmVuY2Uge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdyZWYnLFxuICAgIHZhbHVlVHlwZTogJ0FueScsXG4gICAgYmFzZTogYmFzZSxcbiAgICBhY2Nlc3NvcjogcHJvcFxuICB9O1xufVxuXG5sZXQgcmVJZGVudGlmaWVyID0gL15bYS16QS1aXyRdW2EtekEtWjAtOV9dKiQvO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNJZGVudGlmaWVyU3RyaW5nRXhwKGV4cDogRXhwKSB7XG4gIHJldHVybiBleHAudHlwZSA9PT0gJ1N0cmluZycgJiYgcmVJZGVudGlmaWVyLnRlc3QoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XG59XG5cbi8vIFNoYWxsb3cgY29weSBvZiBhbiBleHByZXNzaW9uIChzbyBpdCBjYW4gYmUgbW9kaWZpZWQgYW5kIHByZXNlcnZlXG4vLyBpbW11dGFiaWxpdHkgb2YgdGhlIG9yaWdpbmFsIGV4cHJlc3Npb24pLlxuZXhwb3J0IGZ1bmN0aW9uIGNvcHlFeHAoZXhwOiBFeHApOiBFeHAge1xuICBleHAgPSA8RXhwPiB1dGlsLmV4dGVuZCh7fSwgZXhwKTtcbiAgc3dpdGNoIChleHAudHlwZSkge1xuICBjYXNlICdvcCc6XG4gIGNhc2UgJ2NhbGwnOlxuICAgIGxldCBvcEV4cCA9IDxFeHBPcD4gZXhwO1xuICAgIG9wRXhwLmFyZ3MgPSB1dGlsLmNvcHlBcnJheShvcEV4cC5hcmdzKTtcbiAgICByZXR1cm4gb3BFeHA7XG5cbiAgY2FzZSAndW5pb24nOlxuICAgIGxldCB1bmlvbkV4cCA9IDxFeHBVbmlvblR5cGU+IGV4cDtcbiAgICB1bmlvbkV4cC50eXBlcyA9IHV0aWwuY29weUFycmF5KHVuaW9uRXhwLnR5cGVzKTtcbiAgICByZXR1cm4gdW5pb25FeHA7XG5cbiAgY2FzZSAnZ2VuZXJpYyc6XG4gICAgbGV0IGdlbmVyaWNFeHAgPSA8RXhwR2VuZXJpY1R5cGU+IGV4cDtcbiAgICBnZW5lcmljRXhwLnBhcmFtcyA9IHV0aWwuY29weUFycmF5KGdlbmVyaWNFeHAucGFyYW1zKTtcbiAgICByZXR1cm4gZ2VuZXJpY0V4cDtcblxuICBkZWZhdWx0OlxuICAgICByZXR1cm4gZXhwO1xuICB9XG59XG5cbi8vIE1ha2UgYSAoc2hhbGxvdykgY29weSBvZiB0aGUgYmFzZSBleHByZXNzaW9uLCBzZXR0aW5nIChvciByZW1vdmluZykgaXQnc1xuLy8gdmFsdWVUeXBlLlxuLy9cbi8vIHZhbHVlVHlwZSBpcyBhIHN0cmluZyBpbmRpY2F0aW5nIHRoZSB0eXBlIG9mIGV2YWx1YXRpbmcgYW4gZXhwcmVzc2lvbiAoZS5nLlxuLy8gJ1NuYXBzaG90JykgLSB1c2VkIHRvIGtub3cgd2hlbiB0eXBlIGNvZXJjaW9uIGlzIG5lZWRlZCBpbiB0aGUgY29udGV4dFxuLy8gb2YgcGFyZW50IGV4cHJlc3Npb25zLlxuZXhwb3J0IGZ1bmN0aW9uIGNhc3QoYmFzZTogRXhwLCB2YWx1ZVR5cGU6IHN0cmluZyk6IEV4cCB7XG4gIHZhciByZXN1bHQgPSBjb3B5RXhwKGJhc2UpO1xuICByZXN1bHQudmFsdWVUeXBlID0gdmFsdWVUeXBlO1xuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FsbChyZWY6IEV4cFJlZmVyZW5jZSB8IEV4cFZhcmlhYmxlLCBhcmdzOiBFeHBbXT0gW10pOiBFeHBDYWxsIHtcbiAgcmV0dXJuIHsgdHlwZTogJ2NhbGwnLCB2YWx1ZVR5cGU6ICdBbnknLCByZWY6IHJlZiwgYXJnczogYXJncyB9O1xufVxuXG4vLyBSZXR1cm4gZW1wdHkgc3RyaW5nIGlmIG5vdCBhIGZ1bmN0aW9uLlxuZXhwb3J0IGZ1bmN0aW9uIGdldEZ1bmN0aW9uTmFtZShleHA6IEV4cENhbGwpOiBzdHJpbmcge1xuICBpZiAoZXhwLnJlZi50eXBlID09PSAncmVmJykge1xuICAgIHJldHVybiAnJztcbiAgfVxuICByZXR1cm4gKDxFeHBWYXJpYWJsZT4gZXhwLnJlZikubmFtZTtcbn1cblxuLy8gUmV0dXJuIGVtcHR5IHN0cmluZyBpZiBub3QgYSAoc2ltcGxlKSBtZXRob2QgY2FsbCAtLSByZWYuZm4oKVxuZXhwb3J0IGZ1bmN0aW9uIGdldE1ldGhvZE5hbWUoZXhwOiBFeHBDYWxsKTogc3RyaW5nIHtcbiAgaWYgKGV4cC5yZWYudHlwZSA9PT0gJ3ZhcicpIHtcbiAgICByZXR1cm4gKDxFeHBWYXJpYWJsZT4gZXhwLnJlZikubmFtZTtcbiAgfVxuICBpZiAoZXhwLnJlZi50eXBlICE9PSAncmVmJykge1xuICAgIHJldHVybiAnJztcbiAgfVxuICByZXR1cm4gZ2V0UHJvcE5hbWUoPEV4cFJlZmVyZW5jZT4gZXhwLnJlZik7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQcm9wTmFtZShyZWY6IEV4cFJlZmVyZW5jZSk6IHN0cmluZyB7XG4gIGlmIChyZWYuYWNjZXNzb3IudHlwZSAhPT0gJ1N0cmluZycpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgcmV0dXJuICg8RXhwVmFsdWU+IHJlZi5hY2Nlc3NvcikudmFsdWU7XG59XG5cbi8vIFRPRE86IFR5cGUgb2YgZnVuY3Rpb24gc2lnbmF0dXJlIGRvZXMgbm90IGZhaWwgdGhpcyBkZWNsYXJhdGlvbj9cbmV4cG9ydCBmdW5jdGlvbiBidWlsdGluKGZuOiBCdWlsdGluRnVuY3Rpb24pOiBFeHBCdWlsdGluIHtcbiAgcmV0dXJuIHsgdHlwZTogJ2J1aWx0aW4nLCB2YWx1ZVR5cGU6ICdBbnknLCBmbjogZm4gfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBzaG90VmFyaWFibGUobmFtZTogc3RyaW5nKTogRXhwVmFyaWFibGUge1xuICByZXR1cm4gPEV4cFZhcmlhYmxlPiBjYXN0KHZhcmlhYmxlKG5hbWUpLCAnU25hcHNob3QnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBzaG90UGFyZW50KGJhc2U6IEV4cCk6IEV4cCB7XG4gIGlmIChiYXNlLnZhbHVlVHlwZSAhPT0gJ1NuYXBzaG90Jykge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMudHlwZU1pc21hdGNoICsgXCJleHBlY3RlZCBTbmFwc2hvdFwiKTtcbiAgfVxuICByZXR1cm4gY2FzdChjYWxsKHJlZmVyZW5jZShjYXN0KGJhc2UsICdBbnknKSwgc3RyaW5nKCdwYXJlbnQnKSkpLFxuICAgICAgICAgICAgICAnU25hcHNob3QnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZVZhbHVlKGV4cDogRXhwKTogRXhwIHtcbiAgaWYgKGV4cC52YWx1ZVR5cGUgPT09ICdTbmFwc2hvdCcpIHtcbiAgICByZXR1cm4gc25hcHNob3RWYWx1ZShleHApO1xuICB9XG4gIHJldHVybiBleHA7XG59XG5cbi8vIHJlZi52YWwoKVxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBzaG90VmFsdWUoZXhwOiBFeHApOiBFeHBDYWxsIHtcbiAgcmV0dXJuIGNhbGwocmVmZXJlbmNlKGNhc3QoZXhwLCAnQW55JyksIHN0cmluZygndmFsJykpKTtcbn1cblxuLy8gRW5zdXJlIGV4cHJlc3Npb24gaXMgYSBib29sZWFuICh3aGVuIHVzZWQgaW4gYSBib29sZWFuIGNvbnRleHQpLlxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZUJvb2xlYW4oZXhwOiBFeHApOiBFeHAge1xuICBleHAgPSBlbnN1cmVWYWx1ZShleHApO1xuICBpZiAoaXNDYWxsKGV4cCwgJ3ZhbCcpKSB7XG4gICAgZXhwID0gZXEoZXhwLCBib29sZWFuKHRydWUpKTtcbiAgfVxuICByZXR1cm4gZXhwO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDYWxsKGV4cDogRXhwLCBtZXRob2ROYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIGV4cC50eXBlID09PSAnY2FsbCcgJiYgKDxFeHBDYWxsPiBleHApLnJlZi50eXBlID09PSAncmVmJyAmJlxuICAgICg8RXhwUmVmZXJlbmNlPiAoPEV4cENhbGw+IGV4cCkucmVmKS5hY2Nlc3Nvci50eXBlID09PSAnU3RyaW5nJyAmJlxuICAgICg8RXhwVmFsdWU+ICg8RXhwUmVmZXJlbmNlPiAoPEV4cENhbGw+IGV4cCkucmVmKS5hY2Nlc3NvcikudmFsdWUgPT09IG1ldGhvZE5hbWU7XG59XG5cbi8vIFJldHVybiB2YWx1ZSBnZW5lcmF0aW5nIGZ1bmN0aW9uIGZvciBhIGdpdmVuIFR5cGUuXG5mdW5jdGlvbiB2YWx1ZUdlbih0eXBlTmFtZTogc3RyaW5nKTogKCh2YWw6IGFueSkgPT4gRXhwVmFsdWUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKHZhbCk6IEV4cFZhbHVlIHtcbiAgICByZXR1cm4ge1xuICAgICAgdHlwZTogdHlwZU5hbWUsICAgICAgLy8gRXhwIHR5cGUgaWRlbnRpZnlpbmcgYSBjb25zdGFudCB2YWx1ZSBvZiB0aGlzIFR5cGUuXG4gICAgICB2YWx1ZVR5cGU6IHR5cGVOYW1lLCAvLyBUaGUgdHlwZSBvZiB0aGUgcmVzdWx0IG9mIGV2YWx1YXRpbmcgdGhpcyBleHByZXNzaW9uLlxuICAgICAgdmFsdWU6IHZhbCAgICAgICAgICAgLy8gVGhlIChjb25zdGFudCkgdmFsdWUgaXRzZWxmLlxuICAgIH07XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdleHAocGF0dGVybjogc3RyaW5nLCBtb2RpZmllcnMgPSBcIlwiKTogUmVnRXhwVmFsdWUge1xuICBzd2l0Y2ggKG1vZGlmaWVycykge1xuICBjYXNlIFwiXCI6XG4gIGNhc2UgXCJpXCI6XG4gICAgYnJlYWs7XG4gIGRlZmF1bHQ6XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5zdXBwb3J0ZWQgUmVnRXhwIG1vZGlmaWVyOiBcIiArIG1vZGlmaWVycyk7XG4gIH1cbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnUmVnRXhwJyxcbiAgICB2YWx1ZVR5cGU6ICdSZWdFeHAnLFxuICAgIHZhbHVlOiBwYXR0ZXJuLFxuICAgIG1vZGlmaWVyczogbW9kaWZpZXJzXG4gIH07XG59XG5cbmZ1bmN0aW9uIGNtcFZhbHVlcyh2MTogRXhwLCB2MjogRXhwVmFsdWUpOiBib29sZWFuIHtcbiAgaWYgKHYxLnR5cGUgIT09IHYyLnR5cGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuICg8RXhwVmFsdWU+IHYxKS52YWx1ZSA9PT0gdjIudmFsdWU7XG59XG5cbmZ1bmN0aW9uIGlzT3Aob3BUeXBlOiBzdHJpbmcsIGV4cDogRXhwKTogYm9vbGVhbiB7XG4gIHJldHVybiBleHAudHlwZSA9PT0gJ29wJyAmJiAoPEV4cE9wPiBleHApLm9wID09PSBvcFR5cGU7XG59XG5cbi8vIFJldHVybiBhIGdlbmVyYXRpbmcgZnVuY3Rpb24gdG8gbWFrZSBhbiBvcGVyYXRvciBleHAgbm9kZS5cbmZ1bmN0aW9uIG9wR2VuKG9wVHlwZTogc3RyaW5nLCBhcml0eTogbnVtYmVyID0gMik6ICgoLi4uYXJnczogRXhwW10pID0+IEV4cE9wKSB7XG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKTogRXhwT3Age1xuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gYXJpdHkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk9wZXJhdG9yIGhhcyBcIiArIGFyZ3MubGVuZ3RoICtcbiAgICAgICAgICAgICAgICAgICAgICBcIiBhcmd1bWVudHMgKGV4cGVjdGluZyBcIiArIGFyaXR5ICsgXCIpLlwiKTtcbiAgICB9XG4gICAgcmV0dXJuIG9wKG9wVHlwZSwgYXJncyk7XG4gIH07XG59XG5cbmV4cG9ydCB2YXIgYW5kQXJyYXkgPSBsZWZ0QXNzb2NpYXRlR2VuKCcmJicsIGJvb2xlYW4odHJ1ZSksIGJvb2xlYW4oZmFsc2UpKTtcbmV4cG9ydCB2YXIgb3JBcnJheSA9IGxlZnRBc3NvY2lhdGVHZW4oJ3x8JywgYm9vbGVhbihmYWxzZSksIGJvb2xlYW4odHJ1ZSkpO1xuXG4vLyBDcmVhdGUgYW4gZXhwcmVzc2lvbiBidWlsZGVyIGZ1bmN0aW9uIHdoaWNoIG9wZXJhdGVzIG9uIGFycmF5cyBvZiB2YWx1ZXMuXG4vLyBSZXR1cm5zIG5ldyBleHByZXNzaW9uIGxpa2UgdjEgb3AgdjIgb3AgdjMgLi4uXG4vL1xuLy8gLSBBbnkgaWRlbnRpdHlWYWx1ZSdzIGluIGFycmF5IGlucHV0IGFyZSBpZ25vcmVkLlxuLy8gLSBJZiB6ZXJvVmFsdWUgaXMgZm91bmQgLSBqdXN0IHJldHVybiB6ZXJvVmFsdWUuXG4vL1xuLy8gT3VyIGZ1bmN0aW9uIHJlLW9yZGVycyB0b3AtbGV2ZWwgb3AgaW4gYXJyYXkgZWxlbWVudHMgdG8gdGhlIHJlc3VsdGluZ1xuLy8gZXhwcmVzc2lvbiBpcyBsZWZ0LWFzc29jaWF0aW5nLiAgRS5nLjpcbi8vXG4vLyAgICBbYSAmJiBiLCBjICYmIGRdID0+ICgoKGEgJiYgYikgJiYgYykgJiYgZClcbi8vICAgIChOT1QgKGEgJiYgYikgJiYgKGMgJiYgZCkpXG5mdW5jdGlvbiBsZWZ0QXNzb2NpYXRlR2VuKG9wVHlwZTogc3RyaW5nLCBpZGVudGl0eVZhbHVlOiBFeHBWYWx1ZSwgemVyb1ZhbHVlOiBFeHBWYWx1ZSkge1xuICByZXR1cm4gZnVuY3Rpb24oYTogRXhwW10pOiBFeHAge1xuICAgIHZhciBpOiBudW1iZXI7XG5cbiAgICBmdW5jdGlvbiByZWR1Y2VyKHJlc3VsdDogRXhwLCBjdXJyZW50OiBFeHApIHtcbiAgICAgIGlmIChyZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gY3VycmVudDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBvcChvcFR5cGUsIFtyZXN1bHQsIGN1cnJlbnRdKTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCBmbGF0dGVuIGFsbCB0b3AtbGV2ZWwgb3AgdmFsdWVzIHRvIG9uZSBmbGF0IGFycmF5LlxuICAgIHZhciBmbGF0ID0gPEV4cFtdPltdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGF0dGVuKG9wVHlwZSwgYVtpXSwgZmxhdCk7XG4gICAgfVxuXG4gICAgdmFyIHJlc3VsdCA9IDxFeHBbXT5bXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgZmxhdC5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gUmVtb3ZlIGlkZW50aWZ5VmFsdWVzIGZyb20gYXJyYXkuXG4gICAgICBpZiAoY21wVmFsdWVzKGZsYXRbaV0sIGlkZW50aXR5VmFsdWUpKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgICAgLy8gSnVzdCByZXR1cm4gemVyb1ZhbHVlIGlmIGZvdW5kXG4gICAgICBpZiAoY21wVmFsdWVzKGZsYXRbaV0sIHplcm9WYWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIHplcm9WYWx1ZTtcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5wdXNoKGZsYXRbaV0pO1xuICAgIH1cblxuICAgIGlmIChyZXN1bHQubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gaWRlbnRpdHlWYWx1ZTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gbGVmdC1hc3NvY2lhdGl2ZSBleHByZXNzaW9uIG9mIG9wVHlwZS5cbiAgICByZXR1cm4gcmVzdWx0LnJlZHVjZShyZWR1Y2VyKTtcbiAgfTtcbn1cblxuLy8gRmxhdHRlbiB0aGUgdG9wIGxldmVsIHRyZWUgb2Ygb3AgaW50byBhIHNpbmdsZSBmbGF0IGFycmF5IG9mIGV4cHJlc3Npb25zLlxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW4ob3BUeXBlOiBzdHJpbmcsIGV4cDogRXhwLCBmbGF0PzogRXhwW10pOiBFeHBbXSB7XG4gIHZhciBpOiBudW1iZXI7XG5cbiAgaWYgKGZsYXQgPT09IHVuZGVmaW5lZCkge1xuICAgIGZsYXQgPSBbXTtcbiAgfVxuXG4gIGlmICghaXNPcChvcFR5cGUsIGV4cCkpIHtcbiAgICBmbGF0LnB1c2goZXhwKTtcbiAgICByZXR1cm4gZmxhdDtcbiAgfVxuXG4gIGZvciAoaSA9IDA7IGkgPCAoPEV4cE9wPiBleHApLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICBmbGF0dGVuKG9wVHlwZSwgKDxFeHBPcD4gZXhwKS5hcmdzW2ldLCBmbGF0KTtcbiAgfVxuXG4gIHJldHVybiBmbGF0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gb3Aob3BUeXBlOiBzdHJpbmcsIGFyZ3M6IEV4cFtdKTogRXhwT3Age1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdvcCcsICAgICAvLyBUaGlzIGlzIChtdWx0aS1hcmd1bWVudCkgb3BlcmF0b3IuXG4gICAgdmFsdWVUeXBlOiAnQW55JyxcbiAgICBvcDogb3BUeXBlLCAgICAgLy8gVGhlIG9wZXJhdG9yIChzdHJpbmcsIGUuZy4gJysnKS5cbiAgICBhcmdzOiBhcmdzICAgICAgLy8gQXJndW1lbnRzIHRvIHRoZSBvcGVyYXRvciBBcnJheTxleHA+XG4gIH07XG59XG5cbi8vIFdhcm5pbmc6IE5PVCBhbiBleHByZXNzaW9uIHR5cGUhXG5leHBvcnQgZnVuY3Rpb24gbWV0aG9kKHBhcmFtczogc3RyaW5nW10sIGJvZHk6IEV4cCk6IE1ldGhvZCB7XG4gIHJldHVybiB7XG4gICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgYm9keTogYm9keVxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHlwZVR5cGUodHlwZU5hbWU6IHN0cmluZyk6IEV4cFNpbXBsZVR5cGUge1xuICByZXR1cm4geyB0eXBlOiBcInR5cGVcIiwgdmFsdWVUeXBlOiBcInR5cGVcIiwgbmFtZTogdHlwZU5hbWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVuaW9uVHlwZSh0eXBlczogRXhwVHlwZVtdKTogRXhwVW5pb25UeXBlIHtcbiAgcmV0dXJuIHsgdHlwZTogXCJ1bmlvblwiLCB2YWx1ZVR5cGU6IFwidHlwZVwiLCB0eXBlczogdHlwZXMgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdlbmVyaWNUeXBlKHR5cGVOYW1lOiBzdHJpbmcsIHBhcmFtczogRXhwVHlwZVtdKTogRXhwR2VuZXJpY1R5cGUge1xuICByZXR1cm4geyB0eXBlOiBcImdlbmVyaWNcIiwgdmFsdWVUeXBlOiBcInR5cGVcIiwgbmFtZTogdHlwZU5hbWUsIHBhcmFtczogcGFyYW1zIH07XG59XG5cbmV4cG9ydCBjbGFzcyBTeW1ib2xzIHtcbiAgZnVuY3Rpb25zOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcbiAgcGF0aHM6IFBhdGhbXTtcbiAgc2NoZW1hOiB7IFtuYW1lOiBzdHJpbmddOiBTY2hlbWEgfTtcblxuICBjb25zdHJ1Y3RvcigpIHtcbiAgICB0aGlzLmZ1bmN0aW9ucyA9IHt9O1xuICAgIHRoaXMucGF0aHMgPSBbXTtcbiAgICB0aGlzLnNjaGVtYSA9IHt9O1xuICB9XG5cbiAgcmVnaXN0ZXI8VD4obWFwOiB7W25hbWU6IHN0cmluZ106IFR9LCB0eXBlTmFtZTogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIG9iamVjdDogVCk6IFQge1xuICAgIGlmIChtYXBbbmFtZV0pIHtcbiAgICAgIGxvZ2dlci5lcnJvcihcIkR1cGxpY2F0ZWQgXCIgKyB0eXBlTmFtZSArIFwiIGRlZmluaXRpb246IFwiICsgbmFtZSArIFwiLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWFwW25hbWVdID0gb2JqZWN0O1xuICAgIH1cbiAgICByZXR1cm4gbWFwW25hbWVdO1xuICB9XG5cbiAgcmVnaXN0ZXJGdW5jdGlvbihuYW1lOiBzdHJpbmcsIHBhcmFtczogc3RyaW5nW10sIGJvZHk6IEV4cCk6IE1ldGhvZCB7XG4gICAgcmV0dXJuIHRoaXMucmVnaXN0ZXI8TWV0aG9kPih0aGlzLmZ1bmN0aW9ucywgJ2Z1bmN0aW9ucycsIG5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtZXRob2QocGFyYW1zLCBib2R5KSk7XG4gIH1cblxuICByZWdpc3RlclBhdGgodGVtcGxhdGU6IFBhdGhUZW1wbGF0ZSwgaXNUeXBlOiBFeHBUeXBlIHwgdm9pZCwgbWV0aG9kczogeyBbbmFtZTogc3RyaW5nXTogTWV0aG9kOyB9ID0ge30pOiBQYXRoIHtcbiAgICBpc1R5cGUgPSBpc1R5cGUgfHwgdHlwZVR5cGUoJ0FueScpO1xuICAgIHZhciBwOiBQYXRoID0ge1xuICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlLmNvcHkoKSxcbiAgICAgIGlzVHlwZTogPEV4cFR5cGU+IGlzVHlwZSxcbiAgICAgIG1ldGhvZHM6IG1ldGhvZHNcbiAgICB9O1xuICAgIHRoaXMucGF0aHMucHVzaChwKTtcbiAgICByZXR1cm4gcDtcbiAgfVxuXG4gIHJlZ2lzdGVyU2NoZW1hKG5hbWU6IHN0cmluZyxcbiAgICAgICAgICAgICAgICAgZGVyaXZlZEZyb20/OiBFeHBUeXBlLFxuICAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzID0gPFR5cGVQYXJhbXM+IHt9LFxuICAgICAgICAgICAgICAgICBtZXRob2RzID0gPHsgW25hbWU6IHN0cmluZ106IE1ldGhvZCB9PiB7fSxcbiAgICAgICAgICAgICAgICAgcGFyYW1zID0gPHN0cmluZ1tdPiBbXSlcbiAgOiBTY2hlbWEge1xuICAgIGRlcml2ZWRGcm9tID0gZGVyaXZlZEZyb20gfHwgdHlwZVR5cGUoT2JqZWN0LmtleXMocHJvcGVydGllcykubGVuZ3RoID4gMCA/ICdPYmplY3QnIDogJ0FueScpO1xuXG4gICAgdmFyIHM6IFNjaGVtYSA9IHtcbiAgICAgIGRlcml2ZWRGcm9tOiA8RXhwVHlwZT4gZGVyaXZlZEZyb20sXG4gICAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzLFxuICAgICAgbWV0aG9kczogbWV0aG9kcyxcbiAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgIH07XG4gICAgcmV0dXJuIHRoaXMucmVnaXN0ZXI8U2NoZW1hPih0aGlzLnNjaGVtYSwgJ3NjaGVtYScsIG5hbWUsIHMpO1xuICB9XG5cbiAgaXNEZXJpdmVkRnJvbSh0eXBlOiBFeHBUeXBlLCBhbmNlc3Rvcjogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgaWYgKGFuY2VzdG9yID09PSAnQW55Jykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgc3dpdGNoICh0eXBlLnR5cGUpIHtcbiAgICBjYXNlICd0eXBlJzpcbiAgICBjYXNlICdnZW5lcmljJzpcbiAgICAgIGxldCBzaW1wbGVUeXBlID0gPEV4cFNpbXBsZVR5cGU+IHR5cGU7XG4gICAgICBpZiAoc2ltcGxlVHlwZS5uYW1lID09PSBhbmNlc3Rvcikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChzaW1wbGVUeXBlLm5hbWUgPT09ICdBbnknKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGxldCBzY2hlbWEgPSB0aGlzLnNjaGVtYVtzaW1wbGVUeXBlLm5hbWVdO1xuICAgICAgaWYgKCFzY2hlbWEpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuaXNEZXJpdmVkRnJvbShzY2hlbWEuZGVyaXZlZEZyb20sIGFuY2VzdG9yKTtcblxuICAgIGNhc2UgJ3VuaW9uJzpcbiAgICAgIHJldHVybiAoPEV4cFVuaW9uVHlwZT4gdHlwZSkudHlwZXNcbiAgICAgICAgLm1hcCgoc3ViVHlwZSkgPT4gdGhpcy5pc0Rlcml2ZWRGcm9tKHN1YlR5cGUsIGFuY2VzdG9yKSlcbiAgICAgICAgLnJlZHVjZSh1dGlsLm9yKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHR5cGU6IFwiICsgdHlwZS50eXBlKTtcbiAgICAgIH1cbiAgfVxufVxuXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9PcGVyYXRvcnMvT3BlcmF0b3JfUHJlY2VkZW5jZVxuaW50ZXJmYWNlIE9wUHJpb3JpdHkge1xuICByZXA/OiBzdHJpbmc7XG4gIHA6IG51bWJlcjtcbn1cblxudmFyIEpTX09QUzogeyBbb3A6IHN0cmluZ106IE9wUHJpb3JpdHk7IH0gPSB7XG4gICd2YWx1ZSc6IHsgcmVwOiBcIlwiLCBwOiAxOCB9LFxuXG4gICduZWcnOiB7IHJlcDogXCItXCIsIHA6IDE1fSxcbiAgJyEnOiB7IHA6IDE1fSxcbiAgJyonOiB7IHA6IDE0fSxcbiAgJy8nOiB7IHA6IDE0fSxcbiAgJyUnOiB7IHA6IDE0fSxcbiAgJysnOiB7IHA6IDEzIH0sXG4gICctJzogeyBwOiAxMyB9LFxuICAnPCc6IHsgcDogMTEgfSxcbiAgJzw9JzogeyBwOiAxMSB9LFxuICAnPic6IHsgcDogMTEgfSxcbiAgJz49JzogeyBwOiAxMSB9LFxuICAnaW4nOiB7IHA6IDExIH0sXG4gICc9PSc6IHsgcDogMTAgfSxcbiAgXCIhPVwiOiB7IHA6IDEwIH0sXG4gICcmJic6IHsgcDogNiB9LFxuICAnfHwnOiB7IHA6IDUgfSxcbiAgJz86JzogeyBwOiA0IH0sXG4gICcsJzogeyBwOiAwfSxcbn07XG5cbi8vIEZyb20gYW4gQVNULCBkZWNvZGUgYXMgYW4gZXhwcmVzc2lvbiAoc3RyaW5nKS5cbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVFeHByZXNzaW9uKGV4cDogRXhwLCBvdXRlclByZWNlZGVuY2U/OiBudW1iZXIpOiBzdHJpbmcge1xuICBpZiAob3V0ZXJQcmVjZWRlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICBvdXRlclByZWNlZGVuY2UgPSAwO1xuICB9XG4gIHZhciBpbm5lclByZWNlZGVuY2UgPSBwcmVjZWRlbmNlT2YoZXhwKTtcbiAgdmFyIHJlc3VsdCA9ICcnO1xuXG4gIHN3aXRjaCAoZXhwLnR5cGUpIHtcbiAgY2FzZSAnQm9vbGVhbic6XG4gIGNhc2UgJ051bWJlcic6XG4gICAgcmVzdWx0ID0gSlNPTi5zdHJpbmdpZnkoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnU3RyaW5nJzpcbiAgICByZXN1bHQgPSB1dGlsLnF1b3RlU3RyaW5nKCg8RXhwVmFsdWU+IGV4cCkudmFsdWUpO1xuICAgIGJyZWFrO1xuXG4gIC8vIFJlZ0V4cCBhc3N1bWVkIHRvIGJlIGluIHByZS1xdW90ZWQgZm9ybWF0LlxuICBjYXNlICdSZWdFeHAnOlxuICAgIGxldCByZWdleHAgPSA8UmVnRXhwVmFsdWU+IGV4cDtcbiAgICByZXN1bHQgPSAnLycgKyByZWdleHAudmFsdWUgKyAnLyc7XG4gICAgaWYgKHJlZ2V4cC5tb2RpZmllcnMgIT09ICcnKSB7XG4gICAgICByZXN1bHQgKz0gcmVnZXhwLm1vZGlmaWVycztcbiAgICB9XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnQXJyYXknOlxuICAgIHJlc3VsdCA9ICdbJyArIGRlY29kZUFycmF5KCg8RXhwVmFsdWU+IGV4cCkudmFsdWUpICsgJ10nO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ051bGwnOlxuICAgIHJlc3VsdCA9ICdudWxsJztcbiAgICBicmVhaztcblxuICBjYXNlICd2YXInOlxuICBjYXNlICdsaXRlcmFsJzpcbiAgICByZXN1bHQgPSAoPEV4cFZhcmlhYmxlPiBleHApLm5hbWU7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAncmVmJzpcbiAgICBsZXQgZXhwUmVmID0gPEV4cFJlZmVyZW5jZT4gZXhwO1xuICAgIGlmIChpc0lkZW50aWZpZXJTdHJpbmdFeHAoZXhwUmVmLmFjY2Vzc29yKSkge1xuICAgICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHBSZWYuYmFzZSwgaW5uZXJQcmVjZWRlbmNlKSArICcuJyArICg8RXhwVmFsdWU+IGV4cFJlZi5hY2Nlc3NvcikudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdCA9IGRlY29kZUV4cHJlc3Npb24oZXhwUmVmLmJhc2UsIGlubmVyUHJlY2VkZW5jZSkgK1xuICAgICAgICAnWycgKyBkZWNvZGVFeHByZXNzaW9uKGV4cFJlZi5hY2Nlc3NvcikgKyAnXSc7XG4gICAgfVxuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ2NhbGwnOlxuICAgIGxldCBleHBDYWxsID0gPEV4cENhbGw+IGV4cDtcbiAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cENhbGwucmVmKSArICcoJyArIGRlY29kZUFycmF5KGV4cENhbGwuYXJncykgKyAnKSc7XG4gICAgYnJlYWs7XG5cbiAgY2FzZSAnYnVpbHRpbic6XG4gICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHApO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ29wJzpcbiAgICBsZXQgZXhwT3AgPSA8RXhwT3A+IGV4cDtcbiAgICB2YXIgcmVwID0gSlNfT1BTW2V4cE9wLm9wXS5yZXAgPT09IHVuZGVmaW5lZCA/IGV4cE9wLm9wIDogSlNfT1BTW2V4cE9wLm9wXS5yZXA7XG4gICAgaWYgKGV4cE9wLmFyZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXN1bHQgPSByZXAgKyBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMF0sIGlubmVyUHJlY2VkZW5jZSk7XG4gICAgfSBlbHNlIGlmIChleHBPcC5hcmdzLmxlbmd0aCA9PT0gMikge1xuICAgICAgcmVzdWx0ID1cbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdLCBpbm5lclByZWNlZGVuY2UpICtcbiAgICAgICAgJyAnICsgcmVwICsgJyAnICtcbiAgICAgICAgLy8gQWxsIG9wcyBhcmUgbGVmdCBhc3NvY2lhdGl2ZSAtIHNvIG51ZGdlIHRoZSBpbm5lclByZWNlbmRlbmNlXG4gICAgICAgIC8vIGRvd24gb24gdGhlIHJpZ2h0IGhhbmQgc2lkZSB0byBmb3JjZSAoKSBmb3IgcmlnaHQtYXNzb2NpYXRpbmdcbiAgICAgICAgLy8gb3BlcmF0aW9ucy5cbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzFdLCBpbm5lclByZWNlZGVuY2UgKyAxKTtcblxuICAgICAgICBpZiAoKGlubmVyUHJlY2VkZW5jZSA+PSBvdXRlclByZWNlZGVuY2UpICYmICgoZXhwT3Aub3AgPT09ICcmJicpIHx8IChleHBPcC5vcCA9PT0gJ3x8JykpKSB7XG4gICAgICAgICAgcmVzdWx0ID0gJygnICsgcmVzdWx0ICsgJyknO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChleHBPcC5hcmdzLmxlbmd0aCA9PT0gMykge1xuICAgICAgcmVzdWx0ID1cbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdLCBpbm5lclByZWNlZGVuY2UpICsgJyA/ICcgK1xuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0sIGlubmVyUHJlY2VkZW5jZSkgKyAnIDogJyArXG4gICAgICAgIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1syXSwgaW5uZXJQcmVjZWRlbmNlKTtcbiAgICB9XG5cbiAgICBicmVhaztcblxuICBjYXNlICd0eXBlJzpcbiAgICByZXN1bHQgPSAoPEV4cFNpbXBsZVR5cGU+IGV4cCkubmFtZTtcbiAgICBicmVhaztcblxuICBjYXNlICd1bmlvbic6XG4gICAgcmVzdWx0ID0gKDxFeHBVbmlvblR5cGU+IGV4cCkudHlwZXMubWFwKGRlY29kZUV4cHJlc3Npb24pLmpvaW4oJyB8ICcpO1xuICAgIGJyZWFrO1xuXG4gIGNhc2UgJ2dlbmVyaWMnOlxuICAgIGxldCBnZW5lcmljVHlwZSA9IDxFeHBHZW5lcmljVHlwZT4gZXhwO1xuICAgIHJldHVybiBnZW5lcmljVHlwZS5uYW1lICsgJzwnICsgZGVjb2RlQXJyYXkoZ2VuZXJpY1R5cGUucGFyYW1zKSArICc+JztcblxuICBkZWZhdWx0OlxuICAgIHJlc3VsdCA9IFwiKioqVU5LTk9XTiBUWVBFKioqIChcIiArIGV4cC50eXBlICsgXCIpXCI7XG4gICAgYnJlYWs7XG4gIH1cblxuICBpZiAoaW5uZXJQcmVjZWRlbmNlIDwgb3V0ZXJQcmVjZWRlbmNlKSB7XG4gICAgcmVzdWx0ID0gJygnICsgcmVzdWx0ICsgJyknO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZGVjb2RlQXJyYXkoYXJnczogRXhwW10pOiBzdHJpbmcge1xuICByZXR1cm4gYXJncy5tYXAoZGVjb2RlRXhwcmVzc2lvbikuam9pbignLCAnKTtcbn1cblxuZnVuY3Rpb24gcHJlY2VkZW5jZU9mKGV4cDogRXhwKTogbnVtYmVyIHtcbiAgbGV0IHJlc3VsdDogbnVtYmVyO1xuXG4gIHN3aXRjaCAoZXhwLnR5cGUpIHtcbiAgY2FzZSAnb3AnOlxuICAgIHJlc3VsdCA9IEpTX09QU1soPEV4cE9wPiBleHApLm9wXS5wO1xuICAgIGJyZWFrO1xuXG4gIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL09wZXJhdG9ycy9PcGVyYXRvcl9QcmVjZWRlbmNlXG4gIC8vIGxpc3RzIGNhbGwgYXMgMTcgYW5kIHJlZiBhcyAxOCAtIGJ1dCBob3cgY291bGQgdGhleSBiZSBhbnl0aGluZyBvdGhlciB0aGFuIGxlZnQgdG8gcmlnaHQ/XG4gIC8vIGh0dHA6Ly93d3cuc2NyaXB0aW5nbWFzdGVyLmNvbS9qYXZhc2NyaXB0L29wZXJhdG9yLXByZWNlZGVuY2UuYXNwIC0gYWdyZWVzLlxuICBjYXNlICdjYWxsJzpcbiAgICByZXN1bHQgPSAxODtcbiAgICBicmVhaztcbiAgY2FzZSAncmVmJzpcbiAgICByZXN1bHQgPSAxODtcbiAgICBicmVhaztcbiAgZGVmYXVsdDpcbiAgICByZXN1bHQgPSAxOTtcbiAgICBicmVhaztcbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59XG4iLCIvKlxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuLy8gVE9ETyhrb3NzKTogQWZ0ZXIgbm9kZSAwLjEwIGxlYXZlcyBMVFMgLSByZW1vdmUgcG9seWZpbGxlZCBQcm9taXNlIGxpYnJhcnkuXG5pZiAodHlwZW9mIFByb21pc2UgPT09ICd1bmRlZmluZWQnKSB7XG4gIHJlcXVpcmUoJ2VzNi1wcm9taXNlJykucG9seWZpbGwoKTtcbn1cblxubGV0IHBhcnNlciA9IHJlcXVpcmUoJy4vcnVsZXMtcGFyc2VyJyk7XG5pbXBvcnQgKiBhcyBnZW5lcmF0b3IgZnJvbSAnLi9ydWxlcy1nZW5lcmF0b3InO1xuaW1wb3J0ICogYXMgYXN0SW1wb3J0IGZyb20gJy4vYXN0JztcblxuZXhwb3J0IGxldCBGSUxFX0VYVEVOU0lPTiA9ICdib2x0JztcblxuZXhwb3J0IGxldCBhc3QgPSBhc3RJbXBvcnQ7XG5leHBvcnQgbGV0IHBhcnNlID0gcGFyc2VyLnBhcnNlO1xuZXhwb3J0IGxldCBHZW5lcmF0b3IgPSBnZW5lcmF0b3IuR2VuZXJhdG9yO1xuZXhwb3J0IGxldCBkZWNvZGVFeHByZXNzaW9uID0gYXN0LmRlY29kZUV4cHJlc3Npb247XG5leHBvcnQgbGV0IGdlbmVyYXRlID0gZ2VuZXJhdG9yLmdlbmVyYXRlO1xuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5sZXQgbGFzdEVycm9yOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5sZXQgbGFzdE1lc3NhZ2U6IHN0cmluZyB8IHVuZGVmaW5lZDtcbmxldCBlcnJvckNvdW50OiBudW1iZXI7XG5sZXQgc2lsZW5jZU91dHB1dDogYm9vbGVhbjtcblxubGV0IERFQlVHID0gZmFsc2U7XG5cbmxldCBnZXRDb250ZXh0ID0gKCkgPT4gKDxFcnJvckNvbnRleHQ+IHt9KTtcblxucmVzZXQoKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHJlc2V0KCkge1xuICBsYXN0RXJyb3IgPSB1bmRlZmluZWQ7XG4gIGxhc3RNZXNzYWdlID0gdW5kZWZpbmVkO1xuICBlcnJvckNvdW50ID0gMDtcbiAgc2lsZW5jZU91dHB1dCA9IGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0RGVidWcoZGVidWcgPSB0cnVlKSB7XG4gIERFQlVHID0gZGVidWc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWxlbnQoZiA9IHRydWUpIHtcbiAgc2lsZW5jZU91dHB1dCA9IGY7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXJyb3JDb250ZXh0IHtcbiAgbGluZT86IG51bWJlcjtcbiAgY29sdW1uPzogbnVtYmVyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29udGV4dChmbjogKCkgPT4gRXJyb3JDb250ZXh0KSB7XG4gIGdldENvbnRleHQgPSBmbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVycm9yKHM6IHN0cmluZykge1xuICBsZXQgZXJyID0gZXJyb3JTdHJpbmcocyk7XG4gIC8vIERlLWR1cCBpZGVudGljYWwgbWVzc2FnZXNcbiAgaWYgKGVyciAgPT09IGxhc3RNZXNzYWdlKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGxhc3RNZXNzYWdlID0gZXJyO1xuICBsYXN0RXJyb3IgPSBsYXN0TWVzc2FnZTtcbiAgaWYgKCFzaWxlbmNlT3V0cHV0KSB7XG4gICAgY29uc29sZS5lcnJvcihsYXN0RXJyb3IpO1xuICAgIGlmIChERUJVRykge1xuICAgICAgbGV0IGUgPSBuZXcgRXJyb3IoXCJTdGFjayB0cmFjZVwiKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZS5zdGFjayk7XG4gICAgfVxuICB9XG4gIGVycm9yQ291bnQgKz0gMTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHdhcm4oczogc3RyaW5nKSB7XG4gIGxldCBlcnIgPSBlcnJvclN0cmluZyhzKTtcbiAgLy8gRGUtZHVwIGlkZW50aWNhbCBtZXNzYWdlc1xuICBpZiAoZXJyID09PSBsYXN0TWVzc2FnZSkge1xuICAgIHJldHVybjtcbiAgfVxuICBsYXN0TWVzc2FnZSA9IGVycjtcbiAgaWYgKCFzaWxlbmNlT3V0cHV0KSB7XG4gICAgY29uc29sZS53YXJuKGxhc3RNZXNzYWdlKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFzdE1lc3NhZ2UoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGxhc3RNZXNzYWdlO1xufVxuXG5mdW5jdGlvbiBlcnJvclN0cmluZyhzOiBzdHJpbmcpIHtcbiAgbGV0IGN0eCA9IGdldENvbnRleHQoKTtcbiAgaWYgKGN0eC5saW5lICE9PSB1bmRlZmluZWQgJiYgY3R4LmNvbHVtbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICdib2x0OicgKyBjdHgubGluZSArICc6JyArIGN0eC5jb2x1bW4gKyAnOiAnICsgcztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gJ2JvbHQ6ICcgKyBzO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNFcnJvcnMoKTogYm9vbGVhbiB7XG4gIHJldHVybiBlcnJvckNvdW50ID4gMDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVycm9yU3VtbWFyeSgpOiBzdHJpbmcge1xuICBpZiAoZXJyb3JDb3VudCA9PT0gMSkge1xuICAgIHJldHVybiA8c3RyaW5nPiBsYXN0RXJyb3I7XG4gIH1cblxuICBpZiAoZXJyb3JDb3VudCAhPT0gMCkge1xuICAgIHJldHVybiBcIkZhdGFsIGVycm9yczogXCIgKyBlcnJvckNvdW50O1xuICB9XG4gIHJldHVybiBcIlwiO1xufVxuIiwiLypcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5sZXQgcGFyc2VyID0gcmVxdWlyZSgnLi9ydWxlcy1wYXJzZXInKTtcbmltcG9ydCAqIGFzIGFzdCBmcm9tICcuL2FzdCc7XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUV4cHJlc3Npb24oZXhwcmVzc2lvbjogc3RyaW5nKTogYXN0LkV4cCB7XG4gIHZhciByZXN1bHQgPSBwYXJzZXIucGFyc2UoJ2Z1bmN0aW9uIGYoKSB7cmV0dXJuICcgKyBleHByZXNzaW9uICsgJzt9Jyk7XG4gIHJldHVybiByZXN1bHQuZnVuY3Rpb25zLmYuYm9keTtcbn1cbiIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuaW1wb3J0ICogYXMgdXRpbCBmcm9tICcuL3V0aWwnO1xuaW1wb3J0ICogYXMgYXN0IGZyb20gJy4vYXN0JztcbmltcG9ydCB7d2FybiwgZXJyb3J9IGZyb20gJy4vbG9nZ2VyJztcbmxldCBwYXJzZXIgPSByZXF1aXJlKCcuL3J1bGVzLXBhcnNlcicpO1xuaW1wb3J0IHtwYXJzZUV4cHJlc3Npb259IGZyb20gJy4vcGFyc2UtdXRpbCc7XG5cbnZhciBlcnJvcnMgPSB7XG4gIGJhZEluZGV4OiBcIlRoZSBpbmRleCBmdW5jdGlvbiBtdXN0IHJldHVybiBhIFN0cmluZyBvciBhbiBhcnJheSBvZiBTdHJpbmdzLlwiLFxuICBub1BhdGhzOiBcIk11c3QgaGF2ZSBhdCBsZWFzdCBvbmUgcGF0aCBleHByZXNzaW9uLlwiLFxuICBub25PYmplY3Q6IFwiVHlwZSBjb250YWlucyBwcm9wZXJ0aWVzIGFuZCBtdXN0IGV4dGVuZCAnT2JqZWN0Jy5cIixcbiAgbWlzc2luZ1NjaGVtYTogXCJNaXNzaW5nIGRlZmluaXRpb24gZm9yIHR5cGUuXCIsXG4gIHJlY3Vyc2l2ZTogXCJSZWN1cnNpdmUgZnVuY3Rpb24gY2FsbC5cIixcbiAgbWlzbWF0Y2hQYXJhbXM6IFwiSW5jb3JyZWN0IG51bWJlciBvZiBmdW5jdGlvbiBhcmd1bWVudHMuXCIsXG4gIGdlbmVyYXRlRmFpbGVkOiBcIkNvdWxkIG5vdCBnZW5lcmF0ZSBKU09OOiBcIixcbiAgbm9TdWNoVHlwZTogXCJObyB0eXBlIGRlZmluaXRpb24gZm9yOiBcIixcbiAgYmFkU2NoZW1hTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHR5cGUgc3RhdGVtZW50OiBcIixcbiAgYmFkUGF0aE1ldGhvZDogXCJVbnN1cHBvcnRlZCBtZXRob2QgbmFtZSBpbiBwYXRoIHN0YXRlbWVudDogXCIsXG4gIGJhZFdyaXRlQWxpYXM6IFwiQ2Fubm90IGhhdmUgYm90aCBhIHdyaXRlKCkgbWV0aG9kIGFuZCBhIHdyaXRlLWFsaWFzaW5nIG1ldGhvZDogXCIsXG4gIGNvZXJjaW9uOiBcIkNhbm5vdCBjb252ZXJ0IHZhbHVlOiBcIixcbiAgdW5kZWZpbmVkRnVuY3Rpb246IFwiVW5kZWZpbmVkIGZ1bmN0aW9uOiBcIixcbiAgYXBwbGljYXRpb246IFwiQm9sdCBhcHBsaWNhdGlvbiBlcnJvcjogXCIsXG4gIGludmFsaWRHZW5lcmljOiBcIkludmFsaWQgZ2VuZXJpYyBzY2hlbWEgdXNhZ2U6IFwiLFxuICBpbnZhbGlkTWFwS2V5OiBcIk1hcDxLZXksIFQ+IC0gS2V5IG11c3QgZGVyaXZlIGZyb20gU3RyaW5nIHR5cGUuXCIsXG4gIGludmFsaWRXaWxkQ2hpbGRyZW46IFwiVHlwZXMgY2FuIGhhdmUgYXQgbW9zdCBvbmUgJHdpbGQgcHJvcGVydHkgYW5kIGNhbm5vdCBtaXggd2l0aCBvdGhlciBwcm9wZXJ0aWVzLlwiLFxuICBpbnZhbGlkUHJvcGVydHlOYW1lOiBcIlByb3BlcnR5IG5hbWVzIGNhbm5vdCBjb250YWluIGFueSBvZjogLiAkICMgWyBdIC8gb3IgY29udHJvbCBjaGFyYWN0ZXJzOiBcIixcbn07XG5cbmxldCBJTlZBTElEX0tFWV9SRUdFWCA9IC9bXFxbXFxdLiMkXFwvXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vO1xuXG4vKlxuICAgQSBWYWxpZGF0b3IgaXMgYSBKU09OIGhlcmlhcmNoaWNhbCBzdHJ1Y3R1cmUuIFRoZSBcImxlYXZlc1wiIGFyZSBcImRvdC1wcm9wZXJ0aWVzXCJcbiAgIChzZWUgYmVsb3cpLiBUaGUgaW50ZXJtZWRpYXRlIG5vZGVzIGluIHRoZSB0cmVlIGFyZSBcInByb3BcIiBvciBcIiRwcm9wXCJcbiAgIHByb3BlcnRpZXMuXG5cbiAgIEEgVmFsaWRhdG9yIGlzIG11dGF0ZWQgdG8gaGF2ZSBkaWZmZXJlbnQgZm9ybXMgYmFzZWQgb24gdGhlIHRoZSBwaGFzZSBvZlxuICAgZ2VuZXJhdGlvbi5cblxuICAgSW4gdGhlIGZpcnN0IHBoYXNlLCB0aGV5IGFyZSBFeHBbXS4gTGF0ZXIgdGhlIEV4cFtdIGFyZSBBTkRlZCB0b2dldGhlciBhbmRcbiAgIGNvbWJpbmVkIGludG8gZXhwcmVzc2lvbiB0ZXh0IChhbmQgcmV0dXJuZWQgYXMgdGhlIGZpbmFsIEpTT04tcnVsZXMgdGhhdFxuICAgRmlyZWJhc2UgdXNlcy5cblxuICAgTm90ZTogVFMgZG9lcyBub3QgYWxsb3cgZm9yIHNwZWNpYWwgcHJvcGVydGllcyB0byBoYXZlIGRpc3RpbmN0XG4gICB0eXBlcyBmcm9tIHRoZSAnaW5kZXgnIHByb3BlcnR5IGdpdmVuIGZvciB0aGUgaW50ZXJmYWNlLiAgOi0oXG5cbiAgICcucmVhZCc6IGFzdC5FeHBbXSB8IHN0cmluZztcbiAgICcud3JpdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XG4gICAnLnZhbGlkYXRlJzogYXN0LkV4cFtdIHwgc3RyaW5nO1xuICAgJy5pbmRleE9uJzogc3RyaW5nW107XG4gICAnLnNjb3BlJzogeyBbdmFyaWFibGU6IHN0cmluZ106IHN0cmluZyB9XG4qL1xuZXhwb3J0IHR5cGUgVmFsaWRhdG9yVmFsdWUgPSBhc3QuRXhwIHwgYXN0LkV4cFtdIHwgc3RyaW5nIHwgc3RyaW5nW10gfCBWYWxpZGF0b3I7XG5leHBvcnQgaW50ZXJmYWNlIFZhbGlkYXRvciB7XG4gIFtuYW1lOiBzdHJpbmddOiBWYWxpZGF0b3JWYWx1ZTtcbn07XG5cbnZhciBidWlsdGluU2NoZW1hTmFtZXMgPSBbJ0FueScsICdOdWxsJywgJ1N0cmluZycsICdOdW1iZXInLCAnQm9vbGVhbicsICdPYmplY3QnXTtcbi8vIE1ldGhvZCBuYW1lcyBhbGxvd2VkIGluIEJvbHQgZmlsZXMuXG52YXIgdmFsdWVNZXRob2RzID0gWydsZW5ndGgnLCAnaW5jbHVkZXMnLCAnc3RhcnRzV2l0aCcsICdiZWdpbnNXaXRoJywgJ2VuZHNXaXRoJyxcbiAgICAgICAgICAgICAgICAgICAgJ3JlcGxhY2UnLCAndG9Mb3dlckNhc2UnLCAndG9VcHBlckNhc2UnLCAndGVzdCcsICdjb250YWlucycsXG4gICAgICAgICAgICAgICAgICAgICdtYXRjaGVzJ107XG4vLyBUT0RPOiBNYWtlIHN1cmUgdXNlcnMgZG9uJ3QgY2FsbCBpbnRlcm5hbCBtZXRob2RzLi4ubWFrZSBwcml2YXRlIHRvIGltcGwuXG52YXIgc25hcHNob3RNZXRob2RzID0gWydwYXJlbnQnLCAnY2hpbGQnLCAnaGFzQ2hpbGRyZW4nLCAndmFsJywgJ2lzU3RyaW5nJywgJ2lzTnVtYmVyJyxcbiAgICAgICAgICAgICAgICAgICAgICAgJ2lzQm9vbGVhbiddLmNvbmNhdCh2YWx1ZU1ldGhvZHMpO1xuXG52YXIgd3JpdGVBbGlhc2VzID0gPHsgW21ldGhvZDogc3RyaW5nXTogYXN0LkV4cCB9PiB7XG4gICdjcmVhdGUnOiBwYXJzZUV4cHJlc3Npb24oJ3ByaW9yKHRoaXMpID09IG51bGwnKSxcbiAgJ3VwZGF0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgIT0gbnVsbCAmJiB0aGlzICE9IG51bGwnKSxcbiAgJ2RlbGV0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgIT0gbnVsbCAmJiB0aGlzID09IG51bGwnKVxufTtcblxuLy8gVXNhZ2U6XG4vLyAgIGpzb24gPSBib2x0LmdlbmVyYXRlKGJvbHQtdGV4dClcbmV4cG9ydCBmdW5jdGlvbiBnZW5lcmF0ZShzeW1ib2xzOiBzdHJpbmcgfCBhc3QuU3ltYm9scyk6IFZhbGlkYXRvciB7XG4gIGlmICh0eXBlb2Ygc3ltYm9scyA9PT0gJ3N0cmluZycpIHtcbiAgICBzeW1ib2xzID0gcGFyc2VyLnBhcnNlKHN5bWJvbHMpO1xuICB9XG4gIHZhciBnZW4gPSBuZXcgR2VuZXJhdG9yKDxhc3QuU3ltYm9scz4gc3ltYm9scyk7XG4gIHJldHVybiBnZW4uZ2VuZXJhdGVSdWxlcygpO1xufVxuXG4vLyBTeW1ib2xzIGNvbnRhaW5zOlxuLy8gICBmdW5jdGlvbnM6IHt9XG4vLyAgIHNjaGVtYToge31cbi8vICAgcGF0aHM6IHt9XG5leHBvcnQgY2xhc3MgR2VuZXJhdG9yIHtcbiAgc3ltYm9sczogYXN0LlN5bWJvbHM7XG4gIHZhbGlkYXRvcnM6IHsgW3NjaGVtYU5hbWU6IHN0cmluZ106IFZhbGlkYXRvcjsgfTtcbiAgcnVsZXM6IFZhbGlkYXRvcjtcbiAgZXJyb3JDb3VudDogbnVtYmVyO1xuICBydW5TaWxlbnRseTogYm9vbGVhbjtcbiAgYWxsb3dVbmRlZmluZWRGdW5jdGlvbnM6IGJvb2xlYW47XG4gIGdsb2JhbHM6IGFzdC5QYXJhbXM7XG4gIHRoaXNJczogc3RyaW5nO1xuICBrZXlJbmRleDogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHN5bWJvbHM6IGFzdC5TeW1ib2xzKSB7XG4gICAgdGhpcy5zeW1ib2xzID0gc3ltYm9scztcbiAgICB0aGlzLnZhbGlkYXRvcnMgPSB7fTtcbiAgICB0aGlzLnJ1bGVzID0ge307XG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcbiAgICB0aGlzLnJ1blNpbGVudGx5ID0gZmFsc2U7XG4gICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IGZhbHNlO1xuICAgIHRoaXMua2V5SW5kZXggPSAwO1xuXG4gICAgLy8gVE9ETzogZ2xvYmFscyBzaG91bGQgYmUgcGFydCBvZiB0aGlzLnN5bWJvbHMgKG5lc3RlZCBzY29wZXMpXG4gICAgdGhpcy5nbG9iYWxzID0ge1xuICAgICAgXCJyb290XCI6IGFzdC5jYWxsKGFzdC52YXJpYWJsZSgnQHJvb3QnKSksXG4gICAgfTtcblxuICAgIHRoaXMucmVnaXN0ZXJCdWlsdGluU2NoZW1hKCk7XG4gIH1cblxuICAvLyBSZXR1cm4gRmlyZWJhc2UgY29tcGF0aWJsZSBSdWxlcyBKU09OIGZvciBhIHRoZSBnaXZlbiBzeW1ib2xzIGRlZmluaXRpb25zLlxuICBnZW5lcmF0ZVJ1bGVzKCk6IFZhbGlkYXRvciB7XG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcbiAgICB2YXIgcGF0aHMgPSB0aGlzLnN5bWJvbHMucGF0aHM7XG4gICAgdmFyIHNjaGVtYSA9IHRoaXMuc3ltYm9scy5zY2hlbWE7XG4gICAgdmFyIG5hbWU6IHN0cmluZztcblxuICAgIHBhdGhzLmZvckVhY2goKHBhdGgpID0+IHtcbiAgICAgIHRoaXMudmFsaWRhdGVNZXRob2RzKGVycm9ycy5iYWRQYXRoTWV0aG9kLCBwYXRoLm1ldGhvZHMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBbJ3ZhbGlkYXRlJywgJ3JlYWQnLCAnd3JpdGUnLCAnaW5kZXgnXSk7XG4gICAgfSk7XG5cbiAgICBmb3IgKG5hbWUgaW4gc2NoZW1hKSB7XG4gICAgICBpZiAoIXV0aWwuYXJyYXlJbmNsdWRlcyhidWlsdGluU2NoZW1hTmFtZXMsIG5hbWUpKSB7XG4gICAgICAgIHRoaXMudmFsaWRhdGVNZXRob2RzKGVycm9ycy5iYWRTY2hlbWFNZXRob2QsIHNjaGVtYVtuYW1lXS5tZXRob2RzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ3ZhbGlkYXRlJywgJ3JlYWQnLCAnd3JpdGUnXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBhdGhzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5mYXRhbChlcnJvcnMubm9QYXRocyk7XG4gICAgfVxuXG4gICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4gdGhpcy51cGRhdGVSdWxlcyhwYXRoKSk7XG4gICAgdGhpcy5jb252ZXJ0RXhwcmVzc2lvbnModGhpcy5ydWxlcyk7XG5cbiAgICBpZiAodGhpcy5lcnJvckNvdW50ICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmdlbmVyYXRlRmFpbGVkICsgdGhpcy5lcnJvckNvdW50ICsgXCIgZXJyb3JzLlwiKTtcbiAgICB9XG5cbiAgICB1dGlsLmRlbGV0ZVByb3BOYW1lKHRoaXMucnVsZXMsICcuc2NvcGUnKTtcbiAgICB1dGlsLnBydW5lRW1wdHlDaGlsZHJlbih0aGlzLnJ1bGVzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBydWxlczogdGhpcy5ydWxlc1xuICAgIH07XG4gIH1cblxuICB2YWxpZGF0ZU1ldGhvZHMobTogc3RyaW5nLCBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBhc3QuTWV0aG9kIH0sIGFsbG93ZWQ6IHN0cmluZ1tdKSB7XG4gICAgaWYgKHV0aWwuYXJyYXlJbmNsdWRlcyhhbGxvd2VkLCAnd3JpdGUnKSkge1xuICAgICAgYWxsb3dlZCA9IGFsbG93ZWQuY29uY2F0KE9iamVjdC5rZXlzKHdyaXRlQWxpYXNlcykpO1xuICAgIH1cbiAgICBmb3IgKHZhciBtZXRob2QgaW4gbWV0aG9kcykge1xuICAgICAgaWYgKCF1dGlsLmFycmF5SW5jbHVkZXMoYWxsb3dlZCwgbWV0aG9kKSkge1xuICAgICAgICB3YXJuKG0gKyB1dGlsLnF1b3RlU3RyaW5nKG1ldGhvZCkgK1xuICAgICAgICAgICAgIFwiIChhbGxvd2VkOiBcIiArIGFsbG93ZWQubWFwKHV0aWwucXVvdGVTdHJpbmcpLmpvaW4oJywgJykgKyBcIilcIik7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICgnd3JpdGUnIGluIG1ldGhvZHMpIHtcbiAgICAgIE9iamVjdC5rZXlzKHdyaXRlQWxpYXNlcykuZm9yRWFjaCgoYWxpYXMpID0+IHtcbiAgICAgICAgaWYgKGFsaWFzIGluIG1ldGhvZHMpIHtcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5iYWRXcml0ZUFsaWFzICsgYWxpYXMpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICByZWdpc3RlckJ1aWx0aW5TY2hlbWEoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciB0aGlzVmFyID0gYXN0LnZhcmlhYmxlKCd0aGlzJyk7XG5cbiAgICBmdW5jdGlvbiByZWdpc3RlckFzQ2FsbChuYW1lOiBzdHJpbmcsIG1ldGhvZE5hbWU6IHN0cmluZyk6IHZvaWQge1xuICAgICAgc2VsZi5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKG5hbWUsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwge1xuICAgICAgICB2YWxpZGF0ZTogYXN0Lm1ldGhvZChbJ3RoaXMnXSwgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdCh0aGlzVmFyLCAnQW55JyksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5zdHJpbmcobWV0aG9kTmFtZSkpKSlcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnQW55JywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XG4gICAgICB2YWxpZGF0ZTogYXN0Lm1ldGhvZChbJ3RoaXMnXSwgYXN0LmJvb2xlYW4odHJ1ZSkpXG4gICAgfSk7XG5cbiAgICByZWdpc3RlckFzQ2FsbCgnT2JqZWN0JywgJ2hhc0NoaWxkcmVuJyk7XG5cbiAgICAvLyBCZWNhdXNlIG9mIHRoZSB3YXkgZmlyZWJhc2UgdHJlYXRzIE51bGwgdmFsdWVzLCB0aGVyZSBpcyBubyB3YXkgdG9cbiAgICAvLyB3cml0ZSBhIHZhbGlkYXRpb24gcnVsZSwgdGhhdCB3aWxsIEVWRVIgYmUgY2FsbGVkIHdpdGggdGhpcyA9PSBudWxsXG4gICAgLy8gKGZpcmViYXNlIGFsbG93cyB2YWx1ZXMgdG8gYmUgZGVsZXRlZCBubyBtYXR0ZXIgdGhlaXIgdmFsaWRhdGlvbiBydWxlcykuXG4gICAgLy8gU28sIGNvbXBhcmluZyB0aGlzID09IG51bGwgd2lsbCBhbHdheXMgcmV0dXJuIGZhbHNlIC0+IHRoYXQgaXMgd2hhdFxuICAgIC8vIHdlIGRvIGhlcmUsIHdoaWNoIHdpbGwgYmUgb3B0aW1pemVkIGF3YXkgaWYgT1JlZCB3aXRoIG90aGVyIHZhbGlkYXRpb25zLlxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnTnVsbCcsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwge1xuICAgICAgdmFsaWRhdGU6IGFzdC5tZXRob2QoWyd0aGlzJ10sIGFzdC5ib29sZWFuKGZhbHNlKSlcbiAgICB9KTtcblxuICAgIHNlbGYuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnU3RyaW5nJywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XG4gICAgICB2YWxpZGF0ZTogYXN0Lm1ldGhvZChbJ3RoaXMnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LmNhc3QodGhpc1ZhciwgJ0FueScpLCBhc3Quc3RyaW5nKCdpc1N0cmluZycpKSkpLFxuICAgICAgaW5jbHVkZXM6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdjb250YWlucycpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncycpKSBdKSksXG4gICAgICBzdGFydHNXaXRoOiBhc3QubWV0aG9kKFsndGhpcycsICdzJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdiZWdpbnNXaXRoJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIGFzdC52YWx1ZShhc3QudmFyaWFibGUoJ3MnKSkgXSkpLFxuICAgICAgZW5kc1dpdGg6IGFzdC5tZXRob2QoWyd0aGlzJywgJ3MnXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdlbmRzV2l0aCcpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncycpKSBdKSksXG4gICAgICByZXBsYWNlOiBhc3QubWV0aG9kKFsndGhpcycsICdzJywgJ3InXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ3JlcGxhY2UnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncycpKSwgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncicpKSBdKSksXG4gICAgICB0ZXN0OiBhc3QubWV0aG9kKFsndGhpcycsICdyJ10sXG4gICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdtYXRjaGVzJykpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbIGFzdC5jYWxsKGFzdC52YXJpYWJsZSgnQFJlZ0V4cCcpLCBbYXN0LnZhcmlhYmxlKCdyJyldKSBdKSksXG4gICAgfSk7XG5cbiAgICByZWdpc3RlckFzQ2FsbCgnTnVtYmVyJywgJ2lzTnVtYmVyJyk7XG4gICAgcmVnaXN0ZXJBc0NhbGwoJ0Jvb2xlYW4nLCAnaXNCb29sZWFuJyk7XG5cbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJGdW5jdGlvbignQFJlZ0V4cCcsIFsnciddLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMuZW5zdXJlVHlwZS5iaW5kKHRoaXMsICdSZWdFeHAnKSkpO1xuXG4gICAgbGV0IG1hcCA9IHRoaXMuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnTWFwJywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ0tleScsICdWYWx1ZSddKTtcbiAgICBtYXAuZ2V0VmFsaWRhdG9yID0gdGhpcy5nZXRNYXBWYWxpZGF0b3IuYmluZCh0aGlzKTtcbiAgfVxuXG4gIC8vIHR5cGUgTWFwPEtleSwgVmFsdWU+ID0+IHtcbiAgLy8gICAka2V5OiB7XG4gIC8vICAgICAnLnZhbGlkYXRlJzogJGtleSBpbnN0YW5jZW9mIEtleSBhbmQgdGhpcyBpbnN0YW5jZW9mIFZhbHVlO1xuICAvLyAgICcudmFsaWRhdGUnOiAnbmV3RGF0YS5oYXNDaGlsZHJlbigpJ1xuICAvLyB9XG4gIC8vIEtleSBtdXN0IGRlcml2ZSBmcm9tIFN0cmluZ1xuICBnZXRNYXBWYWxpZGF0b3IocGFyYW1zOiBhc3QuRXhwW10pOiBWYWxpZGF0b3Ige1xuICAgIGxldCBrZXlUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBwYXJhbXNbMF07XG4gICAgbGV0IHZhbHVlVHlwZSA9IDxhc3QuRXhwVHlwZT4gcGFyYW1zWzFdO1xuICAgIGlmIChrZXlUeXBlLnR5cGUgIT09ICd0eXBlJyB8fCAhdGhpcy5zeW1ib2xzLmlzRGVyaXZlZEZyb20oa2V5VHlwZSwgJ1N0cmluZycpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmludmFsaWRNYXBLZXkgKyBcIiAgKFwiICsgYXN0LmRlY29kZUV4cHJlc3Npb24oa2V5VHlwZSkgKyBcIiBkb2VzIG5vdClcIik7XG4gICAgfVxuXG4gICAgbGV0IHZhbGlkYXRvciA9IDxWYWxpZGF0b3I+IHt9O1xuICAgIGxldCBpbmRleCA9IHRoaXMudW5pcXVlS2V5KCk7XG4gICAgdmFsaWRhdG9yW2luZGV4XSA9IDxWYWxpZGF0b3I+IHt9O1xuICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIHRoaXMuZW5zdXJlVmFsaWRhdG9yKGFzdC50eXBlVHlwZSgnT2JqZWN0JykpKTtcblxuICAgIC8vIEZpcnN0IHZhbGlkYXRlIHRoZSBrZXkgKG9taXQgdGVybWluYWwgU3RyaW5nIHR5cGUgdmFsaWRhdGlvbikuXG4gICAgd2hpbGUgKGtleVR5cGUubmFtZSAhPT0gJ1N0cmluZycpIHtcbiAgICAgIGxldCBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW2tleVR5cGUubmFtZV07XG4gICAgICBpZiAoc2NoZW1hLm1ldGhvZHNbJ3ZhbGlkYXRlJ10pIHtcbiAgICAgICAgbGV0IGV4cCA9IHRoaXMucGFydGlhbEV2YWwoc2NoZW1hLm1ldGhvZHNbJ3ZhbGlkYXRlJ10uYm9keSwgeyd0aGlzJzogYXN0LmxpdGVyYWwoaW5kZXgpfSk7XG4gICAgICAgIGV4dGVuZFZhbGlkYXRvcig8VmFsaWRhdG9yPiB2YWxpZGF0b3JbaW5kZXhdLCA8VmFsaWRhdG9yPiB7Jy52YWxpZGF0ZSc6IFtleHBdfSk7XG4gICAgICB9XG4gICAgICBrZXlUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBzY2hlbWEuZGVyaXZlZEZyb207XG4gICAgfVxuXG4gICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZhbGlkYXRvcltpbmRleF0sIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHZhbHVlVHlwZSkpO1xuICAgIHJldHVybiB2YWxpZGF0b3I7XG4gIH1cblxuICB1bmlxdWVLZXkoKTogc3RyaW5nIHtcbiAgICB0aGlzLmtleUluZGV4ICs9IDE7XG4gICAgcmV0dXJuICcka2V5JyArIHRoaXMua2V5SW5kZXg7XG4gIH1cblxuICAvLyBDb2xsZWN0aW9uIHNjaGVtYSBoYXMgZXhhY3RseSBvbmUgJHdpbGRjaGlsZCBwcm9wZXJ0eVxuICBpc0NvbGxlY3Rpb25TY2hlbWEoc2NoZW1hOiBhc3QuU2NoZW1hKTogYm9vbGVhbiB7XG4gICAgbGV0IHByb3BzID0gT2JqZWN0LmtleXMoc2NoZW1hLnByb3BlcnRpZXMpO1xuICAgIGxldCByZXN1bHQgPSBwcm9wcy5sZW5ndGggPT09IDEgJiYgcHJvcHNbMF1bMF0gPT09ICckJztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gRW5zdXJlIHdlIGhhdmUgYSBkZWZpbml0aW9uIGZvciBhIHZhbGlkYXRvciBmb3IgdGhlIGdpdmVuIHNjaGVtYS5cbiAgZW5zdXJlVmFsaWRhdG9yKHR5cGU6IGFzdC5FeHBUeXBlKTogVmFsaWRhdG9yIHtcbiAgICB2YXIga2V5ID0gYXN0LmRlY29kZUV4cHJlc3Npb24odHlwZSk7XG4gICAgaWYgKCF0aGlzLnZhbGlkYXRvcnNba2V5XSkge1xuICAgICAgdGhpcy52YWxpZGF0b3JzW2tleV0gPSB7Jy52YWxpZGF0ZSc6IGFzdC5saXRlcmFsKCcqKipUWVBFIFJFQ1VSU0lPTioqKicpIH07XG5cbiAgICAgIGxldCBhbGxvd1NhdmUgPSB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zO1xuICAgICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IHRydWU7XG4gICAgICB0aGlzLnZhbGlkYXRvcnNba2V5XSA9IHRoaXMuY3JlYXRlVmFsaWRhdG9yKHR5cGUpO1xuICAgICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IGFsbG93U2F2ZTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdG9yc1trZXldO1xuICB9XG5cbiAgY3JlYXRlVmFsaWRhdG9yKHR5cGU6IGFzdC5FeHBUeXBlKTogVmFsaWRhdG9yIHtcbiAgICBzd2l0Y2ggKHR5cGUudHlwZSkge1xuICAgIGNhc2UgJ3R5cGUnOlxuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYU5hbWUoKDxhc3QuRXhwU2ltcGxlVHlwZT4gdHlwZSkubmFtZSk7XG5cbiAgICBjYXNlICd1bmlvbic6XG4gICAgICBsZXQgdW5pb24gPSA8VmFsaWRhdG9yPiB7fTtcbiAgICAgICg8YXN0LkV4cFVuaW9uVHlwZT4gdHlwZSkudHlwZXMuZm9yRWFjaCgodHlwZVBhcnQ6IGFzdC5FeHBUeXBlKSA9PiB7XG4gICAgICAgIC8vIE1ha2UgYSBjb3B5XG4gICAgICAgIHZhciBzaW5nbGVUeXBlID0gZXh0ZW5kVmFsaWRhdG9yKHt9LCB0aGlzLmVuc3VyZVZhbGlkYXRvcih0eXBlUGFydCkpO1xuICAgICAgICBtYXBWYWxpZGF0b3Ioc2luZ2xlVHlwZSwgYXN0LmFuZEFycmF5KTtcbiAgICAgICAgZXh0ZW5kVmFsaWRhdG9yKHVuaW9uLCBzaW5nbGVUeXBlKTtcbiAgICAgIH0pO1xuICAgICAgbWFwVmFsaWRhdG9yKHVuaW9uLCBhc3Qub3JBcnJheSk7XG4gICAgICByZXR1cm4gdW5pb247XG5cbiAgICBjYXNlICdnZW5lcmljJzpcbiAgICAgIGxldCBnZW5lcmljVHlwZSA9IDxhc3QuRXhwR2VuZXJpY1R5cGU+IHR5cGU7XG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tR2VuZXJpYyhnZW5lcmljVHlwZS5uYW1lLCBnZW5lcmljVHlwZS5wYXJhbXMpO1xuXG4gICAgZGVmYXVsdDpcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcImludmFsaWQgaW50ZXJuYWwgdHlwZTogXCIgKyB0eXBlLnR5cGUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZVZhbGlkYXRvckZyb21HZW5lcmljKHNjaGVtYU5hbWU6IHN0cmluZywgcGFyYW1zOiBhc3QuRXhwVHlwZVtdKTogVmFsaWRhdG9yIHtcbiAgICB2YXIgc2NoZW1hID0gdGhpcy5zeW1ib2xzLnNjaGVtYVtzY2hlbWFOYW1lXTtcblxuICAgIGlmIChzY2hlbWEgPT09IHVuZGVmaW5lZCB8fCAhYXN0LlNjaGVtYS5pc0dlbmVyaWMoc2NoZW1hKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5ub1N1Y2hUeXBlICsgc2NoZW1hTmFtZSArIFwiIChnZW5lcmljKVwiKTtcbiAgICB9XG5cbiAgICBsZXQgc2NoZW1hUGFyYW1zID0gPHN0cmluZ1tdPiBzY2hlbWEucGFyYW1zO1xuXG4gICAgaWYgKHBhcmFtcy5sZW5ndGggIT09IHNjaGVtYVBhcmFtcy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuaW52YWxpZEdlbmVyaWMgKyBcIiBleHBlY3RlZCA8XCIgKyBzY2hlbWFQYXJhbXMuam9pbignLCAnKSArIFwiPlwiKTtcbiAgICB9XG5cbiAgICAvLyBDYWxsIGN1c3RvbSB2YWxpZGF0b3IsIGlmIGdpdmVuLlxuICAgIGlmIChzY2hlbWEuZ2V0VmFsaWRhdG9yKSB7XG4gICAgICByZXR1cm4gc2NoZW1hLmdldFZhbGlkYXRvcihwYXJhbXMpO1xuICAgIH1cblxuICAgIGxldCBiaW5kaW5ncyA9IDxhc3QuVHlwZVBhcmFtcz4ge307XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGJpbmRpbmdzW3NjaGVtYVBhcmFtc1tpXV0gPSBwYXJhbXNbaV07XG4gICAgfVxuXG4gICAgLy8gRXhwYW5kIGdlbmVyaWNzIGFuZCBnZW5lcmF0ZSB2YWxpZGF0b3IgZnJvbSBzY2hlbWEuXG4gICAgc2NoZW1hID0gdGhpcy5yZXBsYWNlR2VuZXJpY3NJblNjaGVtYShzY2hlbWEsIGJpbmRpbmdzKTtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYSk7XG4gIH1cblxuICByZXBsYWNlR2VuZXJpY3NJblNjaGVtYShzY2hlbWE6IGFzdC5TY2hlbWEsIGJpbmRpbmdzOiBhc3QuVHlwZVBhcmFtcyk6IGFzdC5TY2hlbWEge1xuICAgIHZhciBleHBhbmRlZFNjaGVtYSA9IDxhc3QuU2NoZW1hPiB7XG4gICAgICBkZXJpdmVkRnJvbTogPGFzdC5FeHBUeXBlPiB0aGlzLnJlcGxhY2VHZW5lcmljc0luRXhwKHNjaGVtYS5kZXJpdmVkRnJvbSwgYmluZGluZ3MpLFxuICAgICAgcHJvcGVydGllczogeyB9LFxuICAgICAgbWV0aG9kczoge30sXG4gICAgfTtcbiAgICBsZXQgcHJvcHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucHJvcGVydGllcyk7XG4gICAgcHJvcHMuZm9yRWFjaCgocHJvcCkgPT4ge1xuICAgICAgZXhwYW5kZWRTY2hlbWEucHJvcGVydGllc1twcm9wXSA9XG4gICAgICAgIDxhc3QuRXhwVHlwZT4gdGhpcy5yZXBsYWNlR2VuZXJpY3NJbkV4cChzY2hlbWEucHJvcGVydGllc1twcm9wXSwgYmluZGluZ3MpO1xuICAgIH0pO1xuXG4gICAgbGV0IG1ldGhvZHMgPSBPYmplY3Qua2V5cyhzY2hlbWEubWV0aG9kcyk7XG4gICAgbWV0aG9kcy5mb3JFYWNoKChtZXRob2ROYW1lKSA9PiB7XG4gICAgICBleHBhbmRlZFNjaGVtYS5tZXRob2RzW21ldGhvZE5hbWVdID0gdGhpcy5yZXBsYWNlR2VuZXJpY3NJbk1ldGhvZChzY2hlbWEubWV0aG9kc1ttZXRob2ROYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmluZGluZ3MpO1xuICAgIH0pO1xuICAgIHJldHVybiBleHBhbmRlZFNjaGVtYTtcbiAgfVxuXG4gIHJlcGxhY2VHZW5lcmljc0luRXhwKGV4cDogYXN0LkV4cCwgYmluZGluZ3M6IGFzdC5UeXBlUGFyYW1zKTogYXN0LkV4cCB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgZnVuY3Rpb24gcmVwbGFjZUdlbmVyaWNzSW5BcnJheShleHBzOiBhc3QuRXhwW10pOiBhc3QuRXhwW10ge1xuICAgICAgcmV0dXJuIGV4cHMubWFwKGZ1bmN0aW9uKGV4cFBhcnQpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYucmVwbGFjZUdlbmVyaWNzSW5FeHAoZXhwUGFydCwgYmluZGluZ3MpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChleHAudHlwZSkge1xuICAgIGNhc2UgJ29wJzpcbiAgICBjYXNlICdjYWxsJzpcbiAgICAgIGxldCBvcFR5cGUgPSA8YXN0LkV4cE9wPiBhc3QuY29weUV4cChleHApO1xuICAgICAgb3BUeXBlLmFyZ3MgPSByZXBsYWNlR2VuZXJpY3NJbkFycmF5KG9wVHlwZS5hcmdzKTtcbiAgICAgIHJldHVybiBvcFR5cGU7XG5cbiAgICBjYXNlICd0eXBlJzpcbiAgICAgIGxldCBzaW1wbGVUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBleHA7XG4gICAgICByZXR1cm4gYmluZGluZ3Nbc2ltcGxlVHlwZS5uYW1lXSB8fCBzaW1wbGVUeXBlO1xuXG4gICAgY2FzZSAndW5pb24nOlxuICAgICAgbGV0IHVuaW9uVHlwZSA9IDxhc3QuRXhwVW5pb25UeXBlPiBleHA7XG4gICAgICByZXR1cm4gYXN0LnVuaW9uVHlwZSg8YXN0LkV4cFR5cGVbXT4gcmVwbGFjZUdlbmVyaWNzSW5BcnJheSh1bmlvblR5cGUudHlwZXMpKTtcblxuICAgIGNhc2UgJ2dlbmVyaWMnOlxuICAgICAgbGV0IGdlbmVyaWNUeXBlID0gPGFzdC5FeHBHZW5lcmljVHlwZT4gZXhwO1xuICAgICAgcmV0dXJuIGFzdC5nZW5lcmljVHlwZShnZW5lcmljVHlwZS5uYW1lLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YXN0LkV4cFR5cGVbXT4gcmVwbGFjZUdlbmVyaWNzSW5BcnJheShnZW5lcmljVHlwZS5wYXJhbXMpKTtcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZXhwO1xuICAgIH1cbiAgfVxuXG4gIHJlcGxhY2VHZW5lcmljc0luTWV0aG9kKG1ldGhvZDogYXN0Lk1ldGhvZCwgYmluZGluZ3M6IGFzdC5UeXBlUGFyYW1zKTogYXN0Lk1ldGhvZCB7XG4gICAgdmFyIGV4cGFuZGVkTWV0aG9kID0gPGFzdC5NZXRob2Q+IHtcbiAgICAgIHBhcmFtczogbWV0aG9kLnBhcmFtcyxcbiAgICAgIGJvZHk6IG1ldGhvZC5ib2R5XG4gICAgfTtcblxuICAgIGV4cGFuZGVkTWV0aG9kLmJvZHkgPSB0aGlzLnJlcGxhY2VHZW5lcmljc0luRXhwKG1ldGhvZC5ib2R5LCBiaW5kaW5ncyk7XG4gICAgcmV0dXJuIGV4cGFuZGVkTWV0aG9kO1xuICB9XG5cbiAgY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYU5hbWUoc2NoZW1hTmFtZTogc3RyaW5nKTogVmFsaWRhdG9yIHtcbiAgICB2YXIgc2NoZW1hID0gdGhpcy5zeW1ib2xzLnNjaGVtYVtzY2hlbWFOYW1lXTtcblxuICAgIGlmICghc2NoZW1hKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm5vU3VjaFR5cGUgKyBzY2hlbWFOYW1lKTtcbiAgICB9XG5cbiAgICBpZiAoYXN0LlNjaGVtYS5pc0dlbmVyaWMoc2NoZW1hKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5ub1N1Y2hUeXBlICsgc2NoZW1hTmFtZSArIFwiIHVzZWQgYXMgbm9uLWdlbmVyaWMgdHlwZS5cIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYShzY2hlbWEpO1xuICB9XG5cbiAgY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYShzY2hlbWE6IGFzdC5TY2hlbWEpOiBWYWxpZGF0b3Ige1xuICAgIHZhciBoYXNQcm9wcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKS5sZW5ndGggPiAwICYmXG4gICAgICAhdGhpcy5pc0NvbGxlY3Rpb25TY2hlbWEoc2NoZW1hKTtcblxuICAgIGlmIChoYXNQcm9wcyAmJiAhdGhpcy5zeW1ib2xzLmlzRGVyaXZlZEZyb20oc2NoZW1hLmRlcml2ZWRGcm9tLCAnT2JqZWN0JykpIHtcbiAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLm5vbk9iamVjdCArIFwiIChpcyBcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKHNjaGVtYS5kZXJpdmVkRnJvbSkgKyBcIilcIik7XG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgbGV0IHZhbGlkYXRvciA9IDxWYWxpZGF0b3I+IHt9O1xuXG4gICAgaWYgKCEoc2NoZW1hLmRlcml2ZWRGcm9tLnR5cGUgPT09ICd0eXBlJyAmJlxuICAgICAgICAgICg8YXN0LkV4cFNpbXBsZVR5cGU+IHNjaGVtYS5kZXJpdmVkRnJvbSkubmFtZSA9PT0gJ0FueScpKSB7XG4gICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLCB0aGlzLmVuc3VyZVZhbGlkYXRvcihzY2hlbWEuZGVyaXZlZEZyb20pKTtcbiAgICB9XG5cbiAgICBsZXQgcmVxdWlyZWRQcm9wZXJ0aWVzID0gPHN0cmluZ1tdPiBbXTtcbiAgICBsZXQgd2lsZFByb3BlcnRpZXMgPSAwO1xuICAgIE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKS5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xuICAgICAgaWYgKHByb3BOYW1lWzBdID09PSAnJCcpIHtcbiAgICAgICAgd2lsZFByb3BlcnRpZXMgKz0gMTtcbiAgICAgICAgaWYgKElOVkFMSURfS0VZX1JFR0VYLnRlc3QocHJvcE5hbWUuc2xpY2UoMSkpKSB7XG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMuaW52YWxpZFByb3BlcnR5TmFtZSArIHByb3BOYW1lKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKElOVkFMSURfS0VZX1JFR0VYLnRlc3QocHJvcE5hbWUpKSB7XG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMuaW52YWxpZFByb3BlcnR5TmFtZSArIHByb3BOYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKCF2YWxpZGF0b3JbcHJvcE5hbWVdKSB7XG4gICAgICAgIHZhbGlkYXRvcltwcm9wTmFtZV0gPSB7fTtcbiAgICAgIH1cbiAgICAgIHZhciBwcm9wVHlwZSA9IHNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BOYW1lXTtcbiAgICAgIGlmIChwcm9wTmFtZVswXSAhPT0gJyQnICYmICF0aGlzLmlzTnVsbGFibGVUeXBlKHByb3BUeXBlKSkge1xuICAgICAgICByZXF1aXJlZFByb3BlcnRpZXMucHVzaChwcm9wTmFtZSk7XG4gICAgICB9XG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdmFsaWRhdG9yW3Byb3BOYW1lXSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IocHJvcFR5cGUpKTtcbiAgICB9KTtcblxuICAgIGlmICh3aWxkUHJvcGVydGllcyA+IDEgfHwgd2lsZFByb3BlcnRpZXMgPT09IDEgJiYgcmVxdWlyZWRQcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmludmFsaWRXaWxkQ2hpbGRyZW4pO1xuICAgIH1cblxuICAgIGlmIChyZXF1aXJlZFByb3BlcnRpZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gdGhpcy5oYXNDaGlsZHJlbihyZXF1aXJlZFByb3BlcnRpZXMpXG4gICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLFxuICAgICAgICAgICAgICAgICAgICAgIHsnLnZhbGlkYXRlJzogW2hhc0NoaWxkcmVuRXhwKHJlcXVpcmVkUHJvcGVydGllcyldfSk7XG4gICAgfVxuXG4gICAgLy8gRGlzYWxsb3cgJG90aGVyIHByb3BlcnRpZXMgYnkgZGVmYXVsdFxuICAgIGlmIChoYXNQcm9wcykge1xuICAgICAgdmFsaWRhdG9yWyckb3RoZXInXSA9IHt9O1xuICAgICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZhbGlkYXRvclsnJG90aGVyJ10sXG4gICAgICAgICAgICAgICAgICAgICAgPFZhbGlkYXRvcj4geycudmFsaWRhdGUnOiBhc3QuYm9vbGVhbihmYWxzZSl9KTtcbiAgICB9XG5cbiAgICB0aGlzLmV4dGVuZFZhbGlkYXRpb25NZXRob2RzKHZhbGlkYXRvciwgc2NoZW1hLm1ldGhvZHMpO1xuXG4gICAgcmV0dXJuIHZhbGlkYXRvcjtcbiAgfVxuXG4gIGlzTnVsbGFibGVUeXBlKHR5cGU6IGFzdC5FeHBUeXBlKTogYm9vbGVhbiB7XG4gICAgbGV0IHJlc3VsdCA9IHRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHR5cGUsICdOdWxsJykgfHxcbiAgICAgIHRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHR5cGUsICdNYXAnKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLy8gVXBkYXRlIHJ1bGVzIGJhc2VkIG9uIHRoZSBnaXZlbiBwYXRoIGV4cHJlc3Npb24uXG4gIHVwZGF0ZVJ1bGVzKHBhdGg6IGFzdC5QYXRoKSB7XG4gICAgdmFyIGk6IG51bWJlcjtcbiAgICB2YXIgbG9jYXRpb24gPSA8VmFsaWRhdG9yPiB1dGlsLmVuc3VyZU9iamVjdFBhdGgodGhpcy5ydWxlcywgcGF0aC50ZW1wbGF0ZS5nZXRMYWJlbHMoKSk7XG4gICAgdmFyIGV4cDogYXN0LkV4cFZhbHVlO1xuXG4gICAgZXh0ZW5kVmFsaWRhdG9yKGxvY2F0aW9uLCB0aGlzLmVuc3VyZVZhbGlkYXRvcihwYXRoLmlzVHlwZSkpO1xuICAgIGxvY2F0aW9uWycuc2NvcGUnXSA9IHBhdGgudGVtcGxhdGUuZ2V0U2NvcGUoKTtcblxuICAgIHRoaXMuZXh0ZW5kVmFsaWRhdGlvbk1ldGhvZHMobG9jYXRpb24sIHBhdGgubWV0aG9kcyk7XG5cbiAgICAvLyBXcml0ZSBpbmRpY2VzXG4gICAgaWYgKHBhdGgubWV0aG9kc1snaW5kZXgnXSkge1xuICAgICAgc3dpdGNoIChwYXRoLm1ldGhvZHNbJ2luZGV4J10uYm9keS50eXBlKSB7XG4gICAgICBjYXNlICdTdHJpbmcnOlxuICAgICAgICBleHAgPSBhc3QuYXJyYXkoW3BhdGgubWV0aG9kc1snaW5kZXgnXS5ib2R5XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnQXJyYXknOlxuICAgICAgICBleHAgPSA8YXN0LkV4cFZhbHVlPiBwYXRoLm1ldGhvZHNbJ2luZGV4J10uYm9keTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5iYWRJbmRleCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBpbmRpY2VzID0gPHN0cmluZ1tdPiBbXTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBleHAudmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGV4cC52YWx1ZVtpXS50eXBlICE9PSAnU3RyaW5nJykge1xuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZEluZGV4ICsgXCIgKG5vdCBcIiArIGV4cC52YWx1ZVtpXS50eXBlICsgXCIpXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGluZGljZXMucHVzaChleHAudmFsdWVbaV0udmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvLyBUT0RPOiBFcnJvciBjaGVjayBub3Qgb3Zlci13cml0aW5nIGluZGV4IHJ1bGVzLlxuICAgICAgbG9jYXRpb25bJy5pbmRleE9uJ10gPSBpbmRpY2VzO1xuICAgIH1cbiAgfVxuXG4gIGV4dGVuZFZhbGlkYXRpb25NZXRob2RzKHZhbGlkYXRvcjogVmFsaWRhdG9yLCBtZXRob2RzOiB7IFttZXRob2Q6IHN0cmluZ106IGFzdC5NZXRob2QgfSkge1xuICAgIGxldCB3cml0ZU1ldGhvZHMgPSA8YXN0LkV4cFtdPiBbXTtcbiAgICBbJ2NyZWF0ZScsICd1cGRhdGUnLCAnZGVsZXRlJ10uZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBpZiAobWV0aG9kIGluIG1ldGhvZHMpIHtcbiAgICAgICAgd3JpdGVNZXRob2RzLnB1c2goYXN0LmFuZEFycmF5KFt3cml0ZUFsaWFzZXNbbWV0aG9kXSwgbWV0aG9kc1ttZXRob2RdLmJvZHldKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYgKHdyaXRlTWV0aG9kcy5sZW5ndGggIT09IDApIHtcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIDxWYWxpZGF0b3I+IHsgJy53cml0ZSc6IGFzdC5vckFycmF5KHdyaXRlTWV0aG9kcykgfSk7XG4gICAgfVxuXG4gICAgWyd2YWxpZGF0ZScsICdyZWFkJywgJ3dyaXRlJ10uZm9yRWFjaCgobWV0aG9kKSA9PiB7XG4gICAgICBpZiAobWV0aG9kIGluIG1ldGhvZHMpIHtcbiAgICAgICAgdmFyIG1ldGhvZFZhbGlkYXRvciA9IDxWYWxpZGF0b3I+IHt9O1xuICAgICAgICBtZXRob2RWYWxpZGF0b3JbJy4nICsgbWV0aG9kXSA9IG1ldGhvZHNbbWV0aG9kXS5ib2R5O1xuICAgICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLCBtZXRob2RWYWxpZGF0b3IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gUmV0dXJuIHVuaW9uIHZhbGlkYXRvciAofHwpIG92ZXIgZWFjaCBzY2hlbWFcbiAgdW5pb25WYWxpZGF0b3JzKHNjaGVtYTogc3RyaW5nW10pOiBWYWxpZGF0b3Ige1xuICAgIHZhciB1bmlvbiA9IDxWYWxpZGF0b3I+IHt9O1xuICAgIHNjaGVtYS5mb3JFYWNoKGZ1bmN0aW9uKHR5cGVOYW1lOiBzdHJpbmcpIHtcbiAgICAgIC8vIEZpcnN0IGFuZCB0aGUgdmFsaWRhdG9yIHRlcm1zIGZvciBhIHNpbmdsZSB0eXBlXG4gICAgICAvLyBUb2RvIGV4dGVuZCB0byB1bmlvbnMgYW5kIGdlbmVyaWNzXG4gICAgICB2YXIgc2luZ2xlVHlwZSA9IGV4dGVuZFZhbGlkYXRvcih7fSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IodHlwZU5hbWUpKTtcbiAgICAgIG1hcFZhbGlkYXRvcihzaW5nbGVUeXBlLCBhc3QuYW5kQXJyYXkpO1xuICAgICAgZXh0ZW5kVmFsaWRhdG9yKHVuaW9uLCBzaW5nbGVUeXBlKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICAgIG1hcFZhbGlkYXRvcih1bmlvbiwgYXN0Lm9yQXJyYXkpO1xuICAgIHJldHVybiB1bmlvbjtcbiAgfVxuXG4gIC8vIENvbnZlcnQgZXhwcmVzc2lvbnMgdG8gdGV4dCwgYW5kIGF0IHRoZSBzYW1lIHRpbWUsIGFwcGx5IHBydW5pbmcgb3BlcmF0aW9uc1xuICAvLyB0byByZW1vdmUgbm8tb3AgcnVsZXMuXG4gIGNvbnZlcnRFeHByZXNzaW9ucyh2YWxpZGF0b3I6IFZhbGlkYXRvcikge1xuICAgIHZhciBtZXRob2RUaGlzSXMgPSA8e1twcm9wOiBzdHJpbmddOiBzdHJpbmd9PiB7ICcudmFsaWRhdGUnOiAnbmV3RGF0YScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJy5yZWFkJzogJ2RhdGEnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICcud3JpdGUnOiAnbmV3RGF0YScgfTtcblxuICAgIGZ1bmN0aW9uIGhhc1dpbGRjYXJkU2libGluZyhwYXRoOiBhc3QuUGF0aFRlbXBsYXRlKTogYm9vbGVhbiB7XG4gICAgICBsZXQgcGFydHMgPSBwYXRoLmdldExhYmVscygpO1xuICAgICAgbGV0IGNoaWxkUGFydCA9IHBhcnRzLnBvcCgpO1xuICAgICAgbGV0IHBhcmVudCA9IHV0aWwuZGVlcExvb2t1cCh2YWxpZGF0b3IsIHBhcnRzKTtcbiAgICAgIGlmIChwYXJlbnQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBmb3IgKGxldCBwcm9wIG9mIE9iamVjdC5rZXlzKHBhcmVudCkpIHtcbiAgICAgICAgaWYgKHByb3AgPT09IGNoaWxkUGFydCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChwcm9wWzBdID09PSAnJCcpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIG1hcFZhbGlkYXRvcih2YWxpZGF0b3IsICh2YWx1ZTogYXN0LkV4cFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlOiBhc3QuUGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiBhc3QuUGF0aFRlbXBsYXRlKSA9PiB7XG4gICAgICBpZiAocHJvcCBpbiBtZXRob2RUaGlzSXMpIHtcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMuZ2V0RXhwcmVzc2lvblRleHQoYXN0LmFuZEFycmF5KGNvbGxhcHNlSGFzQ2hpbGRyZW4odmFsdWUpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWV0aG9kVGhpc0lzW3Byb3BdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aCk7XG4gICAgICAgIC8vIFJlbW92ZSBuby1vcCAucmVhZCBvciAud3JpdGUgcnVsZSBpZiBubyBzaWJsaW5nIHdpbGRjYXJkIHByb3BzLlxuICAgICAgICBpZiAoKHByb3AgPT09ICcucmVhZCcgfHwgcHJvcCA9PT0gJy53cml0ZScpICYmIHJlc3VsdCA9PT0gJ2ZhbHNlJykge1xuICAgICAgICAgIGlmICghaGFzV2lsZGNhcmRTaWJsaW5nKHBhdGgpKSB7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlbW92ZSBuby1vcCAudmFsaWRhdGUgcnVsZSBpZiBubyBzaWJsaW5nIHdpbGRjYXJkIHByb3BzLlxuICAgICAgICBpZiAocHJvcCA9PT0gJy52YWxpZGF0ZScgJiYgcmVzdWx0ID09PSAndHJ1ZScpIHtcbiAgICAgICAgICBpZiAoIWhhc1dpbGRjYXJkU2libGluZyhwYXRoKSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0pO1xuICB9XG5cbiAgZ2V0RXhwcmVzc2lvblRleHQoZXhwOiBhc3QuRXhwLCB0aGlzSXM6IHN0cmluZywgc2NvcGU6IGFzdC5QYXJhbXMsIHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpOiBzdHJpbmcge1xuICAgIGlmICghKCd0eXBlJyBpbiBleHApKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJOb3QgYW4gZXhwcmVzc2lvbjogXCIgKyB1dGlsLnByZXR0eUpTT04oZXhwKSk7XG4gICAgfVxuICAgIC8vIEZpcnN0IGV2YWx1YXRlIHcvbyBiaW5kaW5nIG9mIHRoaXMgdG8gc3BlY2lmaWMgbG9jYXRpb24uXG4gICAgdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucyA9IHRydWU7XG4gICAgc2NvcGUgPSA8YXN0LlBhcmFtcz4gdXRpbC5leHRlbmQoe30sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NvcGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgeyAndGhpcyc6IGFzdC5jYXN0KGFzdC5jYWxsKGFzdC52YXJpYWJsZSgnQGdldFRoaXMnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdTbmFwc2hvdCcpIH0pO1xuICAgIGV4cCA9IHRoaXMucGFydGlhbEV2YWwoZXhwLCBzY29wZSk7XG4gICAgLy8gTm93IHJlLWV2YWx1YXRlIHRoZSBmbGF0dGVuZWQgZXhwcmVzc2lvbi5cbiAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gZmFsc2U7XG4gICAgdGhpcy50aGlzSXMgPSB0aGlzSXM7XG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ0BnZXRUaGlzJywgW10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5nZXRUaGlzLmJpbmQodGhpcykpKTtcbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJGdW5jdGlvbignQHJvb3QnLCBbXSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLmdldFJvb3RSZWZlcmVuY2UuYmluZCh0aGlzLCBwYXRoKSkpO1xuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdwcmlvcicsIFsnZXhwJ10sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5wcmlvci5iaW5kKHRoaXMpKSk7XG4gICAgdGhpcy5zeW1ib2xzLnJlZ2lzdGVyRnVuY3Rpb24oJ2tleScsIFtdLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMuZ2V0S2V5LmJpbmQoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aC5sZW5ndGgoKSA9PT0gMCA/ICcnIDogcGF0aC5nZXRQYXJ0KC0xKS5sYWJlbCkpKTtcblxuICAgIGV4cCA9IHRoaXMucGFydGlhbEV2YWwoZXhwKTtcblxuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydAZ2V0VGhpcyddO1xuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydAcm9vdCddO1xuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydwcmlvciddO1xuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydrZXknXTtcblxuICAgIC8vIFRvcCBsZXZlbCBleHByZXNzaW9ucyBzaG91bGQgbmV2ZXIgYmUgdG8gYSBzbmFwc2hvdCByZWZlcmVuY2UgLSBzaG91bGRcbiAgICAvLyBhbHdheXMgZXZhbHVhdGUgdG8gYSBib29sZWFuLlxuICAgIGV4cCA9IGFzdC5lbnN1cmVCb29sZWFuKGV4cCk7XG4gICAgcmV0dXJuIGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cCk7XG4gIH1cblxuICAvKlxuICAgKiAgV3JhcHBlciBmb3IgcGFydGlhbEV2YWwgZGVidWdnaW5nLlxuICAgKi9cblxuICBwYXJ0aWFsRXZhbChleHA6IGFzdC5FeHAsXG4gICAgICAgICAgICAgIHBhcmFtcyA9IDxhc3QuUGFyYW1zPiB7fSxcbiAgICAgICAgICAgICAgZnVuY3Rpb25DYWxsczogeyBbbmFtZTogc3RyaW5nXTogYm9vbGVhbiB9ID0ge30pXG4gIDogYXN0LkV4cCB7XG4gICAgLy8gV3JhcCByZWFsIGNhbGwgZm9yIGRlYnVnZ2luZy5cbiAgICBsZXQgcmVzdWx0ID0gdGhpcy5wYXJ0aWFsRXZhbFJlYWwoZXhwLCBwYXJhbXMsIGZ1bmN0aW9uQ2FsbHMpO1xuICAgIC8vIGNvbnNvbGUubG9nKGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cCkgKyBcIiA9PiBcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKHJlc3VsdCkpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyBQYXJ0aWFsIGV2YWx1YXRpb24gb2YgZXhwcmVzc2lvbnMgLSBjb3B5IG9mIGV4cHJlc3Npb24gdHJlZSAoaW1tdXRhYmxlKS5cbiAgLy9cbiAgLy8gLSBFeHBhbmQgaW5saW5lIGZ1bmN0aW9uIGNhbGxzLlxuICAvLyAtIFJlcGxhY2UgbG9jYWwgYW5kIGdsb2JhbCB2YXJpYWJsZXMgd2l0aCB0aGVpciB2YWx1ZXMuXG4gIC8vIC0gRXhwYW5kIHNuYXBzaG90IHJlZmVyZW5jZXMgdXNpbmcgY2hpbGQoJ3JlZicpLlxuICAvLyAtIENvZXJjZSBzbmFwc2hvdCByZWZlcmVuY2VzIHRvIHZhbHVlcyBhcyBuZWVkZWQuXG4gIHBhcnRpYWxFdmFsUmVhbChleHA6IGFzdC5FeHAsXG4gICAgICAgICAgICAgIHBhcmFtcyA9IDxhc3QuUGFyYW1zPiB7fSxcbiAgICAgICAgICAgICAgZnVuY3Rpb25DYWxscyA9IDx7IFtuYW1lOiBzdHJpbmddOiBib29sZWFuIH0+IHt9KVxuICA6IGFzdC5FeHAge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGZ1bmN0aW9uIHN1YkV4cHJlc3Npb24oZXhwMjogYXN0LkV4cCk6IGFzdC5FeHAge1xuICAgICAgcmV0dXJuIHNlbGYucGFydGlhbEV2YWwoZXhwMiwgcGFyYW1zLCBmdW5jdGlvbkNhbGxzKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB2YWx1ZUV4cHJlc3Npb24oZXhwMjogYXN0LkV4cCk6IGFzdC5FeHAge1xuICAgICAgcmV0dXJuIGFzdC5lbnN1cmVWYWx1ZShzdWJFeHByZXNzaW9uKGV4cDIpKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBib29sZWFuRXhwcmVzc2lvbihleHAyOiBhc3QuRXhwKTogYXN0LkV4cCB7XG4gICAgICByZXR1cm4gYXN0LmVuc3VyZUJvb2xlYW4oc3ViRXhwcmVzc2lvbihleHAyKSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbG9va3VwVmFyKGV4cDI6IGFzdC5FeHBWYXJpYWJsZSkge1xuICAgICAgLy8gVE9ETzogVW5ib3VuZCB2YXJpYWJsZSBhY2Nlc3Mgc2hvdWxkIGJlIGFuIGVycm9yLlxuICAgICAgcmV0dXJuIHBhcmFtc1tleHAyLm5hbWVdIHx8IHNlbGYuZ2xvYmFsc1tleHAyLm5hbWVdIHx8IGV4cDI7XG4gICAgfVxuXG4gICAgLy8gQ29udmVydCByZWZbcHJvcF0gPT4gcmVmLmNoaWxkKHByb3ApXG4gICAgZnVuY3Rpb24gc25hcHNob3RDaGlsZChyZWY6IGFzdC5FeHBSZWZlcmVuY2UpOiBhc3QuRXhwIHtcbiAgICAgIHJldHVybiBhc3QuY2FzdChhc3QuY2FsbChhc3QucmVmZXJlbmNlKHJlZi5iYXNlLCBhc3Quc3RyaW5nKCdjaGlsZCcpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbcmVmLmFjY2Vzc29yXSksXG4gICAgICAgICAgICAgICAgICAgICAgJ1NuYXBzaG90Jyk7XG4gICAgfVxuXG4gICAgc3dpdGNoIChleHAudHlwZSkge1xuICAgIGNhc2UgJ29wJzpcbiAgICAgIGxldCBleHBPcCA9IDxhc3QuRXhwT3A+IGFzdC5jb3B5RXhwKGV4cCk7XG4gICAgICAvLyBFbnN1cmUgYXJndW1lbnRzIGFyZSBib29sZWFuIChvciB2YWx1ZXMpIHdoZXJlIG5lZWRlZC5cbiAgICAgIGlmIChleHBPcC5vcCA9PT0gJ3ZhbHVlJykge1xuICAgICAgICBleHBPcC5hcmdzWzBdID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMF0pO1xuICAgICAgfSBlbHNlIGlmIChleHBPcC5vcCA9PT0gJ3x8JyB8fCBleHBPcC5vcCA9PT0gJyYmJyB8fCBleHBPcC5vcCA9PT0gJyEnKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwT3AuYXJncy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGV4cE9wLmFyZ3NbaV0gPSBib29sZWFuRXhwcmVzc2lvbihleHBPcC5hcmdzW2ldKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChleHBPcC5vcCA9PT0gJz86Jykge1xuICAgICAgICBleHBPcC5hcmdzWzBdID0gYm9vbGVhbkV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSk7XG4gICAgICAgIGV4cE9wLmFyZ3NbMV0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1sxXSk7XG4gICAgICAgIGV4cE9wLmFyZ3NbMl0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1syXSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGV4cE9wLmFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBleHBPcC5hcmdzW2ldID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gZXhwT3A7XG5cbiAgICBjYXNlICd2YXInOlxuICAgICAgcmV0dXJuIGxvb2t1cFZhcig8YXN0LkV4cFZhcmlhYmxlPiBleHApO1xuXG4gICAgY2FzZSAncmVmJzpcbiAgICAgIGxldCBleHBSZWYgPSA8YXN0LkV4cFJlZmVyZW5jZT4gYXN0LmNvcHlFeHAoZXhwKTtcbiAgICAgIGV4cFJlZi5iYXNlID0gc3ViRXhwcmVzc2lvbihleHBSZWYuYmFzZSk7XG5cbiAgICAgIC8vIHZhcltyZWZdID0+IHZhcltyZWZdXG4gICAgICBpZiAoZXhwUmVmLmJhc2UudmFsdWVUeXBlICE9PSAnU25hcHNob3QnKSB7XG4gICAgICAgIGV4cFJlZi5hY2Nlc3NvciA9IHN1YkV4cHJlc3Npb24oZXhwUmVmLmFjY2Vzc29yKTtcbiAgICAgICAgcmV0dXJuIGV4cFJlZjtcbiAgICAgIH1cblxuICAgICAgbGV0IHByb3BOYW1lID0gYXN0LmdldFByb3BOYW1lKGV4cFJlZik7XG5cbiAgICAgIC8vIHNuYXBzaG90LnByb3AgKHN0YXRpYyBzdHJpbmcgcHJvcGVydHkpXG4gICAgICBpZiAocHJvcE5hbWUgIT09ICcnKSB7XG4gICAgICAgIC8vIHNuYXBzaG90LnZhbHVlTWV0aG9kID0+IHNuYXBzaG90LnZhbCgpLnZhbHVlTWV0aG9kXG4gICAgICAgIGlmICh1dGlsLmFycmF5SW5jbHVkZXModmFsdWVNZXRob2RzLCBwcm9wTmFtZSkpIHtcbiAgICAgICAgICBleHBSZWYuYmFzZSA9IHZhbHVlRXhwcmVzc2lvbihleHBSZWYuYmFzZSk7XG4gICAgICAgICAgcmV0dXJuIGV4cFJlZjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHNuYXBzaG90LnNzTWV0aG9kID0+IHNuYXBzaG90LnNzTWV0aG9kXG4gICAgICAgIGlmICh1dGlsLmFycmF5SW5jbHVkZXMoc25hcHNob3RNZXRob2RzLCBwcm9wTmFtZSkpIHtcbiAgICAgICAgICByZXR1cm4gZXhwUmVmO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIHNuYXBzaG90W2V4cF0gPT4gc25hcHNob3QuY2hpbGQoZXhwKSBvclxuICAgICAgLy8gc25hcHNob3RbcmVmXSA9PiBzbmFwc2hvdC5jaGlsZChyZWYudmFsKCkpXG4gICAgICBleHBSZWYuYWNjZXNzb3IgPSB2YWx1ZUV4cHJlc3Npb24oZXhwUmVmLmFjY2Vzc29yKTtcbiAgICAgIHJldHVybiBzbmFwc2hvdENoaWxkKGV4cFJlZik7XG5cbiAgICBjYXNlICdjYWxsJzpcbiAgICAgIGxldCBleHBDYWxsID0gPGFzdC5FeHBDYWxsPiBhc3QuY29weUV4cChleHApO1xuICAgICAgZXhwQ2FsbC5yZWYgPSA8YXN0LkV4cFZhcmlhYmxlIHwgYXN0LkV4cFJlZmVyZW5jZT4gc3ViRXhwcmVzc2lvbihleHBDYWxsLnJlZik7XG4gICAgICB2YXIgY2FsbGVlID0gdGhpcy5sb29rdXBGdW5jdGlvbihleHBDYWxsLnJlZik7XG5cbiAgICAgIC8vIEV4cGFuZCB0aGUgZnVuY3Rpb24gY2FsbCBpbmxpbmVcbiAgICAgIGlmIChjYWxsZWUpIHtcbiAgICAgICAgdmFyIGZuID0gY2FsbGVlLmZuO1xuXG4gICAgICAgIGlmIChjYWxsZWUuc2VsZikge1xuICAgICAgICAgIGV4cENhbGwuYXJncy51bnNoaWZ0KGFzdC5lbnN1cmVWYWx1ZShjYWxsZWUuc2VsZikpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZuLnBhcmFtcy5sZW5ndGggIT09IGV4cENhbGwuYXJncy5sZW5ndGgpIHtcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5taXNtYXRjaFBhcmFtcyArIFwiICggXCIgK1xuICAgICAgICAgICAgICAgICAgICAgY2FsbGVlLm1ldGhvZE5hbWUgKyBcIiBleHBlY3RzIFwiICsgZm4ucGFyYW1zLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgICBcIiBidXQgYWN0dWFsbHkgcGFzc2VkIFwiICsgZXhwQ2FsbC5hcmdzLmxlbmd0aCArIFwiKVwiKTtcbiAgICAgICAgICByZXR1cm4gZXhwO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGZuLmJvZHkudHlwZSA9PT0gJ2J1aWx0aW4nKSB7XG4gICAgICAgICAgcmV0dXJuICg8YXN0LkV4cEJ1aWx0aW4+IGZuLmJvZHkpLmZuKGV4cENhbGwuYXJncywgcGFyYW1zKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBpbm5lclBhcmFtcyA9IDxhc3QuUGFyYW1zPiB7fTtcblxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZuLnBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlubmVyUGFyYW1zW2ZuLnBhcmFtc1tpXV0gPSBzdWJFeHByZXNzaW9uKGV4cENhbGwuYXJnc1tpXSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGZ1bmN0aW9uQ2FsbHNbY2FsbGVlLm1ldGhvZE5hbWVdKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5yZWN1cnNpdmUgKyBcIiAoXCIgKyBjYWxsZWUubWV0aG9kTmFtZSArIFwiKVwiKTtcbiAgICAgICAgfVxuICAgICAgICBmdW5jdGlvbkNhbGxzW2NhbGxlZS5tZXRob2ROYW1lXSA9IHRydWU7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzLnBhcnRpYWxFdmFsKGZuLmJvZHksIGlubmVyUGFyYW1zLCBmdW5jdGlvbkNhbGxzKTtcbiAgICAgICAgZnVuY3Rpb25DYWxsc1tjYWxsZWUubWV0aG9kTmFtZV0gPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cblxuICAgICAgLy8gQ2FuJ3QgZXhwYW5kIGZ1bmN0aW9uIC0gYnV0IGp1c3QgZXhwYW5kIHRoZSBhcmd1bWVudHMuXG4gICAgICBpZiAoIXRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMpIHtcbiAgICAgICAgdmFyIGZ1bmNOYW1lID0gYXN0LmdldE1ldGhvZE5hbWUoZXhwQ2FsbCk7XG4gICAgICAgIGlmIChmdW5jTmFtZSAhPT0gJycgJiYgIShmdW5jTmFtZSBpbiB0aGlzLnN5bWJvbHMuc2NoZW1hWydTdHJpbmcnXS5tZXRob2RzIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1dGlsLmFycmF5SW5jbHVkZXMoc25hcHNob3RNZXRob2RzLCBmdW5jTmFtZSkpKSB7XG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMudW5kZWZpbmVkRnVuY3Rpb24gKyBhc3QuZGVjb2RlRXhwcmVzc2lvbihleHBDYWxsLnJlZikpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwQ2FsbC5hcmdzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGV4cENhbGwuYXJnc1tpXSA9IHN1YkV4cHJlc3Npb24oZXhwQ2FsbC5hcmdzW2ldKTtcbiAgICAgIH1cblxuICAgICAgLy8gSGFjayBmb3Igc25hcHNob3QucGFyZW50KCkudmFsKClcbiAgICAgIC8vIFRvZG8gLSBidWlsZCB0YWJsZS1iYXNlZCBtZXRob2Qgc2lnbmF0dXJlcy5cbiAgICAgIGlmIChhc3QuZ2V0TWV0aG9kTmFtZShleHBDYWxsKSA9PT0gJ3BhcmVudCcpIHtcbiAgICAgICAgZXhwQ2FsbCA9IDxhc3QuRXhwQ2FsbD4gYXN0LmNhc3QoZXhwQ2FsbCwgJ1NuYXBzaG90Jyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBleHBDYWxsO1xuXG4gICAgLy8gRXhwcmVzc2lvbiB0eXBlcyAobGlrZSBsaXRlcmFscykgdGhhbiBuZWVkIG5vIGV4cGFuc2lvbi5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIGV4cDtcbiAgICB9XG4gIH1cblxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gY29udmVydCBhbGwgJ3RoaXMnIHRvICdkYXRhJyAoZnJvbSAnbmV3RGF0YScpLlxuICAvLyBBcmdzIGFyZSBmdW5jdGlvbiBhcmd1bWVudHMsIGFuZCBwYXJhbXMgYXJlIHRoZSBsb2NhbCAoZnVuY3Rpb24pIHNjb3BlIHZhcmlhYmxlcy5cbiAgcHJpb3IoYXJnczogYXN0LkV4cFtdLCBwYXJhbXM6IGFzdC5QYXJhbXMpOiBhc3QuRXhwIHtcbiAgICB2YXIgbGFzdFRoaXNJcyA9IHRoaXMudGhpc0lzO1xuICAgIHRoaXMudGhpc0lzID0gJ2RhdGEnO1xuICAgIHZhciBleHAgPSB0aGlzLnBhcnRpYWxFdmFsKGFyZ3NbMF0sIHBhcmFtcyk7XG4gICAgdGhpcy50aGlzSXMgPSBsYXN0VGhpc0lzO1xuICAgIHJldHVybiBleHA7XG4gIH1cblxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gY3VycmVudCB2YWx1ZSBvZiAndGhpcydcbiAgZ2V0VGhpcyhhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcyk6IGFzdC5FeHAge1xuICAgIHJldHVybiBhc3Quc25hcHNob3RWYXJpYWJsZSh0aGlzLnRoaXNJcyk7XG4gIH1cblxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gZW5zdXJlIHR5cGUgb2YgYXJndW1lbnRcbiAgZW5zdXJlVHlwZSh0eXBlOiBzdHJpbmcsIGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJlbnN1cmVUeXBlIGFyZ3VtZW50cy5cIik7XG4gICAgfVxuICAgIHZhciBleHAgPSA8YXN0LkV4cFZhbHVlPiB0aGlzLnBhcnRpYWxFdmFsKGFyZ3NbMF0sIHBhcmFtcyk7XG4gICAgaWYgKGV4cC50eXBlICE9PSB0eXBlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmNvZXJjaW9uICsgYXN0LmRlY29kZUV4cHJlc3Npb24oZXhwKSArIFwiID0+IFwiICsgdHlwZSk7XG4gICAgfVxuICAgIHJldHVybiBleHA7XG4gIH1cblxuICAvLyBCdWlsdGluIGZ1bmN0aW9uIC0gcmV0dXJuIHRoZSBwYXJlbnQga2V5IG9mICd0aGlzJy5cbiAgZ2V0S2V5KGtleTogc3RyaW5nLCBhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcykge1xuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5taXNtYXRjaFBhcmFtcyArIFwiKGZvdW5kIFwiICsgYXJncy5sZW5ndGggKyBcIiBidXQgZXhwZWN0ZWQgMSlcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIGtleVswXSA9PT0gJyQnID8gYXN0LmxpdGVyYWwoa2V5KSA6IGFzdC5zdHJpbmcoa2V5KTtcbiAgfVxuXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSByZXR1cm4gdGhlIHJlZmVyZW5jZSB0byB0aGUgcm9vdFxuICAvLyBXaGVuIGluIHJlYWQgbW9kZSAtIHVzZSAncm9vdCdcbiAgLy8gV2hlbiBpbiB3cml0ZS92YWxpZGF0ZSAtIHVzZSBwYXRoIHRvIHJvb3QgdmlhIG5ld0RhdGEucGFyZW50KCkuLi5cbiAgZ2V0Um9vdFJlZmVyZW5jZShwYXRoOiBhc3QuUGF0aFRlbXBsYXRlLCBhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcykge1xuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiQHJvb3QgYXJndW1lbnRzLlwiKTtcbiAgICB9XG5cbiAgICAvLyAnZGF0YScgY2FzZVxuICAgIGlmICh0aGlzLnRoaXNJcyA9PT0gJ2RhdGEnKSB7XG4gICAgICByZXR1cm4gYXN0LnNuYXBzaG90VmFyaWFibGUoJ3Jvb3QnKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPKGtvc3MpOiBSZW1vdmUgdGhpcyBzcGVjaWFsIGNhc2UgaWYgSlNPTiBzdXBwb3J0cyBuZXdSb290IGluc3RlYWQuXG4gICAgLy8gJ25ld0RhdGEnIGNhc2UgLSB0cmF2ZXJzZSB0byByb290IHZpYSBwYXJlbnQoKSdzLlxuICAgIGxldCByZXN1bHQ6IGFzdC5FeHAgPSBhc3Quc25hcHNob3RWYXJpYWJsZSgnbmV3RGF0YScpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0aC5sZW5ndGgoKTsgaSsrKSB7XG4gICAgICByZXN1bHQgPSBhc3Quc25hcHNob3RQYXJlbnQocmVzdWx0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIC8vIExvb2t1cCBnbG9iYWxseSBkZWZpbmVkIGZ1bmN0aW9uLlxuICBsb29rdXBGdW5jdGlvbihyZWY6IGFzdC5FeHBWYXJpYWJsZSB8IGFzdC5FeHBSZWZlcmVuY2UpOiB7XG4gICAgc2VsZj86IGFzdC5FeHAsXG4gICAgZm46IGFzdC5NZXRob2QsXG4gICAgbWV0aG9kTmFtZTogc3RyaW5nXG4gIH0gfCB1bmRlZmluZWQge1xuICAgIC8vIEZ1bmN0aW9uIGNhbGwuXG4gICAgaWYgKHJlZi50eXBlID09PSAndmFyJykge1xuICAgICAgbGV0IHJlZlZhciA9IDxhc3QuRXhwVmFyaWFibGU+IHJlZjtcbiAgICAgIHZhciBmbiA9IHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbcmVmVmFyLm5hbWVdO1xuICAgICAgaWYgKCFmbikge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHsgc2VsZjogdW5kZWZpbmVkLCBmbjogZm4sIG1ldGhvZE5hbWU6IHJlZlZhci5uYW1lfTtcbiAgICB9XG5cbiAgICAvLyBNZXRob2QgY2FsbC5cbiAgICBpZiAocmVmLnR5cGUgPT09ICdyZWYnKSB7XG4gICAgICBsZXQgcmVmUmVmID0gPGFzdC5FeHBSZWZlcmVuY2U+IHJlZjtcbiAgICAgIC8vIFRPRE86IFJlcXVpcmUgc3RhdGljIHR5cGUgdmFsaWRhdGlvbiBiZWZvcmUgY2FsbGluZyBTdHJpbmcgbWV0aG9kcy5cbiAgICAgIGlmICgoPGFzdC5FeHBPcD4gcmVmUmVmLmJhc2UpLm9wICE9PSAndmFsdWUnICYmXG4gICAgICAgICAgPHN0cmluZz4gKDxhc3QuRXhwVmFsdWU+IHJlZlJlZi5hY2Nlc3NvcikudmFsdWUgaW4gdGhpcy5zeW1ib2xzLnNjaGVtYVsnU3RyaW5nJ10ubWV0aG9kcykge1xuICAgICAgICBsZXQgbWV0aG9kTmFtZSA9IDxzdHJpbmc+ICg8YXN0LkV4cFZhbHVlPiByZWZSZWYuYWNjZXNzb3IpLnZhbHVlO1xuICAgICAgICByZXR1cm4geyBzZWxmOiByZWZSZWYuYmFzZSxcbiAgICAgICAgICAgICAgICAgZm46IHRoaXMuc3ltYm9scy5zY2hlbWFbJ1N0cmluZyddLm1ldGhvZHNbbWV0aG9kTmFtZV0sXG4gICAgICAgICAgICAgICAgIG1ldGhvZE5hbWU6ICdTdHJpbmcuJyArIG1ldGhvZE5hbWVcbiAgICAgICAgICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBmYXRhbChzOiBzdHJpbmcpIHtcbiAgICBlcnJvcihzKTtcbiAgICB0aGlzLmVycm9yQ291bnQgKz0gMTtcbiAgfVxufTtcblxuLy8gTWVyZ2UgYWxsIC5YIHRlcm1zIGludG8gdGFyZ2V0LlxuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZFZhbGlkYXRvcih0YXJnZXQ6IFZhbGlkYXRvciwgc3JjOiBWYWxpZGF0b3IpOiBWYWxpZGF0b3Ige1xuICBpZiAoc3JjID09PSB1bmRlZmluZWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJJbGxlZ2FsIHZhbGlkYXRpb24gc291cmNlLlwiKTtcbiAgfVxuICBmb3IgKHZhciBwcm9wIGluIHNyYykge1xuICAgIGlmICghc3JjLmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHByb3BbMF0gPT09ICcuJykge1xuICAgICAgaWYgKHRhcmdldFtwcm9wXSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHRhcmdldFtwcm9wXSA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKHV0aWwuaXNUeXBlKHNyY1twcm9wXSwgJ2FycmF5JykpIHtcbiAgICAgICAgdXRpbC5leHRlbmRBcnJheSg8YW55W10+IHRhcmdldFtwcm9wXSwgPGFueVtdPiBzcmNbcHJvcF0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgKDxhc3QuRXhwW10+IHRhcmdldFtwcm9wXSkucHVzaCg8YXN0LkV4cD4gc3JjW3Byb3BdKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCF0YXJnZXRbcHJvcF0pIHtcbiAgICAgICAgdGFyZ2V0W3Byb3BdID0ge307XG4gICAgICB9XG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdGFyZ2V0W3Byb3BdLCA8VmFsaWRhdG9yPiBzcmNbcHJvcF0pO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0YXJnZXQ7XG59XG5cbi8vIENhbGwgZm4odmFsdWUsIHByb3AsIHBhdGgpIG9uIGFsbCAnLnByb3BzJyBhbmQgYXNzaWdpbmcgdGhlIHZhbHVlIGJhY2sgaW50byB0aGVcbi8vIHZhbGlkYXRvci5cbmV4cG9ydCBmdW5jdGlvbiBtYXBWYWxpZGF0b3IodjogVmFsaWRhdG9yLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbjogKHZhbDogVmFsaWRhdG9yVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcDogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlOiBhc3QuUGFyYW1zLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpID0+IFZhbGlkYXRvclZhbHVlIHwgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZT86IGFzdC5QYXJhbXMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg/OiBhc3QuUGF0aFRlbXBsYXRlKSB7XG4gIGlmICghc2NvcGUpIHtcbiAgICBzY29wZSA9IDxhc3QuUGFyYW1zPiB7fTtcbiAgfVxuICBpZiAoIXBhdGgpIHtcbiAgICBwYXRoID0gbmV3IGFzdC5QYXRoVGVtcGxhdGUoKTtcbiAgfVxuICBpZiAoJy5zY29wZScgaW4gdikge1xuICAgIHNjb3BlID0gPGFzdC5QYXJhbXM+IHZbJy5zY29wZSddO1xuICB9XG4gIGZvciAodmFyIHByb3AgaW4gdikge1xuICAgIGlmICghdi5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChwcm9wWzBdID09PSAnLicpIHtcbiAgICAgIGxldCB2YWx1ZSA9IGZuKHZbcHJvcF0sIHByb3AsIHNjb3BlLCBwYXRoKTtcbiAgICAgIGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHZbcHJvcF0gPSB2YWx1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlbGV0ZSB2W3Byb3BdO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIXV0aWwuaXNUeXBlKHZbcHJvcF0sICdvYmplY3QnKSkge1xuICAgICAgY29udGludWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBjaGlsZCA9IG5ldyBhc3QuUGF0aFRlbXBsYXRlKFtwcm9wXSk7XG4gICAgICBwYXRoLnB1c2goY2hpbGQpO1xuICAgICAgbWFwVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZbcHJvcF0sIGZuLCBzY29wZSwgcGF0aCk7XG4gICAgICBwYXRoLnBvcChjaGlsZCk7XG4gICAgfVxuICB9XG59XG5cbi8vIENvbGxhcHNlIGFsbCBoYXNDaGlsZHJlbiBjYWxscyBpbnRvIG9uZSAoY29tYmluaW5nIHRoZWlyIGFyZ3VtZW50cykuXG4vLyBFLmcuIFtuZXdEYXRhLmhhc0NoaWxkcmVuKCksIG5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4J10pLCBuZXdEYXRhLmhhc0NoaWxkcmVuKFsneSddKV0gPT5cbi8vICAgICAgbmV3RGF0YS5oYXNDaGlsZHJlbihbJ3gnLCAneSddKVxuZnVuY3Rpb24gY29sbGFwc2VIYXNDaGlsZHJlbihleHBzOiBhc3QuRXhwW10pOiBhc3QuRXhwW10ge1xuICB2YXIgaGFzSGFzQ2hpbGRyZW46IGJvb2xlYW4gPSBmYWxzZTtcbiAgdmFyIGNvbWJpbmVkID0gPHN0cmluZ1tdPiBbXTtcbiAgdmFyIHJlc3VsdCA9IDxhc3QuRXhwW10+IFtdO1xuICBleHBzLmZvckVhY2goZnVuY3Rpb24oZXhwKSB7XG4gICAgaWYgKGV4cC50eXBlICE9PSAnY2FsbCcpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGV4cENhbGwgPSA8YXN0LkV4cENhbGw+IGV4cDtcbiAgICBpZiAoYXN0LmdldE1ldGhvZE5hbWUoZXhwQ2FsbCkgIT09ICdoYXNDaGlsZHJlbicpIHtcbiAgICAgIHJlc3VsdC5wdXNoKGV4cCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGV4cENhbGwuYXJncy5sZW5ndGggPT09IDApIHtcbiAgICAgIGhhc0hhc0NoaWxkcmVuID0gdHJ1ZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBFeHBlY3Qgb25lIGFyZ3VtZW50IG9mIEFycmF5IHR5cGUuXG4gICAgaWYgKGV4cENhbGwuYXJncy5sZW5ndGggIT09IDEgfHwgZXhwQ2FsbC5hcmdzWzBdLnR5cGUgIT09ICdBcnJheScpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcIkludmFsaWQgYXJndW1lbnQgdG8gaGFzQ2hpbGRyZW4oKTogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIGV4cENhbGwuYXJnc1swXS50eXBlKTtcbiAgICB9XG4gICAgbGV0IGFyZ3MgPSAoPGFzdC5FeHBWYWx1ZT4gZXhwQ2FsbC5hcmdzWzBdKS52YWx1ZTtcblxuICAgIGFyZ3MuZm9yRWFjaChmdW5jdGlvbihhcmc6IGFzdC5FeHBWYWx1ZSkge1xuICAgICAgaGFzSGFzQ2hpbGRyZW4gPSB0cnVlO1xuICAgICAgaWYgKGFyZy50eXBlICE9PSAnU3RyaW5nJykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJFeHBlY3Qgc3RyaW5nIGFyZ3VtZW50IHRvIGhhc0NoaWxkcmVuKCksIG5vdDogXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJnLnR5cGUpO1xuICAgICAgfVxuICAgICAgY29tYmluZWQucHVzaChhcmcudmFsdWUpO1xuICAgIH0pO1xuICB9KTtcblxuICBpZiAoaGFzSGFzQ2hpbGRyZW4pIHtcbiAgICByZXN1bHQudW5zaGlmdChoYXNDaGlsZHJlbkV4cChjb21iaW5lZCkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIEdlbmVyYXRlIHRoaXMuaGFzQ2hpbGRyZW4oW3Byb3BzLCAuLi5dKSBvciB0aGlzLmhhc0NoaWxkcmVuKClcbmZ1bmN0aW9uIGhhc0NoaWxkcmVuRXhwKHByb3BzOiBzdHJpbmdbXSk6IGFzdC5FeHAge1xuICB2YXIgYXJncyA9IHByb3BzLmxlbmd0aCA9PT0gMCA/IFtdIDogW2FzdC5hcnJheShwcm9wcy5tYXAoYXN0LnN0cmluZykpXTtcbiAgcmV0dXJuIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LmNhc3QoYXN0LnZhcmlhYmxlKCd0aGlzJyksICdBbnknKSwgYXN0LnN0cmluZygnaGFzQ2hpbGRyZW4nKSksXG4gICAgICAgICAgICAgICAgICBhcmdzKTtcbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uKCkge1xuICAvKlxuICAgKiBHZW5lcmF0ZWQgYnkgUEVHLmpzIDAuOC4wLlxuICAgKlxuICAgKiBodHRwOi8vcGVnanMubWFqZGEuY3ovXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHBlZyRzdWJjbGFzcyhjaGlsZCwgcGFyZW50KSB7XG4gICAgZnVuY3Rpb24gY3RvcigpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGNoaWxkOyB9XG4gICAgY3Rvci5wcm90b3R5cGUgPSBwYXJlbnQucHJvdG90eXBlO1xuICAgIGNoaWxkLnByb3RvdHlwZSA9IG5ldyBjdG9yKCk7XG4gIH1cblxuICBmdW5jdGlvbiBTeW50YXhFcnJvcihtZXNzYWdlLCBleHBlY3RlZCwgZm91bmQsIG9mZnNldCwgbGluZSwgY29sdW1uKSB7XG4gICAgdGhpcy5tZXNzYWdlICA9IG1lc3NhZ2U7XG4gICAgdGhpcy5leHBlY3RlZCA9IGV4cGVjdGVkO1xuICAgIHRoaXMuZm91bmQgICAgPSBmb3VuZDtcbiAgICB0aGlzLm9mZnNldCAgID0gb2Zmc2V0O1xuICAgIHRoaXMubGluZSAgICAgPSBsaW5lO1xuICAgIHRoaXMuY29sdW1uICAgPSBjb2x1bW47XG5cbiAgICB0aGlzLm5hbWUgICAgID0gXCJTeW50YXhFcnJvclwiO1xuICB9XG5cbiAgcGVnJHN1YmNsYXNzKFN5bnRheEVycm9yLCBFcnJvcik7XG5cbiAgZnVuY3Rpb24gcGFyc2UoaW5wdXQpIHtcbiAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPiAxID8gYXJndW1lbnRzWzFdIDoge30sXG5cbiAgICAgICAgcGVnJEZBSUxFRCA9IHt9LFxuXG4gICAgICAgIHBlZyRzdGFydFJ1bGVGdW5jdGlvbnMgPSB7IHN0YXJ0OiBwZWckcGFyc2VzdGFydCB9LFxuICAgICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb24gID0gcGVnJHBhcnNlc3RhcnQsXG5cbiAgICAgICAgcGVnJGMwID0gcGVnJEZBSUxFRCxcbiAgICAgICAgcGVnJGMxID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgaWYgKGxvZ2dlci5oYXNFcnJvcnMoKSkge1xuICAgICAgICAgICAgdGhyb3cobmV3IEVycm9yKGxvZ2dlci5lcnJvclN1bW1hcnkoKSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gc3ltYm9scztcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGMyID0gW10sXG4gICAgICAgIHBlZyRjMyA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJmdW5jdGlvbiBkZWZpbml0aW9uXCIgfSxcbiAgICAgICAgcGVnJGM0ID0gbnVsbCxcbiAgICAgICAgcGVnJGM1ID0gZnVuY3Rpb24oZnVuYywgYm9keSkge1xuICAgICAgICAgIGlmIChmdW5jLm5hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGVycm9yKFwiTWlzc2luZyBmdW5jdGlvbiBuYW1lLlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGZ1bmMucGFyYW1zID09PSBudWxsKSB7XG4gICAgICAgICAgICBlcnJvcihcIkZ1bmN0aW9uIFwiICsgZnVuYy5uYW1lICsgXCIgbWlzc2luZyBwYXJhbWV0ZXJzLlwiKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGJvZHkgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGVycm9yKFwiRnVuY3Rpb24gXCIgKyBmdW5jLm5hbWUgKyBcIiBtaXNzaW5nIG9yIGludmFsaWQgZnVuY3Rpb24gYm9keS5cIik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHN5bWJvbHMucmVnaXN0ZXJGdW5jdGlvbihlbnN1cmVMb3dlckNhc2UoZnVuYy5uYW1lLCBcIkZ1bmN0aW9uIG5hbWVzXCIpLCBmdW5jLnBhcmFtcywgYm9keSk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNiA9IFwiZnVuY3Rpb25cIixcbiAgICAgICAgcGVnJGM3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiZnVuY3Rpb25cIiwgZGVzY3JpcHRpb246IFwiXFxcImZ1bmN0aW9uXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjOCA9IGZ1bmN0aW9uKG5hbWUsIHBhcmFtcykgeyByZXR1cm4ge25hbWU6IG5hbWUsIHBhcmFtczogcGFyYW1zfTsgfSxcbiAgICAgICAgcGVnJGM5ID0gZnVuY3Rpb24obmFtZSwgcGFyYW1zKSB7cmV0dXJuIHtuYW1lOiBuYW1lLCBwYXJhbXM6IHBhcmFtc307IH0sXG4gICAgICAgIHBlZyRjMTAgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwicGF0aCBzdGF0ZW1lbnRcIiB9LFxuICAgICAgICBwZWckYzExID0gXCJpc1wiLFxuICAgICAgICBwZWckYzEyID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiaXNcIiwgZGVzY3JpcHRpb246IFwiXFxcImlzXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTMgPSBmdW5jdGlvbihpZCkgeyByZXR1cm4gaWQ7IH0sXG4gICAgICAgIHBlZyRjMTQgPSBcIntcIixcbiAgICAgICAgcGVnJGMxNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIntcIiwgZGVzY3JpcHRpb246IFwiXFxcIntcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNiA9IFwifVwiLFxuICAgICAgICBwZWckYzE3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwifVwiLCBkZXNjcmlwdGlvbjogXCJcXFwifVxcXCJcIiB9LFxuICAgICAgICBwZWckYzE4ID0gZnVuY3Rpb24oYWxsKSB7IHJldHVybiBhbGw7IH0sXG4gICAgICAgIHBlZyRjMTkgPSBcIjtcIixcbiAgICAgICAgcGVnJGMyMCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIjtcIiwgZGVzY3JpcHRpb246IFwiXFxcIjtcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4ge307IH0sXG4gICAgICAgIHBlZyRjMjIgPSBmdW5jdGlvbihwYXRoLCBpc1R5cGUsIG1ldGhvZHMpIHtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChtZXRob2RzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiTWlzc2luZyBib2R5IG9mIHBhdGggc3RhdGVtZW50LlwiKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3ltYm9scy5yZWdpc3RlclBhdGgoY3VycmVudFBhdGgsIGlzVHlwZSwgbWV0aG9kcyk7XG4gICAgICAgICAgICBjdXJyZW50UGF0aC5wb3AocGF0aCk7XG4gICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMyMyA9IFwicGF0aFwiLFxuICAgICAgICBwZWckYzI0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwicGF0aFwiLCBkZXNjcmlwdGlvbjogXCJcXFwicGF0aFxcXCJcIiB9LFxuICAgICAgICBwZWckYzI1ID0gZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICAgICAgaWYgKHBhdGggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgZXJyb3IoXCJNaXNzaW5nIFBhdGggVGVtcGxhdGUgaW4gcGF0aCBzdGF0ZW1lbnQuXCIpO1xuICAgICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGN1cnJlbnRQYXRoLnB1c2gocGF0aCk7XG4gICAgICAgICAgICByZXR1cm4gcGF0aDtcbiAgICAgICAgICB9LFxuICAgICAgICBwZWckYzI2ID0gZnVuY3Rpb24ocGF0aCkge1xuICAgICAgICAgICAgY3VycmVudFBhdGgucHVzaChwYXRoKTsgcmV0dXJuIHBhdGg7XG4gICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMyNyA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJwYXRoIHRlbXBsYXRlXCIgfSxcbiAgICAgICAgcGVnJGMyOCA9IFwiL1wiLFxuICAgICAgICBwZWckYzI5ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiL1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiL1xcXCJcIiB9LFxuICAgICAgICBwZWckYzMwID0gZnVuY3Rpb24ocGFydCkgeyByZXR1cm4gcGFydDsgfSxcbiAgICAgICAgcGVnJGMzMSA9IGZ1bmN0aW9uKHBhcnRzKSB7XG4gICAgICAgICAgdmFyIGhhc0Vycm9yID0gZmFsc2U7XG4gICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMSAmJiBwYXJ0c1swXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcGFydHMgPSBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcGFydHMgPSBwYXJ0cy5tYXAoZnVuY3Rpb24ocGFydCkge1xuICAgICAgICAgICAgaWYgKHBhcnQgPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgaGFzRXJyb3IgPSB0cnVlO1xuICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gcGFydDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoaGFzRXJyb3IpIHtcbiAgICAgICAgICAgIGVycm9yKChwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXSA9PT0gJydcbiAgICAgICAgICAgICAgICAgICA/IFwiUGF0aHMgbWF5IG5vdCBlbmQgaW4gYSBzbGFzaCAoLykgY2hhcmFjdGVyXCJcbiAgICAgICAgICAgICAgICAgICA6IFwiUGF0aHMgbWF5IG5vdCBjb250YWluIGFuIGVtcHR5IHBhcnRcIikgKyBcIjogL1wiICsgcGFydHMubWFwKGZ1bmN0aW9uKHBhcnQpIHsgcmV0dXJuIHBhcnQubGFiZWw7IH0pLmpvaW4oJy8nKSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBuZXcgYXN0LlBhdGhUZW1wbGF0ZShwYXJ0cyk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjMzIgPSBcIj1cIixcbiAgICAgICAgcGVnJGMzMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIj1cIiwgZGVzY3JpcHRpb246IFwiXFxcIj1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMzNCA9IFwiKlwiLFxuICAgICAgICBwZWckYzM1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiKlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiKlxcXCJcIiB9LFxuICAgICAgICBwZWckYzM2ID0gZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgICByZXR1cm4gbmV3IGFzdC5QYXRoUGFydChpZCwgaWQpO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzM3ID0gL15bXiBcXC87XS8sXG4gICAgICAgIHBlZyRjMzggPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW14gXFxcXC87XVwiLCBkZXNjcmlwdGlvbjogXCJbXiBcXFxcLztdXCIgfSxcbiAgICAgICAgcGVnJGMzOSA9IGZ1bmN0aW9uKGNoYXJzKSB7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IGNoYXJzLmpvaW4oJycpO1xuICAgICAgICAgIGlmIChjaGFyc1swXSA9PT0gJyQnKSB7XG4gICAgICAgICAgICB3YXJuKFwiVXNlIG9mIFwiICsgcmVzdWx0ICsgXCIgdG8gY2FwdHVyZSBhIHBhdGggc2VnbWVudCBpcyBkZXByZWNhdGVkOyBcIiArXG4gICAgICAgICAgICAgICAgIFwidXNlIHtcIiArIHJlc3VsdCArIFwifSBvciB7XCIgKyByZXN1bHQuc2xpY2UoMSkgKyBcIn0sIGluc3RlYWQuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV3IGFzdC5QYXRoUGFydChyZXN1bHQpO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzQwID0gZnVuY3Rpb24oYWxsKSB7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYWxsLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgbWV0aG9kID0gYWxsW2ldO1xuICAgICAgICAgICAgLy8gU2tpcCBlbWJlZGRlZCBwYXRoIHN0YXRlbWVudHMuXG4gICAgICAgICAgICBpZiAobWV0aG9kID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIG1ldGhvZCA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBlcnJvcihcIkludmFsaWQgcGF0aCBvciBtZXRob2Q6ICdcIiArIG1ldGhvZCArIFwiJy5cIik7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG1ldGhvZC5uYW1lIGluIHJlc3VsdCkge1xuICAgICAgICAgICAgICBlcnJvcihcIkR1cGxpY2F0ZSBtZXRob2QgbmFtZTogXCIgKyBtZXRob2QubmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXN1bHRbbWV0aG9kLm5hbWVdID0gYXN0Lm1ldGhvZChtZXRob2QucGFyYW1zLCBtZXRob2QuYm9keSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNDEgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwidHlwZSBzdGF0ZW1lbnRcIiB9LFxuICAgICAgICBwZWckYzQyID0gXCJ0eXBlXCIsXG4gICAgICAgIHBlZyRjNDMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ0eXBlXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ0eXBlXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNDQgPSBcIjxcIixcbiAgICAgICAgcGVnJGM0NSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIjxcIiwgZGVzY3JpcHRpb246IFwiXFxcIjxcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM0NiA9IFwiPlwiLFxuICAgICAgICBwZWckYzQ3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPlxcXCJcIiB9LFxuICAgICAgICBwZWckYzQ4ID0gZnVuY3Rpb24obGlzdCkgeyByZXR1cm4gZW5zdXJlVXBwZXJDYXNlKGxpc3QsIFwiVHlwZSBuYW1lc1wiKTsgfSxcbiAgICAgICAgcGVnJGM0OSA9IFwiZXh0ZW5kc1wiLFxuICAgICAgICBwZWckYzUwID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiZXh0ZW5kc1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiZXh0ZW5kc1xcXCJcIiB9LFxuICAgICAgICBwZWckYzUxID0gZnVuY3Rpb24odHlwZSkgeyByZXR1cm4gdHlwZTsgfSxcbiAgICAgICAgcGVnJGM1MiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4ge3Byb3BlcnRpZXM6IHt9LCBtZXRob2RzOiB7fX07IH0sXG4gICAgICAgIHBlZyRjNTMgPSBmdW5jdGlvbih0eXBlLCBwYXJhbXMsIGV4dCwgYm9keSkge1xuICAgICAgICAgICAgaWYgKHBhcmFtcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBwYXJhbXMgPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgIGVycm9yKFwiTWlzc2luZyB0eXBlIG5hbWUuXCIpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoYm9keSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICBlcnJvcihcIk1pc3Npbmcgb3IgaW52YWxpZCB0eXBlIHN0YXRlbWVudCBib2R5LlwiKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgc3ltYm9scy5yZWdpc3RlclNjaGVtYShlbnN1cmVVcHBlckNhc2UodHlwZSwgXCJUeXBlIG5hbWVzXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHQsIGJvZHkucHJvcGVydGllcywgYm9keS5tZXRob2RzLCBwYXJhbXMpO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzU0ID0gZnVuY3Rpb24oYWxsKSB7XG4gICAgICAgICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgICAgICAgICBwcm9wZXJ0aWVzOiB7fSxcbiAgICAgICAgICAgICBtZXRob2RzOiB7fVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICBmdW5jdGlvbiBhZGRQYXJ0KHBhcnQpIHtcbiAgICAgICAgICAgIC8vIFRPRE86IE1ha2Ugc3VyZSBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzIGRvbid0IHNoYWRvdyBlYWNoIG90aGVyLlxuICAgICAgICAgICAgaWYgKHR5cGVvZiBwYXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICBlcnJvcihcIkludmFsaWQgcHJvcGVydHkgb3IgbWV0aG9kOiAnXCIgKyBwYXJ0ICsgXCInLlwiKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCd0eXBlJyBpbiBwYXJ0KSB7XG4gICAgICAgICAgICAgIGlmIChyZXN1bHQucHJvcGVydGllc1twYXJ0Lm5hbWVdKSB7XG4gICAgICAgICAgICAgICAgZXJyb3IoXCJEdXBsaWNhdGUgcHJvcGVydHkgbmFtZTogXCIgKyBwYXJ0Lm5hbWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJlc3VsdC5wcm9wZXJ0aWVzW3BhcnQubmFtZV0gPSBwYXJ0LnR5cGU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBpZiAocmVzdWx0Lm1ldGhvZHNbcGFydC5uYW1lXSkge1xuICAgICAgICAgICAgICAgIGVycm9yKFwiRHVwbGljYXRlIG1ldGhvZCBuYW1lOiBcIiArIHBhcnQubmFtZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmVzdWx0Lm1ldGhvZHNbcGFydC5uYW1lXSA9IGFzdC5tZXRob2QocGFydC5wYXJhbXMsIHBhcnQuYm9keSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhbGwubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFkZFBhcnQoYWxsW2ldKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzU1ID0gXCI6XCIsXG4gICAgICAgIHBlZyRjNTYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI6XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI6XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNTcgPSBmdW5jdGlvbihuYW1lLCB0eXBlKSB7XG4gICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIG5hbWU6ICBuYW1lLFxuICAgICAgICAgICAgdHlwZTogdHlwZVxuICAgICAgICAgIH07XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNTggPSBcIixcIixcbiAgICAgICAgcGVnJGM1OSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIixcIiwgZGVzY3JpcHRpb246IFwiXFxcIixcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM2MCA9IGZ1bmN0aW9uKHNlcCkgeyByZXR1cm4gc2VwOyB9LFxuICAgICAgICBwZWckYzYxID0geyB0eXBlOiBcIm90aGVyXCIsIGRlc2NyaXB0aW9uOiBcIm1ldGhvZFwiIH0sXG4gICAgICAgIHBlZyRjNjIgPSBmdW5jdGlvbihuYW1lLCBwYXJhbXMsIGJvZHksIHNlcCkge1xuICAgICAgICAgIGlmIChzZXAgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdhcm4oXCJFeHRyYSBzZXBhcmF0b3IgKFwiICsgc2VwICsgXCIpIG5vdCBuZWVkZWQuXCIpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbmFtZTogIGVuc3VyZUxvd2VyQ2FzZShuYW1lLCBcIk1ldGhvZCBuYW1lc1wiKSxcbiAgICAgICAgICAgIHBhcmFtczogcGFyYW1zLFxuICAgICAgICAgICAgYm9keTogIGJvZHlcbiAgICAgICAgICB9O1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzYzID0gXCJyZXR1cm5cIixcbiAgICAgICAgcGVnJGM2NCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInJldHVyblwiLCBkZXNjcmlwdGlvbjogXCJcXFwicmV0dXJuXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjUgPSBmdW5jdGlvbihleHApIHsgcmV0dXJuIGV4cDsgfSxcbiAgICAgICAgcGVnJGM2NiA9IGZ1bmN0aW9uKGV4cCkge1xuICAgICAgICAgICAgd2FybihcIlVzZSBvZiBmbih4KSA9IGV4cDsgZm9ybWF0IGlzIGRlcHJlY2F0ZWQ7IHVzZSBmbih4KSB7IGV4cCB9LCBpbnN0ZWFkLlwiKVxuICAgICAgICAgICAgcmV0dXJuIGV4cDtcbiAgICAgICAgICB9LFxuICAgICAgICBwZWckYzY3ID0gXCIoXCIsXG4gICAgICAgIHBlZyRjNjggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIoXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIoXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNjkgPSBcIilcIixcbiAgICAgICAgcGVnJGM3MCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIilcIiwgZGVzY3JpcHRpb246IFwiXFxcIilcXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3MSA9IGZ1bmN0aW9uKGxpc3QpIHsgcmV0dXJuIGVuc3VyZUxvd2VyQ2FzZShsaXN0LCBcIkZ1bmN0aW9uIGFyZ3VtZW50c1wiKTsgfSxcbiAgICAgICAgcGVnJGM3MiA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgICBpZiAoIWhlYWQpIHtcbiAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFpbC51bnNoaWZ0KGhlYWQpO1xuICAgICAgICAgIHJldHVybiB0YWlsO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzczID0gXCJ8XCIsXG4gICAgICAgIHBlZyRjNzQgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJ8XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ8XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjNzUgPSBmdW5jdGlvbihoZWFkLCB0YWlsKSB7XG4gICAgICAgICAgaWYgKHRhaWwubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBoZWFkO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0YWlsLnVuc2hpZnQoaGVhZCk7XG4gICAgICAgICAgcmV0dXJuIGFzdC51bmlvblR5cGUodGFpbCk7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjNzYgPSBcIltdXCIsXG4gICAgICAgIHBlZyRjNzcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJbXVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiW11cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM3OCA9IGZ1bmN0aW9uKCkge3JldHVybiB7aXNNYXA6IHRydWV9OyB9LFxuICAgICAgICBwZWckYzc5ID0gZnVuY3Rpb24odHlwZXMpIHtyZXR1cm4ge3R5cGVzOiB0eXBlc307fSxcbiAgICAgICAgcGVnJGM4MCA9IGZ1bmN0aW9uKHR5cGUsIG9wdCkge1xuICAgICAgICAgIHR5cGUgPSBlbnN1cmVVcHBlckNhc2UodHlwZSwgXCJUeXBlIG5hbWVzXCIpO1xuICAgICAgICAgIGlmICghb3B0KSB7XG4gICAgICAgICAgICByZXR1cm4gYXN0LnR5cGVUeXBlKHR5cGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAob3B0LmlzTWFwKSB7XG4gICAgICAgICAgICByZXR1cm4gYXN0LmdlbmVyaWNUeXBlKCdNYXAnLCBbYXN0LnR5cGVUeXBlKCdTdHJpbmcnKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QudHlwZVR5cGUodHlwZSldKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGFzdC5nZW5lcmljVHlwZSh0eXBlLCBvcHQudHlwZXMpO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzgxID0gZnVuY3Rpb24oaGVhZCwgdGFpbCkge1xuICAgICAgICAgIHZhciByZXN1bHQgPSBbaGVhZF07XG4gICAgICAgICAgdXRpbC5leHRlbmRBcnJheShyZXN1bHQsIHRhaWwpO1xuICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjODIgPSB2b2lkIDAsXG4gICAgICAgIHBlZyRjODMgPSBmdW5jdGlvbihuYW1lKSB7IHJldHVybiBhc3QudmFyaWFibGUobmFtZSk7IH0sXG4gICAgICAgIHBlZyRjODQgPSBmdW5jdGlvbihleHByZXNzaW9uKSB7IHJldHVybiBleHByZXNzaW9uOyB9LFxuICAgICAgICBwZWckYzg1ID0gXCJbXCIsXG4gICAgICAgIHBlZyRjODYgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJbXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJbXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjODcgPSBcIl1cIixcbiAgICAgICAgcGVnJGM4OCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIl1cIiwgZGVzY3JpcHRpb246IFwiXFxcIl1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM4OSA9IGZ1bmN0aW9uKG5hbWUpIHsgcmV0dXJuIG5hbWU7IH0sXG4gICAgICAgIHBlZyRjOTAgPSBcIi5cIixcbiAgICAgICAgcGVnJGM5MSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIi5cIiwgZGVzY3JpcHRpb246IFwiXFxcIi5cXFwiXCIgfSxcbiAgICAgICAgcGVnJGM5MiA9IGZ1bmN0aW9uKGJhc2UsIGFjY2Vzc29ycykge1xuICAgICAgICAgICAgICB2YXIgcmVzdWx0ID0gYmFzZTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhY2Nlc3NvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgZXhwID0gdHlwZW9mIGFjY2Vzc29yc1tpXSA9PSAnc3RyaW5nJyA/IGFzdC5zdHJpbmcoYWNjZXNzb3JzW2ldKSA6IGFjY2Vzc29yc1tpXTtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhc3QucmVmZXJlbmNlKHJlc3VsdCwgZXhwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGM5MyA9IGZ1bmN0aW9uKHJlZiwgYXJncykge1xuICAgICAgICAgICAgICAgIHJldHVybiBhc3QuY2FsbChyZWYsIGFyZ3MpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICBwZWckYzk0ID0gZnVuY3Rpb24oYXJncykgeyByZXR1cm4gYXJncyB9LFxuICAgICAgICBwZWckYzk1ID0gZnVuY3Rpb24obmFtZSkgeyByZXR1cm4gbmFtZSB9LFxuICAgICAgICBwZWckYzk2ID0gZnVuY3Rpb24oYmFzZSwgYXJndW1lbnRzT3JBY2Nlc3NvcnMpIHtcbiAgICAgICAgICAgICAgdmFyIHJlc3VsdCA9IGJhc2U7XG4gICAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzT3JBY2Nlc3NvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgcGFydCA9IGFyZ3VtZW50c09yQWNjZXNzb3JzW2ldO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgcGFydCA9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gYXN0LnJlZmVyZW5jZShyZXN1bHQsIGFzdC5zdHJpbmcocGFydCkpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodXRpbC5pc1R5cGUocGFydCwgJ2FycmF5JykpIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGFzdC5jYWxsKHJlc3VsdCwgcGFydCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IGFzdC5yZWZlcmVuY2UocmVzdWx0LCBwYXJ0KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjOTcgPSBmdW5jdGlvbihhcmdzKSB7XG4gICAgICAgICAgcmV0dXJuIGFyZ3MgIT09IG51bGwgPyBhcmdzIDogW107XG4gICAgICAgIH0sXG4gICAgICAgIHBlZyRjOTggPSBmdW5jdGlvbihoZWFkLCB0YWlsKSB7XG4gICAgICAgICAgdGFpbC51bnNoaWZ0KGhlYWQpO1xuICAgICAgICAgIHJldHVybiB0YWlsO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzk5ID0gZnVuY3Rpb24ob3AsIGV4cHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgaWYgKG9wID09IFwibm9vcFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGV4cHJlc3Npb247XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFzdC5vcChvcCwgW2V4cHJlc3Npb25dKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjMTAwID0gXCIrXCIsXG4gICAgICAgIHBlZyRjMTAxID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiK1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiK1xcXCJcIiB9LFxuICAgICAgICBwZWckYzEwMiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJub29wXCI7IH0sXG4gICAgICAgIHBlZyRjMTAzID0gXCItXCIsXG4gICAgICAgIHBlZyRjMTA0ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiLVxcXCJcIiB9LFxuICAgICAgICBwZWckYzEwNSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJuZWdcIjsgfSxcbiAgICAgICAgcGVnJGMxMDYgPSBcIiFcIixcbiAgICAgICAgcGVnJGMxMDcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIhXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIhXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTA4ID0gZnVuY3Rpb24ob3AsIGV4cCkgeyByZXR1cm4ge29wOiBvcCwgZXhwOiBleHB9OyB9LFxuICAgICAgICBwZWckYzEwOSA9IGZ1bmN0aW9uKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGxlZnRBc3NvY2lhdGl2ZShoZWFkLCB0YWlsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjMTEwID0gXCIlXCIsXG4gICAgICAgIHBlZyRjMTExID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiJVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiJVxcXCJcIiB9LFxuICAgICAgICBwZWckYzExMiA9IFwiPD1cIixcbiAgICAgICAgcGVnJGMxMTMgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI8PVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPD1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMTQgPSBcIj49XCIsXG4gICAgICAgIHBlZyRjMTE1ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiPj1cIiwgZGVzY3JpcHRpb246IFwiXFxcIj49XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTE2ID0gXCI9PT1cIixcbiAgICAgICAgcGVnJGMxMTcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI9PT1cIiwgZGVzY3JpcHRpb246IFwiXFxcIj09PVxcXCJcIiB9LFxuICAgICAgICBwZWckYzExOCA9IFwiPT1cIixcbiAgICAgICAgcGVnJGMxMTkgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI9PVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiPT1cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMjAgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwiPT1cIjsgfSxcbiAgICAgICAgcGVnJGMxMjEgPSBmdW5jdGlvbigpIHsgZXJyb3IoXCJFcXVhbGl0eSBvcGVyYXRvciBzaG91bGQgYmUgd3JpdHRlbiBhcyA9PSwgbm90ID0uXCIpOyAgcmV0dXJuIFwiPT1cIjsgfSxcbiAgICAgICAgcGVnJGMxMjIgPSBcIiE9PVwiLFxuICAgICAgICBwZWckYzEyMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiE9PVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiIT09XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTI0ID0gXCIhPVwiLFxuICAgICAgICBwZWckYzEyNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiE9XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIhPVxcXCJcIiB9LFxuICAgICAgICBwZWckYzEyNiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCIhPVwiOyB9LFxuICAgICAgICBwZWckYzEyNyA9IFwiJiZcIixcbiAgICAgICAgcGVnJGMxMjggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCImJlwiLCBkZXNjcmlwdGlvbjogXCJcXFwiJiZcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMjkgPSBcImFuZFwiLFxuICAgICAgICBwZWckYzEzMCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcImFuZFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiYW5kXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTMxID0gZnVuY3Rpb24oKSB7IHJldHVybiBcIiYmXCI7IH0sXG4gICAgICAgIHBlZyRjMTMyID0gXCJ8fFwiLFxuICAgICAgICBwZWckYzEzMyA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInx8XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJ8fFxcXCJcIiB9LFxuICAgICAgICBwZWckYzEzNCA9IFwib3JcIixcbiAgICAgICAgcGVnJGMxMzUgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJvclwiLCBkZXNjcmlwdGlvbjogXCJcXFwib3JcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxMzYgPSBmdW5jdGlvbigpIHsgcmV0dXJuIFwifHxcIjsgfSxcbiAgICAgICAgcGVnJGMxMzcgPSBcIj9cIixcbiAgICAgICAgcGVnJGMxMzggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCI/XCIsIGRlc2NyaXB0aW9uOiBcIlxcXCI/XFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTM5ID0gZnVuY3Rpb24oY29uZGl0aW9uLCB0cnVlRXhwcmVzc2lvbiwgZmFsc2VFeHByZXNzaW9uKSB7XG4gICAgICAgICAgICAgIHJldHVybiBhc3Qub3AoJz86JywgW2NvbmRpdGlvbiwgdHJ1ZUV4cHJlc3Npb24sIGZhbHNlRXhwcmVzc2lvbl0pO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxNDAgPSBcIm51bGxcIixcbiAgICAgICAgcGVnJGMxNDEgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJudWxsXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCJudWxsXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTQyID0gZnVuY3Rpb24oKSB7IHJldHVybiBhc3QubnVsbFR5cGUoKSB9LFxuICAgICAgICBwZWckYzE0MyA9IGZ1bmN0aW9uKGVsZW1lbnRzKSB7IHJldHVybiBhc3QuYXJyYXkoZWxlbWVudHMpOyB9LFxuICAgICAgICBwZWckYzE0NCA9IFwidHJ1ZVwiLFxuICAgICAgICBwZWckYzE0NSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInRydWVcIiwgZGVzY3JpcHRpb246IFwiXFxcInRydWVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNDYgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGFzdC5ib29sZWFuKHRydWUpOyB9LFxuICAgICAgICBwZWckYzE0NyA9IFwiZmFsc2VcIixcbiAgICAgICAgcGVnJGMxNDggPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCJmYWxzZVwiLCBkZXNjcmlwdGlvbjogXCJcXFwiZmFsc2VcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMxNDkgPSBmdW5jdGlvbigpIHsgcmV0dXJuIGFzdC5ib29sZWFuKGZhbHNlKTsgfSxcbiAgICAgICAgcGVnJGMxNTAgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwibnVtYmVyXCIgfSxcbiAgICAgICAgcGVnJGMxNTEgPSAvXlsrXFwtXS8sXG4gICAgICAgIHBlZyRjMTUyID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsrXFxcXC1dXCIsIGRlc2NyaXB0aW9uOiBcIlsrXFxcXC1dXCIgfSxcbiAgICAgICAgcGVnJGMxNTMgPSBmdW5jdGlvbih1bmFyeSwgbGl0ZXJhbCkge1xuICAgICAgICAgICAgICBpZiAodW5hcnkgPT0gJy0nKSB7XG4gICAgICAgICAgICAgICAgIHJldHVybiBhc3QubnVtYmVyKC1saXRlcmFsKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gYXN0Lm51bWJlcihsaXRlcmFsKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgIHBlZyRjMTU0ID0gZnVuY3Rpb24ocGFydHMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHBhcnNlRmxvYXQocGFydHMpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxNTUgPSBmdW5jdGlvbihwYXJ0cykgeyByZXR1cm4gcGFyc2VGbG9hdChwYXJ0cyk7IH0sXG4gICAgICAgIHBlZyRjMTU2ID0gXCIwXCIsXG4gICAgICAgIHBlZyRjMTU3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiMFwiLCBkZXNjcmlwdGlvbjogXCJcXFwiMFxcXCJcIiB9LFxuICAgICAgICBwZWckYzE1OCA9IC9eWzAtOV0vLFxuICAgICAgICBwZWckYzE1OSA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbMC05XVwiLCBkZXNjcmlwdGlvbjogXCJbMC05XVwiIH0sXG4gICAgICAgIHBlZyRjMTYwID0gL15bMS05XS8sXG4gICAgICAgIHBlZyRjMTYxID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsxLTldXCIsIGRlc2NyaXB0aW9uOiBcIlsxLTldXCIgfSxcbiAgICAgICAgcGVnJGMxNjIgPSAvXltlRV0vLFxuICAgICAgICBwZWckYzE2MyA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbZUVdXCIsIGRlc2NyaXB0aW9uOiBcIltlRV1cIiB9LFxuICAgICAgICBwZWckYzE2NCA9IC9eW1xcLStdLyxcbiAgICAgICAgcGVnJGMxNjUgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW1xcXFwtK11cIiwgZGVzY3JpcHRpb246IFwiW1xcXFwtK11cIiB9LFxuICAgICAgICBwZWckYzE2NiA9IC9eW3hYXS8sXG4gICAgICAgIHBlZyRjMTY3ID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlt4WF1cIiwgZGVzY3JpcHRpb246IFwiW3hYXVwiIH0sXG4gICAgICAgIHBlZyRjMTY4ID0gZnVuY3Rpb24oZGlnaXRzKSB7IHJldHVybiBwYXJzZUludChkaWdpdHMsIDE2KTsgfSxcbiAgICAgICAgcGVnJGMxNjkgPSAvXlswLTlhLWZBLUZdLyxcbiAgICAgICAgcGVnJGMxNzAgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzAtOWEtZkEtRl1cIiwgZGVzY3JpcHRpb246IFwiWzAtOWEtZkEtRl1cIiB9LFxuICAgICAgICBwZWckYzE3MSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJyZWdleHBcIiB9LFxuICAgICAgICBwZWckYzE3MiA9IC9eW2Etel0vLFxuICAgICAgICBwZWckYzE3MyA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbYS16XVwiLCBkZXNjcmlwdGlvbjogXCJbYS16XVwiIH0sXG4gICAgICAgIHBlZyRjMTc0ID0gZnVuY3Rpb24ocGF0dGVybiwgbW9kaWZpZXJzKSB7XG4gICAgICAgICAgaWYgKG1vZGlmaWVycykge1xuICAgICAgICAgICAgcmV0dXJuIGFzdC5yZWdleHAocGF0dGVybiwgbW9kaWZpZXJzLmpvaW4oXCJcIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYXN0LnJlZ2V4cChwYXR0ZXJuKTtcbiAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxNzUgPSAvXlteXFxcXFxcL10vLFxuICAgICAgICBwZWckYzE3NiA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbXlxcXFxcXFxcXFxcXC9dXCIsIGRlc2NyaXB0aW9uOiBcIlteXFxcXFxcXFxcXFxcL11cIiB9LFxuICAgICAgICBwZWckYzE3NyA9IGZ1bmN0aW9uKGNoYXJzKSB7IHJldHVybiBjaGFycy5qb2luKFwiXCIpOyB9LFxuICAgICAgICBwZWckYzE3OCA9IFwiXFxcXFwiLFxuICAgICAgICBwZWckYzE3OSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIlxcXFxcIiwgZGVzY3JpcHRpb246IFwiXFxcIlxcXFxcXFxcXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTgwID0geyB0eXBlOiBcImFueVwiLCBkZXNjcmlwdGlvbjogXCJhbnkgY2hhcmFjdGVyXCIgfSxcbiAgICAgICAgcGVnJGMxODEgPSBmdW5jdGlvbihjaGFyXykgeyByZXR1cm4gXCJcXFxcXCIgKyBjaGFyXzsgfSxcbiAgICAgICAgcGVnJGMxODIgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwic3RyaW5nXCIgfSxcbiAgICAgICAgcGVnJGMxODMgPSBmdW5jdGlvbihzKSB7IHJldHVybiBhc3Quc3RyaW5nKHMpOyB9LFxuICAgICAgICBwZWckYzE4NCA9IFwiXFxcIlwiLFxuICAgICAgICBwZWckYzE4NSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIlxcXCJcIiwgZGVzY3JpcHRpb246IFwiXFxcIlxcXFxcXFwiXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMTg2ID0gXCInXCIsXG4gICAgICAgIHBlZyRjMTg3ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiJ1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiJ1xcXCJcIiB9LFxuICAgICAgICBwZWckYzE4OCA9IGZ1bmN0aW9uKHBhcnRzKSB7XG4gICAgICAgICAgICByZXR1cm4gcGFydHNbMV07XG4gICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxODkgPSBmdW5jdGlvbihjaGFyXykgeyByZXR1cm4gY2hhcl87ICAgICB9LFxuICAgICAgICBwZWckYzE5MCA9IGZ1bmN0aW9uKHNlcXVlbmNlKSB7IHJldHVybiBzZXF1ZW5jZTsgIH0sXG4gICAgICAgIHBlZyRjMTkxID0gZnVuY3Rpb24oc2VxdWVuY2UpIHsgcmV0dXJuIHNlcXVlbmNlOyB9LFxuICAgICAgICBwZWckYzE5MiA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gXCJcXDBcIjsgfSxcbiAgICAgICAgcGVnJGMxOTMgPSAvXlsnXCJcXFxcYmZucnRdLyxcbiAgICAgICAgcGVnJGMxOTQgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWydcXFwiXFxcXFxcXFxiZm5ydF1cIiwgZGVzY3JpcHRpb246IFwiWydcXFwiXFxcXFxcXFxiZm5ydF1cIiB9LFxuICAgICAgICBwZWckYzE5NSA9IGZ1bmN0aW9uKGNoYXJfKSB7XG4gICAgICAgICAgICAgIHJldHVybiBjaGFyX1xuICAgICAgICAgICAgICAgIC5yZXBsYWNlKFwiYlwiLCBcIlxcYlwiKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKFwiZlwiLCBcIlxcZlwiKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKFwiblwiLCBcIlxcblwiKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKFwiclwiLCBcIlxcclwiKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKFwidFwiLCBcIlxcdFwiKVxuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMxOTYgPSBmdW5jdGlvbihjaGFyXykgeyByZXR1cm4gY2hhcl87IH0sXG4gICAgICAgIHBlZyRjMTk3ID0gXCJ4XCIsXG4gICAgICAgIHBlZyRjMTk4ID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwieFwiLCBkZXNjcmlwdGlvbjogXCJcXFwieFxcXCJcIiB9LFxuICAgICAgICBwZWckYzE5OSA9IFwidVwiLFxuICAgICAgICBwZWckYzIwMCA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcInVcIiwgZGVzY3JpcHRpb246IFwiXFxcInVcXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMDEgPSBmdW5jdGlvbihkaWdpdHMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUocGFyc2VJbnQoZGlnaXRzLCAxNikpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgcGVnJGMyMDIgPSB7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IFwiaWRlbnRpZmllclwiIH0sXG4gICAgICAgIHBlZyRjMjAzID0gL15bYS16QS1aXyRdLyxcbiAgICAgICAgcGVnJGMyMDQgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW2EtekEtWl8kXVwiLCBkZXNjcmlwdGlvbjogXCJbYS16QS1aXyRdXCIgfSxcbiAgICAgICAgcGVnJGMyMDUgPSAvXlthLXpBLVpfJDAtOV0vLFxuICAgICAgICBwZWckYzIwNiA9IHsgdHlwZTogXCJjbGFzc1wiLCB2YWx1ZTogXCJbYS16QS1aXyQwLTldXCIsIGRlc2NyaXB0aW9uOiBcIlthLXpBLVpfJDAtOV1cIiB9LFxuICAgICAgICBwZWckYzIwNyA9IGZ1bmN0aW9uKHN0YXJ0LCByZXN0KSB7XG4gICAgICAgICAgcmV0dXJuIHN0YXJ0ICsgcmVzdC5qb2luKFwiXCIpO1xuICAgICAgICB9LFxuICAgICAgICBwZWckYzIwOCA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJ3aGl0ZXNwYWNlXCIgfSxcbiAgICAgICAgcGVnJGMyMDkgPSAvXlsgXFx0XFxyXFxuXS8sXG4gICAgICAgIHBlZyRjMjEwID0geyB0eXBlOiBcImNsYXNzXCIsIHZhbHVlOiBcIlsgXFxcXHRcXFxcclxcXFxuXVwiLCBkZXNjcmlwdGlvbjogXCJbIFxcXFx0XFxcXHJcXFxcbl1cIiB9LFxuICAgICAgICBwZWckYzIxMSA9IHsgdHlwZTogXCJvdGhlclwiLCBkZXNjcmlwdGlvbjogXCJjb21tZW50XCIgfSxcbiAgICAgICAgcGVnJGMyMTIgPSBcIi8qXCIsXG4gICAgICAgIHBlZyRjMjEzID0geyB0eXBlOiBcImxpdGVyYWxcIiwgdmFsdWU6IFwiLypcIiwgZGVzY3JpcHRpb246IFwiXFxcIi8qXFxcIlwiIH0sXG4gICAgICAgIHBlZyRjMjE0ID0gXCIqL1wiLFxuICAgICAgICBwZWckYzIxNSA9IHsgdHlwZTogXCJsaXRlcmFsXCIsIHZhbHVlOiBcIiovXCIsIGRlc2NyaXB0aW9uOiBcIlxcXCIqL1xcXCJcIiB9LFxuICAgICAgICBwZWckYzIxNiA9IFwiLy9cIixcbiAgICAgICAgcGVnJGMyMTcgPSB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZTogXCIvL1wiLCBkZXNjcmlwdGlvbjogXCJcXFwiLy9cXFwiXCIgfSxcbiAgICAgICAgcGVnJGMyMTggPSAvXls7LH1dLyxcbiAgICAgICAgcGVnJGMyMTkgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiWzssfV1cIiwgZGVzY3JpcHRpb246IFwiWzssfV1cIiB9LFxuICAgICAgICBwZWckYzIyMCA9IGZ1bmN0aW9uKGNoYXJzKSB7IHJldHVybiBjaGFycy5qb2luKCcnKTsgfSxcbiAgICAgICAgcGVnJGMyMjEgPSAvXltcXG5cXHJdLyxcbiAgICAgICAgcGVnJGMyMjIgPSB7IHR5cGU6IFwiY2xhc3NcIiwgdmFsdWU6IFwiW1xcXFxuXFxcXHJdXCIsIGRlc2NyaXB0aW9uOiBcIltcXFxcblxcXFxyXVwiIH0sXG5cbiAgICAgICAgcGVnJGN1cnJQb3MgICAgICAgICAgPSAwLFxuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgICAgICA9IDAsXG4gICAgICAgIHBlZyRjYWNoZWRQb3MgICAgICAgID0gMCxcbiAgICAgICAgcGVnJGNhY2hlZFBvc0RldGFpbHMgPSB7IGxpbmU6IDEsIGNvbHVtbjogMSwgc2VlbkNSOiBmYWxzZSB9LFxuICAgICAgICBwZWckbWF4RmFpbFBvcyAgICAgICA9IDAsXG4gICAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQgID0gW10sXG4gICAgICAgIHBlZyRzaWxlbnRGYWlscyAgICAgID0gMCxcblxuICAgICAgICBwZWckcmVzdWx0O1xuXG4gICAgaWYgKFwic3RhcnRSdWxlXCIgaW4gb3B0aW9ucykge1xuICAgICAgaWYgKCEob3B0aW9ucy5zdGFydFJ1bGUgaW4gcGVnJHN0YXJ0UnVsZUZ1bmN0aW9ucykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3Qgc3RhcnQgcGFyc2luZyBmcm9tIHJ1bGUgXFxcIlwiICsgb3B0aW9ucy5zdGFydFJ1bGUgKyBcIlxcXCIuXCIpO1xuICAgICAgfVxuXG4gICAgICBwZWckc3RhcnRSdWxlRnVuY3Rpb24gPSBwZWckc3RhcnRSdWxlRnVuY3Rpb25zW29wdGlvbnMuc3RhcnRSdWxlXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiB0ZXh0KCkge1xuICAgICAgcmV0dXJuIGlucHV0LnN1YnN0cmluZyhwZWckcmVwb3J0ZWRQb3MsIHBlZyRjdXJyUG9zKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBvZmZzZXQoKSB7XG4gICAgICByZXR1cm4gcGVnJHJlcG9ydGVkUG9zO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpbmUoKSB7XG4gICAgICByZXR1cm4gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBlZyRyZXBvcnRlZFBvcykubGluZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb2x1bW4oKSB7XG4gICAgICByZXR1cm4gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBlZyRyZXBvcnRlZFBvcykuY29sdW1uO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGV4cGVjdGVkKGRlc2NyaXB0aW9uKSB7XG4gICAgICB0aHJvdyBwZWckYnVpbGRFeGNlcHRpb24oXG4gICAgICAgIG51bGwsXG4gICAgICAgIFt7IHR5cGU6IFwib3RoZXJcIiwgZGVzY3JpcHRpb246IGRlc2NyaXB0aW9uIH1dLFxuICAgICAgICBwZWckcmVwb3J0ZWRQb3NcbiAgICAgICk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZXJyb3IobWVzc2FnZSkge1xuICAgICAgdGhyb3cgcGVnJGJ1aWxkRXhjZXB0aW9uKG1lc3NhZ2UsIG51bGwsIHBlZyRyZXBvcnRlZFBvcyk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJGNvbXB1dGVQb3NEZXRhaWxzKHBvcykge1xuICAgICAgZnVuY3Rpb24gYWR2YW5jZShkZXRhaWxzLCBzdGFydFBvcywgZW5kUG9zKSB7XG4gICAgICAgIHZhciBwLCBjaDtcblxuICAgICAgICBmb3IgKHAgPSBzdGFydFBvczsgcCA8IGVuZFBvczsgcCsrKSB7XG4gICAgICAgICAgY2ggPSBpbnB1dC5jaGFyQXQocCk7XG4gICAgICAgICAgaWYgKGNoID09PSBcIlxcblwiKSB7XG4gICAgICAgICAgICBpZiAoIWRldGFpbHMuc2VlbkNSKSB7IGRldGFpbHMubGluZSsrOyB9XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbiA9IDE7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IGZhbHNlO1xuICAgICAgICAgIH0gZWxzZSBpZiAoY2ggPT09IFwiXFxyXCIgfHwgY2ggPT09IFwiXFx1MjAyOFwiIHx8IGNoID09PSBcIlxcdTIwMjlcIikge1xuICAgICAgICAgICAgZGV0YWlscy5saW5lKys7XG4gICAgICAgICAgICBkZXRhaWxzLmNvbHVtbiA9IDE7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRldGFpbHMuY29sdW1uKys7XG4gICAgICAgICAgICBkZXRhaWxzLnNlZW5DUiA9IGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGVnJGNhY2hlZFBvcyAhPT0gcG9zKSB7XG4gICAgICAgIGlmIChwZWckY2FjaGVkUG9zID4gcG9zKSB7XG4gICAgICAgICAgcGVnJGNhY2hlZFBvcyA9IDA7XG4gICAgICAgICAgcGVnJGNhY2hlZFBvc0RldGFpbHMgPSB7IGxpbmU6IDEsIGNvbHVtbjogMSwgc2VlbkNSOiBmYWxzZSB9O1xuICAgICAgICB9XG4gICAgICAgIGFkdmFuY2UocGVnJGNhY2hlZFBvc0RldGFpbHMsIHBlZyRjYWNoZWRQb3MsIHBvcyk7XG4gICAgICAgIHBlZyRjYWNoZWRQb3MgPSBwb3M7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwZWckY2FjaGVkUG9zRGV0YWlscztcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckZmFpbChleHBlY3RlZCkge1xuICAgICAgaWYgKHBlZyRjdXJyUG9zIDwgcGVnJG1heEZhaWxQb3MpIHsgcmV0dXJuOyB9XG5cbiAgICAgIGlmIChwZWckY3VyclBvcyA+IHBlZyRtYXhGYWlsUG9zKSB7XG4gICAgICAgIHBlZyRtYXhGYWlsUG9zID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHBlZyRtYXhGYWlsRXhwZWN0ZWQgPSBbXTtcbiAgICAgIH1cblxuICAgICAgcGVnJG1heEZhaWxFeHBlY3RlZC5wdXNoKGV4cGVjdGVkKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckYnVpbGRFeGNlcHRpb24obWVzc2FnZSwgZXhwZWN0ZWQsIHBvcykge1xuICAgICAgZnVuY3Rpb24gY2xlYW51cEV4cGVjdGVkKGV4cGVjdGVkKSB7XG4gICAgICAgIHZhciBpID0gMTtcblxuICAgICAgICBleHBlY3RlZC5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICBpZiAoYS5kZXNjcmlwdGlvbiA8IGIuZGVzY3JpcHRpb24pIHtcbiAgICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGEuZGVzY3JpcHRpb24gPiBiLmRlc2NyaXB0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB3aGlsZSAoaSA8IGV4cGVjdGVkLmxlbmd0aCkge1xuICAgICAgICAgIGlmIChleHBlY3RlZFtpIC0gMV0gPT09IGV4cGVjdGVkW2ldKSB7XG4gICAgICAgICAgICBleHBlY3RlZC5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gYnVpbGRNZXNzYWdlKGV4cGVjdGVkLCBmb3VuZCkge1xuICAgICAgICBmdW5jdGlvbiBzdHJpbmdFc2NhcGUocykge1xuICAgICAgICAgIGZ1bmN0aW9uIGhleChjaCkgeyByZXR1cm4gY2guY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTsgfVxuXG4gICAgICAgICAgcmV0dXJuIHNcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcL2csICAgJ1xcXFxcXFxcJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cIi9nLCAgICAnXFxcXFwiJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHgwOC9nLCAnXFxcXGInKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcdC9nLCAgICdcXFxcdCcpXG4gICAgICAgICAgICAucmVwbGFjZSgvXFxuL2csICAgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXGYvZywgICAnXFxcXGYnKVxuICAgICAgICAgICAgLnJlcGxhY2UoL1xcci9nLCAgICdcXFxccicpXG4gICAgICAgICAgICAucmVwbGFjZSgvW1xceDAwLVxceDA3XFx4MEJcXHgwRVxceDBGXS9nLCBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx4MCcgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHgxMC1cXHgxRlxceDgwLVxceEZGXS9nLCAgICBmdW5jdGlvbihjaCkgeyByZXR1cm4gJ1xcXFx4JyAgKyBoZXgoY2gpOyB9KVxuICAgICAgICAgICAgLnJlcGxhY2UoL1tcXHUwMTgwLVxcdTBGRkZdL2csICAgICAgICAgZnVuY3Rpb24oY2gpIHsgcmV0dXJuICdcXFxcdTAnICsgaGV4KGNoKTsgfSlcbiAgICAgICAgICAgIC5yZXBsYWNlKC9bXFx1MTA4MC1cXHVGRkZGXS9nLCAgICAgICAgIGZ1bmN0aW9uKGNoKSB7IHJldHVybiAnXFxcXHUnICArIGhleChjaCk7IH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGV4cGVjdGVkRGVzY3MgPSBuZXcgQXJyYXkoZXhwZWN0ZWQubGVuZ3RoKSxcbiAgICAgICAgICAgIGV4cGVjdGVkRGVzYywgZm91bmREZXNjLCBpO1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBleHBlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGV4cGVjdGVkRGVzY3NbaV0gPSBleHBlY3RlZFtpXS5kZXNjcmlwdGlvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIGV4cGVjdGVkRGVzYyA9IGV4cGVjdGVkLmxlbmd0aCA+IDFcbiAgICAgICAgICA/IGV4cGVjdGVkRGVzY3Muc2xpY2UoMCwgLTEpLmpvaW4oXCIsIFwiKVxuICAgICAgICAgICAgICArIFwiIG9yIFwiXG4gICAgICAgICAgICAgICsgZXhwZWN0ZWREZXNjc1tleHBlY3RlZC5sZW5ndGggLSAxXVxuICAgICAgICAgIDogZXhwZWN0ZWREZXNjc1swXTtcblxuICAgICAgICBmb3VuZERlc2MgPSBmb3VuZCA/IFwiXFxcIlwiICsgc3RyaW5nRXNjYXBlKGZvdW5kKSArIFwiXFxcIlwiIDogXCJlbmQgb2YgaW5wdXRcIjtcblxuICAgICAgICByZXR1cm4gXCJFeHBlY3RlZCBcIiArIGV4cGVjdGVkRGVzYyArIFwiIGJ1dCBcIiArIGZvdW5kRGVzYyArIFwiIGZvdW5kLlwiO1xuICAgICAgfVxuXG4gICAgICB2YXIgcG9zRGV0YWlscyA9IHBlZyRjb21wdXRlUG9zRGV0YWlscyhwb3MpLFxuICAgICAgICAgIGZvdW5kICAgICAgPSBwb3MgPCBpbnB1dC5sZW5ndGggPyBpbnB1dC5jaGFyQXQocG9zKSA6IG51bGw7XG5cbiAgICAgIGlmIChleHBlY3RlZCAhPT0gbnVsbCkge1xuICAgICAgICBjbGVhbnVwRXhwZWN0ZWQoZXhwZWN0ZWQpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbmV3IFN5bnRheEVycm9yKFxuICAgICAgICBtZXNzYWdlICE9PSBudWxsID8gbWVzc2FnZSA6IGJ1aWxkTWVzc2FnZShleHBlY3RlZCwgZm91bmQpLFxuICAgICAgICBleHBlY3RlZCxcbiAgICAgICAgZm91bmQsXG4gICAgICAgIHBvcyxcbiAgICAgICAgcG9zRGV0YWlscy5saW5lLFxuICAgICAgICBwb3NEZXRhaWxzLmNvbHVtblxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VzdGFydCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlXygpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlU3RhdGVtZW50cygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzEoKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTdGF0ZW1lbnRzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzO1xuXG4gICAgICBzMCA9IFtdO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHMyID0gcGVnJHBhcnNlU3RhdGVtZW50KCk7XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gW3MyLCBzM107XG4gICAgICAgICAgczEgPSBzMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgICAgczIgPSBwZWckcGFyc2VTdGF0ZW1lbnQoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IFtzMiwgczNdO1xuICAgICAgICAgICAgczEgPSBzMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTdGF0ZW1lbnQoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIHMwID0gcGVnJHBhcnNlRnVuY3Rpb24oKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZVBhdGgoKTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAgPSBwZWckcGFyc2VTY2hlbWEoKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRnVuY3Rpb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VGdW5jdGlvblN0YXJ0KCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VGdW5jdGlvbkJvZHkoKTtcbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzUoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMyk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUZ1bmN0aW9uU3RhcnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczY7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA4KSA9PT0gcGVnJGM2KSB7XG4gICAgICAgIHMxID0gcGVnJGM2O1xuICAgICAgICBwZWckY3VyclBvcyArPSA4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VQYXJhbWV0ZXJMaXN0KCk7XG4gICAgICAgICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM0O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjOChzMywgczUpO1xuICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMSA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRwYXJzZVBhcmFtZXRlckxpc3QoKTtcbiAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzkoczEsIHMzKTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVBhdGgoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzODtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VQYXRoU3RhcnQoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMyA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzExKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjMTE7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTIpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzEzKHM2KTtcbiAgICAgICAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjMpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzE0O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTUpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlUGF0aHNBbmRNZXRob2RzKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNSkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRjMTY7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNyk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzNDtcbiAgICAgICAgICAgICAgICAgICAgczUgPSBwZWckYzE4KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTkpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMTk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHM0O1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGMyMSgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHM0ID0gczU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckYzQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGMyMihzMSwgczIsIHM0KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTApOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQYXRoU3RhcnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA0KSA9PT0gcGVnJGMyMykge1xuICAgICAgICBzMSA9IHBlZyRjMjM7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyNCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlUGF0aFRlbXBsYXRlKCk7XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMyNShzMyk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlUGF0aFRlbXBsYXRlKCk7XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyNihzMSk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVBhdGhUZW1wbGF0ZSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQ7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nykge1xuICAgICAgICBzMyA9IHBlZyRjMjg7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyOSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzNCA9IHBlZyRwYXJzZVBhdGhLZXkoKTtcbiAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczQgPSBwZWckYzQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgczMgPSBwZWckYzMwKHM0KTtcbiAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMxLnB1c2goczIpO1xuICAgICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nykge1xuICAgICAgICAgICAgczMgPSBwZWckYzI4O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI5KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlUGF0aEtleSgpO1xuICAgICAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gcGVnJGM0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMzAoczQpO1xuICAgICAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMzEoczEpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI3KTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUGF0aEtleSgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VDYXB0dXJlS2V5KCk7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VMaXRlcmFsUGF0aEtleSgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQ2FwdHVyZUtleSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTIzKSB7XG4gICAgICAgIHMxID0gcGVnJGMxNDtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjEpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMzI7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMzKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Mikge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRjMzQ7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzNSk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOSA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczYgPSBbczYsIHM3LCBzOCwgczldO1xuICAgICAgICAgICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgICAgczUgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjNDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNSkge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzE2O1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzM2KHMzKTtcbiAgICAgICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMaXRlcmFsUGF0aEtleSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIGlmIChwZWckYzM3LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzgpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgICAgaWYgKHBlZyRjMzcudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzM4KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMzOShzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUGF0aHNBbmRNZXRob2RzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgczIgPSBwZWckcGFyc2VQYXRoKCk7XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VNZXRob2QoKTtcbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VBbnlCbG9jaygpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB3aGlsZSAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlUGF0aCgpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZU1ldGhvZCgpO1xuICAgICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckcGFyc2VBbnlCbG9jaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNDAoczEpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTY2hlbWEoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzOCwgczksIHMxMCwgczExO1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA0KSA9PT0gcGVnJGM0Mikge1xuICAgICAgICBzMSA9IHBlZyRjNDI7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0Myk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjApIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzQ0O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDUpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VJZGVudGlmaWVyTGlzdCgpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYyKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjNDY7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDcpOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczQ7XG4gICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjNDgoczYpO1xuICAgICAgICAgICAgICAgICAgczQgPSBzNTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM0O1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV9fKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDcpID09PSBwZWckYzQ5KSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRjNDk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyArPSA3O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTApOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczggPSBwZWckcGFyc2VfXygpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczEwID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzMTAgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHM1O1xuICAgICAgICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzUxKHM5KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHM1ID0gczY7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICAgICAgczUgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczU7XG4gICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNTtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjNDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjMpIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBwZWckYzE0O1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTUpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHMxMCA9IHBlZyRwYXJzZVByb3BlcnRpZXNBbmRNZXRob2RzKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHMxMCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczExID0gcGVnJGMxNjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHMxMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNyk7IH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzMTEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJGMxOChzMTApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICBzNiA9IHM3O1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNjtcbiAgICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA1OSkge1xuICAgICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJGMxOTtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHM4ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjApOyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczY7XG4gICAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzUyKCk7XG4gICAgICAgICAgICAgICAgICAgICAgczYgPSBzNztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICAgICAgICAgIHM2ID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHM2O1xuICAgICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjNDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM1MyhzMywgczQsIHM1LCBzNik7XG4gICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNDEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQcm9wZXJ0aWVzQW5kTWV0aG9kcygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIHMyID0gcGVnJHBhcnNlUHJvcGVydHkoKTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZU1ldGhvZCgpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUFueUJsb2NrKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgczIgPSBwZWckcGFyc2VQcm9wZXJ0eSgpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZU1ldGhvZCgpO1xuICAgICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckcGFyc2VBbnlCbG9jaygpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNTQoczEpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VQcm9wZXJ0eSgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRwYXJzZVN0cmluZygpO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDU4KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNTU7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VUeXBlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlUHJvcFNlcCgpO1xuICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNTcoczEsIHM1KTtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUHJvcFNlcCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICBzMSA9IHBlZyRjNTg7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDU5KSB7XG4gICAgICAgICAgczEgPSBwZWckYzE5O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMCk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM0O1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjNjAoczEpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VNZXRob2QoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VQYXJhbWV0ZXJMaXN0KCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VGdW5jdGlvbkJvZHkoKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZVByb3BTZXAoKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzYyKHMxLCBzMiwgczQsIHM1KTtcbiAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNjEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VGdW5jdGlvbkJvZHkoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3LCBzOCwgczk7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyMykge1xuICAgICAgICBzMSA9IHBlZyRjMTQ7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCA2KSA9PT0gcGVnJGM2Mykge1xuICAgICAgICAgICAgczQgPSBwZWckYzYzO1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gNjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY0KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlX18oKTtcbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNCA9IFtzNCwgczVdO1xuICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjNDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDU5KSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRjMTk7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjApOyB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMjUpIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRjMTY7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3KTsgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChzOSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMSA9IHBlZyRjNjUoczQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYxKSB7XG4gICAgICAgICAgczEgPSBwZWckYzMyO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMzMyk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA1OSkge1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxOTtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjApOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzQ7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczUgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGM2NihzMyk7XG4gICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVBhcmFtZXRlckxpc3QoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MCkge1xuICAgICAgICBzMSA9IHBlZyRjNjc7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2OCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZUlkZW50aWZpZXJMaXN0KCk7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDEpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM2OTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3MCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzcxKHMyKTtcbiAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSWRlbnRpZmllckxpc3QoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzQ7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJGM1ODtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM1OSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzEzKHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzU4O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTkpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTMoczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzcyKHMxLCBzMik7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VTaW5nbGVUeXBlKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMTI0KSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjNzM7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNzQpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VTaW5nbGVUeXBlKCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM1MShzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyNCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNzM7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3NCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VTaW5nbGVUeXBlKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM1MShzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjNzUoczEsIHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTaW5nbGVUeXBlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjNzYpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjNzY7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzc3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMyO1xuICAgICAgICAgIHMzID0gcGVnJGM3OCgpO1xuICAgICAgICB9XG4gICAgICAgIHMyID0gczM7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2MCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzQ0O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ1KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlVHlwZUxpc3QoKTtcbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA2Mikge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckYzQ2O1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgczYgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ3KTsgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMyO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzc5KHM1KTtcbiAgICAgICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckYzQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM4MChzMSwgczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVR5cGVMaXN0KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NCkge1xuICAgICAgICAgICAgczUgPSBwZWckYzU4O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzU5KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzUxKHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzU4O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTkpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlVHlwZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzUxKHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGM4MShzMSwgczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVByaW1hcnlFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMiA9IHBlZyRwYXJzZUxpdGVyYWwoKTtcbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4MjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlSWRlbnRpZmllcigpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzgzKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VMaXRlcmFsKCk7XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MCkge1xuICAgICAgICAgICAgczEgPSBwZWckYzY3O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzY4KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMzID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MSkge1xuICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRjNjk7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM3MCk7IH1cbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgczEgPSBwZWckYzg0KHMzKTtcbiAgICAgICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VNZW1iZXJFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczgsIHM5O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VQcmltYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkxKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjODU7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczggPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkzKSB7XG4gICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJGM4NztcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg4KTsgfVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjODkoczcpO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjOTA7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MSk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM4OShzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkxKSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJGM4NTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg2KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczggPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczggIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mykge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJGM4NztcbiAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODgpOyB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzg5KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjOTA7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkxKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VJZGVudGlmaWVyKCk7XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM4OShzNyk7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzkyKHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUNhbGxFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNywgczgsIHM5O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHMyID0gcGVnJHBhcnNlTWVtYmVyRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMzID0gcGVnJHBhcnNlQXJndW1lbnRzKCk7XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMxO1xuICAgICAgICAgIHMyID0gcGVnJGM5MyhzMiwgczMpO1xuICAgICAgICAgIHMxID0gczI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlQXJndW1lbnRzKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgIHM0ID0gcGVnJGM5NChzNSk7XG4gICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTEpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzg1O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODYpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzg3O1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM4OCk7IH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjOTUoczcpO1xuICAgICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nikge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM5MDtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjOTEpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzk1KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VBcmd1bWVudHMoKTtcbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgczQgPSBwZWckYzk0KHM1KTtcbiAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTEpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjODU7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg2KTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzOCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM4ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mykge1xuICAgICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckYzg3O1xuICAgICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgczkgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg4KTsgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICBpZiAoczkgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzk1KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM5MDtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM5MSk7IH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUlkZW50aWZpZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzk1KHM3KTtcbiAgICAgICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzk2KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZU1lbWJlckV4cHJlc3Npb24oKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFyZ3VtZW50cygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0MCkge1xuICAgICAgICBzMSA9IHBlZyRjNjc7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM2OCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VBcmd1bWVudExpc3QoKTtcbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDEpIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRjNjk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzcwKTsgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMxID0gcGVnJGM5NyhzMyk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFyZ3VtZW50TGlzdCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ0KSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjNTg7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTkpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VDb25kaXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzY1KHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDQpIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckYzU4O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTkpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGM2NShzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGM5OChzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VVbmFyeUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckcGFyc2VDYWxsRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJHBhcnNlVW5hcnlPcGVyYXRvcigpO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZVVuYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjOTkoczEsIHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlVW5hcnlPcGVyYXRvcigpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQzKSB7XG4gICAgICAgIHMxID0gcGVnJGMxMDA7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMDEpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxMDIoKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0NSkge1xuICAgICAgICAgIHMxID0gcGVnJGMxMDM7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwNCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA1KCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzMykge1xuICAgICAgICAgICAgczAgPSBwZWckYzEwNjtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMDcpOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VNdWx0aXBsaWNhdGl2ZUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VVbmFyeUV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VNdWx0aXBsaWNhdGl2ZU9wZXJhdG9yKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVVuYXJ5RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlT3BlcmF0b3IoKTtcbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VVbmFyeUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA5KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlT3BlcmF0b3IoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDIpIHtcbiAgICAgICAgczAgPSBwZWckYzM0O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMzUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA0Nykge1xuICAgICAgICAgIHMwID0gcGVnJGMyODtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzNykge1xuICAgICAgICAgICAgczAgPSBwZWckYzExMDtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMTEpOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VBZGRpdGl2ZUV4cHJlc3Npb24oKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VNdWx0aXBsaWNhdGl2ZUV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VBZGRpdGl2ZU9wZXJhdG9yKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZU11bHRpcGxpY2F0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUFkZGl0aXZlT3BlcmF0b3IoKTtcbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VNdWx0aXBsaWNhdGl2ZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA5KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUFkZGl0aXZlT3BlcmF0b3IoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDMpIHtcbiAgICAgICAgczAgPSBwZWckYzEwMDtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEwMSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ1KSB7XG4gICAgICAgICAgczAgPSBwZWckYzEwMztcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTA0KTsgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VSZWxhdGlvbmFsRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUFkZGl0aXZlRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZVJlbGF0aW9uYWxPcGVyYXRvcigpO1xuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VBZGRpdGl2ZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VSZWxhdGlvbmFsT3BlcmF0b3IoKTtcbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgczcgPSBwZWckcGFyc2VBZGRpdGl2ZUV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTA5KHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVJlbGF0aW9uYWxPcGVyYXRvcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTEyKSB7XG4gICAgICAgIHMwID0gcGVnJGMxMTI7XG4gICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMTMpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTE0KSB7XG4gICAgICAgICAgczAgPSBwZWckYzExNDtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTE1KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjApIHtcbiAgICAgICAgICAgIHMwID0gcGVnJGM0NDtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGM0NSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYyKSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGM0NjtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzQ3KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXF1YWxpdHlFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlUmVsYXRpb25hbEV4cHJlc3Npb24oKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VFcXVhbGl0eU9wZXJhdG9yKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVJlbGF0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlRXF1YWxpdHlPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZVJlbGF0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzEwOShzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFcXVhbGl0eU9wZXJhdG9yKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzExNikge1xuICAgICAgICBzMSA9IHBlZyRjMTE2O1xuICAgICAgICBwZWckY3VyclBvcyArPSAzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTE3KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzExOCkge1xuICAgICAgICAgIHMxID0gcGVnJGMxMTg7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzExOSk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTIwKCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNjEpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMzI7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzMzKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMjEoKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzEyMikge1xuICAgICAgICAgICAgczEgPSBwZWckYzEyMjtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDM7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMjMpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMTI0KSB7XG4gICAgICAgICAgICAgIHMxID0gcGVnJGMxMjQ7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMjUpOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTI2KCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUxvZ2ljYWxBTkRFeHByZXNzaW9uKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2LCBzNztcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlRXF1YWxpdHlFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlTG9naWNhbEFORE9wZXJhdG9yKCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIHdoaWxlIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyLnB1c2goczMpO1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUxvZ2ljYWxBTkRPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUVxdWFsaXR5RXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzNCA9IHBlZyRjMTA4KHM1LCBzNyk7XG4gICAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxMDkoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTG9naWNhbEFORE9wZXJhdG9yKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDIpID09PSBwZWckYzEyNykge1xuICAgICAgICBzMSA9IHBlZyRjMTI3O1xuICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTI4KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDMpID09PSBwZWckYzEyOSkge1xuICAgICAgICAgIHMxID0gcGVnJGMxMjk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzMCk7IH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTMxKCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTG9naWNhbE9SRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczc7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRwYXJzZUxvZ2ljYWxBTkRFeHByZXNzaW9uKCk7XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBbXTtcbiAgICAgICAgczMgPSBwZWckY3VyclBvcztcbiAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlTG9naWNhbE9ST3BlcmF0b3IoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgaWYgKHM2ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM3ID0gcGVnJHBhcnNlTG9naWNhbEFOREV4cHJlc3Npb24oKTtcbiAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczQgPSBwZWckYzEwOChzNSwgczcpO1xuICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VMb2dpY2FsT1JPcGVyYXRvcigpO1xuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlXygpO1xuICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUxvZ2ljYWxBTkRFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHM3ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMztcbiAgICAgICAgICAgICAgICAgIHM0ID0gcGVnJGMxMDgoczUsIHM3KTtcbiAgICAgICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzEwOShzMSwgczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VMb2dpY2FsT1JPcGVyYXRvcigpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxMzIpIHtcbiAgICAgICAgczEgPSBwZWckYzEzMjtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzMyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMxMzQpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMTM0O1xuICAgICAgICAgIHBlZyRjdXJyUG9zICs9IDI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxMzUpOyB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzEzNigpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1LCBzNiwgczcsIHM4LCBzOTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlTG9naWNhbE9SRXhwcmVzc2lvbigpO1xuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDYzKSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMTM3O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzEzOCk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRwYXJzZUNvbmRpdGlvbmFsRXhwcmVzc2lvbigpO1xuICAgICAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzNiA9IHBlZyRwYXJzZV8oKTtcbiAgICAgICAgICAgICAgICBpZiAoczYgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNTgpIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckYzU1O1xuICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgczcgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjNTYpOyB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoczcgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICAgICAgczggPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzOCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgICAgICAgIHM5ID0gcGVnJHBhcnNlQ29uZGl0aW9uYWxFeHByZXNzaW9uKCk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHM5ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgICAgICAgICAgICAgIHMxID0gcGVnJGMxMzkoczEsIHM1LCBzOSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJHBhcnNlTG9naWNhbE9SRXhwcmVzc2lvbigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTGl0ZXJhbCgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VOdWxsKCk7XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckcGFyc2VCb29sZWFuTGl0ZXJhbCgpO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRwYXJzZU51bWVyaWNMaXRlcmFsKCk7XG4gICAgICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMCA9IHBlZyRwYXJzZVN0cmluZ0xpdGVyYWwoKTtcbiAgICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZUFycmF5TGl0ZXJhbCgpO1xuICAgICAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgICBzMCA9IHBlZyRwYXJzZVJlZ0V4cCgpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VOdWxsKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDQpID09PSBwZWckYzE0MCkge1xuICAgICAgICBzMSA9IHBlZyRjMTQwO1xuICAgICAgICBwZWckY3VyclBvcyArPSA0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTQxKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTQyKCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlQXJyYXlMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkxKSB7XG4gICAgICAgIHMxID0gcGVnJGM4NTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzg2KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlXygpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZUFyZ3VtZW50TGlzdCgpO1xuICAgICAgICAgIGlmIChzMyA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczMgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mykge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJGM4NztcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjODgpOyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICAgICAgczEgPSBwZWckYzE0MyhzMyk7XG4gICAgICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUJvb2xlYW5MaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDQpID09PSBwZWckYzE0NCkge1xuICAgICAgICBzMSA9IHBlZyRjMTQ0O1xuICAgICAgICBwZWckY3VyclBvcyArPSA0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTQ1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTQ2KCk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5zdWJzdHIocGVnJGN1cnJQb3MsIDUpID09PSBwZWckYzE0Nykge1xuICAgICAgICAgIHMxID0gcGVnJGMxNDc7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgKz0gNTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE0OCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTQ5KCk7XG4gICAgICAgIH1cbiAgICAgICAgczAgPSBzMTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU51bWVyaWNMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChwZWckYzE1MS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1Mik7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjNDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZUhleEludGVnZXJMaXRlcmFsKCk7XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlRGVjaW1hbExpdGVyYWwoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTUzKHMxLCBzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1MCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURlY2ltYWxMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczUsIHM2O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMyA9IHBlZyRwYXJzZURlY2ltYWxJbnRlZ2VyTGl0ZXJhbCgpO1xuICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICBzNCA9IHBlZyRjOTA7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkxKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0cygpO1xuICAgICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckYzQ7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczYgPSBwZWckcGFyc2VFeHBvbmVudFBhcnQoKTtcbiAgICAgICAgICAgIGlmIChzNiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNiA9IHBlZyRjNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMyA9IFtzMywgczQsIHM1LCBzNl07XG4gICAgICAgICAgICAgIHMyID0gczM7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IGlucHV0LnN1YnN0cmluZyhzMSwgcGVnJGN1cnJQb3MpO1xuICAgICAgfVxuICAgICAgczEgPSBzMjtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE1NChzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDYpIHtcbiAgICAgICAgICBzMyA9IHBlZyRjOTA7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzkxKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM0ID0gcGVnJHBhcnNlRGVjaW1hbERpZ2l0cygpO1xuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczUgPSBwZWckcGFyc2VFeHBvbmVudFBhcnQoKTtcbiAgICAgICAgICAgIGlmIChzNSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNSA9IHBlZyRjNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMyA9IFtzMywgczQsIHM1XTtcbiAgICAgICAgICAgICAgczIgPSBzMztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMyO1xuICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5zdWJzdHJpbmcoczEsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgfVxuICAgICAgICBzMSA9IHMyO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTU1KHMxKTtcbiAgICAgICAgfVxuICAgICAgICBzMCA9IHMxO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzMyA9IHBlZyRwYXJzZURlY2ltYWxJbnRlZ2VyTGl0ZXJhbCgpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBwZWckcGFyc2VFeHBvbmVudFBhcnQoKTtcbiAgICAgICAgICAgIGlmIChzNCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjNDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzMyA9IFtzMywgczRdO1xuICAgICAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMiA9IGlucHV0LnN1YnN0cmluZyhzMSwgcGVnJGN1cnJQb3MpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzMSA9IHMyO1xuICAgICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTU1KHMxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRGVjaW1hbEludGVnZXJMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDgpIHtcbiAgICAgICAgczAgPSBwZWckYzE1NjtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1Nyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMSA9IHBlZyRwYXJzZU5vblplcm9EaWdpdCgpO1xuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdHMoKTtcbiAgICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gcGVnJGM0O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMxID0gW3MxLCBzMl07XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURlY2ltYWxEaWdpdHMoKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IFtdO1xuICAgICAgczEgPSBwZWckcGFyc2VEZWNpbWFsRGlnaXQoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICB3aGlsZSAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgICBzMSA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdCgpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURlY2ltYWxEaWdpdCgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgaWYgKHBlZyRjMTU4LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczAgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTU5KTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTm9uWmVyb0RpZ2l0KCkge1xuICAgICAgdmFyIHMwO1xuXG4gICAgICBpZiAocGVnJGMxNjAudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNjEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VFeHBvbmVudFBhcnQoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJHBhcnNlRXhwb25lbnRJbmRpY2F0b3IoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZVNpZ25lZEludGVnZXIoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEgPSBbczEsIHMyXTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXhwb25lbnRJbmRpY2F0b3IoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChwZWckYzE2Mi50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE2Myk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNpZ25lZEludGVnZXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChwZWckYzE2NC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE2NSk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjNDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdHMoKTtcbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEgPSBbczEsIHMyXTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSGV4SW50ZWdlckxpdGVyYWwoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gNDgpIHtcbiAgICAgICAgczEgPSBwZWckYzE1NjtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE1Nyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAocGVnJGMxNjYudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTY3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgczQgPSBbXTtcbiAgICAgICAgICBzNSA9IHBlZyRwYXJzZUhleERpZ2l0KCk7XG4gICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICB3aGlsZSAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgczQucHVzaChzNSk7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczQgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBpbnB1dC5zdWJzdHJpbmcoczMsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgczMgPSBzNDtcbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzE2OChzMyk7XG4gICAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSGV4RGlnaXQoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChwZWckYzE2OS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3MCk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVJlZ0V4cCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQsIHM1O1xuXG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ3KSB7XG4gICAgICAgIHMxID0gcGVnJGMyODtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzI5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlUmVnRXhwQ2hhcmFjdGVycygpO1xuICAgICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjNDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ3KSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMjg7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjkpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBbXTtcbiAgICAgICAgICAgIGlmIChwZWckYzE3Mi50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICAgIHM1ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3Myk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNC5wdXNoKHM1KTtcbiAgICAgICAgICAgICAgaWYgKHBlZyRjMTcyLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgICAgICBzNSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzNSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3Myk7IH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMSA9IHBlZyRjMTc0KHMyLCBzNCk7XG4gICAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3MSk7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVJlZ0V4cENoYXJhY3RlcnMoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gW107XG4gICAgICBpZiAocGVnJGMxNzUudGVzdChpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpKSkge1xuICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzYpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczIgPSBwZWckcGFyc2VSZWdFeHBFc2NhcGVkKCk7XG4gICAgICB9XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgICAgaWYgKHBlZyRjMTc1LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczIgPSBwZWckcGFyc2VSZWdFeHBFc2NhcGVkKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE3NyhzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlUmVnRXhwRXNjYXBlZCgpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICBzMSA9IHBlZyRjMTc4O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTc5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxODEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTdHJpbmdMaXRlcmFsKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckcGFyc2VTdHJpbmcoKTtcbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE4MyhzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgyKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU3RyaW5nKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNDtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM0KSB7XG4gICAgICAgIHMyID0gcGVnJGMxODQ7XG4gICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODUpOyB9XG4gICAgICB9XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczMgPSBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyYWN0ZXJzKCk7XG4gICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzQpIHtcbiAgICAgICAgICAgIHM0ID0gcGVnJGMxODQ7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTg1KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gW3MyLCBzMywgczRdO1xuICAgICAgICAgICAgczEgPSBzMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDM5KSB7XG4gICAgICAgICAgczIgPSBwZWckYzE4NjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTg3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMzID0gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcmFjdGVycygpO1xuICAgICAgICAgIGlmIChzMyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzOSkge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRjMTg2O1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczQgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTg3KTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHMyID0gW3MyLCBzMywgczRdO1xuICAgICAgICAgICAgICBzMSA9IHMyO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICBzMSA9IHBlZyRjMTg4KHMxKTtcbiAgICAgIH1cbiAgICAgIHMwID0gczE7XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyYWN0ZXJzKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgczIgPSBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyYWN0ZXIoKTtcbiAgICAgIHdoaWxlIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMS5wdXNoKHMyKTtcbiAgICAgICAgczIgPSBwZWckcGFyc2VEb3VibGVTdHJpbmdDaGFyYWN0ZXIoKTtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE3NyhzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcmFjdGVycygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBbXTtcbiAgICAgIHMyID0gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcmFjdGVyKCk7XG4gICAgICB3aGlsZSAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlU2luZ2xlU3RyaW5nQ2hhcmFjdGVyKCk7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgIHMxID0gcGVnJGMxNzcoczEpO1xuICAgICAgfVxuICAgICAgczAgPSBzMTtcblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZURvdWJsZVN0cmluZ0NoYXJhY3RlcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgczEgPSBwZWckY3VyclBvcztcbiAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAzNCkge1xuICAgICAgICBzMiA9IHBlZyRjMTg0O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTg1KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTIpIHtcbiAgICAgICAgICBzMiA9IHBlZyRjMTc4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHMyID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMxID0gcGVnJGM4MjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczE7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHMyID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMxODkoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICAgIHMxID0gcGVnJGMxNzg7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE3OSk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMiA9IHBlZyRwYXJzZUVzY2FwZVNlcXVlbmNlKCk7XG4gICAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMxOTAoczIpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJHBhcnNlTGluZUNvbnRpbnVhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VTaW5nbGVTdHJpbmdDaGFyYWN0ZXIoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMjtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIHMxID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gMzkpIHtcbiAgICAgICAgczIgPSBwZWckYzE4NjtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4Nyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDkyKSB7XG4gICAgICAgICAgczIgPSBwZWckYzE3ODtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMyID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTc5KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJHBhcnNlTmV3TGluZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMiA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRjODI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMxO1xuICAgICAgICBzMSA9IHBlZyRjMDtcbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICBzMiA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzMiA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE4MCk7IH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTg5KHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMwID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIGlmIChpbnB1dC5jaGFyQ29kZUF0KHBlZyRjdXJyUG9zKSA9PT0gOTIpIHtcbiAgICAgICAgICBzMSA9IHBlZyRjMTc4O1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxNzkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIgPSBwZWckcGFyc2VFc2NhcGVTZXF1ZW5jZSgpO1xuICAgICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgICBzMSA9IHBlZyRjMTkwKHMyKTtcbiAgICAgICAgICAgIHMwID0gczE7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMCA9IHBlZyRwYXJzZUxpbmVDb250aW51YXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTGluZUNvbnRpbnVhdGlvbigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyO1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSA5Mikge1xuICAgICAgICBzMSA9IHBlZyRjMTc4O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTc5KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJHBhcnNlTmV3TGluZSgpO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMTkxKHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlRXNjYXBlU2VxdWVuY2UoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczM7XG5cbiAgICAgIHMwID0gcGVnJHBhcnNlQ2hhcmFjdGVyRXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDQ4KSB7XG4gICAgICAgICAgczEgPSBwZWckYzE1NjtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTU3KTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VEZWNpbWFsRGlnaXQoKTtcbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICBpZiAoczMgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMyID0gcGVnJGM4MjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgIHMyID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgICAgczEgPSBwZWckYzE5MigpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwID0gcGVnJHBhcnNlSGV4RXNjYXBlU2VxdWVuY2UoKTtcbiAgICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMwID0gcGVnJHBhcnNlVW5pY29kZUVzY2FwZVNlcXVlbmNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VDaGFyYWN0ZXJFc2NhcGVTZXF1ZW5jZSgpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VTaW5nbGVFc2NhcGVDaGFyYWN0ZXIoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZU5vbkVzY2FwZUNoYXJhY3RlcigpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlU2luZ2xlRXNjYXBlQ2hhcmFjdGVyKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgczAgPSBwZWckY3VyclBvcztcbiAgICAgIGlmIChwZWckYzE5My50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMxID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzE5NCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgczEgPSBwZWckYzE5NShzMSk7XG4gICAgICB9XG4gICAgICBzMCA9IHMxO1xuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlTm9uRXNjYXBlQ2hhcmFjdGVyKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczI7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IHBlZyRjdXJyUG9zO1xuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMiA9IHBlZyRwYXJzZUVzY2FwZUNoYXJhY3RlcigpO1xuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczIgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckYzgyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMTtcbiAgICAgICAgczEgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgaWYgKGlucHV0Lmxlbmd0aCA+IHBlZyRjdXJyUG9zKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczA7XG4gICAgICAgICAgczEgPSBwZWckYzE5NihzMik7XG4gICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUVzY2FwZUNoYXJhY3RlcigpIHtcbiAgICAgIHZhciBzMDtcblxuICAgICAgczAgPSBwZWckcGFyc2VTaW5nbGVFc2NhcGVDaGFyYWN0ZXIoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZURlY2ltYWxEaWdpdCgpO1xuICAgICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyMCkge1xuICAgICAgICAgICAgczAgPSBwZWckYzE5NztcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxOTgpOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTcpIHtcbiAgICAgICAgICAgICAgczAgPSBwZWckYzE5OTtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwMCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZUhleEVzY2FwZVNlcXVlbmNlKCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuY2hhckNvZGVBdChwZWckY3VyclBvcykgPT09IDEyMCkge1xuICAgICAgICBzMSA9IHBlZyRjMTk3O1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTk4KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICAgIHM0ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VIZXhEaWdpdCgpO1xuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBbczQsIHM1XTtcbiAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMyA9IGlucHV0LnN1YnN0cmluZyhzMiwgcGVnJGN1cnJQb3MpO1xuICAgICAgICB9XG4gICAgICAgIHMyID0gczM7XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyMDEoczIpO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VVbmljb2RlRXNjYXBlU2VxdWVuY2UoKSB7XG4gICAgICB2YXIgczAsIHMxLCBzMiwgczMsIHM0LCBzNSwgczYsIHM3O1xuXG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKGlucHV0LmNoYXJDb2RlQXQocGVnJGN1cnJQb3MpID09PSAxMTcpIHtcbiAgICAgICAgczEgPSBwZWckYzE5OTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIwMCk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRwYXJzZUhleERpZ2l0KCk7XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHM1ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgICBpZiAoczUgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHM2ID0gcGVnJHBhcnNlSGV4RGlnaXQoKTtcbiAgICAgICAgICAgIGlmIChzNiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICBzNyA9IHBlZyRwYXJzZUhleERpZ2l0KCk7XG4gICAgICAgICAgICAgIGlmIChzNyAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgICAgIHM0ID0gW3M0LCBzNSwgczYsIHM3XTtcbiAgICAgICAgICAgICAgICBzMyA9IHM0O1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgczMgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBpbnB1dC5zdWJzdHJpbmcoczIsIHBlZyRjdXJyUG9zKTtcbiAgICAgICAgfVxuICAgICAgICBzMiA9IHMzO1xuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICBzMSA9IHBlZyRjMjAxKHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlSWRlbnRpZmllcigpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMztcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRjdXJyUG9zO1xuICAgICAgaWYgKHBlZyRjMjAzLnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjA0KTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMyID0gW107XG4gICAgICAgIGlmIChwZWckYzIwNS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgczMgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczMgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMDYpOyB9XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczIucHVzaChzMyk7XG4gICAgICAgICAgaWYgKHBlZyRjMjA1LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgICAgIHMzID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHMzID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMDYpOyB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzMiAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMwO1xuICAgICAgICAgIHMxID0gcGVnJGMyMDcoczEsIHMyKTtcbiAgICAgICAgICBzMCA9IHMxO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczA7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICBpZiAoczAgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjAyKTsgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlX18oKSB7XG4gICAgICB2YXIgczAsIHMxO1xuXG4gICAgICBzMCA9IFtdO1xuICAgICAgczEgPSBwZWckcGFyc2VXaGl0ZXNwYWNlKCk7XG4gICAgICBpZiAoczEgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgczEgPSBwZWckcGFyc2VDb21tZW50KCk7XG4gICAgICB9XG4gICAgICBpZiAoczEgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczAucHVzaChzMSk7XG4gICAgICAgICAgczEgPSBwZWckcGFyc2VXaGl0ZXNwYWNlKCk7XG4gICAgICAgICAgaWYgKHMxID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRwYXJzZUNvbW1lbnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gczA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVnJHBhcnNlXygpIHtcbiAgICAgIHZhciBzMCwgczE7XG5cbiAgICAgIHMwID0gW107XG4gICAgICBzMSA9IHBlZyRwYXJzZVdoaXRlc3BhY2UoKTtcbiAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRwYXJzZUNvbW1lbnQoKTtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMC5wdXNoKHMxKTtcbiAgICAgICAgczEgPSBwZWckcGFyc2VXaGl0ZXNwYWNlKCk7XG4gICAgICAgIGlmIChzMSA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMxID0gcGVnJHBhcnNlQ29tbWVudCgpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VXaGl0ZXNwYWNlKCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IFtdO1xuICAgICAgaWYgKHBlZyRjMjA5LnRlc3QoaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKSkpIHtcbiAgICAgICAgczEgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczEgPSBwZWckRkFJTEVEO1xuICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjEwKTsgfVxuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHdoaWxlIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHMwLnB1c2goczEpO1xuICAgICAgICAgIGlmIChwZWckYzIwOS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICBzMSA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjEwKTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMDgpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VDb21tZW50KCkge1xuICAgICAgdmFyIHMwLCBzMTtcblxuICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICBzMCA9IHBlZyRwYXJzZU11bHRpTGluZUNvbW1lbnQoKTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMCA9IHBlZyRwYXJzZVNpbmdsZUxpbmVDb21tZW50KCk7XG4gICAgICB9XG4gICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgIGlmIChzMCA9PT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMSA9IHBlZyRGQUlMRUQ7XG4gICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTEpOyB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VNdWx0aUxpbmVDb21tZW50KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyMTIpIHtcbiAgICAgICAgczEgPSBwZWckYzIxMjtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxMyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMjE0KSB7XG4gICAgICAgICAgczUgPSBwZWckYzIxNDtcbiAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE1KTsgfVxuICAgICAgICB9XG4gICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNCA9IHBlZyRjODI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgIHM1ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBbczQsIHM1XTtcbiAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgaWYgKGlucHV0LnN1YnN0cihwZWckY3VyclBvcywgMikgPT09IHBlZyRjMjE0KSB7XG4gICAgICAgICAgICBzNSA9IHBlZyRjMjE0O1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxNSk7IH1cbiAgICAgICAgICB9XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgICAgaWYgKHM1ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjODI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gW3M0LCBzNV07XG4gICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyMTQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGMyMTQ7XG4gICAgICAgICAgICBwZWckY3VyclBvcyArPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzMyA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE1KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMxID0gW3MxLCBzMiwgczNdO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZVNpbmdsZUxpbmVDb21tZW50KCkge1xuICAgICAgdmFyIHMwLCBzMSwgczIsIHMzLCBzNCwgczU7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBpZiAoaW5wdXQuc3Vic3RyKHBlZyRjdXJyUG9zLCAyKSA9PT0gcGVnJGMyMTYpIHtcbiAgICAgICAgczEgPSBwZWckYzIxNjtcbiAgICAgICAgcGVnJGN1cnJQb3MgKz0gMjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxNyk7IH1cbiAgICAgIH1cbiAgICAgIGlmIChzMSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICBzMiA9IFtdO1xuICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBzNCA9IHBlZyRjdXJyUG9zO1xuICAgICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgICAgczUgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgICBpZiAoczUgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzNCA9IHBlZyRjODI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzNDtcbiAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgIHM1ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHM1ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChzNSAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgICAgczQgPSBbczQsIHM1XTtcbiAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMi5wdXNoKHMzKTtcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHM0ID0gcGVnJGN1cnJQb3M7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzKys7XG4gICAgICAgICAgczUgPSBwZWckcGFyc2VOZXdMaW5lKCk7XG4gICAgICAgICAgcGVnJHNpbGVudEZhaWxzLS07XG4gICAgICAgICAgaWYgKHM1ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRjODI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczQ7XG4gICAgICAgICAgICBzNCA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHM0ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBpZiAoaW5wdXQubGVuZ3RoID4gcGVnJGN1cnJQb3MpIHtcbiAgICAgICAgICAgICAgczUgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgczUgPSBwZWckRkFJTEVEO1xuICAgICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHM1ICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICAgIHM0ID0gW3M0LCBzNV07XG4gICAgICAgICAgICAgIHMzID0gczQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBwZWckY3VyclBvcyA9IHMzO1xuICAgICAgICAgICAgICBzMyA9IHBlZyRjMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICBzMSA9IFtzMSwgczJdO1xuICAgICAgICAgIHMwID0gczE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgczAgPSBwZWckYzA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBzMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwZWckcGFyc2VBbnlCbG9jaygpIHtcbiAgICAgIHZhciBzMCwgczEsIHMyLCBzMywgczQ7XG5cbiAgICAgIHMwID0gcGVnJGN1cnJQb3M7XG4gICAgICBzMSA9IFtdO1xuICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgIHMzID0gcGVnJGN1cnJQb3M7XG4gICAgICBwZWckc2lsZW50RmFpbHMrKztcbiAgICAgIGlmIChwZWckYzIxOC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIxOSk7IH1cbiAgICAgIH1cbiAgICAgIHBlZyRzaWxlbnRGYWlscy0tO1xuICAgICAgaWYgKHM0ID09PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIHMzID0gcGVnJGM4MjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBlZyRjdXJyUG9zID0gczM7XG4gICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgIHM0ID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHM0ID0gcGVnJEZBSUxFRDtcbiAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMTgwKTsgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzNCAhPT0gcGVnJEZBSUxFRCkge1xuICAgICAgICAgIHBlZyRyZXBvcnRlZFBvcyA9IHMyO1xuICAgICAgICAgIHMzID0gcGVnJGMxOTYoczQpO1xuICAgICAgICAgIHMyID0gczM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICB9XG4gICAgICBpZiAoczIgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgd2hpbGUgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczEucHVzaChzMik7XG4gICAgICAgICAgczIgPSBwZWckY3VyclBvcztcbiAgICAgICAgICBzMyA9IHBlZyRjdXJyUG9zO1xuICAgICAgICAgIHBlZyRzaWxlbnRGYWlscysrO1xuICAgICAgICAgIGlmIChwZWckYzIxOC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgICBzNCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICBwZWckY3VyclBvcysrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICBpZiAocGVnJHNpbGVudEZhaWxzID09PSAwKSB7IHBlZyRmYWlsKHBlZyRjMjE5KTsgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBwZWckc2lsZW50RmFpbHMtLTtcbiAgICAgICAgICBpZiAoczQgPT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIHMzID0gcGVnJGM4MjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMztcbiAgICAgICAgICAgIHMzID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoczMgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgIGlmIChpbnB1dC5sZW5ndGggPiBwZWckY3VyclBvcykge1xuICAgICAgICAgICAgICBzNCA9IGlucHV0LmNoYXJBdChwZWckY3VyclBvcyk7XG4gICAgICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBzNCA9IHBlZyRGQUlMRUQ7XG4gICAgICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMxODApOyB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoczQgIT09IHBlZyRGQUlMRUQpIHtcbiAgICAgICAgICAgICAgcGVnJHJlcG9ydGVkUG9zID0gczI7XG4gICAgICAgICAgICAgIHMzID0gcGVnJGMxOTYoczQpO1xuICAgICAgICAgICAgICBzMiA9IHMzO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMjtcbiAgICAgICAgICAgICAgczIgPSBwZWckYzA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBlZyRjdXJyUG9zID0gczI7XG4gICAgICAgICAgICBzMiA9IHBlZyRjMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMxID0gcGVnJGMwO1xuICAgICAgfVxuICAgICAgaWYgKHMxICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgIGlmIChwZWckYzIxOC50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgICAgczIgPSBpbnB1dC5jaGFyQXQocGVnJGN1cnJQb3MpO1xuICAgICAgICAgIHBlZyRjdXJyUG9zKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgczIgPSBwZWckRkFJTEVEO1xuICAgICAgICAgIGlmIChwZWckc2lsZW50RmFpbHMgPT09IDApIHsgcGVnJGZhaWwocGVnJGMyMTkpOyB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHMyICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgczMgPSBwZWckcGFyc2VfKCk7XG4gICAgICAgICAgaWYgKHMzICE9PSBwZWckRkFJTEVEKSB7XG4gICAgICAgICAgICBwZWckcmVwb3J0ZWRQb3MgPSBzMDtcbiAgICAgICAgICAgIHMxID0gcGVnJGMyMjAoczEpO1xuICAgICAgICAgICAgczAgPSBzMTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGVnJGN1cnJQb3MgPSBzMDtcbiAgICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICAgIHMwID0gcGVnJGMwO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwZWckY3VyclBvcyA9IHMwO1xuICAgICAgICBzMCA9IHBlZyRjMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZyRwYXJzZU5ld0xpbmUoKSB7XG4gICAgICB2YXIgczA7XG5cbiAgICAgIGlmIChwZWckYzIyMS50ZXN0KGlucHV0LmNoYXJBdChwZWckY3VyclBvcykpKSB7XG4gICAgICAgIHMwID0gaW5wdXQuY2hhckF0KHBlZyRjdXJyUG9zKTtcbiAgICAgICAgcGVnJGN1cnJQb3MrKztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMwID0gcGVnJEZBSUxFRDtcbiAgICAgICAgaWYgKHBlZyRzaWxlbnRGYWlscyA9PT0gMCkgeyBwZWckZmFpbChwZWckYzIyMik7IH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHMwO1xuICAgIH1cblxuXG4gICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgdmFyIGFzdCA9IHJlcXVpcmUoJy4vYXN0Jyk7XG4gICAgICB2YXIgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xuICAgICAgdmFyIGxvZ2dlciA9IHJlcXVpcmUoJy4vbG9nZ2VyJyk7XG4gICAgICB2YXIgZXJyb3IgPSBsb2dnZXIuZXJyb3I7XG4gICAgICB2YXIgd2FybiA9IGxvZ2dlci53YXJuO1xuXG4gICAgICBsb2dnZXIuc2V0Q29udGV4dChmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBsaW5lOiBsaW5lKCksXG4gICAgICAgICAgY29sdW1uOiBjb2x1bW4oKVxuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIC8vIFJldHVybiBhIGxlZnQtYXNzb2NpYXRpdmUgYmluYXJ5IHN0cnVjdHVyZVxuICAgICAgLy8gY29uc2lzdGluZyBvZiBoZWFkIChleHApLCBhbmQgdGFpbCAob3AsIGV4cCkqLlxuICAgICAgZnVuY3Rpb24gbGVmdEFzc29jaWF0aXZlKGhlYWQsIHRhaWwpIHtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGhlYWQ7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGFpbC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIHJlc3VsdCA9IGFzdC5vcCh0YWlsW2ldLm9wLCBbcmVzdWx0LCB0YWlsW2ldLmV4cF0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIHZhciBzeW1ib2xzID0gbmV3IGFzdC5TeW1ib2xzKCk7XG5cbiAgICAgIHZhciBjdXJyZW50UGF0aCA9IG5ldyBhc3QuUGF0aFRlbXBsYXRlKCk7XG5cbiAgICAgIGZ1bmN0aW9uIGVuc3VyZUxvd2VyQ2FzZShzLCBtKSB7XG4gICAgICAgIGlmIChzIGluc3RhbmNlb2YgQXJyYXkpIHtcbiAgICAgICAgICBzID0gcy5tYXAoZnVuY3Rpb24oaWQpIHtcbiAgICAgICAgICAgIHJldHVybiBlbnN1cmVMb3dlckNhc2UoaWQsIG0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybiBzO1xuICAgICAgICB9XG4gICAgICAgIHZhciBjYW5vbmljYWwgPSBzWzBdLnRvTG93ZXJDYXNlKCkgKyBzLnNsaWNlKDEpO1xuICAgICAgICBpZiAocyAhPSBjYW5vbmljYWwpIHtcbiAgICAgICAgICB3YXJuKG0gKyBcIiBzaG91bGQgYmVnaW4gd2l0aCBhIGxvd2VyY2FzZSBsZXR0ZXI6ICgnXCIgKyBzICsgXCInIHNob3VsZCBiZSAnXCIgKyBjYW5vbmljYWwgKyBcIicpLlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcztcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gZW5zdXJlVXBwZXJDYXNlKHMsIG0pIHtcbiAgICAgICAgaWYgKHMgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgIHMgPSBzLm1hcChmdW5jdGlvbihpZCkge1xuICAgICAgICAgICAgcmV0dXJuIGVuc3VyZVVwcGVyQ2FzZShpZCwgbSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuIHM7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGNhbm9uaWNhbCA9IHNbMF0udG9VcHBlckNhc2UoKSArIHMuc2xpY2UoMSk7XG4gICAgICAgIGlmIChzICE9IGNhbm9uaWNhbCkge1xuICAgICAgICAgIHdhcm4obSArIFwiIHNob3VsZCBiZWdpbiB3aXRoIGFuIHVwcGVyY2FzZSBsZXR0ZXI6ICgnXCIgKyBzICsgXCInIHNob3VsZCBiZSAnXCIgKyBjYW5vbmljYWwgKyBcIicpLlwiKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcztcbiAgICAgIH1cblxuXG4gICAgcGVnJHJlc3VsdCA9IHBlZyRzdGFydFJ1bGVGdW5jdGlvbigpO1xuXG4gICAgaWYgKHBlZyRyZXN1bHQgIT09IHBlZyRGQUlMRUQgJiYgcGVnJGN1cnJQb3MgPT09IGlucHV0Lmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHBlZyRyZXN1bHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChwZWckcmVzdWx0ICE9PSBwZWckRkFJTEVEICYmIHBlZyRjdXJyUG9zIDwgaW5wdXQubGVuZ3RoKSB7XG4gICAgICAgIHBlZyRmYWlsKHsgdHlwZTogXCJlbmRcIiwgZGVzY3JpcHRpb246IFwiZW5kIG9mIGlucHV0XCIgfSk7XG4gICAgICB9XG5cbiAgICAgIHRocm93IHBlZyRidWlsZEV4Y2VwdGlvbihudWxsLCBwZWckbWF4RmFpbEV4cGVjdGVkLCBwZWckbWF4RmFpbFBvcyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBTeW50YXhFcnJvcjogU3ludGF4RXJyb3IsXG4gICAgcGFyc2U6ICAgICAgIHBhcnNlXG4gIH07XG59KSgpOyIsIi8qXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuZXhwb3J0IHR5cGUgT2JqZWN0ID0ge1xuICBbcHJvcDogc3RyaW5nXTogYW55XG59O1xuZXhwb3J0IGZ1bmN0aW9uIGV4dGVuZChkZXN0OiBPYmplY3QsIC4uLnNyY3M6IE9iamVjdFtdKTogT2JqZWN0IHtcbiAgdmFyIGk6IG51bWJlcjtcbiAgdmFyIHNvdXJjZTogYW55O1xuICB2YXIgcHJvcDogc3RyaW5nO1xuXG4gIGlmIChkZXN0ID09PSB1bmRlZmluZWQpIHtcbiAgICBkZXN0ID0ge307XG4gIH1cbiAgZm9yIChpID0gMDsgaSA8IHNyY3MubGVuZ3RoOyBpKyspIHtcbiAgICBzb3VyY2UgPSBzcmNzW2ldO1xuICAgIGZvciAocHJvcCBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChzb3VyY2UuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgICAgZGVzdFtwcm9wXSA9IHNvdXJjZVtwcm9wXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVzdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvcHlBcnJheShhcmc6IEFycmF5TGlrZTxhbnk+KTogYW55W10ge1xuICByZXR1cm4gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJnKTtcbn1cblxudmFyIGJhc2VUeXBlcyA9IFtcbiAgJ251bWJlcicsICdzdHJpbmcnLCAnYm9vbGVhbicsICdhcnJheScsICdmdW5jdGlvbicsICdkYXRlJywgJ3JlZ2V4cCcsXG4gICdhcmd1bWVudHMnLCAndW5kZWZpbmVkJywgJ251bGwnXG5dO1xuXG5mdW5jdGlvbiBpbnRlcm5hbFR5cGUodmFsdWU6IGFueSk6IHN0cmluZyB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpXG4gICAgICAubWF0Y2goL1xcW29iamVjdCAoLiopXFxdLylbMV1cbiAgICAgIC50b0xvd2VyQ2FzZSgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNUeXBlKHZhbHVlOiBhbnksIHR5cGU6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZU9mKHZhbHVlKSA9PT0gdHlwZTtcbn1cblxuLy8gUmV0dXJuIG9uZSBvZiB0aGUgYmFzZVR5cGVzIGFzIGEgc3RyaW5nXG5leHBvcnQgZnVuY3Rpb24gdHlwZU9mKHZhbHVlOiBhbnkpOiBzdHJpbmcge1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiAndW5kZWZpbmVkJztcbiAgfVxuICBpZiAodmFsdWUgPT09IG51bGwpIHtcbiAgICByZXR1cm4gJ251bGwnO1xuICB9XG4gIHZhciB0eXBlID0gaW50ZXJuYWxUeXBlKHZhbHVlKTtcbiAgaWYgKCFhcnJheUluY2x1ZGVzKGJhc2VUeXBlcywgdHlwZSkpIHtcbiAgICB0eXBlID0gdHlwZW9mIHZhbHVlO1xuICB9XG4gIHJldHVybiB0eXBlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNUaGVuYWJsZShvYmo6IGFueSk6IGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZU9mKG9iaikgPT09ICdvYmplY3QnICYmICd0aGVuJyBpbiBvYmogJiZcbiAgICAgIHR5cGVvZiAob2JqLnRoZW4pID09PSAnZnVuY3Rpb24nO1xufVxuXG4vLyBDb252ZXJ0cyBhIHN5bmNocm9ub3VzIGZ1bmN0aW9uIHRvIG9uZSBhbGxvd2luZyBQcm9taXNlc1xuLy8gYXMgYXJndW1lbnRzIGFuZCByZXR1cm5pbmcgYSBQcm9taXNlIHZhbHVlLlxuLy9cbi8vICAgZm4oVSwgViwgLi4uKTogVCA9PiBmbihVIHwgUHJvbWlzZTxVPiwgViB8IFByb21pc2U8Vj4sIC4uLik6IFByb21pc2U8VD5cbmV4cG9ydCBmdW5jdGlvbiBsaWZ0PFQ+KGZuOiAoLi4uYXJnczogYW55W10pID0+IFQpOiAoLi4uYXJnczogYW55W10pID0+XG4gICAgUHJvbWlzZTxUPiB7XG4gIHJldHVybiBmdW5jdGlvbiguLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8VD4ge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChhcmdzKS50aGVuKCh2YWx1ZXM6IGFueVtdKSA9PiB7XG4gICAgICByZXR1cm4gZm4uYXBwbHkodW5kZWZpbmVkLCB2YWx1ZXMpO1xuICAgIH0pO1xuICB9O1xufVxuXG4vLyBDb252ZXJ0cyBhbiBhc3luY2hyb25vdXMgZnVuY3Rpb24gdG8gb25lIGFsbG93aW5nIFByb21pc2VzXG4vLyBhcyBhcmd1bWVudHMuXG4vL1xuLy8gICBmbihVLCBWLCAuLi4pOiBQcm9taXNlPFQ+ID0+IGZuKFUgfCBQcm9taXNlPFU+LCBWIHwgUHJvbWlzZTxWPiwgLi4uKTpcbi8vICAgUHJvbWlzZTxUPlxuZXhwb3J0IGxldCBsaWZ0QXJnczogPFQ+KGZuOiAoLi4uYXJnczogYW55W10pID0+IFByb21pc2U8VD4pID0+XG4gICAgKCguLi5hcmdzOiBhbnlbXSkgPT4gUHJvbWlzZTxUPikgPSA8YW55PmxpZnQ7XG5cbmV4cG9ydCBsZXQgZ2V0UHJvcCA9IGxpZnQoKG9iaiwgcHJvcCkgPT4gb2JqW3Byb3BdKTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZUV4dGVuc2lvbihmaWxlTmFtZTogc3RyaW5nLCBleHRlbnNpb246IHN0cmluZyk6IHN0cmluZyB7XG4gIGlmIChmaWxlTmFtZS5pbmRleE9mKCcuJykgPT09IC0xKSB7XG4gICAgcmV0dXJuIGZpbGVOYW1lICsgJy4nICsgZXh0ZW5zaW9uO1xuICB9XG4gIHJldHVybiBmaWxlTmFtZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcGxhY2VFeHRlbnNpb24oZmlsZU5hbWU6IHN0cmluZywgZXh0ZW5zaW9uOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZmlsZU5hbWUucmVwbGFjZSgvXFwuW15cXC5dKiQvLCAnLicgKyBleHRlbnNpb24pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcHJldHR5SlNPTihvOiBhbnkpOiBzdHJpbmcge1xuICByZXR1cm4gSlNPTi5zdHJpbmdpZnkobywgbnVsbCwgMik7XG59XG5cbmZ1bmN0aW9uIGRlZXBFeHRlbmQodGFyZ2V0OiBPYmplY3QsIHNvdXJjZTogT2JqZWN0KTogdm9pZCB7XG4gIGZvciAodmFyIHByb3AgaW4gc291cmNlKSB7XG4gICAgaWYgKCFzb3VyY2UuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICh0YXJnZXRbcHJvcF0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQcm9wZXJ0eSBvdmVyd3JpdGU6ICcgKyBwcm9wKTtcbiAgICB9XG5cbiAgICBpZiAoaXNUeXBlKHNvdXJjZVtwcm9wXSwgJ29iamVjdCcpKSB7XG4gICAgICB0YXJnZXRbcHJvcF0gPSB7fTtcbiAgICAgIGRlZXBFeHRlbmQodGFyZ2V0W3Byb3BdLCBzb3VyY2VbcHJvcF0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXRbcHJvcF0gPSBzb3VyY2VbcHJvcF07XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWVwTG9va3VwKG86IE9iamVjdCwgcGF0aDogc3RyaW5nW10pOiBPYmplY3R8dW5kZWZpbmVkIHtcbiAgbGV0IHJlc3VsdCA9IG87XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXN1bHQgPSByZXN1bHRbcGF0aFtpXV07XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gTGlrZSBKU09OLnN0cmluZ2lmeSAtIGJ1dCBmb3Igc2luZ2xlLXF1b3RlZCBzdHJpbmdzIGluc3RlYWQgb2YgZG91YmxlLXF1b3RlZFxuLy8gb25lcy4gVGhpcyBqdXN0IG1ha2VzIHRoZSBjb21waWxlZCBydWxlcyBtdWNoIGVhc2llciB0byByZWFkLlxuXG4vLyBRdW90ZSBhbGwgY29udHJvbCBjaGFyYWN0ZXJzLCBzbGFzaCwgc2luZ2xlIHF1b3RlcywgYW5kIG5vbi1hc2NpaSBwcmludGFibGVzLlxudmFyIHF1b3RhYmxlQ2hhcmFjdGVycyA9IC9bXFx1MDAwMC1cXHUwMDFmXFxcXFxcJ1xcdTAwN2YtXFx1ZmZmZl0vZztcbnZhciBzcGVjaWFsUXVvdGVzID0gPHtbYzogc3RyaW5nXTogc3RyaW5nfT57XG4gICdcXCcnOiAnXFxcXFxcJycsXG4gICdcXGInOiAnXFxcXGInLFxuICAnXFx0JzogJ1xcXFx0JyxcbiAgJ1xcbic6ICdcXFxcbicsXG4gICdcXGYnOiAnXFxcXGYnLFxuICAnXFxyJzogJ1xcXFxyJ1xufTtcblxuZXhwb3J0IGZ1bmN0aW9uIHF1b3RlU3RyaW5nKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gIHMgPSBzLnJlcGxhY2UocXVvdGFibGVDaGFyYWN0ZXJzLCBmdW5jdGlvbihjKSB7XG4gICAgaWYgKHNwZWNpYWxRdW90ZXNbY10pIHtcbiAgICAgIHJldHVybiBzcGVjaWFsUXVvdGVzW2NdO1xuICAgIH1cbiAgICByZXR1cm4gJ1xcXFx1JyArICgnMDAwMCcgKyBjLmNoYXJDb2RlQXQoMCkudG9TdHJpbmcoMTYpKS5zbGljZSgtNCk7XG4gIH0pO1xuICByZXR1cm4gJ1xcJycgKyBzICsgJ1xcJyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcnJheUluY2x1ZGVzKGE6IGFueVtdLCBlOiBhbnkpOiBib29sZWFuIHtcbiAgcmV0dXJuIGEuaW5kZXhPZihlKSAhPT0gLTE7XG59XG5cbi8vIExpa2UgUHl0aG9uIGxpc3QuZXh0ZW5kXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kQXJyYXkodGFyZ2V0OiBhbnlbXSwgc3JjOiBhbnlbXSkge1xuICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0YXJnZXQgPSBbXTtcbiAgfVxuICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseSh0YXJnZXQsIHNyYyk7XG4gIHJldHVybiB0YXJnZXQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcih0YXJnZXQ6IGFueSwgc3JjOiBhbnkpIHtcbiAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0YXJnZXQgfHwgc3JjO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlT2JqZWN0UGF0aChvYmo6IE9iamVjdCwgcGFydHM6IHN0cmluZ1tdKTogT2JqZWN0IHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuICAgIHZhciBuYW1lID0gcGFydHNbaV07XG4gICAgaWYgKCEobmFtZSBpbiBvYmopKSB7XG4gICAgICBvYmpbbmFtZV0gPSB7fTtcbiAgICB9XG4gICAgb2JqID0gb2JqW25hbWVdO1xuICB9XG4gIHJldHVybiBvYmo7XG59XG5cbi8vIFJlbW92ZSBhbGwgZW1wdHksICd7fScsICBjaGlsZHJlbiBhbmQgdW5kZWZpbmVkIC0gcmV0dXJucyB0cnVlIGlmZiBvYmogaXNcbi8vIGVtcHR5LlxuZXhwb3J0IGZ1bmN0aW9uIHBydW5lRW1wdHlDaGlsZHJlbihvYmo6IE9iamVjdCk6IGJvb2xlYW4ge1xuICBpZiAob2JqID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICBpZiAob2JqLmNvbnN0cnVjdG9yICE9PSBPYmplY3QpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmFyIGhhc0NoaWxkcmVuID0gZmFsc2U7XG4gIGZvciAodmFyIHByb3AgaW4gb2JqKSB7XG4gICAgaWYgKCFvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAocHJ1bmVFbXB0eUNoaWxkcmVuKG9ialtwcm9wXSkpIHtcbiAgICAgIGRlbGV0ZSBvYmpbcHJvcF07XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0NoaWxkcmVuID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuICFoYXNDaGlsZHJlbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlbGV0ZVByb3BOYW1lKG9iajogT2JqZWN0LCBuYW1lOiBzdHJpbmcpIHtcbiAgaWYgKG9iai5jb25zdHJ1Y3RvciAhPT0gT2JqZWN0KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGZvciAodmFyIHByb3AgaW4gb2JqKSB7XG4gICAgaWYgKCFvYmouaGFzT3duUHJvcGVydHkocHJvcCkpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAocHJvcCA9PT0gbmFtZSkge1xuICAgICAgZGVsZXRlIG9ialtwcm9wXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlUHJvcE5hbWUob2JqW3Byb3BdLCBuYW1lKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdENvbHVtbnMoaW5kZW50OiBudW1iZXIsIGxpbmVzOiBzdHJpbmdbXVtdKTogc3RyaW5nW10ge1xuICBsZXQgcmVzdWx0OiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgY29sdW1uU2l6ZSA9IDxudW1iZXJbXT5bXTtcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICBmb3IgKGxldCBqID0gMDsgaiA8IGxpbmUubGVuZ3RoOyBqKyspIHtcbiAgICAgIGlmIChjb2x1bW5TaXplW2pdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29sdW1uU2l6ZVtqXSA9IDA7XG4gICAgICB9XG4gICAgICBjb2x1bW5TaXplW2pdID0gTWF0aC5tYXgoY29sdW1uU2l6ZVtqXSwgbGluZVtqXS5sZW5ndGgpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBwcmVmaXggPSByZXBlYXRTdHJpbmcoJyAnLCBpbmRlbnQpO1xuICB2YXIgczogc3RyaW5nO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IGxpbmUgPSBsaW5lc1tpXTtcbiAgICBsZXQgc2VwID0gJyc7XG4gICAgcyA9ICcnO1xuICAgIGZvciAobGV0IGogPSAwOyBqIDwgbGluZS5sZW5ndGg7IGorKykge1xuICAgICAgaWYgKGogPT09IDApIHtcbiAgICAgICAgcyA9IHByZWZpeDtcbiAgICAgIH1cbiAgICAgIGlmIChqID09PSBsaW5lLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgcyArPSBzZXAgKyBsaW5lW2pdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcyArPSBzZXAgKyBmaWxsU3RyaW5nKGxpbmVbal0sIGNvbHVtblNpemVbal0pO1xuICAgICAgfVxuICAgICAgc2VwID0gJyAgJztcbiAgICB9XG4gICAgcmVzdWx0LnB1c2gocyk7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiByZXBlYXRTdHJpbmcoczogc3RyaW5nLCBuOiBudW1iZXIpOiBzdHJpbmcge1xuICByZXR1cm4gbmV3IEFycmF5KG4gKyAxKS5qb2luKHMpO1xufVxuXG5mdW5jdGlvbiBmaWxsU3RyaW5nKHM6IHN0cmluZywgbjogbnVtYmVyKTogc3RyaW5nIHtcbiAgbGV0IHBhZGRpbmcgPSBuIC0gcy5sZW5ndGg7XG4gIGlmIChwYWRkaW5nID4gMCkge1xuICAgIHMgKz0gcmVwZWF0U3RyaW5nKCcgJywgcGFkZGluZyk7XG4gIH1cbiAgcmV0dXJuIHM7XG59XG4iLCIvKiFcbiAqIEBvdmVydmlldyBlczYtcHJvbWlzZSAtIGEgdGlueSBpbXBsZW1lbnRhdGlvbiBvZiBQcm9taXNlcy9BKy5cbiAqIEBjb3B5cmlnaHQgQ29weXJpZ2h0IChjKSAyMDE0IFllaHVkYSBLYXR6LCBUb20gRGFsZSwgU3RlZmFuIFBlbm5lciBhbmQgY29udHJpYnV0b3JzIChDb252ZXJzaW9uIHRvIEVTNiBBUEkgYnkgSmFrZSBBcmNoaWJhbGQpXG4gKiBAbGljZW5zZSAgIExpY2Vuc2VkIHVuZGVyIE1JVCBsaWNlbnNlXG4gKiAgICAgICAgICAgIFNlZSBodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vc3RlZmFucGVubmVyL2VzNi1wcm9taXNlL21hc3Rlci9MSUNFTlNFXG4gKiBAdmVyc2lvbiAgIDMuMy4xXG4gKi9cblxuKGZ1bmN0aW9uIChnbG9iYWwsIGZhY3RvcnkpIHtcbiAgICB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG1vZHVsZSAhPT0gJ3VuZGVmaW5lZCcgPyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKSA6XG4gICAgdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lKGZhY3RvcnkpIDpcbiAgICAoZ2xvYmFsLkVTNlByb21pc2UgPSBmYWN0b3J5KCkpO1xufSh0aGlzLCAoZnVuY3Rpb24gKCkgeyAndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG9iamVjdE9yRnVuY3Rpb24oeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbicgfHwgdHlwZW9mIHggPT09ICdvYmplY3QnICYmIHggIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oeCkge1xuICByZXR1cm4gdHlwZW9mIHggPT09ICdmdW5jdGlvbic7XG59XG5cbnZhciBfaXNBcnJheSA9IHVuZGVmaW5lZDtcbmlmICghQXJyYXkuaXNBcnJheSkge1xuICBfaXNBcnJheSA9IGZ1bmN0aW9uICh4KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh4KSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbiAgfTtcbn0gZWxzZSB7XG4gIF9pc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcbn1cblxudmFyIGlzQXJyYXkgPSBfaXNBcnJheTtcblxudmFyIGxlbiA9IDA7XG52YXIgdmVydHhOZXh0ID0gdW5kZWZpbmVkO1xudmFyIGN1c3RvbVNjaGVkdWxlckZuID0gdW5kZWZpbmVkO1xuXG52YXIgYXNhcCA9IGZ1bmN0aW9uIGFzYXAoY2FsbGJhY2ssIGFyZykge1xuICBxdWV1ZVtsZW5dID0gY2FsbGJhY2s7XG4gIHF1ZXVlW2xlbiArIDFdID0gYXJnO1xuICBsZW4gKz0gMjtcbiAgaWYgKGxlbiA9PT0gMikge1xuICAgIC8vIElmIGxlbiBpcyAyLCB0aGF0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byBzY2hlZHVsZSBhbiBhc3luYyBmbHVzaC5cbiAgICAvLyBJZiBhZGRpdGlvbmFsIGNhbGxiYWNrcyBhcmUgcXVldWVkIGJlZm9yZSB0aGUgcXVldWUgaXMgZmx1c2hlZCwgdGhleVxuICAgIC8vIHdpbGwgYmUgcHJvY2Vzc2VkIGJ5IHRoaXMgZmx1c2ggdGhhdCB3ZSBhcmUgc2NoZWR1bGluZy5cbiAgICBpZiAoY3VzdG9tU2NoZWR1bGVyRm4pIHtcbiAgICAgIGN1c3RvbVNjaGVkdWxlckZuKGZsdXNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2NoZWR1bGVGbHVzaCgpO1xuICAgIH1cbiAgfVxufTtcblxuZnVuY3Rpb24gc2V0U2NoZWR1bGVyKHNjaGVkdWxlRm4pIHtcbiAgY3VzdG9tU2NoZWR1bGVyRm4gPSBzY2hlZHVsZUZuO1xufVxuXG5mdW5jdGlvbiBzZXRBc2FwKGFzYXBGbikge1xuICBhc2FwID0gYXNhcEZuO1xufVxuXG52YXIgYnJvd3NlcldpbmRvdyA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdW5kZWZpbmVkO1xudmFyIGJyb3dzZXJHbG9iYWwgPSBicm93c2VyV2luZG93IHx8IHt9O1xudmFyIEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyID0gYnJvd3Nlckdsb2JhbC5NdXRhdGlvbk9ic2VydmVyIHx8IGJyb3dzZXJHbG9iYWwuV2ViS2l0TXV0YXRpb25PYnNlcnZlcjtcbnZhciBpc05vZGUgPSB0eXBlb2Ygc2VsZiA9PT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHByb2Nlc3MgIT09ICd1bmRlZmluZWQnICYmICh7fSkudG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXG4vLyB0ZXN0IGZvciB3ZWIgd29ya2VyIGJ1dCBub3QgaW4gSUUxMFxudmFyIGlzV29ya2VyID0gdHlwZW9mIFVpbnQ4Q2xhbXBlZEFycmF5ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgaW1wb3J0U2NyaXB0cyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIE1lc3NhZ2VDaGFubmVsICE9PSAndW5kZWZpbmVkJztcblxuLy8gbm9kZVxuZnVuY3Rpb24gdXNlTmV4dFRpY2soKSB7XG4gIC8vIG5vZGUgdmVyc2lvbiAwLjEwLnggZGlzcGxheXMgYSBkZXByZWNhdGlvbiB3YXJuaW5nIHdoZW4gbmV4dFRpY2sgaXMgdXNlZCByZWN1cnNpdmVseVxuICAvLyBzZWUgaHR0cHM6Ly9naXRodWIuY29tL2N1am9qcy93aGVuL2lzc3Vlcy80MTAgZm9yIGRldGFpbHNcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gIH07XG59XG5cbi8vIHZlcnR4XG5mdW5jdGlvbiB1c2VWZXJ0eFRpbWVyKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZlcnR4TmV4dChmbHVzaCk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVzZU11dGF0aW9uT2JzZXJ2ZXIoKSB7XG4gIHZhciBpdGVyYXRpb25zID0gMDtcbiAgdmFyIG9ic2VydmVyID0gbmV3IEJyb3dzZXJNdXRhdGlvbk9ic2VydmVyKGZsdXNoKTtcbiAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG4gIG9ic2VydmVyLm9ic2VydmUobm9kZSwgeyBjaGFyYWN0ZXJEYXRhOiB0cnVlIH0pO1xuXG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgbm9kZS5kYXRhID0gaXRlcmF0aW9ucyA9ICsraXRlcmF0aW9ucyAlIDI7XG4gIH07XG59XG5cbi8vIHdlYiB3b3JrZXJcbmZ1bmN0aW9uIHVzZU1lc3NhZ2VDaGFubmVsKCkge1xuICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZsdXNoO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBjaGFubmVsLnBvcnQyLnBvc3RNZXNzYWdlKDApO1xuICB9O1xufVxuXG5mdW5jdGlvbiB1c2VTZXRUaW1lb3V0KCkge1xuICAvLyBTdG9yZSBzZXRUaW1lb3V0IHJlZmVyZW5jZSBzbyBlczYtcHJvbWlzZSB3aWxsIGJlIHVuYWZmZWN0ZWQgYnlcbiAgLy8gb3RoZXIgY29kZSBtb2RpZnlpbmcgc2V0VGltZW91dCAobGlrZSBzaW5vbi51c2VGYWtlVGltZXJzKCkpXG4gIHZhciBnbG9iYWxTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gZ2xvYmFsU2V0VGltZW91dChmbHVzaCwgMSk7XG4gIH07XG59XG5cbnZhciBxdWV1ZSA9IG5ldyBBcnJheSgxMDAwKTtcbmZ1bmN0aW9uIGZsdXNoKCkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgdmFyIGNhbGxiYWNrID0gcXVldWVbaV07XG4gICAgdmFyIGFyZyA9IHF1ZXVlW2kgKyAxXTtcblxuICAgIGNhbGxiYWNrKGFyZyk7XG5cbiAgICBxdWV1ZVtpXSA9IHVuZGVmaW5lZDtcbiAgICBxdWV1ZVtpICsgMV0gPSB1bmRlZmluZWQ7XG4gIH1cblxuICBsZW4gPSAwO1xufVxuXG5mdW5jdGlvbiBhdHRlbXB0VmVydHgoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHIgPSByZXF1aXJlO1xuICAgIHZhciB2ZXJ0eCA9IHIoJ3ZlcnR4Jyk7XG4gICAgdmVydHhOZXh0ID0gdmVydHgucnVuT25Mb29wIHx8IHZlcnR4LnJ1bk9uQ29udGV4dDtcbiAgICByZXR1cm4gdXNlVmVydHhUaW1lcigpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIHVzZVNldFRpbWVvdXQoKTtcbiAgfVxufVxuXG52YXIgc2NoZWR1bGVGbHVzaCA9IHVuZGVmaW5lZDtcbi8vIERlY2lkZSB3aGF0IGFzeW5jIG1ldGhvZCB0byB1c2UgdG8gdHJpZ2dlcmluZyBwcm9jZXNzaW5nIG9mIHF1ZXVlZCBjYWxsYmFja3M6XG5pZiAoaXNOb2RlKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VOZXh0VGljaygpO1xufSBlbHNlIGlmIChCcm93c2VyTXV0YXRpb25PYnNlcnZlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTXV0YXRpb25PYnNlcnZlcigpO1xufSBlbHNlIGlmIChpc1dvcmtlcikge1xuICBzY2hlZHVsZUZsdXNoID0gdXNlTWVzc2FnZUNoYW5uZWwoKTtcbn0gZWxzZSBpZiAoYnJvd3NlcldpbmRvdyA9PT0gdW5kZWZpbmVkICYmIHR5cGVvZiByZXF1aXJlID09PSAnZnVuY3Rpb24nKSB7XG4gIHNjaGVkdWxlRmx1c2ggPSBhdHRlbXB0VmVydHgoKTtcbn0gZWxzZSB7XG4gIHNjaGVkdWxlRmx1c2ggPSB1c2VTZXRUaW1lb3V0KCk7XG59XG5cbmZ1bmN0aW9uIHRoZW4ob25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIF9hcmd1bWVudHMgPSBhcmd1bWVudHM7XG5cbiAgdmFyIHBhcmVudCA9IHRoaXM7XG5cbiAgdmFyIGNoaWxkID0gbmV3IHRoaXMuY29uc3RydWN0b3Iobm9vcCk7XG5cbiAgaWYgKGNoaWxkW1BST01JU0VfSURdID09PSB1bmRlZmluZWQpIHtcbiAgICBtYWtlUHJvbWlzZShjaGlsZCk7XG4gIH1cblxuICB2YXIgX3N0YXRlID0gcGFyZW50Ll9zdGF0ZTtcblxuICBpZiAoX3N0YXRlKSB7XG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBjYWxsYmFjayA9IF9hcmd1bWVudHNbX3N0YXRlIC0gMV07XG4gICAgICBhc2FwKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGludm9rZUNhbGxiYWNrKF9zdGF0ZSwgY2hpbGQsIGNhbGxiYWNrLCBwYXJlbnQuX3Jlc3VsdCk7XG4gICAgICB9KTtcbiAgICB9KSgpO1xuICB9IGVsc2Uge1xuICAgIHN1YnNjcmliZShwYXJlbnQsIGNoaWxkLCBvbkZ1bGZpbGxtZW50LCBvblJlamVjdGlvbik7XG4gIH1cblxuICByZXR1cm4gY2hpbGQ7XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZXNvbHZlYCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgYmVjb21lIHJlc29sdmVkIHdpdGggdGhlXG4gIHBhc3NlZCBgdmFsdWVgLiBJdCBpcyBzaG9ydGhhbmQgZm9yIHRoZSBmb2xsb3dpbmc6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgcmVzb2x2ZSgxKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgSW5zdGVhZCBvZiB3cml0aW5nIHRoZSBhYm92ZSwgeW91ciBjb2RlIG5vdyBzaW1wbHkgYmVjb21lcyB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoMSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyB2YWx1ZSA9PT0gMVxuICB9KTtcbiAgYGBgXG5cbiAgQG1ldGhvZCByZXNvbHZlXG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHZhbHVlIHZhbHVlIHRoYXQgdGhlIHJldHVybmVkIHByb21pc2Ugd2lsbCBiZSByZXNvbHZlZCB3aXRoXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHRoYXQgd2lsbCBiZWNvbWUgZnVsZmlsbGVkIHdpdGggdGhlIGdpdmVuXG4gIGB2YWx1ZWBcbiovXG5mdW5jdGlvbiByZXNvbHZlKG9iamVjdCkge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuXG4gIGlmIChvYmplY3QgJiYgdHlwZW9mIG9iamVjdCA9PT0gJ29iamVjdCcgJiYgb2JqZWN0LmNvbnN0cnVjdG9yID09PSBDb25zdHJ1Y3Rvcikge1xuICAgIHJldHVybiBvYmplY3Q7XG4gIH1cblxuICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcbiAgX3Jlc29sdmUocHJvbWlzZSwgb2JqZWN0KTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbnZhciBQUk9NSVNFX0lEID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDE2KTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnZhciBQRU5ESU5HID0gdm9pZCAwO1xudmFyIEZVTEZJTExFRCA9IDE7XG52YXIgUkVKRUNURUQgPSAyO1xuXG52YXIgR0VUX1RIRU5fRVJST1IgPSBuZXcgRXJyb3JPYmplY3QoKTtcblxuZnVuY3Rpb24gc2VsZkZ1bGZpbGxtZW50KCkge1xuICByZXR1cm4gbmV3IFR5cGVFcnJvcihcIllvdSBjYW5ub3QgcmVzb2x2ZSBhIHByb21pc2Ugd2l0aCBpdHNlbGZcIik7XG59XG5cbmZ1bmN0aW9uIGNhbm5vdFJldHVybk93bigpIHtcbiAgcmV0dXJuIG5ldyBUeXBlRXJyb3IoJ0EgcHJvbWlzZXMgY2FsbGJhY2sgY2Fubm90IHJldHVybiB0aGF0IHNhbWUgcHJvbWlzZS4nKTtcbn1cblxuZnVuY3Rpb24gZ2V0VGhlbihwcm9taXNlKSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHByb21pc2UudGhlbjtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBHRVRfVEhFTl9FUlJPUi5lcnJvciA9IGVycm9yO1xuICAgIHJldHVybiBHRVRfVEhFTl9FUlJPUjtcbiAgfVxufVxuXG5mdW5jdGlvbiB0cnlUaGVuKHRoZW4sIHZhbHVlLCBmdWxmaWxsbWVudEhhbmRsZXIsIHJlamVjdGlvbkhhbmRsZXIpIHtcbiAgdHJ5IHtcbiAgICB0aGVuLmNhbGwodmFsdWUsIGZ1bGZpbGxtZW50SGFuZGxlciwgcmVqZWN0aW9uSGFuZGxlcik7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUsIHRoZW4pIHtcbiAgYXNhcChmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgIHZhciBzZWFsZWQgPSBmYWxzZTtcbiAgICB2YXIgZXJyb3IgPSB0cnlUaGVuKHRoZW4sIHRoZW5hYmxlLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIGlmIChzZWFsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgc2VhbGVkID0gdHJ1ZTtcbiAgICAgIGlmICh0aGVuYWJsZSAhPT0gdmFsdWUpIHtcbiAgICAgICAgX3Jlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gICAgICB9XG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgaWYgKHNlYWxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuXG4gICAgICBfcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSwgJ1NldHRsZTogJyArIChwcm9taXNlLl9sYWJlbCB8fCAnIHVua25vd24gcHJvbWlzZScpKTtcblxuICAgIGlmICghc2VhbGVkICYmIGVycm9yKSB7XG4gICAgICBzZWFsZWQgPSB0cnVlO1xuICAgICAgX3JlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgfVxuICB9LCBwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gaGFuZGxlT3duVGhlbmFibGUocHJvbWlzZSwgdGhlbmFibGUpIHtcbiAgaWYgKHRoZW5hYmxlLl9zdGF0ZSA9PT0gRlVMRklMTEVEKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgfSBlbHNlIGlmICh0aGVuYWJsZS5fc3RhdGUgPT09IFJFSkVDVEVEKSB7XG4gICAgX3JlamVjdChwcm9taXNlLCB0aGVuYWJsZS5fcmVzdWx0KTtcbiAgfSBlbHNlIHtcbiAgICBzdWJzY3JpYmUodGhlbmFibGUsIHVuZGVmaW5lZCwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICByZXR1cm4gX3Jlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHJldHVybiBfcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBtYXliZVRoZW5hYmxlLCB0aGVuJCQpIHtcbiAgaWYgKG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IgPT09IHByb21pc2UuY29uc3RydWN0b3IgJiYgdGhlbiQkID09PSB0aGVuICYmIG1heWJlVGhlbmFibGUuY29uc3RydWN0b3IucmVzb2x2ZSA9PT0gcmVzb2x2ZSkge1xuICAgIGhhbmRsZU93blRoZW5hYmxlKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0aGVuJCQgPT09IEdFVF9USEVOX0VSUk9SKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIEdFVF9USEVOX0VSUk9SLmVycm9yKTtcbiAgICB9IGVsc2UgaWYgKHRoZW4kJCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBmdWxmaWxsKHByb21pc2UsIG1heWJlVGhlbmFibGUpO1xuICAgIH0gZWxzZSBpZiAoaXNGdW5jdGlvbih0aGVuJCQpKSB7XG4gICAgICBoYW5kbGVGb3JlaWduVGhlbmFibGUocHJvbWlzZSwgbWF5YmVUaGVuYWJsZSwgdGhlbiQkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnVsZmlsbChwcm9taXNlLCBtYXliZVRoZW5hYmxlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gX3Jlc29sdmUocHJvbWlzZSwgdmFsdWUpIHtcbiAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgX3JlamVjdChwcm9taXNlLCBzZWxmRnVsZmlsbG1lbnQoKSk7XG4gIH0gZWxzZSBpZiAob2JqZWN0T3JGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICBoYW5kbGVNYXliZVRoZW5hYmxlKHByb21pc2UsIHZhbHVlLCBnZXRUaGVuKHZhbHVlKSk7XG4gIH0gZWxzZSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB2YWx1ZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVibGlzaFJlamVjdGlvbihwcm9taXNlKSB7XG4gIGlmIChwcm9taXNlLl9vbmVycm9yKSB7XG4gICAgcHJvbWlzZS5fb25lcnJvcihwcm9taXNlLl9yZXN1bHQpO1xuICB9XG5cbiAgcHVibGlzaChwcm9taXNlKTtcbn1cblxuZnVuY3Rpb24gZnVsZmlsbChwcm9taXNlLCB2YWx1ZSkge1xuICBpZiAocHJvbWlzZS5fc3RhdGUgIT09IFBFTkRJTkcpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBwcm9taXNlLl9yZXN1bHQgPSB2YWx1ZTtcbiAgcHJvbWlzZS5fc3RhdGUgPSBGVUxGSUxMRUQ7XG5cbiAgaWYgKHByb21pc2UuX3N1YnNjcmliZXJzLmxlbmd0aCAhPT0gMCkge1xuICAgIGFzYXAocHVibGlzaCwgcHJvbWlzZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gX3JlamVjdChwcm9taXNlLCByZWFzb24pIHtcbiAgaWYgKHByb21pc2UuX3N0YXRlICE9PSBQRU5ESU5HKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHByb21pc2UuX3N0YXRlID0gUkVKRUNURUQ7XG4gIHByb21pc2UuX3Jlc3VsdCA9IHJlYXNvbjtcblxuICBhc2FwKHB1Ymxpc2hSZWplY3Rpb24sIHByb21pc2UpO1xufVxuXG5mdW5jdGlvbiBzdWJzY3JpYmUocGFyZW50LCBjaGlsZCwgb25GdWxmaWxsbWVudCwgb25SZWplY3Rpb24pIHtcbiAgdmFyIF9zdWJzY3JpYmVycyA9IHBhcmVudC5fc3Vic2NyaWJlcnM7XG4gIHZhciBsZW5ndGggPSBfc3Vic2NyaWJlcnMubGVuZ3RoO1xuXG4gIHBhcmVudC5fb25lcnJvciA9IG51bGw7XG5cbiAgX3N1YnNjcmliZXJzW2xlbmd0aF0gPSBjaGlsZDtcbiAgX3N1YnNjcmliZXJzW2xlbmd0aCArIEZVTEZJTExFRF0gPSBvbkZ1bGZpbGxtZW50O1xuICBfc3Vic2NyaWJlcnNbbGVuZ3RoICsgUkVKRUNURURdID0gb25SZWplY3Rpb247XG5cbiAgaWYgKGxlbmd0aCA9PT0gMCAmJiBwYXJlbnQuX3N0YXRlKSB7XG4gICAgYXNhcChwdWJsaXNoLCBwYXJlbnQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHB1Ymxpc2gocHJvbWlzZSkge1xuICB2YXIgc3Vic2NyaWJlcnMgPSBwcm9taXNlLl9zdWJzY3JpYmVycztcbiAgdmFyIHNldHRsZWQgPSBwcm9taXNlLl9zdGF0ZTtcblxuICBpZiAoc3Vic2NyaWJlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGNoaWxkID0gdW5kZWZpbmVkLFxuICAgICAgY2FsbGJhY2sgPSB1bmRlZmluZWQsXG4gICAgICBkZXRhaWwgPSBwcm9taXNlLl9yZXN1bHQ7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdWJzY3JpYmVycy5sZW5ndGg7IGkgKz0gMykge1xuICAgIGNoaWxkID0gc3Vic2NyaWJlcnNbaV07XG4gICAgY2FsbGJhY2sgPSBzdWJzY3JpYmVyc1tpICsgc2V0dGxlZF07XG5cbiAgICBpZiAoY2hpbGQpIHtcbiAgICAgIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIGNoaWxkLCBjYWxsYmFjaywgZGV0YWlsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2soZGV0YWlsKTtcbiAgICB9XG4gIH1cblxuICBwcm9taXNlLl9zdWJzY3JpYmVycy5sZW5ndGggPSAwO1xufVxuXG5mdW5jdGlvbiBFcnJvck9iamVjdCgpIHtcbiAgdGhpcy5lcnJvciA9IG51bGw7XG59XG5cbnZhciBUUllfQ0FUQ0hfRVJST1IgPSBuZXcgRXJyb3JPYmplY3QoKTtcblxuZnVuY3Rpb24gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCkge1xuICB0cnkge1xuICAgIHJldHVybiBjYWxsYmFjayhkZXRhaWwpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgVFJZX0NBVENIX0VSUk9SLmVycm9yID0gZTtcbiAgICByZXR1cm4gVFJZX0NBVENIX0VSUk9SO1xuICB9XG59XG5cbmZ1bmN0aW9uIGludm9rZUNhbGxiYWNrKHNldHRsZWQsIHByb21pc2UsIGNhbGxiYWNrLCBkZXRhaWwpIHtcbiAgdmFyIGhhc0NhbGxiYWNrID0gaXNGdW5jdGlvbihjYWxsYmFjayksXG4gICAgICB2YWx1ZSA9IHVuZGVmaW5lZCxcbiAgICAgIGVycm9yID0gdW5kZWZpbmVkLFxuICAgICAgc3VjY2VlZGVkID0gdW5kZWZpbmVkLFxuICAgICAgZmFpbGVkID0gdW5kZWZpbmVkO1xuXG4gIGlmIChoYXNDYWxsYmFjaykge1xuICAgIHZhbHVlID0gdHJ5Q2F0Y2goY2FsbGJhY2ssIGRldGFpbCk7XG5cbiAgICBpZiAodmFsdWUgPT09IFRSWV9DQVRDSF9FUlJPUikge1xuICAgICAgZmFpbGVkID0gdHJ1ZTtcbiAgICAgIGVycm9yID0gdmFsdWUuZXJyb3I7XG4gICAgICB2YWx1ZSA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN1Y2NlZWRlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgaWYgKHByb21pc2UgPT09IHZhbHVlKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIGNhbm5vdFJldHVybk93bigpKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFsdWUgPSBkZXRhaWw7XG4gICAgc3VjY2VlZGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGlmIChwcm9taXNlLl9zdGF0ZSAhPT0gUEVORElORykge1xuICAgIC8vIG5vb3BcbiAgfSBlbHNlIGlmIChoYXNDYWxsYmFjayAmJiBzdWNjZWVkZWQpIHtcbiAgICAgIF9yZXNvbHZlKHByb21pc2UsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKGZhaWxlZCkge1xuICAgICAgX3JlamVjdChwcm9taXNlLCBlcnJvcik7XG4gICAgfSBlbHNlIGlmIChzZXR0bGVkID09PSBGVUxGSUxMRUQpIHtcbiAgICAgIGZ1bGZpbGwocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0gZWxzZSBpZiAoc2V0dGxlZCA9PT0gUkVKRUNURUQpIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gaW5pdGlhbGl6ZVByb21pc2UocHJvbWlzZSwgcmVzb2x2ZXIpIHtcbiAgdHJ5IHtcbiAgICByZXNvbHZlcihmdW5jdGlvbiByZXNvbHZlUHJvbWlzZSh2YWx1ZSkge1xuICAgICAgX3Jlc29sdmUocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0sIGZ1bmN0aW9uIHJlamVjdFByb21pc2UocmVhc29uKSB7XG4gICAgICBfcmVqZWN0KHByb21pc2UsIHJlYXNvbik7XG4gICAgfSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBfcmVqZWN0KHByb21pc2UsIGUpO1xuICB9XG59XG5cbnZhciBpZCA9IDA7XG5mdW5jdGlvbiBuZXh0SWQoKSB7XG4gIHJldHVybiBpZCsrO1xufVxuXG5mdW5jdGlvbiBtYWtlUHJvbWlzZShwcm9taXNlKSB7XG4gIHByb21pc2VbUFJPTUlTRV9JRF0gPSBpZCsrO1xuICBwcm9taXNlLl9zdGF0ZSA9IHVuZGVmaW5lZDtcbiAgcHJvbWlzZS5fcmVzdWx0ID0gdW5kZWZpbmVkO1xuICBwcm9taXNlLl9zdWJzY3JpYmVycyA9IFtdO1xufVxuXG5mdW5jdGlvbiBFbnVtZXJhdG9yKENvbnN0cnVjdG9yLCBpbnB1dCkge1xuICB0aGlzLl9pbnN0YW5jZUNvbnN0cnVjdG9yID0gQ29uc3RydWN0b3I7XG4gIHRoaXMucHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcblxuICBpZiAoIXRoaXMucHJvbWlzZVtQUk9NSVNFX0lEXSkge1xuICAgIG1ha2VQcm9taXNlKHRoaXMucHJvbWlzZSk7XG4gIH1cblxuICBpZiAoaXNBcnJheShpbnB1dCkpIHtcbiAgICB0aGlzLl9pbnB1dCA9IGlucHV0O1xuICAgIHRoaXMubGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuICAgIHRoaXMuX3JlbWFpbmluZyA9IGlucHV0Lmxlbmd0aDtcblxuICAgIHRoaXMuX3Jlc3VsdCA9IG5ldyBBcnJheSh0aGlzLmxlbmd0aCk7XG5cbiAgICBpZiAodGhpcy5sZW5ndGggPT09IDApIHtcbiAgICAgIGZ1bGZpbGwodGhpcy5wcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxlbmd0aCA9IHRoaXMubGVuZ3RoIHx8IDA7XG4gICAgICB0aGlzLl9lbnVtZXJhdGUoKTtcbiAgICAgIGlmICh0aGlzLl9yZW1haW5pbmcgPT09IDApIHtcbiAgICAgICAgZnVsZmlsbCh0aGlzLnByb21pc2UsIHRoaXMuX3Jlc3VsdCk7XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIF9yZWplY3QodGhpcy5wcm9taXNlLCB2YWxpZGF0aW9uRXJyb3IoKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdmFsaWRhdGlvbkVycm9yKCkge1xuICByZXR1cm4gbmV3IEVycm9yKCdBcnJheSBNZXRob2RzIG11c3QgYmUgcHJvdmlkZWQgYW4gQXJyYXknKTtcbn07XG5cbkVudW1lcmF0b3IucHJvdG90eXBlLl9lbnVtZXJhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aDtcbiAgdmFyIF9pbnB1dCA9IHRoaXMuX2lucHV0O1xuXG4gIGZvciAodmFyIGkgPSAwOyB0aGlzLl9zdGF0ZSA9PT0gUEVORElORyAmJiBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICB0aGlzLl9lYWNoRW50cnkoX2lucHV0W2ldLCBpKTtcbiAgfVxufTtcblxuRW51bWVyYXRvci5wcm90b3R5cGUuX2VhY2hFbnRyeSA9IGZ1bmN0aW9uIChlbnRyeSwgaSkge1xuICB2YXIgYyA9IHRoaXMuX2luc3RhbmNlQ29uc3RydWN0b3I7XG4gIHZhciByZXNvbHZlJCQgPSBjLnJlc29sdmU7XG5cbiAgaWYgKHJlc29sdmUkJCA9PT0gcmVzb2x2ZSkge1xuICAgIHZhciBfdGhlbiA9IGdldFRoZW4oZW50cnkpO1xuXG4gICAgaWYgKF90aGVuID09PSB0aGVuICYmIGVudHJ5Ll9zdGF0ZSAhPT0gUEVORElORykge1xuICAgICAgdGhpcy5fc2V0dGxlZEF0KGVudHJ5Ll9zdGF0ZSwgaSwgZW50cnkuX3Jlc3VsdCk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgX3RoZW4gIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHRoaXMuX3JlbWFpbmluZy0tO1xuICAgICAgdGhpcy5fcmVzdWx0W2ldID0gZW50cnk7XG4gICAgfSBlbHNlIGlmIChjID09PSBQcm9taXNlKSB7XG4gICAgICB2YXIgcHJvbWlzZSA9IG5ldyBjKG5vb3ApO1xuICAgICAgaGFuZGxlTWF5YmVUaGVuYWJsZShwcm9taXNlLCBlbnRyeSwgX3RoZW4pO1xuICAgICAgdGhpcy5fd2lsbFNldHRsZUF0KHByb21pc2UsIGkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl93aWxsU2V0dGxlQXQobmV3IGMoZnVuY3Rpb24gKHJlc29sdmUkJCkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZSQkKGVudHJ5KTtcbiAgICAgIH0pLCBpKTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5fd2lsbFNldHRsZUF0KHJlc29sdmUkJChlbnRyeSksIGkpO1xuICB9XG59O1xuXG5FbnVtZXJhdG9yLnByb3RvdHlwZS5fc2V0dGxlZEF0ID0gZnVuY3Rpb24gKHN0YXRlLCBpLCB2YWx1ZSkge1xuICB2YXIgcHJvbWlzZSA9IHRoaXMucHJvbWlzZTtcblxuICBpZiAocHJvbWlzZS5fc3RhdGUgPT09IFBFTkRJTkcpIHtcbiAgICB0aGlzLl9yZW1haW5pbmctLTtcblxuICAgIGlmIChzdGF0ZSA9PT0gUkVKRUNURUQpIHtcbiAgICAgIF9yZWplY3QocHJvbWlzZSwgdmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9yZXN1bHRbaV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBpZiAodGhpcy5fcmVtYWluaW5nID09PSAwKSB7XG4gICAgZnVsZmlsbChwcm9taXNlLCB0aGlzLl9yZXN1bHQpO1xuICB9XG59O1xuXG5FbnVtZXJhdG9yLnByb3RvdHlwZS5fd2lsbFNldHRsZUF0ID0gZnVuY3Rpb24gKHByb21pc2UsIGkpIHtcbiAgdmFyIGVudW1lcmF0b3IgPSB0aGlzO1xuXG4gIHN1YnNjcmliZShwcm9taXNlLCB1bmRlZmluZWQsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHJldHVybiBlbnVtZXJhdG9yLl9zZXR0bGVkQXQoRlVMRklMTEVELCBpLCB2YWx1ZSk7XG4gIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICByZXR1cm4gZW51bWVyYXRvci5fc2V0dGxlZEF0KFJFSkVDVEVELCBpLCByZWFzb24pO1xuICB9KTtcbn07XG5cbi8qKlxuICBgUHJvbWlzZS5hbGxgIGFjY2VwdHMgYW4gYXJyYXkgb2YgcHJvbWlzZXMsIGFuZCByZXR1cm5zIGEgbmV3IHByb21pc2Ugd2hpY2hcbiAgaXMgZnVsZmlsbGVkIHdpdGggYW4gYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzIGZvciB0aGUgcGFzc2VkIHByb21pc2VzLCBvclxuICByZWplY3RlZCB3aXRoIHRoZSByZWFzb24gb2YgdGhlIGZpcnN0IHBhc3NlZCBwcm9taXNlIHRvIGJlIHJlamVjdGVkLiBJdCBjYXN0cyBhbGxcbiAgZWxlbWVudHMgb2YgdGhlIHBhc3NlZCBpdGVyYWJsZSB0byBwcm9taXNlcyBhcyBpdCBydW5zIHRoaXMgYWxnb3JpdGhtLlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZXNvbHZlKDIpO1xuICBsZXQgcHJvbWlzZTMgPSByZXNvbHZlKDMpO1xuICBsZXQgcHJvbWlzZXMgPSBbIHByb21pc2UxLCBwcm9taXNlMiwgcHJvbWlzZTMgXTtcblxuICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbihhcnJheSl7XG4gICAgLy8gVGhlIGFycmF5IGhlcmUgd291bGQgYmUgWyAxLCAyLCAzIF07XG4gIH0pO1xuICBgYGBcblxuICBJZiBhbnkgb2YgdGhlIGBwcm9taXNlc2AgZ2l2ZW4gdG8gYGFsbGAgYXJlIHJlamVjdGVkLCB0aGUgZmlyc3QgcHJvbWlzZVxuICB0aGF0IGlzIHJlamVjdGVkIHdpbGwgYmUgZ2l2ZW4gYXMgYW4gYXJndW1lbnQgdG8gdGhlIHJldHVybmVkIHByb21pc2VzJ3NcbiAgcmVqZWN0aW9uIGhhbmRsZXIuIEZvciBleGFtcGxlOlxuXG4gIEV4YW1wbGU6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBsZXQgcHJvbWlzZTEgPSByZXNvbHZlKDEpO1xuICBsZXQgcHJvbWlzZTIgPSByZWplY3QobmV3IEVycm9yKFwiMlwiKSk7XG4gIGxldCBwcm9taXNlMyA9IHJlamVjdChuZXcgRXJyb3IoXCIzXCIpKTtcbiAgbGV0IHByb21pc2VzID0gWyBwcm9taXNlMSwgcHJvbWlzZTIsIHByb21pc2UzIF07XG5cbiAgUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24oYXJyYXkpe1xuICAgIC8vIENvZGUgaGVyZSBuZXZlciBydW5zIGJlY2F1c2UgdGhlcmUgYXJlIHJlamVjdGVkIHByb21pc2VzIVxuICB9LCBmdW5jdGlvbihlcnJvcikge1xuICAgIC8vIGVycm9yLm1lc3NhZ2UgPT09IFwiMlwiXG4gIH0pO1xuICBgYGBcblxuICBAbWV0aG9kIGFsbFxuICBAc3RhdGljXG4gIEBwYXJhbSB7QXJyYXl9IGVudHJpZXMgYXJyYXkgb2YgcHJvbWlzZXNcbiAgQHBhcmFtIHtTdHJpbmd9IGxhYmVsIG9wdGlvbmFsIHN0cmluZyBmb3IgbGFiZWxpbmcgdGhlIHByb21pc2UuXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gcHJvbWlzZSB0aGF0IGlzIGZ1bGZpbGxlZCB3aGVuIGFsbCBgcHJvbWlzZXNgIGhhdmUgYmVlblxuICBmdWxmaWxsZWQsIG9yIHJlamVjdGVkIGlmIGFueSBvZiB0aGVtIGJlY29tZSByZWplY3RlZC5cbiAgQHN0YXRpY1xuKi9cbmZ1bmN0aW9uIGFsbChlbnRyaWVzKSB7XG4gIHJldHVybiBuZXcgRW51bWVyYXRvcih0aGlzLCBlbnRyaWVzKS5wcm9taXNlO1xufVxuXG4vKipcbiAgYFByb21pc2UucmFjZWAgcmV0dXJucyBhIG5ldyBwcm9taXNlIHdoaWNoIGlzIHNldHRsZWQgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZVxuICBmaXJzdCBwYXNzZWQgcHJvbWlzZSB0byBzZXR0bGUuXG5cbiAgRXhhbXBsZTpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlMSA9IG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgcmVzb2x2ZSgncHJvbWlzZSAxJyk7XG4gICAgfSwgMjAwKTtcbiAgfSk7XG5cbiAgbGV0IHByb21pc2UyID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDInKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyByZXN1bHQgPT09ICdwcm9taXNlIDInIGJlY2F1c2UgaXQgd2FzIHJlc29sdmVkIGJlZm9yZSBwcm9taXNlMVxuICAgIC8vIHdhcyByZXNvbHZlZC5cbiAgfSk7XG4gIGBgYFxuXG4gIGBQcm9taXNlLnJhY2VgIGlzIGRldGVybWluaXN0aWMgaW4gdGhhdCBvbmx5IHRoZSBzdGF0ZSBvZiB0aGUgZmlyc3RcbiAgc2V0dGxlZCBwcm9taXNlIG1hdHRlcnMuIEZvciBleGFtcGxlLCBldmVuIGlmIG90aGVyIHByb21pc2VzIGdpdmVuIHRvIHRoZVxuICBgcHJvbWlzZXNgIGFycmF5IGFyZ3VtZW50IGFyZSByZXNvbHZlZCwgYnV0IHRoZSBmaXJzdCBzZXR0bGVkIHByb21pc2UgaGFzXG4gIGJlY29tZSByZWplY3RlZCBiZWZvcmUgdGhlIG90aGVyIHByb21pc2VzIGJlY2FtZSBmdWxmaWxsZWQsIHRoZSByZXR1cm5lZFxuICBwcm9taXNlIHdpbGwgYmVjb21lIHJlamVjdGVkOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UxID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KXtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICByZXNvbHZlKCdwcm9taXNlIDEnKTtcbiAgICB9LCAyMDApO1xuICB9KTtcblxuICBsZXQgcHJvbWlzZTIgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgIHJlamVjdChuZXcgRXJyb3IoJ3Byb21pc2UgMicpKTtcbiAgICB9LCAxMDApO1xuICB9KTtcblxuICBQcm9taXNlLnJhY2UoW3Byb21pc2UxLCBwcm9taXNlMl0pLnRoZW4oZnVuY3Rpb24ocmVzdWx0KXtcbiAgICAvLyBDb2RlIGhlcmUgbmV2ZXIgcnVuc1xuICB9LCBmdW5jdGlvbihyZWFzb24pe1xuICAgIC8vIHJlYXNvbi5tZXNzYWdlID09PSAncHJvbWlzZSAyJyBiZWNhdXNlIHByb21pc2UgMiBiZWNhbWUgcmVqZWN0ZWQgYmVmb3JlXG4gICAgLy8gcHJvbWlzZSAxIGJlY2FtZSBmdWxmaWxsZWRcbiAgfSk7XG4gIGBgYFxuXG4gIEFuIGV4YW1wbGUgcmVhbC13b3JsZCB1c2UgY2FzZSBpcyBpbXBsZW1lbnRpbmcgdGltZW91dHM6XG5cbiAgYGBgamF2YXNjcmlwdFxuICBQcm9taXNlLnJhY2UoW2FqYXgoJ2Zvby5qc29uJyksIHRpbWVvdXQoNTAwMCldKVxuICBgYGBcblxuICBAbWV0aG9kIHJhY2VcbiAgQHN0YXRpY1xuICBAcGFyYW0ge0FycmF5fSBwcm9taXNlcyBhcnJheSBvZiBwcm9taXNlcyB0byBvYnNlcnZlXG4gIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgQHJldHVybiB7UHJvbWlzZX0gYSBwcm9taXNlIHdoaWNoIHNldHRsZXMgaW4gdGhlIHNhbWUgd2F5IGFzIHRoZSBmaXJzdCBwYXNzZWRcbiAgcHJvbWlzZSB0byBzZXR0bGUuXG4qL1xuZnVuY3Rpb24gcmFjZShlbnRyaWVzKSB7XG4gIC8qanNoaW50IHZhbGlkdGhpczp0cnVlICovXG4gIHZhciBDb25zdHJ1Y3RvciA9IHRoaXM7XG5cbiAgaWYgKCFpc0FycmF5KGVudHJpZXMpKSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAoXywgcmVqZWN0KSB7XG4gICAgICByZXR1cm4gcmVqZWN0KG5ldyBUeXBlRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXJyYXkgdG8gcmFjZS4nKSk7XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBDb25zdHJ1Y3RvcihmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICB2YXIgbGVuZ3RoID0gZW50cmllcy5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIENvbnN0cnVjdG9yLnJlc29sdmUoZW50cmllc1tpXSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICBgUHJvbWlzZS5yZWplY3RgIHJldHVybnMgYSBwcm9taXNlIHJlamVjdGVkIHdpdGggdGhlIHBhc3NlZCBgcmVhc29uYC5cbiAgSXQgaXMgc2hvcnRoYW5kIGZvciB0aGUgZm9sbG93aW5nOlxuXG4gIGBgYGphdmFzY3JpcHRcbiAgbGV0IHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3Qpe1xuICAgIHJlamVjdChuZXcgRXJyb3IoJ1dIT09QUycpKTtcbiAgfSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEluc3RlYWQgb2Ygd3JpdGluZyB0aGUgYWJvdmUsIHlvdXIgY29kZSBub3cgc2ltcGx5IGJlY29tZXMgdGhlIGZvbGxvd2luZzpcblxuICBgYGBqYXZhc2NyaXB0XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKCdXSE9PUFMnKSk7XG5cbiAgcHJvbWlzZS50aGVuKGZ1bmN0aW9uKHZhbHVlKXtcbiAgICAvLyBDb2RlIGhlcmUgZG9lc24ndCBydW4gYmVjYXVzZSB0aGUgcHJvbWlzZSBpcyByZWplY3RlZCFcbiAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAvLyByZWFzb24ubWVzc2FnZSA9PT0gJ1dIT09QUydcbiAgfSk7XG4gIGBgYFxuXG4gIEBtZXRob2QgcmVqZWN0XG4gIEBzdGF0aWNcbiAgQHBhcmFtIHtBbnl9IHJlYXNvbiB2YWx1ZSB0aGF0IHRoZSByZXR1cm5lZCBwcm9taXNlIHdpbGwgYmUgcmVqZWN0ZWQgd2l0aC5cbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAcmV0dXJuIHtQcm9taXNlfSBhIHByb21pc2UgcmVqZWN0ZWQgd2l0aCB0aGUgZ2l2ZW4gYHJlYXNvbmAuXG4qL1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAvKmpzaGludCB2YWxpZHRoaXM6dHJ1ZSAqL1xuICB2YXIgQ29uc3RydWN0b3IgPSB0aGlzO1xuICB2YXIgcHJvbWlzZSA9IG5ldyBDb25zdHJ1Y3Rvcihub29wKTtcbiAgX3JlamVjdChwcm9taXNlLCByZWFzb24pO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cblxuZnVuY3Rpb24gbmVlZHNSZXNvbHZlcigpIHtcbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignWW91IG11c3QgcGFzcyBhIHJlc29sdmVyIGZ1bmN0aW9uIGFzIHRoZSBmaXJzdCBhcmd1bWVudCB0byB0aGUgcHJvbWlzZSBjb25zdHJ1Y3RvcicpO1xufVxuXG5mdW5jdGlvbiBuZWVkc05ldygpIHtcbiAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZhaWxlZCB0byBjb25zdHJ1Y3QgJ1Byb21pc2UnOiBQbGVhc2UgdXNlIHRoZSAnbmV3JyBvcGVyYXRvciwgdGhpcyBvYmplY3QgY29uc3RydWN0b3IgY2Fubm90IGJlIGNhbGxlZCBhcyBhIGZ1bmN0aW9uLlwiKTtcbn1cblxuLyoqXG4gIFByb21pc2Ugb2JqZWN0cyByZXByZXNlbnQgdGhlIGV2ZW50dWFsIHJlc3VsdCBvZiBhbiBhc3luY2hyb25vdXMgb3BlcmF0aW9uLiBUaGVcbiAgcHJpbWFyeSB3YXkgb2YgaW50ZXJhY3Rpbmcgd2l0aCBhIHByb21pc2UgaXMgdGhyb3VnaCBpdHMgYHRoZW5gIG1ldGhvZCwgd2hpY2hcbiAgcmVnaXN0ZXJzIGNhbGxiYWNrcyB0byByZWNlaXZlIGVpdGhlciBhIHByb21pc2UncyBldmVudHVhbCB2YWx1ZSBvciB0aGUgcmVhc29uXG4gIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuXG4gIFRlcm1pbm9sb2d5XG4gIC0tLS0tLS0tLS0tXG5cbiAgLSBgcHJvbWlzZWAgaXMgYW4gb2JqZWN0IG9yIGZ1bmN0aW9uIHdpdGggYSBgdGhlbmAgbWV0aG9kIHdob3NlIGJlaGF2aW9yIGNvbmZvcm1zIHRvIHRoaXMgc3BlY2lmaWNhdGlvbi5cbiAgLSBgdGhlbmFibGVgIGlzIGFuIG9iamVjdCBvciBmdW5jdGlvbiB0aGF0IGRlZmluZXMgYSBgdGhlbmAgbWV0aG9kLlxuICAtIGB2YWx1ZWAgaXMgYW55IGxlZ2FsIEphdmFTY3JpcHQgdmFsdWUgKGluY2x1ZGluZyB1bmRlZmluZWQsIGEgdGhlbmFibGUsIG9yIGEgcHJvbWlzZSkuXG4gIC0gYGV4Y2VwdGlvbmAgaXMgYSB2YWx1ZSB0aGF0IGlzIHRocm93biB1c2luZyB0aGUgdGhyb3cgc3RhdGVtZW50LlxuICAtIGByZWFzb25gIGlzIGEgdmFsdWUgdGhhdCBpbmRpY2F0ZXMgd2h5IGEgcHJvbWlzZSB3YXMgcmVqZWN0ZWQuXG4gIC0gYHNldHRsZWRgIHRoZSBmaW5hbCByZXN0aW5nIHN0YXRlIG9mIGEgcHJvbWlzZSwgZnVsZmlsbGVkIG9yIHJlamVjdGVkLlxuXG4gIEEgcHJvbWlzZSBjYW4gYmUgaW4gb25lIG9mIHRocmVlIHN0YXRlczogcGVuZGluZywgZnVsZmlsbGVkLCBvciByZWplY3RlZC5cblxuICBQcm9taXNlcyB0aGF0IGFyZSBmdWxmaWxsZWQgaGF2ZSBhIGZ1bGZpbGxtZW50IHZhbHVlIGFuZCBhcmUgaW4gdGhlIGZ1bGZpbGxlZFxuICBzdGF0ZS4gIFByb21pc2VzIHRoYXQgYXJlIHJlamVjdGVkIGhhdmUgYSByZWplY3Rpb24gcmVhc29uIGFuZCBhcmUgaW4gdGhlXG4gIHJlamVjdGVkIHN0YXRlLiAgQSBmdWxmaWxsbWVudCB2YWx1ZSBpcyBuZXZlciBhIHRoZW5hYmxlLlxuXG4gIFByb21pc2VzIGNhbiBhbHNvIGJlIHNhaWQgdG8gKnJlc29sdmUqIGEgdmFsdWUuICBJZiB0aGlzIHZhbHVlIGlzIGFsc28gYVxuICBwcm9taXNlLCB0aGVuIHRoZSBvcmlnaW5hbCBwcm9taXNlJ3Mgc2V0dGxlZCBzdGF0ZSB3aWxsIG1hdGNoIHRoZSB2YWx1ZSdzXG4gIHNldHRsZWQgc3RhdGUuICBTbyBhIHByb21pc2UgdGhhdCAqcmVzb2x2ZXMqIGEgcHJvbWlzZSB0aGF0IHJlamVjdHMgd2lsbFxuICBpdHNlbGYgcmVqZWN0LCBhbmQgYSBwcm9taXNlIHRoYXQgKnJlc29sdmVzKiBhIHByb21pc2UgdGhhdCBmdWxmaWxscyB3aWxsXG4gIGl0c2VsZiBmdWxmaWxsLlxuXG5cbiAgQmFzaWMgVXNhZ2U6XG4gIC0tLS0tLS0tLS0tLVxuXG4gIGBgYGpzXG4gIGxldCBwcm9taXNlID0gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgLy8gb24gc3VjY2Vzc1xuICAgIHJlc29sdmUodmFsdWUpO1xuXG4gICAgLy8gb24gZmFpbHVyZVxuICAgIHJlamVjdChyZWFzb24pO1xuICB9KTtcblxuICBwcm9taXNlLnRoZW4oZnVuY3Rpb24odmFsdWUpIHtcbiAgICAvLyBvbiBmdWxmaWxsbWVudFxuICB9LCBmdW5jdGlvbihyZWFzb24pIHtcbiAgICAvLyBvbiByZWplY3Rpb25cbiAgfSk7XG4gIGBgYFxuXG4gIEFkdmFuY2VkIFVzYWdlOlxuICAtLS0tLS0tLS0tLS0tLS1cblxuICBQcm9taXNlcyBzaGluZSB3aGVuIGFic3RyYWN0aW5nIGF3YXkgYXN5bmNocm9ub3VzIGludGVyYWN0aW9ucyBzdWNoIGFzXG4gIGBYTUxIdHRwUmVxdWVzdGBzLlxuXG4gIGBgYGpzXG4gIGZ1bmN0aW9uIGdldEpTT04odXJsKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uKHJlc29sdmUsIHJlamVjdCl7XG4gICAgICBsZXQgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgIHhoci5vcGVuKCdHRVQnLCB1cmwpO1xuICAgICAgeGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGhhbmRsZXI7XG4gICAgICB4aHIucmVzcG9uc2VUeXBlID0gJ2pzb24nO1xuICAgICAgeGhyLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICB4aHIuc2VuZCgpO1xuXG4gICAgICBmdW5jdGlvbiBoYW5kbGVyKCkge1xuICAgICAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSB0aGlzLkRPTkUpIHtcbiAgICAgICAgICBpZiAodGhpcy5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICAgICAgcmVzb2x2ZSh0aGlzLnJlc3BvbnNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KG5ldyBFcnJvcignZ2V0SlNPTjogYCcgKyB1cmwgKyAnYCBmYWlsZWQgd2l0aCBzdGF0dXM6IFsnICsgdGhpcy5zdGF0dXMgKyAnXScpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH1cblxuICBnZXRKU09OKCcvcG9zdHMuanNvbicpLnRoZW4oZnVuY3Rpb24oanNvbikge1xuICAgIC8vIG9uIGZ1bGZpbGxtZW50XG4gIH0sIGZ1bmN0aW9uKHJlYXNvbikge1xuICAgIC8vIG9uIHJlamVjdGlvblxuICB9KTtcbiAgYGBgXG5cbiAgVW5saWtlIGNhbGxiYWNrcywgcHJvbWlzZXMgYXJlIGdyZWF0IGNvbXBvc2FibGUgcHJpbWl0aXZlcy5cblxuICBgYGBqc1xuICBQcm9taXNlLmFsbChbXG4gICAgZ2V0SlNPTignL3Bvc3RzJyksXG4gICAgZ2V0SlNPTignL2NvbW1lbnRzJylcbiAgXSkudGhlbihmdW5jdGlvbih2YWx1ZXMpe1xuICAgIHZhbHVlc1swXSAvLyA9PiBwb3N0c0pTT05cbiAgICB2YWx1ZXNbMV0gLy8gPT4gY29tbWVudHNKU09OXG5cbiAgICByZXR1cm4gdmFsdWVzO1xuICB9KTtcbiAgYGBgXG5cbiAgQGNsYXNzIFByb21pc2VcbiAgQHBhcmFtIHtmdW5jdGlvbn0gcmVzb2x2ZXJcbiAgVXNlZnVsIGZvciB0b29saW5nLlxuICBAY29uc3RydWN0b3JcbiovXG5mdW5jdGlvbiBQcm9taXNlKHJlc29sdmVyKSB7XG4gIHRoaXNbUFJPTUlTRV9JRF0gPSBuZXh0SWQoKTtcbiAgdGhpcy5fcmVzdWx0ID0gdGhpcy5fc3RhdGUgPSB1bmRlZmluZWQ7XG4gIHRoaXMuX3N1YnNjcmliZXJzID0gW107XG5cbiAgaWYgKG5vb3AgIT09IHJlc29sdmVyKSB7XG4gICAgdHlwZW9mIHJlc29sdmVyICE9PSAnZnVuY3Rpb24nICYmIG5lZWRzUmVzb2x2ZXIoKTtcbiAgICB0aGlzIGluc3RhbmNlb2YgUHJvbWlzZSA/IGluaXRpYWxpemVQcm9taXNlKHRoaXMsIHJlc29sdmVyKSA6IG5lZWRzTmV3KCk7XG4gIH1cbn1cblxuUHJvbWlzZS5hbGwgPSBhbGw7XG5Qcm9taXNlLnJhY2UgPSByYWNlO1xuUHJvbWlzZS5yZXNvbHZlID0gcmVzb2x2ZTtcblByb21pc2UucmVqZWN0ID0gcmVqZWN0O1xuUHJvbWlzZS5fc2V0U2NoZWR1bGVyID0gc2V0U2NoZWR1bGVyO1xuUHJvbWlzZS5fc2V0QXNhcCA9IHNldEFzYXA7XG5Qcm9taXNlLl9hc2FwID0gYXNhcDtcblxuUHJvbWlzZS5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBQcm9taXNlLFxuXG4gIC8qKlxuICAgIFRoZSBwcmltYXJ5IHdheSBvZiBpbnRlcmFjdGluZyB3aXRoIGEgcHJvbWlzZSBpcyB0aHJvdWdoIGl0cyBgdGhlbmAgbWV0aG9kLFxuICAgIHdoaWNoIHJlZ2lzdGVycyBjYWxsYmFja3MgdG8gcmVjZWl2ZSBlaXRoZXIgYSBwcm9taXNlJ3MgZXZlbnR1YWwgdmFsdWUgb3IgdGhlXG4gICAgcmVhc29uIHdoeSB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbih1c2VyKXtcbiAgICAgIC8vIHVzZXIgaXMgYXZhaWxhYmxlXG4gICAgfSwgZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIHVzZXIgaXMgdW5hdmFpbGFibGUsIGFuZCB5b3UgYXJlIGdpdmVuIHRoZSByZWFzb24gd2h5XG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIENoYWluaW5nXG4gICAgLS0tLS0tLS1cbiAgXG4gICAgVGhlIHJldHVybiB2YWx1ZSBvZiBgdGhlbmAgaXMgaXRzZWxmIGEgcHJvbWlzZS4gIFRoaXMgc2Vjb25kLCAnZG93bnN0cmVhbSdcbiAgICBwcm9taXNlIGlzIHJlc29sdmVkIHdpdGggdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgZmlyc3QgcHJvbWlzZSdzIGZ1bGZpbGxtZW50XG4gICAgb3IgcmVqZWN0aW9uIGhhbmRsZXIsIG9yIHJlamVjdGVkIGlmIHRoZSBoYW5kbGVyIHRocm93cyBhbiBleGNlcHRpb24uXG4gIFxuICAgIGBgYGpzXG4gICAgZmluZFVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICByZXR1cm4gdXNlci5uYW1lO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHJldHVybiAnZGVmYXVsdCBuYW1lJztcbiAgICB9KS50aGVuKGZ1bmN0aW9uICh1c2VyTmFtZSkge1xuICAgICAgLy8gSWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGB1c2VyTmFtZWAgd2lsbCBiZSB0aGUgdXNlcidzIG5hbWUsIG90aGVyd2lzZSBpdFxuICAgICAgLy8gd2lsbCBiZSBgJ2RlZmF1bHQgbmFtZSdgXG4gICAgfSk7XG4gIFxuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGb3VuZCB1c2VyLCBidXQgc3RpbGwgdW5oYXBweScpO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignYGZpbmRVc2VyYCByZWplY3RlZCBhbmQgd2UncmUgdW5oYXBweScpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgfSwgZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgLy8gaWYgYGZpbmRVc2VyYCBmdWxmaWxsZWQsIGByZWFzb25gIHdpbGwgYmUgJ0ZvdW5kIHVzZXIsIGJ1dCBzdGlsbCB1bmhhcHB5Jy5cbiAgICAgIC8vIElmIGBmaW5kVXNlcmAgcmVqZWN0ZWQsIGByZWFzb25gIHdpbGwgYmUgJ2BmaW5kVXNlcmAgcmVqZWN0ZWQgYW5kIHdlJ3JlIHVuaGFwcHknLlxuICAgIH0pO1xuICAgIGBgYFxuICAgIElmIHRoZSBkb3duc3RyZWFtIHByb21pc2UgZG9lcyBub3Qgc3BlY2lmeSBhIHJlamVjdGlvbiBoYW5kbGVyLCByZWplY3Rpb24gcmVhc29ucyB3aWxsIGJlIHByb3BhZ2F0ZWQgZnVydGhlciBkb3duc3RyZWFtLlxuICBcbiAgICBgYGBqc1xuICAgIGZpbmRVc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgdGhyb3cgbmV3IFBlZGFnb2dpY2FsRXhjZXB0aW9uKCdVcHN0cmVhbSBlcnJvcicpO1xuICAgIH0pLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAvLyBuZXZlciByZWFjaGVkXG4gICAgfSkudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgIC8vIG5ldmVyIHJlYWNoZWRcbiAgICB9LCBmdW5jdGlvbiAocmVhc29uKSB7XG4gICAgICAvLyBUaGUgYFBlZGdhZ29jaWFsRXhjZXB0aW9uYCBpcyBwcm9wYWdhdGVkIGFsbCB0aGUgd2F5IGRvd24gdG8gaGVyZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBBc3NpbWlsYXRpb25cbiAgICAtLS0tLS0tLS0tLS1cbiAgXG4gICAgU29tZXRpbWVzIHRoZSB2YWx1ZSB5b3Ugd2FudCB0byBwcm9wYWdhdGUgdG8gYSBkb3duc3RyZWFtIHByb21pc2UgY2FuIG9ubHkgYmVcbiAgICByZXRyaWV2ZWQgYXN5bmNocm9ub3VzbHkuIFRoaXMgY2FuIGJlIGFjaGlldmVkIGJ5IHJldHVybmluZyBhIHByb21pc2UgaW4gdGhlXG4gICAgZnVsZmlsbG1lbnQgb3IgcmVqZWN0aW9uIGhhbmRsZXIuIFRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCB0aGVuIGJlIHBlbmRpbmdcbiAgICB1bnRpbCB0aGUgcmV0dXJuZWQgcHJvbWlzZSBpcyBzZXR0bGVkLiBUaGlzIGlzIGNhbGxlZCAqYXNzaW1pbGF0aW9uKi5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgLy8gVGhlIHVzZXIncyBjb21tZW50cyBhcmUgbm93IGF2YWlsYWJsZVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBJZiB0aGUgYXNzaW1saWF0ZWQgcHJvbWlzZSByZWplY3RzLCB0aGVuIHRoZSBkb3duc3RyZWFtIHByb21pc2Ugd2lsbCBhbHNvIHJlamVjdC5cbiAgXG4gICAgYGBganNcbiAgICBmaW5kVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgIHJldHVybiBmaW5kQ29tbWVudHNCeUF1dGhvcih1c2VyKTtcbiAgICB9KS50aGVuKGZ1bmN0aW9uIChjb21tZW50cykge1xuICAgICAgLy8gSWYgYGZpbmRDb21tZW50c0J5QXV0aG9yYCBmdWxmaWxscywgd2UnbGwgaGF2ZSB0aGUgdmFsdWUgaGVyZVxuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgIC8vIElmIGBmaW5kQ29tbWVudHNCeUF1dGhvcmAgcmVqZWN0cywgd2UnbGwgaGF2ZSB0aGUgcmVhc29uIGhlcmVcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgU2ltcGxlIEV4YW1wbGVcbiAgICAtLS0tLS0tLS0tLS0tLVxuICBcbiAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG4gIFxuICAgIGBgYGphdmFzY3JpcHRcbiAgICBsZXQgcmVzdWx0O1xuICBcbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gZmluZFJlc3VsdCgpO1xuICAgICAgLy8gc3VjY2Vzc1xuICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAvLyBmYWlsdXJlXG4gICAgfVxuICAgIGBgYFxuICBcbiAgICBFcnJiYWNrIEV4YW1wbGVcbiAgXG4gICAgYGBganNcbiAgICBmaW5kUmVzdWx0KGZ1bmN0aW9uKHJlc3VsdCwgZXJyKXtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgLy8gZmFpbHVyZVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc3VjY2Vzc1xuICAgICAgfVxuICAgIH0pO1xuICAgIGBgYFxuICBcbiAgICBQcm9taXNlIEV4YW1wbGU7XG4gIFxuICAgIGBgYGphdmFzY3JpcHRcbiAgICBmaW5kUmVzdWx0KCkudGhlbihmdW5jdGlvbihyZXN1bHQpe1xuICAgICAgLy8gc3VjY2Vzc1xuICAgIH0sIGZ1bmN0aW9uKHJlYXNvbil7XG4gICAgICAvLyBmYWlsdXJlXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEFkdmFuY2VkIEV4YW1wbGVcbiAgICAtLS0tLS0tLS0tLS0tLVxuICBcbiAgICBTeW5jaHJvbm91cyBFeGFtcGxlXG4gIFxuICAgIGBgYGphdmFzY3JpcHRcbiAgICBsZXQgYXV0aG9yLCBib29rcztcbiAgXG4gICAgdHJ5IHtcbiAgICAgIGF1dGhvciA9IGZpbmRBdXRob3IoKTtcbiAgICAgIGJvb2tzICA9IGZpbmRCb29rc0J5QXV0aG9yKGF1dGhvcik7XG4gICAgICAvLyBzdWNjZXNzXG4gICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgIC8vIGZhaWx1cmVcbiAgICB9XG4gICAgYGBgXG4gIFxuICAgIEVycmJhY2sgRXhhbXBsZVxuICBcbiAgICBgYGBqc1xuICBcbiAgICBmdW5jdGlvbiBmb3VuZEJvb2tzKGJvb2tzKSB7XG4gIFxuICAgIH1cbiAgXG4gICAgZnVuY3Rpb24gZmFpbHVyZShyZWFzb24pIHtcbiAgXG4gICAgfVxuICBcbiAgICBmaW5kQXV0aG9yKGZ1bmN0aW9uKGF1dGhvciwgZXJyKXtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAvLyBmYWlsdXJlXG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGZpbmRCb29va3NCeUF1dGhvcihhdXRob3IsIGZ1bmN0aW9uKGJvb2tzLCBlcnIpIHtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgZmFpbHVyZShlcnIpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBmb3VuZEJvb2tzKGJvb2tzKTtcbiAgICAgICAgICAgICAgfSBjYXRjaChyZWFzb24pIHtcbiAgICAgICAgICAgICAgICBmYWlsdXJlKHJlYXNvbik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaChlcnJvcikge1xuICAgICAgICAgIGZhaWx1cmUoZXJyKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzdWNjZXNzXG4gICAgICB9XG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIFByb21pc2UgRXhhbXBsZTtcbiAgXG4gICAgYGBgamF2YXNjcmlwdFxuICAgIGZpbmRBdXRob3IoKS5cbiAgICAgIHRoZW4oZmluZEJvb2tzQnlBdXRob3IpLlxuICAgICAgdGhlbihmdW5jdGlvbihib29rcyl7XG4gICAgICAgIC8vIGZvdW5kIGJvb2tzXG4gICAgfSkuY2F0Y2goZnVuY3Rpb24ocmVhc29uKXtcbiAgICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nXG4gICAgfSk7XG4gICAgYGBgXG4gIFxuICAgIEBtZXRob2QgdGhlblxuICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uRnVsZmlsbGVkXG4gICAgQHBhcmFtIHtGdW5jdGlvbn0gb25SZWplY3RlZFxuICAgIFVzZWZ1bCBmb3IgdG9vbGluZy5cbiAgICBAcmV0dXJuIHtQcm9taXNlfVxuICAqL1xuICB0aGVuOiB0aGVuLFxuXG4gIC8qKlxuICAgIGBjYXRjaGAgaXMgc2ltcGx5IHN1Z2FyIGZvciBgdGhlbih1bmRlZmluZWQsIG9uUmVqZWN0aW9uKWAgd2hpY2ggbWFrZXMgaXQgdGhlIHNhbWVcbiAgICBhcyB0aGUgY2F0Y2ggYmxvY2sgb2YgYSB0cnkvY2F0Y2ggc3RhdGVtZW50LlxuICBcbiAgICBgYGBqc1xuICAgIGZ1bmN0aW9uIGZpbmRBdXRob3IoKXtcbiAgICAgIHRocm93IG5ldyBFcnJvcignY291bGRuJ3QgZmluZCB0aGF0IGF1dGhvcicpO1xuICAgIH1cbiAgXG4gICAgLy8gc3luY2hyb25vdXNcbiAgICB0cnkge1xuICAgICAgZmluZEF1dGhvcigpO1xuICAgIH0gY2F0Y2gocmVhc29uKSB7XG4gICAgICAvLyBzb21ldGhpbmcgd2VudCB3cm9uZ1xuICAgIH1cbiAgXG4gICAgLy8gYXN5bmMgd2l0aCBwcm9taXNlc1xuICAgIGZpbmRBdXRob3IoKS5jYXRjaChmdW5jdGlvbihyZWFzb24pe1xuICAgICAgLy8gc29tZXRoaW5nIHdlbnQgd3JvbmdcbiAgICB9KTtcbiAgICBgYGBcbiAgXG4gICAgQG1ldGhvZCBjYXRjaFxuICAgIEBwYXJhbSB7RnVuY3Rpb259IG9uUmVqZWN0aW9uXG4gICAgVXNlZnVsIGZvciB0b29saW5nLlxuICAgIEByZXR1cm4ge1Byb21pc2V9XG4gICovXG4gICdjYXRjaCc6IGZ1bmN0aW9uIF9jYXRjaChvblJlamVjdGlvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4obnVsbCwgb25SZWplY3Rpb24pO1xuICB9XG59O1xuXG5mdW5jdGlvbiBwb2x5ZmlsbCgpIHtcbiAgICB2YXIgbG9jYWwgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAodHlwZW9mIGdsb2JhbCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9jYWwgPSBnbG9iYWw7XG4gICAgfSBlbHNlIGlmICh0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbG9jYWwgPSBzZWxmO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsb2NhbCA9IEZ1bmN0aW9uKCdyZXR1cm4gdGhpcycpKCk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncG9seWZpbGwgZmFpbGVkIGJlY2F1c2UgZ2xvYmFsIG9iamVjdCBpcyB1bmF2YWlsYWJsZSBpbiB0aGlzIGVudmlyb25tZW50Jyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgUCA9IGxvY2FsLlByb21pc2U7XG5cbiAgICBpZiAoUCkge1xuICAgICAgICB2YXIgcHJvbWlzZVRvU3RyaW5nID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHByb21pc2VUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChQLnJlc29sdmUoKSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIC8vIHNpbGVudGx5IGlnbm9yZWRcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChwcm9taXNlVG9TdHJpbmcgPT09ICdbb2JqZWN0IFByb21pc2VdJyAmJiAhUC5jYXN0KSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb2NhbC5Qcm9taXNlID0gUHJvbWlzZTtcbn1cblxucG9seWZpbGwoKTtcbi8vIFN0cmFuZ2UgY29tcGF0Li5cblByb21pc2UucG9seWZpbGwgPSBwb2x5ZmlsbDtcblByb21pc2UuUHJvbWlzZSA9IFByb21pc2U7XG5cbnJldHVybiBQcm9taXNlO1xuXG59KSkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXM2LXByb21pc2UubWFwIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiJdfQ==
