"use strict";
var errors = {
    typeMismatch: "Unexpected type: ",
    duplicatePathPart: "A path component name is duplicated: "
};
var util = require('./util');
var logger = require('./logger');
;
;
var PathPart = (function () {
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
var PathTemplate = (function () {
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
function getFunctionName(exp) {
    if (exp.ref.type === 'ref') {
        return '';
    }
    return exp.ref.name;
}
exports.getFunctionName = getFunctionName;
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
function snapshotValue(exp) {
    return call(reference(cast(exp, 'Any'), exports.string('val')));
}
exports.snapshotValue = snapshotValue;
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
function valueGen(typeName) {
    return function (val) {
        return {
            type: typeName,
            valueType: typeName,
            value: val
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
    return v1.type === v2.type && v1.value === v2.value;
}
function isOp(opType, exp) {
    return exp.type === 'op' && exp.op === opType;
}
function opGen(opType, arity) {
    if (arity === void 0) { arity = 2; }
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i - 0] = arguments[_i];
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
function leftAssociateGen(opType, identityValue, zeroValue) {
    return function (a) {
        var i;
        function reducer(result, current) {
            if (result === undefined) {
                return current;
            }
            return op(opType, [result, current]);
        }
        var flat = [];
        for (i = 0; i < a.length; i++) {
            flatten(opType, a[i], flat);
        }
        var result = [];
        for (i = 0; i < flat.length; i++) {
            if (cmpValues(flat[i], identityValue)) {
                continue;
            }
            if (cmpValues(flat[i], zeroValue)) {
                return zeroValue;
            }
            result.push(flat[i]);
        }
        if (result.length === 0) {
            return identityValue;
        }
        return result.reduce(reducer);
    };
}
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
        args: args
    };
}
exports.op = op;
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
var Symbols = (function () {
    function Symbols() {
        this.functions = {};
        this.paths = [];
        this.schema = {};
        this.imports = [];
    }
    Symbols.prototype.register = function (type, name, object) {
        if (!this[type]) {
            throw new Error("Invalid registration type: " + type);
        }
        if (this[type][name]) {
            logger.error("Duplicated " + type + " definition: " + name + ".");
        }
        else {
            this[type][name] = object;
        }
        return this[type][name];
    };
    Symbols.prototype.registerFunction = function (name, params, body) {
        return this.register('functions', name, method(params, body));
    };
    Symbols.prototype.registerImport = function (alias, data, scope) {
        var theScope = false;
        if (scope) {
            theScope = true;
        }
        var theAlias = "";
        if (alias) {
            theAlias = alias;
        }
        var i = {
            filename: data,
            alias: theAlias,
            scope: !theScope
        };
        this.imports.push(i);
        return i;
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
        return this.register('schema', name, s);
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
function decodeExpression(exp, outerPrecedence) {
    if (outerPrecedence === undefined) {
        outerPrecedence = 0;
    }
    var innerPrecedence = precedenceOf(exp);
    var result;
    switch (exp.type) {
        case 'Boolean':
        case 'Number':
            result = JSON.stringify(exp.value);
            break;
        case 'String':
            result = util.quoteString(exp.value);
            break;
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

//# sourceMappingURL=data:application/json;base64,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O0FBRUQscUJBQXFCLElBQVc7SUFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0MsQ0FBQztBQUVELHNCQUFzQixHQUFRO0lBQzVCLElBQUksTUFBYyxDQUFDO0lBRW5CLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ25CLEtBQUssSUFBSTtZQUNQLE1BQU0sR0FBRyxNQUFNLENBQVUsR0FBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwQyxLQUFLLENBQUM7UUFLUixLQUFLLE1BQU07WUFDVCxNQUFNLEdBQUcsRUFBRSxDQUFDO1lBQ1osS0FBSyxDQUFDO1FBQ1IsS0FBSyxLQUFLO1lBQ1IsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssQ0FBQztRQUNSO1lBQ0UsTUFBTSxHQUFHLEVBQUUsQ0FBQztZQUNaLEtBQUssQ0FBQztJQUNSLENBQUM7SUFFRCxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ2hCLENBQUMiLCJmaWxlIjoiYXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogQVNUIGJ1aWxkZXJzIGZvciBGaXJlYmFzZSBSdWxlcyBMYW5ndWFnZS5cclxuICpcclxuICogQ29weXJpZ2h0IDIwMTUgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cclxuICpcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcclxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxyXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcclxuICpcclxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwidHlwaW5ncy9ub2RlLmQudHNcIiAvPlxyXG5cclxudmFyIGVycm9ycyA9IHtcclxuICB0eXBlTWlzbWF0Y2g6IFwiVW5leHBlY3RlZCB0eXBlOiBcIixcclxuICBkdXBsaWNhdGVQYXRoUGFydDogXCJBIHBhdGggY29tcG9uZW50IG5hbWUgaXMgZHVwbGljYXRlZDogXCIsXHJcbn07XHJcblxyXG5pbXBvcnQgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xyXG5pbXBvcnQgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcclxuXHJcbmV4cG9ydCB0eXBlIE9iamVjdCA9IHsgW3Byb3A6IHN0cmluZ106IGFueSB9O1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHAge1xyXG4gIHR5cGU6IHN0cmluZztcclxuICB2YWx1ZVR5cGU6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBWYWx1ZSBleHRlbmRzIEV4cCB7XHJcbiAgdmFsdWU6IGFueTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBSZWdFeHBWYWx1ZSBleHRlbmRzIEV4cFZhbHVlIHtcclxuICBtb2RpZmllcnM6IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBOdWxsIGV4dGVuZHMgRXhwIHtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBPcCBleHRlbmRzIEV4cCB7XHJcbiAgb3A6IHN0cmluZztcclxuICBhcmdzOiBFeHBbXTtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBFeHBWYXJpYWJsZSBleHRlbmRzIEV4cCB7XHJcbiAgbmFtZTogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cExpdGVyYWwgZXh0ZW5kcyBFeHAge1xyXG4gIG5hbWU6IHN0cmluZztcclxufVxyXG5cclxuLy8gYmFzZVthY2Nlc3Nvcl1cclxuZXhwb3J0IGludGVyZmFjZSBFeHBSZWZlcmVuY2UgZXh0ZW5kcyBFeHAge1xyXG4gIGJhc2U6IEV4cDtcclxuICBhY2Nlc3NvcjogRXhwO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cENhbGwgZXh0ZW5kcyBFeHAge1xyXG4gIHJlZjogRXhwUmVmZXJlbmNlIHwgRXhwVmFyaWFibGU7XHJcbiAgYXJnczogRXhwW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cDsgfTtcclxuXHJcbmV4cG9ydCB0eXBlIEJ1aWx0aW5GdW5jdGlvbiA9IChhcmdzOiBFeHBbXSwgcGFyYW1zOiBQYXJhbXMpID0+IEV4cDtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgRXhwQnVpbHRpbiBleHRlbmRzIEV4cCB7XHJcbiAgZm46IEJ1aWx0aW5GdW5jdGlvbjtcclxufVxyXG5cclxuZXhwb3J0IHR5cGUgRXhwVHlwZSA9IEV4cFNpbXBsZVR5cGUgfCBFeHBVbmlvblR5cGUgfCBFeHBHZW5lcmljVHlwZTtcclxuZXhwb3J0IGludGVyZmFjZSBUeXBlUGFyYW1zIHsgW25hbWU6IHN0cmluZ106IEV4cFR5cGU7IH07XHJcblxyXG4vLyBTaW1wbGUgVHlwZSAocmVmZXJlbmNlKVxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cFNpbXBsZVR5cGUgZXh0ZW5kcyBFeHAge1xyXG4gIG5hbWU6IHN0cmluZztcclxufVxyXG5cclxuLy8gVW5pb24gVHlwZTogVHlwZTEgfCBUeXBlMiB8IC4uLlxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cFVuaW9uVHlwZSBleHRlbmRzIEV4cCB7XHJcbiAgdHlwZXM6IEV4cFR5cGVbXTtcclxufVxyXG5cclxuLy8gR2VuZXJpYyBUeXBlIChyZWZlcmVuY2UpOiBUeXBlPFR5cGUxLCBUeXBlMiwgLi4uPlxyXG5leHBvcnQgaW50ZXJmYWNlIEV4cEdlbmVyaWNUeXBlIGV4dGVuZHMgRXhwIHtcclxuICBuYW1lOiBzdHJpbmc7XHJcbiAgcGFyYW1zOiBFeHBUeXBlW107XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgTWV0aG9kIHtcclxuICBwYXJhbXM6IHN0cmluZ1tdO1xyXG4gIGJvZHk6IEV4cDtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJbXBvcnQge1xyXG4gIGZpbGVuYW1lOiBzdHJpbmc7XHJcbiAgYWxpYXM6IHN0cmluZztcclxuICBzY29wZTogYm9vbGVhbjtcclxufVxyXG5leHBvcnQgY2xhc3MgUGF0aFBhcnQge1xyXG4gIGxhYmVsOiBzdHJpbmc7XHJcbiAgdmFyaWFibGU6IHN0cmluZztcclxuXHJcbiAgLy8gXCJsYWJlbFwiLCB1bmRlZmluZWQgLSBzdGF0aWMgcGF0aCBwYXJ0XHJcbiAgLy8gXCIkbGFiZWxcIiwgWCAtIHZhcmlhYmxlIHBhdGggcGFydFxyXG4gIC8vIFgsICF1bmRlZmluZWQgLSB2YXJpYWJsZSBwYXRoIHBhcnRcclxuICBjb25zdHJ1Y3RvcihsYWJlbDogc3RyaW5nLCB2YXJpYWJsZT86IHN0cmluZykge1xyXG4gICAgaWYgKGxhYmVsWzBdID09PSAnJCcgJiYgdmFyaWFibGUgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB2YXJpYWJsZSA9IGxhYmVsO1xyXG4gICAgfVxyXG4gICAgaWYgKHZhcmlhYmxlICYmIGxhYmVsWzBdICE9PSAnJCcpIHtcclxuICAgICAgbGFiZWwgPSAnJCcgKyBsYWJlbDtcclxuICAgIH1cclxuICAgIHRoaXMubGFiZWwgPSBsYWJlbDtcclxuICAgIHRoaXMudmFyaWFibGUgPSB2YXJpYWJsZTtcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjbGFzcyBQYXRoVGVtcGxhdGUge1xyXG4gIHBhcnRzOiBQYXRoUGFydFtdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwYXJ0cyA9IDwoc3RyaW5nIHwgUGF0aFBhcnQpW10+IFtdKSB7XHJcbiAgICB0aGlzLnBhcnRzID0gPFBhdGhQYXJ0W10+IHBhcnRzLm1hcCgocGFydCkgPT4ge1xyXG4gICAgICBpZiAodXRpbC5pc1R5cGUocGFydCwgJ3N0cmluZycpKSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQYXRoUGFydCg8c3RyaW5nPiBwYXJ0KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXR1cm4gPFBhdGhQYXJ0PiBwYXJ0O1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIGNvcHkoKSB7XHJcbiAgICBsZXQgcmVzdWx0ID0gbmV3IFBhdGhUZW1wbGF0ZSgpO1xyXG4gICAgcmVzdWx0LnB1c2godGhpcyk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgZ2V0TGFiZWxzKCk6IHN0cmluZ1tdIHtcclxuICAgIHJldHVybiB0aGlzLnBhcnRzLm1hcCgocGFydCkgPT4gcGFydC5sYWJlbCk7XHJcbiAgfVxyXG5cclxuICAvLyBNYXBwaW5nIGZyb20gdmFyaWFibGVzIHRvIEpTT04gbGFiZWxzXHJcbiAgZ2V0U2NvcGUoKTogUGFyYW1zIHtcclxuICAgIGxldCByZXN1bHQgPSA8UGFyYW1zPiB7fTtcclxuICAgIHRoaXMucGFydHMuZm9yRWFjaCgocGFydCkgPT4ge1xyXG4gICAgICBpZiAocGFydC52YXJpYWJsZSkge1xyXG4gICAgICAgIGlmIChyZXN1bHRbcGFydC52YXJpYWJsZV0pIHtcclxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuZHVwbGljYXRlUGF0aFBhcnQgKyBwYXJ0LnZhcmlhYmxlKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVzdWx0W3BhcnQudmFyaWFibGVdID0gbGl0ZXJhbChwYXJ0LmxhYmVsKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgcHVzaCh0ZW1wOiBQYXRoVGVtcGxhdGUpIHtcclxuICAgIHV0aWwuZXh0ZW5kQXJyYXkodGhpcy5wYXJ0cywgdGVtcC5wYXJ0cyk7XHJcbiAgfVxyXG5cclxuICBwb3AodGVtcDogUGF0aFRlbXBsYXRlKSB7XHJcbiAgICB0ZW1wLnBhcnRzLmZvckVhY2goKHBhcnQpID0+IHtcclxuICAgICAgdGhpcy5wYXJ0cy5wb3AoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgbGVuZ3RoKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy5wYXJ0cy5sZW5ndGg7XHJcbiAgfVxyXG5cclxuICBnZXRQYXJ0KGk6IG51bWJlcik6IFBhdGhQYXJ0IHtcclxuICAgIGlmIChpID4gdGhpcy5wYXJ0cy5sZW5ndGggfHwgaSA8IC10aGlzLnBhcnRzLmxlbmd0aCkge1xyXG4gICAgICBsZXQgbCA9IHRoaXMucGFydHMubGVuZ3RoO1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQYXRoIHJlZmVyZW5jZSBvdXQgb2YgYm91bmRzOiBcIiArIGkgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgXCIgW1wiICsgLWwgKyBcIiAuLiBcIiArIGwgKyBcIl1cIik7XHJcbiAgICB9XHJcbiAgICBpZiAoaSA8IDApIHtcclxuICAgICAgcmV0dXJuIHRoaXMucGFydHNbdGhpcy5wYXJ0cy5sZW5ndGggKyBpXTtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzLnBhcnRzW2ldO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBQYXRoIHtcclxuICB0ZW1wbGF0ZTogUGF0aFRlbXBsYXRlO1xyXG4gIGlzVHlwZTogRXhwVHlwZTtcclxuICBtZXRob2RzOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcclxufTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgU2NoZW1hIHtcclxuICBkZXJpdmVkRnJvbTogRXhwVHlwZTtcclxuICBwcm9wZXJ0aWVzOiBUeXBlUGFyYW1zO1xyXG4gIG1ldGhvZHM6IHsgW25hbWU6IHN0cmluZ106IE1ldGhvZCB9O1xyXG5cclxuICAvLyBHZW5lcmljIHBhcmFtZXRlcnMgLSBpZiBhIEdlbmVyaWMgc2NoZW1hXHJcbiAgcGFyYW1zPzogc3RyaW5nW107XHJcbiAgZ2V0VmFsaWRhdG9yPzogKHBhcmFtczogRXhwW10pID0+IE9iamVjdDtcclxufTtcclxuXHJcbmV4cG9ydCB2YXIgc3RyaW5nOiAodjogc3RyaW5nKSA9PiBFeHBWYWx1ZSA9IHZhbHVlR2VuKCdTdHJpbmcnKTtcclxuZXhwb3J0IHZhciBib29sZWFuOiAodjogYm9vbGVhbikgPT4gRXhwVmFsdWUgPSB2YWx1ZUdlbignQm9vbGVhbicpO1xyXG5leHBvcnQgdmFyIG51bWJlcjogKHY6IG51bWJlcikgPT4gRXhwVmFsdWUgPSB2YWx1ZUdlbignTnVtYmVyJyk7XHJcbmV4cG9ydCB2YXIgYXJyYXk6ICh2OiBBcnJheTxhbnk+KSA9PiBFeHBWYWx1ZSA9IHZhbHVlR2VuKCdBcnJheScpO1xyXG5cclxuZXhwb3J0IHZhciBuZWcgPSBvcEdlbignbmVnJywgMSk7XHJcbmV4cG9ydCB2YXIgbm90ID0gb3BHZW4oJyEnLCAxKTtcclxuZXhwb3J0IHZhciBtdWx0ID0gb3BHZW4oJyonKTtcclxuZXhwb3J0IHZhciBkaXYgPSBvcEdlbignLycpO1xyXG5leHBvcnQgdmFyIG1vZCA9IG9wR2VuKCclJyk7XHJcbmV4cG9ydCB2YXIgYWRkID0gb3BHZW4oJysnKTtcclxuZXhwb3J0IHZhciBzdWIgPSBvcEdlbignLScpO1xyXG5leHBvcnQgdmFyIGVxID0gb3BHZW4oJz09Jyk7XHJcbmV4cG9ydCB2YXIgbHQgPSBvcEdlbignPCcpO1xyXG5leHBvcnQgdmFyIGx0ZSA9IG9wR2VuKCc8PScpO1xyXG5leHBvcnQgdmFyIGd0ID0gb3BHZW4oJz4nKTtcclxuZXhwb3J0IHZhciBndGUgPSBvcEdlbignPj0nKTtcclxuZXhwb3J0IHZhciBuZSA9IG9wR2VuKCchPScpO1xyXG5leHBvcnQgdmFyIGFuZCA9IG9wR2VuKCcmJicpO1xyXG5leHBvcnQgdmFyIG9yID0gb3BHZW4oJ3x8Jyk7XHJcbmV4cG9ydCB2YXIgdGVybmFyeSA9IG9wR2VuKCc/OicsIDMpO1xyXG5leHBvcnQgdmFyIHZhbHVlID0gb3BHZW4oJ3ZhbHVlJywgMSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdmFyaWFibGUobmFtZSk6IEV4cFZhcmlhYmxlIHtcclxuICByZXR1cm4geyB0eXBlOiAndmFyJywgdmFsdWVUeXBlOiAnQW55JywgbmFtZTogbmFtZSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbGl0ZXJhbChuYW1lKTogRXhwTGl0ZXJhbCB7XHJcbiAgcmV0dXJuIHsgdHlwZTogJ2xpdGVyYWwnLCB2YWx1ZVR5cGU6ICdBbnknLCBuYW1lOiBuYW1lIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBudWxsVHlwZSgpOiBFeHBOdWxsIHtcclxuICByZXR1cm4geyB0eXBlOiAnTnVsbCcsIHZhbHVlVHlwZTogJ051bGwnIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiByZWZlcmVuY2UoYmFzZTogRXhwLCBwcm9wOiBFeHApOiBFeHBSZWZlcmVuY2Uge1xyXG4gIHJldHVybiB7XHJcbiAgICB0eXBlOiAncmVmJyxcclxuICAgIHZhbHVlVHlwZTogJ0FueScsXHJcbiAgICBiYXNlOiBiYXNlLFxyXG4gICAgYWNjZXNzb3I6IHByb3BcclxuICB9O1xyXG59XHJcblxyXG5sZXQgcmVJZGVudGlmaWVyID0gL15bYS16QS1aXyRdW2EtekEtWjAtOV9dKiQvO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzSWRlbnRpZmllclN0cmluZ0V4cChleHA6IEV4cCkge1xyXG4gIHJldHVybiBleHAudHlwZSA9PT0gJ1N0cmluZycgJiYgcmVJZGVudGlmaWVyLnRlc3QoKDxFeHBWYWx1ZT4gZXhwKS52YWx1ZSk7XHJcbn1cclxuXHJcbi8vIFNoYWxsb3cgY29weSBvZiBhbiBleHByZXNzaW9uIChzbyBpdCBjYW4gYmUgbW9kaWZpZWQgYW5kIHByZXNlcnZlXHJcbi8vIGltbXV0YWJpbGl0eSBvZiB0aGUgb3JpZ2luYWwgZXhwcmVzc2lvbikuXHJcbmV4cG9ydCBmdW5jdGlvbiBjb3B5RXhwKGV4cDogRXhwKTogRXhwIHtcclxuICBleHAgPSA8RXhwPiB1dGlsLmV4dGVuZCh7fSwgZXhwKTtcclxuICBzd2l0Y2ggKGV4cC50eXBlKSB7XHJcbiAgY2FzZSAnb3AnOlxyXG4gIGNhc2UgJ2NhbGwnOlxyXG4gICAgbGV0IG9wRXhwID0gPEV4cE9wPiBleHA7XHJcbiAgICBvcEV4cC5hcmdzID0gdXRpbC5jb3B5QXJyYXkob3BFeHAuYXJncyk7XHJcbiAgICByZXR1cm4gb3BFeHA7XHJcblxyXG4gIGNhc2UgJ3VuaW9uJzpcclxuICAgIGxldCB1bmlvbkV4cCA9IDxFeHBVbmlvblR5cGU+IGV4cDtcclxuICAgIHVuaW9uRXhwLnR5cGVzID0gdXRpbC5jb3B5QXJyYXkodW5pb25FeHAudHlwZXMpO1xyXG4gICAgcmV0dXJuIHVuaW9uRXhwO1xyXG5cclxuICBjYXNlICdnZW5lcmljJzpcclxuICAgIGxldCBnZW5lcmljRXhwID0gPEV4cEdlbmVyaWNUeXBlPiBleHA7XHJcbiAgICBnZW5lcmljRXhwLnBhcmFtcyA9IHV0aWwuY29weUFycmF5KGdlbmVyaWNFeHAucGFyYW1zKTtcclxuICAgIHJldHVybiBnZW5lcmljRXhwO1xyXG5cclxuICBkZWZhdWx0OlxyXG4gICAgIHJldHVybiBleHA7XHJcbiAgfVxyXG59XHJcblxyXG4vLyBNYWtlIGEgKHNoYWxsb3cpIGNvcHkgb2YgdGhlIGJhc2UgZXhwcmVzc2lvbiwgc2V0dGluZyAob3IgcmVtb3ZpbmcpIGl0J3NcclxuLy8gdmFsdWVUeXBlLlxyXG4vL1xyXG4vLyB2YWx1ZVR5cGUgaXMgYSBzdHJpbmcgaW5kaWNhdGluZyB0aGUgdHlwZSBvZiBldmFsdWF0aW5nIGFuIGV4cHJlc3Npb24gKGUuZy5cclxuLy8gJ1NuYXBzaG90JykgLSB1c2VkIHRvIGtub3cgd2hlbiB0eXBlIGNvZXJjaW9uIGlzIG5lZWRlZCBpbiB0aGUgY29udGV4dFxyXG4vLyBvZiBwYXJlbnQgZXhwcmVzc2lvbnMuXHJcbmV4cG9ydCBmdW5jdGlvbiBjYXN0KGJhc2U6IEV4cCwgdmFsdWVUeXBlOiBzdHJpbmcpOiBFeHAge1xyXG4gIHZhciByZXN1bHQgPSBjb3B5RXhwKGJhc2UpO1xyXG4gIHJlc3VsdC52YWx1ZVR5cGUgPSB2YWx1ZVR5cGU7XHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNhbGwocmVmOiBFeHBSZWZlcmVuY2UgfCBFeHBWYXJpYWJsZSwgYXJnczogRXhwW109IFtdKTogRXhwQ2FsbCB7XHJcbiAgcmV0dXJuIHsgdHlwZTogJ2NhbGwnLCB2YWx1ZVR5cGU6ICdBbnknLCByZWY6IHJlZiwgYXJnczogYXJncyB9O1xyXG59XHJcblxyXG4vLyBSZXR1cm4gZW1wdHkgc3RyaW5nIGlmIG5vdCBhIGZ1bmN0aW9uLlxyXG5leHBvcnQgZnVuY3Rpb24gZ2V0RnVuY3Rpb25OYW1lKGV4cDogRXhwQ2FsbCk6IHN0cmluZyB7XHJcbiAgaWYgKGV4cC5yZWYudHlwZSA9PT0gJ3JlZicpIHtcclxuICAgIHJldHVybiAnJztcclxuICB9XHJcbiAgcmV0dXJuICg8RXhwVmFyaWFibGU+IGV4cC5yZWYpLm5hbWU7XHJcbn1cclxuXHJcbi8vIFJldHVybiBlbXB0eSBzdHJpbmcgaWYgbm90IGEgKHNpbXBsZSkgbWV0aG9kIGNhbGwgLS0gcmVmLmZuKClcclxuZXhwb3J0IGZ1bmN0aW9uIGdldE1ldGhvZE5hbWUoZXhwOiBFeHBDYWxsKTogc3RyaW5nIHtcclxuICBpZiAoZXhwLnJlZi50eXBlID09PSAndmFyJykge1xyXG4gICAgcmV0dXJuICg8RXhwVmFyaWFibGU+IGV4cC5yZWYpLm5hbWU7XHJcbiAgfVxyXG4gIGlmIChleHAucmVmLnR5cGUgIT09ICdyZWYnKSB7XHJcbiAgICByZXR1cm4gJyc7XHJcbiAgfVxyXG4gIHJldHVybiBnZXRQcm9wTmFtZSg8RXhwUmVmZXJlbmNlPiBleHAucmVmKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFByb3BOYW1lKHJlZjogRXhwUmVmZXJlbmNlKTogc3RyaW5nIHtcclxuICBpZiAocmVmLmFjY2Vzc29yLnR5cGUgIT09ICdTdHJpbmcnKSB7XHJcbiAgICByZXR1cm4gJyc7XHJcbiAgfVxyXG4gIHJldHVybiAoPEV4cFZhbHVlPiByZWYuYWNjZXNzb3IpLnZhbHVlO1xyXG59XHJcblxyXG4vLyBUT0RPOiBUeXBlIG9mIGZ1bmN0aW9uIHNpZ25hdHVyZSBkb2VzIG5vdCBmYWlsIHRoaXMgZGVjbGFyYXRpb24/XHJcbmV4cG9ydCBmdW5jdGlvbiBidWlsdGluKGZuOiBCdWlsdGluRnVuY3Rpb24pOiBFeHBCdWlsdGluIHtcclxuICByZXR1cm4geyB0eXBlOiAnYnVpbHRpbicsIHZhbHVlVHlwZTogJ0FueScsIGZuOiBmbiB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gc25hcHNob3RWYXJpYWJsZShuYW1lOiBzdHJpbmcpOiBFeHBWYXJpYWJsZSB7XHJcbiAgcmV0dXJuIDxFeHBWYXJpYWJsZT4gY2FzdCh2YXJpYWJsZShuYW1lKSwgJ1NuYXBzaG90Jyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBzbmFwc2hvdFBhcmVudChiYXNlOiBFeHApOiBFeHAge1xyXG4gIGlmIChiYXNlLnZhbHVlVHlwZSAhPT0gJ1NuYXBzaG90Jykge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy50eXBlTWlzbWF0Y2ggKyBcImV4cGVjdGVkIFNuYXBzaG90XCIpO1xyXG4gIH1cclxuICByZXR1cm4gY2FzdChjYWxsKHJlZmVyZW5jZShjYXN0KGJhc2UsICdBbnknKSwgc3RyaW5nKCdwYXJlbnQnKSkpLFxyXG4gICAgICAgICAgICAgICdTbmFwc2hvdCcpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlVmFsdWUoZXhwOiBFeHApOiBFeHAge1xyXG4gIGlmIChleHAudmFsdWVUeXBlID09PSAnU25hcHNob3QnKSB7XHJcbiAgICByZXR1cm4gc25hcHNob3RWYWx1ZShleHApO1xyXG4gIH1cclxuICByZXR1cm4gZXhwO1xyXG59XHJcblxyXG4vLyByZWYudmFsKClcclxuZXhwb3J0IGZ1bmN0aW9uIHNuYXBzaG90VmFsdWUoZXhwKTogRXhwQ2FsbCB7XHJcbiAgcmV0dXJuIGNhbGwocmVmZXJlbmNlKGNhc3QoZXhwLCAnQW55JyksIHN0cmluZygndmFsJykpKTtcclxufVxyXG5cclxuLy8gRW5zdXJlIGV4cHJlc3Npb24gaXMgYSBib29sZWFuICh3aGVuIHVzZWQgaW4gYSBib29sZWFuIGNvbnRleHQpLlxyXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlQm9vbGVhbihleHA6IEV4cCk6IEV4cCB7XHJcbiAgZXhwID0gZW5zdXJlVmFsdWUoZXhwKTtcclxuICBpZiAoaXNDYWxsKGV4cCwgJ3ZhbCcpKSB7XHJcbiAgICBleHAgPSBlcShleHAsIGJvb2xlYW4odHJ1ZSkpO1xyXG4gIH1cclxuICByZXR1cm4gZXhwO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNDYWxsKGV4cDogRXhwLCBtZXRob2ROYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICByZXR1cm4gZXhwLnR5cGUgPT09ICdjYWxsJyAmJiAoPEV4cENhbGw+IGV4cCkucmVmLnR5cGUgPT09ICdyZWYnICYmXHJcbiAgICAoPEV4cFJlZmVyZW5jZT4gKDxFeHBDYWxsPiBleHApLnJlZikuYWNjZXNzb3IudHlwZSA9PT0gJ1N0cmluZycgJiZcclxuICAgICg8RXhwVmFsdWU+ICg8RXhwUmVmZXJlbmNlPiAoPEV4cENhbGw+IGV4cCkucmVmKS5hY2Nlc3NvcikudmFsdWUgPT09IG1ldGhvZE5hbWU7XHJcbn1cclxuXHJcbi8vIFJldHVybiB2YWx1ZSBnZW5lcmF0aW5nIGZ1bmN0aW9uIGZvciBhIGdpdmVuIFR5cGUuXHJcbmZ1bmN0aW9uIHZhbHVlR2VuKHR5cGVOYW1lOiBzdHJpbmcpOiAoKHZhbDogYW55KSA9PiBFeHBWYWx1ZSkge1xyXG4gIHJldHVybiBmdW5jdGlvbih2YWwpOiBFeHBWYWx1ZSB7XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB0eXBlOiB0eXBlTmFtZSwgICAgICAvLyBFeHAgdHlwZSBpZGVudGlmeWluZyBhIGNvbnN0YW50IHZhbHVlIG9mIHRoaXMgVHlwZS5cclxuICAgICAgdmFsdWVUeXBlOiB0eXBlTmFtZSwgLy8gVGhlIHR5cGUgb2YgdGhlIHJlc3VsdCBvZiBldmFsdWF0aW5nIHRoaXMgZXhwcmVzc2lvbi5cclxuICAgICAgdmFsdWU6IHZhbCAgICAgICAgICAgLy8gVGhlIChjb25zdGFudCkgdmFsdWUgaXRzZWxmLlxyXG4gICAgfTtcclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVnZXhwKHBhdHRlcm46IHN0cmluZywgbW9kaWZpZXJzID0gXCJcIik6IFJlZ0V4cFZhbHVlIHtcclxuICBzd2l0Y2ggKG1vZGlmaWVycykge1xyXG4gIGNhc2UgXCJcIjpcclxuICBjYXNlIFwiaVwiOlxyXG4gICAgYnJlYWs7XHJcbiAgZGVmYXVsdDpcclxuICAgIHRocm93IG5ldyBFcnJvcihcIlVuc3VwcG9ydGVkIFJlZ0V4cCBtb2RpZmllcjogXCIgKyBtb2RpZmllcnMpO1xyXG4gIH1cclxuICByZXR1cm4ge1xyXG4gICAgdHlwZTogJ1JlZ0V4cCcsXHJcbiAgICB2YWx1ZVR5cGU6ICdSZWdFeHAnLFxyXG4gICAgdmFsdWU6IHBhdHRlcm4sXHJcbiAgICBtb2RpZmllcnM6IG1vZGlmaWVyc1xyXG4gIH07XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNtcFZhbHVlcyh2MTogRXhwVmFsdWUsIHYyOiBFeHBWYWx1ZSk6IGJvb2xlYW4ge1xyXG4gIHJldHVybiB2MS50eXBlID09PSB2Mi50eXBlICYmIHYxLnZhbHVlID09PSB2Mi52YWx1ZTtcclxufVxyXG5cclxuZnVuY3Rpb24gaXNPcChvcFR5cGU6IHN0cmluZywgZXhwOiBFeHApOiBib29sZWFuIHtcclxuICByZXR1cm4gZXhwLnR5cGUgPT09ICdvcCcgJiYgKDxFeHBPcD4gZXhwKS5vcCA9PT0gb3BUeXBlO1xyXG59XHJcblxyXG4vLyBSZXR1cm4gYSBnZW5lcmF0aW5nIGZ1bmN0aW9uIHRvIG1ha2UgYW4gb3BlcmF0b3IgZXhwIG5vZGUuXHJcbmZ1bmN0aW9uIG9wR2VuKG9wVHlwZTogc3RyaW5nLCBhcml0eTogbnVtYmVyID0gMik6ICgoLi4uYXJnczogRXhwW10pID0+IEV4cE9wKSB7XHJcbiAgcmV0dXJuIGZ1bmN0aW9uKC4uLmFyZ3MpOiBFeHBPcCB7XHJcbiAgICBpZiAoYXJncy5sZW5ndGggIT09IGFyaXR5KSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk9wZXJhdG9yIGhhcyBcIiArIGFyZ3MubGVuZ3RoICtcclxuICAgICAgICAgICAgICAgICAgICAgIFwiIGFyZ3VtZW50cyAoZXhwZWN0aW5nIFwiICsgYXJpdHkgKyBcIikuXCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIG9wKG9wVHlwZSwgYXJncyk7XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBhbmRBcnJheSA9IGxlZnRBc3NvY2lhdGVHZW4oJyYmJywgYm9vbGVhbih0cnVlKSwgYm9vbGVhbihmYWxzZSkpO1xyXG5leHBvcnQgdmFyIG9yQXJyYXkgPSBsZWZ0QXNzb2NpYXRlR2VuKCd8fCcsIGJvb2xlYW4oZmFsc2UpLCBib29sZWFuKHRydWUpKTtcclxuXHJcbi8vIENyZWF0ZSBhbiBleHByZXNzaW9uIGJ1aWxkZXIgZnVuY3Rpb24gd2hpY2ggb3BlcmF0ZXMgb24gYXJyYXlzIG9mIHZhbHVlcy5cclxuLy8gUmV0dXJucyBuZXcgZXhwcmVzc2lvbiBsaWtlIHYxIG9wIHYyIG9wIHYzIC4uLlxyXG4vL1xyXG4vLyAtIEFueSBpZGVudGl0eVZhbHVlJ3MgaW4gYXJyYXkgaW5wdXQgYXJlIGlnbm9yZWQuXHJcbi8vIC0gSWYgemVyb1ZhbHVlIGlzIGZvdW5kIC0ganVzdCByZXR1cm4gemVyb1ZhbHVlLlxyXG4vL1xyXG4vLyBPdXIgZnVuY3Rpb24gcmUtb3JkZXJzIHRvcC1sZXZlbCBvcCBpbiBhcnJheSBlbGVtZW50cyB0byB0aGUgcmVzdWx0aW5nXHJcbi8vIGV4cHJlc3Npb24gaXMgbGVmdC1hc3NvY2lhdGluZy4gIEUuZy46XHJcbi8vXHJcbi8vICAgIFthICYmIGIsIGMgJiYgZF0gPT4gKCgoYSAmJiBiKSAmJiBjKSAmJiBkKVxyXG4vLyAgICAoTk9UIChhICYmIGIpICYmIChjICYmIGQpKVxyXG5mdW5jdGlvbiBsZWZ0QXNzb2NpYXRlR2VuKG9wVHlwZTogc3RyaW5nLCBpZGVudGl0eVZhbHVlOiBFeHBWYWx1ZSwgemVyb1ZhbHVlOiBFeHBWYWx1ZSkge1xyXG4gIHJldHVybiBmdW5jdGlvbihhOiBFeHBbXSk6IEV4cCB7XHJcbiAgICB2YXIgaTtcclxuXHJcbiAgICBmdW5jdGlvbiByZWR1Y2VyKHJlc3VsdCwgY3VycmVudCkge1xyXG4gICAgICBpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICByZXR1cm4gY3VycmVudDtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gb3Aob3BUeXBlLCBbcmVzdWx0LCBjdXJyZW50XSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRmlyc3QgZmxhdHRlbiBhbGwgdG9wLWxldmVsIG9wIHZhbHVlcyB0byBvbmUgZmxhdCBhcnJheS5cclxuICAgIHZhciBmbGF0ID0gW107XHJcbiAgICBmb3IgKGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xyXG4gICAgICBmbGF0dGVuKG9wVHlwZSwgYVtpXSwgZmxhdCk7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHJlc3VsdCA9IFtdO1xyXG4gICAgZm9yIChpID0gMDsgaSA8IGZsYXQubGVuZ3RoOyBpKyspIHtcclxuICAgICAgLy8gUmVtb3ZlIGlkZW50aWZ5VmFsdWVzIGZyb20gYXJyYXkuXHJcbiAgICAgIGlmIChjbXBWYWx1ZXMoZmxhdFtpXSwgaWRlbnRpdHlWYWx1ZSkpIHtcclxuICAgICAgICBjb250aW51ZTtcclxuICAgICAgfVxyXG4gICAgICAvLyBKdXN0IHJldHVybiB6ZXJvVmFsdWUgaWYgZm91bmRcclxuICAgICAgaWYgKGNtcFZhbHVlcyhmbGF0W2ldLCB6ZXJvVmFsdWUpKSB7XHJcbiAgICAgICAgcmV0dXJuIHplcm9WYWx1ZTtcclxuICAgICAgfVxyXG4gICAgICByZXN1bHQucHVzaChmbGF0W2ldKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocmVzdWx0Lmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICByZXR1cm4gaWRlbnRpdHlWYWx1ZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZXR1cm4gbGVmdC1hc3NvY2lhdGl2ZSBleHByZXNzaW9uIG9mIG9wVHlwZS5cclxuICAgIHJldHVybiByZXN1bHQucmVkdWNlKHJlZHVjZXIpO1xyXG4gIH07XHJcbn1cclxuXHJcbi8vIEZsYXR0ZW4gdGhlIHRvcCBsZXZlbCB0cmVlIG9mIG9wIGludG8gYSBzaW5nbGUgZmxhdCBhcnJheSBvZiBleHByZXNzaW9ucy5cclxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW4ob3BUeXBlOiBzdHJpbmcsIGV4cDogRXhwLCBmbGF0PzogRXhwW10pOiBFeHBbXSB7XHJcbiAgdmFyIGk7XHJcblxyXG4gIGlmIChmbGF0ID09PSB1bmRlZmluZWQpIHtcclxuICAgIGZsYXQgPSBbXTtcclxuICB9XHJcblxyXG4gIGlmICghaXNPcChvcFR5cGUsIGV4cCkpIHtcclxuICAgIGZsYXQucHVzaChleHApO1xyXG4gICAgcmV0dXJuIGZsYXQ7XHJcbiAgfVxyXG5cclxuICBmb3IgKGkgPSAwOyBpIDwgKDxFeHBPcD4gZXhwKS5hcmdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICBmbGF0dGVuKG9wVHlwZSwgKDxFeHBPcD4gZXhwKS5hcmdzW2ldLCBmbGF0KTtcclxuICB9XHJcblxyXG4gIHJldHVybiBmbGF0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gb3Aob3BUeXBlLCBhcmdzKTogRXhwT3Age1xyXG4gIHJldHVybiB7XHJcbiAgICB0eXBlOiAnb3AnLCAgICAgLy8gVGhpcyBpcyAobXVsdGktYXJndW1lbnQpIG9wZXJhdG9yLlxyXG4gICAgdmFsdWVUeXBlOiAnQW55JyxcclxuICAgIG9wOiBvcFR5cGUsICAgICAvLyBUaGUgb3BlcmF0b3IgKHN0cmluZywgZS5nLiAnKycpLlxyXG4gICAgYXJnczogYXJncyAgICAgIC8vIEFyZ3VtZW50cyB0byB0aGUgb3BlcmF0b3IgQXJyYXk8ZXhwPlxyXG4gIH07XHJcbn1cclxuXHJcbi8vIFdhcm5pbmc6IE5PVCBhbiBleHByZXNzaW9uIHR5cGUhXHJcbmV4cG9ydCBmdW5jdGlvbiBtZXRob2QocGFyYW1zOiBzdHJpbmdbXSwgYm9keTogRXhwKTogTWV0aG9kIHtcclxuICByZXR1cm4ge1xyXG4gICAgcGFyYW1zOiBwYXJhbXMsXHJcbiAgICBib2R5OiBib2R5XHJcbiAgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHR5cGVUeXBlKHR5cGVOYW1lOiBzdHJpbmcpOiBFeHBTaW1wbGVUeXBlIHtcclxuICByZXR1cm4geyB0eXBlOiBcInR5cGVcIiwgdmFsdWVUeXBlOiBcInR5cGVcIiwgbmFtZTogdHlwZU5hbWUgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHVuaW9uVHlwZSh0eXBlczogRXhwVHlwZVtdKTogRXhwVW5pb25UeXBlIHtcclxuICByZXR1cm4geyB0eXBlOiBcInVuaW9uXCIsIHZhbHVlVHlwZTogXCJ0eXBlXCIsIHR5cGVzOiB0eXBlcyB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJpY1R5cGUodHlwZU5hbWU6IHN0cmluZywgcGFyYW1zOiBFeHBUeXBlW10pOiBFeHBHZW5lcmljVHlwZSB7XHJcbiAgcmV0dXJuIHsgdHlwZTogXCJnZW5lcmljXCIsIHZhbHVlVHlwZTogXCJ0eXBlXCIsIG5hbWU6IHR5cGVOYW1lLCBwYXJhbXM6IHBhcmFtcyB9O1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgU3ltYm9scyB7XHJcbiAgZnVuY3Rpb25zOiB7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfTtcclxuICBwYXRoczogUGF0aFtdO1xyXG4gIHNjaGVtYTogeyBbbmFtZTogc3RyaW5nXTogU2NoZW1hIH07XHJcbiAgaW1wb3J0czogSW1wb3J0W10gO1xyXG5cclxuICBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHRoaXMuZnVuY3Rpb25zID0ge307XHJcbiAgICB0aGlzLnBhdGhzID0gW107XHJcbiAgICB0aGlzLnNjaGVtYSA9IHt9O1xyXG4gICAgdGhpcy5pbXBvcnRzID0gW107XHJcbiAgfVxyXG5cclxuICByZWdpc3Rlcih0eXBlOiBzdHJpbmcsIG5hbWU6IHN0cmluZywgb2JqZWN0OiBhbnkpIHtcclxuICAgIGlmICghdGhpc1t0eXBlXSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIHJlZ2lzdHJhdGlvbiB0eXBlOiBcIiArIHR5cGUpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzW3R5cGVdW25hbWVdKSB7XHJcbiAgICAgIGxvZ2dlci5lcnJvcihcIkR1cGxpY2F0ZWQgXCIgKyB0eXBlICsgXCIgZGVmaW5pdGlvbjogXCIgKyBuYW1lICsgXCIuXCIpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgdGhpc1t0eXBlXVtuYW1lXSA9IG9iamVjdDtcclxuICAgIH1cclxuICAgIHJldHVybiB0aGlzW3R5cGVdW25hbWVdO1xyXG4gIH1cclxuXHJcbiAgcmVnaXN0ZXJGdW5jdGlvbihuYW1lOiBzdHJpbmcsIHBhcmFtczogc3RyaW5nW10sIGJvZHk6IEV4cCk6IE1ldGhvZCB7XHJcbiAgICByZXR1cm4gPE1ldGhvZD4gdGhpcy5yZWdpc3RlcignZnVuY3Rpb25zJywgbmFtZSwgbWV0aG9kKHBhcmFtcywgYm9keSkpO1xyXG4gIH1cclxuXHJcbiAgcmVnaXN0ZXJJbXBvcnQoYWxpYXM6IHN0cmluZywgZGF0YTogc3RyaW5nLCBzY29wZTogc3RyaW5nKTogSW1wb3J0IHtcclxuICAgIC8vIHR5cGUsIG5hbWUsIGRhdGFcclxuICAgIHZhciB0aGVTY29wZSA9IGZhbHNlO1xyXG4gICAgaWYgKHNjb3BlKSB7XHJcbiAgICAgIHRoZVNjb3BlID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIHZhciB0aGVBbGlhcyA9IFwiXCI7XHJcbiAgICBpZiAoYWxpYXMpIHtcclxuICAgICAgdGhlQWxpYXMgPSBhbGlhcztcclxuICAgIH1cclxuXHJcbiAgICB2YXIgaTogSW1wb3J0ID0ge1xyXG4gICAgICBmaWxlbmFtZSA6IGRhdGEsXHJcbiAgICAgIGFsaWFzOiB0aGVBbGlhcyxcclxuICAgICAgc2NvcGU6ICF0aGVTY29wZVxyXG4gICAgfTtcclxuICAgIHRoaXMuaW1wb3J0cy5wdXNoKGkpO1xyXG4gICAgcmV0dXJuIGk7XHJcbiAgfVxyXG5cclxuICByZWdpc3RlclBhdGgodGVtcGxhdGU6IFBhdGhUZW1wbGF0ZSwgaXNUeXBlOiBFeHBUeXBlIHwgdm9pZCwgbWV0aG9kczogeyBbbmFtZTogc3RyaW5nXTogTWV0aG9kOyB9ID0ge30pOiBQYXRoIHtcclxuICAgIGlzVHlwZSA9IGlzVHlwZSB8fCB0eXBlVHlwZSgnQW55Jyk7XHJcbiAgICB2YXIgcDogUGF0aCA9IHtcclxuICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlLmNvcHkoKSxcclxuICAgICAgaXNUeXBlOiA8RXhwVHlwZT4gaXNUeXBlLFxyXG4gICAgICBtZXRob2RzOiBtZXRob2RzXHJcbiAgICB9O1xyXG4gICAgdGhpcy5wYXRocy5wdXNoKHApO1xyXG4gICAgcmV0dXJuIHA7XHJcbiAgfVxyXG5cclxuICByZWdpc3RlclNjaGVtYShuYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgZGVyaXZlZEZyb20/OiBFeHBUeXBlLFxyXG4gICAgICAgICAgICAgICAgIHByb3BlcnRpZXMgPSA8VHlwZVBhcmFtcz4ge30sXHJcbiAgICAgICAgICAgICAgICAgbWV0aG9kcyA9IDx7IFtuYW1lOiBzdHJpbmddOiBNZXRob2QgfT4ge30sXHJcbiAgICAgICAgICAgICAgICAgcGFyYW1zID0gPHN0cmluZ1tdPiBbXSk6IFNjaGVtYSB7XHJcbiAgICBkZXJpdmVkRnJvbSA9IGRlcml2ZWRGcm9tIHx8IHR5cGVUeXBlKE9iamVjdC5rZXlzKHByb3BlcnRpZXMpLmxlbmd0aCA+IDAgPyAnT2JqZWN0JyA6ICdBbnknKTtcclxuXHJcbiAgICB2YXIgczogU2NoZW1hID0ge1xyXG4gICAgICBkZXJpdmVkRnJvbTogPEV4cFR5cGU+IGRlcml2ZWRGcm9tLFxyXG4gICAgICBwcm9wZXJ0aWVzOiBwcm9wZXJ0aWVzLFxyXG4gICAgICBtZXRob2RzOiBtZXRob2RzLFxyXG4gICAgICBwYXJhbXM6IHBhcmFtcyxcclxuICAgIH07XHJcbiAgICByZXR1cm4gPFNjaGVtYT4gdGhpcy5yZWdpc3Rlcignc2NoZW1hJywgbmFtZSwgcyk7XHJcbiAgfVxyXG5cclxuICBpc0Rlcml2ZWRGcm9tKHR5cGU6IEV4cFR5cGUsIGFuY2VzdG9yOiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIGlmIChhbmNlc3RvciA9PT0gJ0FueScpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgc3dpdGNoICh0eXBlLnR5cGUpIHtcclxuICAgIGNhc2UgJ3R5cGUnOlxyXG4gICAgY2FzZSAnZ2VuZXJpYyc6XHJcbiAgICAgIGxldCBzaW1wbGVUeXBlID0gPEV4cFNpbXBsZVR5cGU+IHR5cGU7XHJcbiAgICAgIGlmIChzaW1wbGVUeXBlLm5hbWUgPT09IGFuY2VzdG9yKSB7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHNpbXBsZVR5cGUubmFtZSA9PT0gJ0FueScpIHtcclxuICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgIH1cclxuICAgICAgbGV0IHNjaGVtYSA9IHRoaXMuc2NoZW1hW3NpbXBsZVR5cGUubmFtZV07XHJcbiAgICAgIGlmICghc2NoZW1hKSB7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiB0aGlzLmlzRGVyaXZlZEZyb20oc2NoZW1hLmRlcml2ZWRGcm9tLCBhbmNlc3Rvcik7XHJcblxyXG4gICAgY2FzZSAndW5pb24nOlxyXG4gICAgICByZXR1cm4gKDxFeHBVbmlvblR5cGU+IHR5cGUpLnR5cGVzXHJcbiAgICAgICAgLm1hcCgoc3ViVHlwZSkgPT4gdGhpcy5pc0Rlcml2ZWRGcm9tKHN1YlR5cGUsIGFuY2VzdG9yKSlcclxuICAgICAgICAucmVkdWNlKHV0aWwub3IpO1xyXG5cclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gdHlwZTogXCIgKyB0eXBlLnR5cGUpO1xyXG4gICAgICB9XHJcbiAgfVxyXG59XHJcblxyXG4vLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9KYXZhU2NyaXB0L1JlZmVyZW5jZS9PcGVyYXRvcnMvT3BlcmF0b3JfUHJlY2VkZW5jZVxyXG5pbnRlcmZhY2UgT3BQcmlvcml0eSB7XHJcbiAgcmVwPzogc3RyaW5nO1xyXG4gIHA6IG51bWJlcjtcclxufVxyXG5cclxudmFyIEpTX09QUzogeyBbb3A6IHN0cmluZ106IE9wUHJpb3JpdHk7IH0gPSB7XHJcbiAgJ3ZhbHVlJzogeyByZXA6IFwiXCIsIHA6IDE4IH0sXHJcblxyXG4gICduZWcnOiB7IHJlcDogXCItXCIsIHA6IDE1fSxcclxuICAnISc6IHsgcDogMTV9LFxyXG4gICcqJzogeyBwOiAxNH0sXHJcbiAgJy8nOiB7IHA6IDE0fSxcclxuICAnJSc6IHsgcDogMTR9LFxyXG4gICcrJzogeyBwOiAxMyB9LFxyXG4gICctJzogeyBwOiAxMyB9LFxyXG4gICc8JzogeyBwOiAxMSB9LFxyXG4gICc8PSc6IHsgcDogMTEgfSxcclxuICAnPic6IHsgcDogMTEgfSxcclxuICAnPj0nOiB7IHA6IDExIH0sXHJcbiAgJ2luJzogeyBwOiAxMSB9LFxyXG4gICc9PSc6IHsgcDogMTAgfSxcclxuICBcIiE9XCI6IHsgcDogMTAgfSxcclxuICAnJiYnOiB7IHA6IDYgfSxcclxuICAnfHwnOiB7IHA6IDUgfSxcclxuICAnPzonOiB7IHA6IDQgfSxcclxuICAnLCc6IHsgcDogMH0sXHJcbn07XHJcblxyXG4vLyBGcm9tIGFuIEFTVCwgZGVjb2RlIGFzIGFuIGV4cHJlc3Npb24gKHN0cmluZykuXHJcbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVFeHByZXNzaW9uKGV4cDogRXhwLCBvdXRlclByZWNlZGVuY2U/OiBudW1iZXIpOiBzdHJpbmcge1xyXG4gIGlmIChvdXRlclByZWNlZGVuY2UgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgb3V0ZXJQcmVjZWRlbmNlID0gMDtcclxuICB9XHJcbiAgdmFyIGlubmVyUHJlY2VkZW5jZSA9IHByZWNlZGVuY2VPZihleHApO1xyXG4gIHZhciByZXN1bHQ7XHJcbiAgc3dpdGNoIChleHAudHlwZSkge1xyXG4gIGNhc2UgJ0Jvb2xlYW4nOlxyXG4gIGNhc2UgJ051bWJlcic6XHJcbiAgICByZXN1bHQgPSBKU09OLnN0cmluZ2lmeSgoPEV4cFZhbHVlPiBleHApLnZhbHVlKTtcclxuICAgIGJyZWFrO1xyXG5cclxuICBjYXNlICdTdHJpbmcnOlxyXG4gICAgcmVzdWx0ID0gdXRpbC5xdW90ZVN0cmluZygoPEV4cFZhbHVlPiBleHApLnZhbHVlKTtcclxuICAgIGJyZWFrO1xyXG5cclxuICAvLyBSZWdFeHAgYXNzdW1lZCB0byBiZSBpbiBwcmUtcXVvdGVkIGZvcm1hdC5cclxuICBjYXNlICdSZWdFeHAnOlxyXG4gICAgbGV0IHJlZ2V4cCA9IDxSZWdFeHBWYWx1ZT4gZXhwO1xyXG4gICAgcmVzdWx0ID0gJy8nICsgcmVnZXhwLnZhbHVlICsgJy8nO1xyXG4gICAgaWYgKHJlZ2V4cC5tb2RpZmllcnMgIT09ICcnKSB7XHJcbiAgICAgIHJlc3VsdCArPSByZWdleHAubW9kaWZpZXJzO1xyXG4gICAgfVxyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ0FycmF5JzpcclxuICAgIHJlc3VsdCA9ICdbJyArIGRlY29kZUFycmF5KCg8RXhwVmFsdWU+IGV4cCkudmFsdWUpICsgJ10nO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ051bGwnOlxyXG4gICAgcmVzdWx0ID0gJ251bGwnO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ3Zhcic6XHJcbiAgY2FzZSAnbGl0ZXJhbCc6XHJcbiAgICByZXN1bHQgPSAoPEV4cFZhcmlhYmxlPiBleHApLm5hbWU7XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAncmVmJzpcclxuICAgIGxldCBleHBSZWYgPSA8RXhwUmVmZXJlbmNlPiBleHA7XHJcbiAgICBpZiAoaXNJZGVudGlmaWVyU3RyaW5nRXhwKGV4cFJlZi5hY2Nlc3NvcikpIHtcclxuICAgICAgcmVzdWx0ID0gZGVjb2RlRXhwcmVzc2lvbihleHBSZWYuYmFzZSwgaW5uZXJQcmVjZWRlbmNlKSArICcuJyArICg8RXhwVmFsdWU+IGV4cFJlZi5hY2Nlc3NvcikudmFsdWU7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cFJlZi5iYXNlLCBpbm5lclByZWNlZGVuY2UpICtcclxuICAgICAgICAnWycgKyBkZWNvZGVFeHByZXNzaW9uKGV4cFJlZi5hY2Nlc3NvcikgKyAnXSc7XHJcbiAgICB9XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAnY2FsbCc6XHJcbiAgICBsZXQgZXhwQ2FsbCA9IDxFeHBDYWxsPiBleHA7XHJcbiAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cENhbGwucmVmKSArICcoJyArIGRlY29kZUFycmF5KGV4cENhbGwuYXJncykgKyAnKSc7XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAnYnVpbHRpbic6XHJcbiAgICByZXN1bHQgPSBkZWNvZGVFeHByZXNzaW9uKGV4cCk7XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAnb3AnOlxyXG4gICAgbGV0IGV4cE9wID0gPEV4cE9wPiBleHA7XHJcbiAgICB2YXIgcmVwID0gSlNfT1BTW2V4cE9wLm9wXS5yZXAgPT09IHVuZGVmaW5lZCA/IGV4cE9wLm9wIDogSlNfT1BTW2V4cE9wLm9wXS5yZXA7XHJcbiAgICBpZiAoZXhwT3AuYXJncy5sZW5ndGggPT09IDEpIHtcclxuICAgICAgcmVzdWx0ID0gcmVwICsgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdLCBpbm5lclByZWNlZGVuY2UpO1xyXG4gICAgfSBlbHNlIGlmIChleHBPcC5hcmdzLmxlbmd0aCA9PT0gMikge1xyXG4gICAgICByZXN1bHQgPVxyXG4gICAgICAgIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSwgaW5uZXJQcmVjZWRlbmNlKSArXHJcbiAgICAgICAgJyAnICsgcmVwICsgJyAnICtcclxuICAgICAgICAvLyBBbGwgb3BzIGFyZSBsZWZ0IGFzc29jaWF0aXZlIC0gc28gbnVkZ2UgdGhlIGlubmVyUHJlY2VuZGVuY2VcclxuICAgICAgICAvLyBkb3duIG9uIHRoZSByaWdodCBoYW5kIHNpZGUgdG8gZm9yY2UgKCkgZm9yIHJpZ2h0LWFzc29jaWF0aW5nXHJcbiAgICAgICAgLy8gb3BlcmF0aW9ucy5cclxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0sIGlubmVyUHJlY2VkZW5jZSArIDEpO1xyXG4gICAgfSBlbHNlIGlmIChleHBPcC5hcmdzLmxlbmd0aCA9PT0gMykge1xyXG4gICAgICByZXN1bHQgPVxyXG4gICAgICAgIGRlY29kZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSwgaW5uZXJQcmVjZWRlbmNlKSArICcgPyAnICtcclxuICAgICAgICBkZWNvZGVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0sIGlubmVyUHJlY2VkZW5jZSkgKyAnIDogJyArXHJcbiAgICAgICAgZGVjb2RlRXhwcmVzc2lvbihleHBPcC5hcmdzWzJdLCBpbm5lclByZWNlZGVuY2UpO1xyXG4gICAgfVxyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ3R5cGUnOlxyXG4gICAgcmVzdWx0ID0gKDxFeHBTaW1wbGVUeXBlPiBleHApLm5hbWU7XHJcbiAgICBicmVhaztcclxuXHJcbiAgY2FzZSAndW5pb24nOlxyXG4gICAgcmVzdWx0ID0gKDxFeHBVbmlvblR5cGU+IGV4cCkudHlwZXMubWFwKGRlY29kZUV4cHJlc3Npb24pLmpvaW4oJyB8ICcpO1xyXG4gICAgYnJlYWs7XHJcblxyXG4gIGNhc2UgJ2dlbmVyaWMnOlxyXG4gICAgbGV0IGdlbmVyaWNUeXBlID0gPEV4cEdlbmVyaWNUeXBlPiBleHA7XHJcbiAgICByZXR1cm4gZ2VuZXJpY1R5cGUubmFtZSArICc8JyArIGRlY29kZUFycmF5KGdlbmVyaWNUeXBlLnBhcmFtcykgKyAnPic7XHJcblxyXG4gIGRlZmF1bHQ6XHJcbiAgICByZXN1bHQgPSBcIioqKlVOS05PV04gVFlQRSoqKiAoXCIgKyBleHAudHlwZSArIFwiKVwiO1xyXG4gICAgYnJlYWs7XHJcbiAgfVxyXG5cclxuICBpZiAoaW5uZXJQcmVjZWRlbmNlIDwgb3V0ZXJQcmVjZWRlbmNlKSB7XHJcbiAgICByZXN1bHQgPSAnKCcgKyByZXN1bHQgKyAnKSc7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5mdW5jdGlvbiBkZWNvZGVBcnJheShhcmdzOiBFeHBbXSk6IHN0cmluZyB7XHJcbiAgcmV0dXJuIGFyZ3MubWFwKGRlY29kZUV4cHJlc3Npb24pLmpvaW4oJywgJyk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZWNlZGVuY2VPZihleHA6IEV4cCk6IG51bWJlciB7XHJcbiAgbGV0IHJlc3VsdDogbnVtYmVyO1xyXG5cclxuICBzd2l0Y2ggKGV4cC50eXBlKSB7XHJcbiAgY2FzZSAnb3AnOlxyXG4gICAgcmVzdWx0ID0gSlNfT1BTWyg8RXhwT3A+IGV4cCkub3BdLnA7XHJcbiAgICBicmVhaztcclxuXHJcbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvT3BlcmF0b3JzL09wZXJhdG9yX1ByZWNlZGVuY2VcclxuICAvLyBsaXN0cyBjYWxsIGFzIDE3IGFuZCByZWYgYXMgMTggLSBidXQgaG93IGNvdWxkIHRoZXkgYmUgYW55dGhpbmcgb3RoZXIgdGhhbiBsZWZ0IHRvIHJpZ2h0P1xyXG4gIC8vIGh0dHA6Ly93d3cuc2NyaXB0aW5nbWFzdGVyLmNvbS9qYXZhc2NyaXB0L29wZXJhdG9yLXByZWNlZGVuY2UuYXNwIC0gYWdyZWVzLlxyXG4gIGNhc2UgJ2NhbGwnOlxyXG4gICAgcmVzdWx0ID0gMTg7XHJcbiAgICBicmVhaztcclxuICBjYXNlICdyZWYnOlxyXG4gICAgcmVzdWx0ID0gMTg7XHJcbiAgICBicmVhaztcclxuICBkZWZhdWx0OlxyXG4gICAgcmVzdWx0ID0gMTk7XHJcbiAgICBicmVhaztcclxuICB9XHJcblxyXG4gIHJldHVybiByZXN1bHQ7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
