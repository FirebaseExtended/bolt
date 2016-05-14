"use strict";
var util = require('./util');
var ast = require('./ast');
var logger = require('./logger');
var parseUtil = require('./parse-util');
var parseExpression = parseUtil.parseExpression;
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
var valueMethods = ['length', 'includes', 'startsWith', 'beginsWith', 'endsWith',
    'replace', 'toLowerCase', 'toUpperCase', 'test', 'contains',
    'matches'];
var snapshotMethods = ['parent', 'child', 'hasChildren', 'val', 'isString', 'isNumber',
    'isBoolean'].concat(valueMethods);
var writeAliases = {
    'create': parseExpression('prior(this) == null'),
    'update': parseExpression('prior(this) != null && this != null'),
    'delete': parseExpression('prior(this) != null && this == null')
};
var Generator = (function () {
    function Generator(symbols) {
        this.symbols = symbols;
        this.validators = {};
        this.rules = {};
        this.errorCount = 0;
        this.runSilently = false;
        this.allowUndefinedFunctions = false;
        this.keyIndex = 0;
        this.globals = {
            "root": ast.call(ast.variable('@root'))
        };
        this.registerBuiltinSchema();
    }
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
        util.deletePropName(this.rules, '$$scope');
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
                logger.warn(m + util.quoteString(method) +
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
        this.symbols.registerSchema('Null', ast.typeType('Any'), undefined, {
            validate: ast.method(['this'], ast.eq(thisVar, ast.nullType()))
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
    Generator.prototype.getMapValidator = function (params) {
        var keyType = params[0];
        var valueType = params[1];
        if (keyType.type !== 'type' || !this.symbols.isDerivedFrom(keyType, 'String')) {
            throw new Error(errors.invalidMapKey + "  (" + ast.decodeExpression(keyType) + " does not)");
        }
        var validator = {};
        var index = this.uniqueKey();
        validator[index] = {};
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
    Generator.prototype.isCollectionSchema = function (schema) {
        var props = Object.keys(schema.properties);
        var result = props.length === 1 && props[0][0] === '$';
        return result;
    };
    Generator.prototype.ensureValidator = function (type) {
        var key = ast.decodeExpression(type);
        if (!this.validators[key]) {
            this.validators[key] = { '.validate': ast.literal('***TYPE RECURSION***') };
            this.validators[key] = this.createValidator(type);
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
        if (!schema || !this.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " (generic)");
        }
        if (params.length !== schema.params.length) {
            throw new Error(errors.invalidGeneric + " expected <" + schema.params.join(', ') + ">");
        }
        if (schema.getValidator) {
            return schema.getValidator(params);
        }
        var bindings = {};
        for (var i = 0; i < params.length; i++) {
            bindings[schema.params[i]] = params[i];
        }
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
        if (this.isGeneric(schema)) {
            throw new Error(errors.noSuchType + schemaName + " used as non-generic type.");
        }
        return this.createValidatorFromSchema(schema);
    };
    Generator.prototype.isGeneric = function (schema) {
        return schema.params.length > 0;
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
            extendValidator(validator, { '.validate': [hasChildrenExp(requiredProperties)] });
        }
        if (hasProps) {
            validator['$other'] = {};
            extendValidator(validator['$other'], { '.validate': ast.boolean(false) });
        }
        this.extendValidationMethods(validator, schema.methods);
        return validator;
    };
    Generator.prototype.isNullableType = function (type) {
        var result = this.symbols.isDerivedFrom(type, 'Null') || this.symbols.isDerivedFrom(type, 'Map');
        return result;
    };
    Generator.prototype.updateRules = function (path) {
        var i;
        var location = util.ensureObjectPath(this.rules, path.template.getLabels());
        var exp;
        extendValidator(location, this.ensureValidator(path.isType));
        location['$$scope'] = path.template.getScope();
        this.extendValidationMethods(location, path.methods);
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
    Generator.prototype.unionValidators = function (schema) {
        var union = {};
        schema.forEach(function (typeName) {
            var singleType = extendValidator({}, this.ensureValidator(typeName));
            mapValidator(singleType, ast.andArray);
            extendValidator(union, singleType);
        }.bind(this));
        mapValidator(union, ast.orArray);
        return union;
    };
    Generator.prototype.convertExpressions = function (validator) {
        var methodThisIs = { '.validate': 'newData',
            '.read': 'data',
            '.write': 'newData' };
        mapValidator(validator, function (value, prop, scope, path) {
            if (prop in methodThisIs) {
                var result = this.getExpressionText(ast.andArray(collapseHasChildren(value)), methodThisIs[prop], scope, path);
                if (prop === '.validate' && result === 'true' ||
                    (prop === '.read' || prop === '.write') && result === 'false') {
                    return undefined;
                }
                return result;
            }
            return value;
        }.bind(this));
    };
    Generator.prototype.getExpressionText = function (exp, thisIs, scope, path) {
        if (!('type' in exp)) {
            throw new Error(errors.application + "Not an expression: " + util.prettyJSON(exp));
        }
        this.allowUndefinedFunctions = true;
        scope = util.extend({}, scope, { 'this': ast.cast(ast.call(ast.variable('@getThis')), 'Snapshot') });
        exp = this.partialEval(exp, scope);
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
        exp = ast.ensureBoolean(exp);
        return ast.decodeExpression(exp);
    };
    Generator.prototype.partialEval = function (exp, params, functionCalls) {
        if (params === void 0) { params = {}; }
        if (functionCalls === void 0) { functionCalls = {}; }
        var result = this.partialEvalReal(exp, params, functionCalls);
        return result;
    };
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
            return params[exp2.name] || self.globals[exp2.name] || exp2;
        }
        switch (exp.type) {
            case 'op':
                var expOp = ast.copyExp(exp);
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
                function snapshotChild(ref) {
                    return ast.cast(ast.call(ast.reference(ref.base, ast.string('child')), [ref.accessor]), 'Snapshot');
                }
                var expRef = ast.copyExp(exp);
                expRef.base = subExpression(expRef.base);
                if (expRef.base.valueType !== 'Snapshot') {
                    expRef.accessor = subExpression(expRef.accessor);
                    return expRef;
                }
                var propName = ast.getPropName(expRef);
                if (propName !== '') {
                    if (util.arrayIncludes(valueMethods, propName)) {
                        expRef.base = valueExpression(expRef.base);
                        return expRef;
                    }
                    if (util.arrayIncludes(snapshotMethods, propName)) {
                        return expRef;
                    }
                }
                expRef.accessor = valueExpression(expRef.accessor);
                return snapshotChild(expRef);
            case 'call':
                var expCall = ast.copyExp(exp);
                expCall.ref = subExpression(expCall.ref);
                var callee = this.lookupFunction(expCall.ref);
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
                if (ast.getMethodName(expCall) === 'parent') {
                    expCall = ast.cast(expCall, 'Snapshot');
                }
                return expCall;
            default:
                return exp;
        }
    };
    Generator.prototype.prior = function (args, params) {
        var lastThisIs = this.thisIs;
        this.thisIs = 'data';
        var exp = this.partialEval(args[0], params);
        this.thisIs = lastThisIs;
        return exp;
    };
    Generator.prototype.getThis = function (args, params) {
        return ast.snapshotVariable(this.thisIs);
    };
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
    Generator.prototype.getKey = function (key, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.mismatchParams + "(found " + args.length + " but expected 1)");
        }
        return key[0] === '$' ? ast.literal(key) : ast.string(key);
    };
    Generator.prototype.getRootReference = function (path, args, params) {
        if (args.length !== 0) {
            throw new Error(errors.application + "@root arguments.");
        }
        if (this.thisIs === 'data') {
            return ast.snapshotVariable('root');
        }
        var result = ast.snapshotVariable('newData');
        for (var i = 0; i < path.length(); i++) {
            result = ast.snapshotParent(result);
        }
        return result;
    };
    Generator.prototype.lookupFunction = function (ref) {
        if (ref.type === 'var') {
            var refVar = ref;
            var fn = this.symbols.functions[refVar.name];
            if (!fn) {
                return undefined;
            }
            return { self: undefined, fn: fn, methodName: refVar.name };
        }
        if (ref.type === 'ref') {
            var refRef = ref;
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
        logger.error(s);
        this.errorCount += 1;
    };
    return Generator;
}());
exports.Generator = Generator;
;
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
function mapValidator(v, fn, scope, path) {
    if (!scope) {
        scope = {};
    }
    if (!path) {
        path = new ast.PathTemplate();
    }
    if ('$$scope' in v) {
        scope = v['$$scope'];
    }
    for (var prop in v) {
        if (!v.hasOwnProperty(prop)) {
            continue;
        }
        if (prop[0] === '.') {
            v[prop] = fn(v[prop], prop, scope, path);
            if (v[prop] === undefined) {
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
function hasChildrenExp(props) {
    var args = props.length === 0 ? [] : [ast.array(props.map(ast.string))];
    return ast.call(ast.reference(ast.cast(ast.variable('this'), 'Any'), ast.string('hasChildren')), args);
}

//# sourceMappingURL=data:application/json;base64,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LEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEtBQUssQ0FBQyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsRUFDL0UsSUFBSSxDQUFDLENBQUM7QUFDeEIsQ0FBQyIsImZpbGUiOiJydWxlcy1nZW5lcmF0b3IuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ0eXBpbmdzL25vZGUuZC50c1wiIC8+XHJcbmltcG9ydCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XHJcbmltcG9ydCBhc3QgPSByZXF1aXJlKCcuL2FzdCcpO1xyXG5pbXBvcnQgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcclxuaW1wb3J0IHBhcnNlVXRpbCA9IHJlcXVpcmUoJy4vcGFyc2UtdXRpbCcpO1xyXG5sZXQgcGFyc2VFeHByZXNzaW9uID0gcGFyc2VVdGlsLnBhcnNlRXhwcmVzc2lvbjtcclxuXHJcbnZhciBlcnJvcnMgPSB7XHJcbiAgYmFkSW5kZXg6IFwiVGhlIGluZGV4IGZ1bmN0aW9uIG11c3QgcmV0dXJuIGEgU3RyaW5nIG9yIGFuIGFycmF5IG9mIFN0cmluZ3MuXCIsXHJcbiAgbm9QYXRoczogXCJNdXN0IGhhdmUgYXQgbGVhc3Qgb25lIHBhdGggZXhwcmVzc2lvbi5cIixcclxuICBub25PYmplY3Q6IFwiVHlwZSBjb250YWlucyBwcm9wZXJ0aWVzIGFuZCBtdXN0IGV4dGVuZCAnT2JqZWN0Jy5cIixcclxuICBtaXNzaW5nU2NoZW1hOiBcIk1pc3NpbmcgZGVmaW5pdGlvbiBmb3IgdHlwZS5cIixcclxuICByZWN1cnNpdmU6IFwiUmVjdXJzaXZlIGZ1bmN0aW9uIGNhbGwuXCIsXHJcbiAgbWlzbWF0Y2hQYXJhbXM6IFwiSW5jb3JyZWN0IG51bWJlciBvZiBmdW5jdGlvbiBhcmd1bWVudHMuXCIsXHJcbiAgZ2VuZXJhdGVGYWlsZWQ6IFwiQ291bGQgbm90IGdlbmVyYXRlIEpTT046IFwiLFxyXG4gIG5vU3VjaFR5cGU6IFwiTm8gdHlwZSBkZWZpbml0aW9uIGZvcjogXCIsXHJcbiAgYmFkU2NoZW1hTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHR5cGUgc3RhdGVtZW50OiBcIixcclxuICBiYWRQYXRoTWV0aG9kOiBcIlVuc3VwcG9ydGVkIG1ldGhvZCBuYW1lIGluIHBhdGggc3RhdGVtZW50OiBcIixcclxuICBiYWRXcml0ZUFsaWFzOiBcIkNhbm5vdCBoYXZlIGJvdGggYSB3cml0ZSgpIG1ldGhvZCBhbmQgYSB3cml0ZS1hbGlhc2luZyBtZXRob2Q6IFwiLFxyXG4gIGNvZXJjaW9uOiBcIkNhbm5vdCBjb252ZXJ0IHZhbHVlOiBcIixcclxuICB1bmRlZmluZWRGdW5jdGlvbjogXCJVbmRlZmluZWQgZnVuY3Rpb246IFwiLFxyXG4gIGFwcGxpY2F0aW9uOiBcIkJvbHQgYXBwbGljYXRpb24gZXJyb3I6IFwiLFxyXG4gIGludmFsaWRHZW5lcmljOiBcIkludmFsaWQgZ2VuZXJpYyBzY2hlbWEgdXNhZ2U6IFwiLFxyXG4gIGludmFsaWRNYXBLZXk6IFwiTWFwPEtleSwgVD4gLSBLZXkgbXVzdCBkZXJpdmUgZnJvbSBTdHJpbmcgdHlwZS5cIixcclxuICBpbnZhbGlkV2lsZENoaWxkcmVuOiBcIlR5cGVzIGNhbiBoYXZlIGF0IG1vc3Qgb25lICR3aWxkIHByb3BlcnR5IGFuZCBjYW5ub3QgbWl4IHdpdGggb3RoZXIgcHJvcGVydGllcy5cIixcclxuICBpbnZhbGlkUHJvcGVydHlOYW1lOiBcIlByb3BlcnR5IG5hbWVzIGNhbm5vdCBjb250YWluIGFueSBvZjogLiAkICMgWyBdIC8gb3IgY29udHJvbCBjaGFyYWN0ZXJzOiBcIixcclxufTtcclxuXHJcbmxldCBJTlZBTElEX0tFWV9SRUdFWCA9IC9bXFxbXFxdLiMkXFwvXFx1MDAwMC1cXHUwMDFGXFx1MDA3Rl0vO1xyXG5cclxuLypcclxuICAgQSBWYWxpZGF0b3IgaXMgYSBKU09OIGhlcmlhcmNoaWNhbCBzdHJ1Y3R1cmUuIFRoZSBcImxlYXZlc1wiIGFyZSBcImRvdC1wcm9wZXJ0aWVzXCJcclxuICAgKHNlZSBiZWxvdykuIFRoZSBpbnRlcm1lZGlhdGUgbm9kZXMgaW4gdGhlIHRyZWUgYXJlIFwicHJvcFwiIG9yIFwiJHByb3BcIlxyXG4gICBwcm9wZXJ0aWVzLlxyXG5cclxuICAgQSBWYWxpZGF0b3IgaXMgbXV0YXRlZCB0byBoYXZlIGRpZmZlcmVudCBmb3JtcyBiYXNlZCBvbiB0aGUgdGhlIHBoYXNlIG9mXHJcbiAgIGdlbmVyYXRpb24uXHJcblxyXG4gICBJbiB0aGUgZmlyc3QgcGhhc2UsIHRoZXkgYXJlIEV4cFtdLiBMYXRlciB0aGUgRXhwW10gYXJlIEFORGVkIHRvZ2V0aGVyIGFuZFxyXG4gICBjb21iaW5lZCBpbnRvIGV4cHJlc3Npb24gdGV4dCAoYW5kIHJldHVybmVkIGFzIHRoZSBmaW5hbCBKU09OLXJ1bGVzIHRoYXRcclxuICAgRmlyZWJhc2UgdXNlcy5cclxuXHJcbiAgIE5vdGU6IFRTIGRvZXMgbm90IGFsbG93IGZvciBzcGVjaWFsIHByb3BlcnRpZXMgdG8gaGF2ZSBkaXN0aW5jdFxyXG4gICB0eXBlcyBmcm9tIHRoZSAnaW5kZXgnIHByb3BlcnR5IGdpdmVuIGZvciB0aGUgaW50ZXJmYWNlLiAgOi0oXHJcblxyXG4gICAnLnJlYWQnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcud3JpdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcudmFsaWRhdGUnOiBhc3QuRXhwW10gfCBzdHJpbmc7XHJcbiAgICcuaW5kZXhPbic6IHN0cmluZ1tdO1xyXG4gICAnJCRzY29wZSc6IHsgW3ZhcmlhYmxlOiBzdHJpbmddOiBzdHJpbmcgfVxyXG4qL1xyXG5leHBvcnQgdHlwZSBWYWxpZGF0b3JWYWx1ZSA9IGFzdC5FeHAgfCBhc3QuRXhwW10gfCBzdHJpbmcgfCBzdHJpbmdbXSB8IFZhbGlkYXRvcjtcclxuZXhwb3J0IGludGVyZmFjZSBWYWxpZGF0b3Ige1xyXG4gIFtuYW1lOiBzdHJpbmddOiBWYWxpZGF0b3JWYWx1ZTtcclxufTtcclxuXHJcbnZhciBidWlsdGluU2NoZW1hTmFtZXMgPSBbJ0FueScsICdOdWxsJywgJ1N0cmluZycsICdOdW1iZXInLCAnQm9vbGVhbicsICdPYmplY3QnXTtcclxuLy8gTWV0aG9kIG5hbWVzIGFsbG93ZWQgaW4gQm9sdCBmaWxlcy5cclxudmFyIHZhbHVlTWV0aG9kcyA9IFsnbGVuZ3RoJywgJ2luY2x1ZGVzJywgJ3N0YXJ0c1dpdGgnLCAnYmVnaW5zV2l0aCcsICdlbmRzV2l0aCcsXHJcbiAgICAgICAgICAgICAgICAgICAgJ3JlcGxhY2UnLCAndG9Mb3dlckNhc2UnLCAndG9VcHBlckNhc2UnLCAndGVzdCcsICdjb250YWlucycsXHJcbiAgICAgICAgICAgICAgICAgICAgJ21hdGNoZXMnXTtcclxuLy8gVE9ETzogTWFrZSBzdXJlIHVzZXJzIGRvbid0IGNhbGwgaW50ZXJuYWwgbWV0aG9kcy4uLm1ha2UgcHJpdmF0ZSB0byBpbXBsLlxyXG52YXIgc25hcHNob3RNZXRob2RzID0gWydwYXJlbnQnLCAnY2hpbGQnLCAnaGFzQ2hpbGRyZW4nLCAndmFsJywgJ2lzU3RyaW5nJywgJ2lzTnVtYmVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAnaXNCb29sZWFuJ10uY29uY2F0KHZhbHVlTWV0aG9kcyk7XHJcblxyXG52YXIgd3JpdGVBbGlhc2VzID0gPHsgW21ldGhvZDogc3RyaW5nXTogYXN0LkV4cCB9PiB7XHJcbiAgJ2NyZWF0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgPT0gbnVsbCcpLFxyXG4gICd1cGRhdGUnOiBwYXJzZUV4cHJlc3Npb24oJ3ByaW9yKHRoaXMpICE9IG51bGwgJiYgdGhpcyAhPSBudWxsJyksXHJcbiAgJ2RlbGV0ZSc6IHBhcnNlRXhwcmVzc2lvbigncHJpb3IodGhpcykgIT0gbnVsbCAmJiB0aGlzID09IG51bGwnKVxyXG59O1xyXG5cclxuLy8gU3ltYm9scyBjb250YWluczpcclxuLy8gICBmdW5jdGlvbnM6IHt9XHJcbi8vICAgc2NoZW1hOiB7fVxyXG4vLyAgIHBhdGhzOiB7fVxyXG5leHBvcnQgY2xhc3MgR2VuZXJhdG9yIHtcclxuICBzeW1ib2xzOiBhc3QuU3ltYm9scztcclxuICB2YWxpZGF0b3JzOiB7IFtzY2hlbWFOYW1lOiBzdHJpbmddOiBWYWxpZGF0b3I7IH07XHJcbiAgcnVsZXM6IFZhbGlkYXRvcjtcclxuICBlcnJvckNvdW50OiBudW1iZXI7XHJcbiAgcnVuU2lsZW50bHk6IGJvb2xlYW47XHJcbiAgYWxsb3dVbmRlZmluZWRGdW5jdGlvbnM6IGJvb2xlYW47XHJcbiAgZ2xvYmFsczogYXN0LlBhcmFtcztcclxuICB0aGlzSXM6IHN0cmluZztcclxuICBrZXlJbmRleDogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzeW1ib2xzOiBhc3QuU3ltYm9scykge1xyXG4gICAgdGhpcy5zeW1ib2xzID0gc3ltYm9scztcclxuICAgIHRoaXMudmFsaWRhdG9ycyA9IHt9O1xyXG4gICAgdGhpcy5ydWxlcyA9IHt9O1xyXG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcclxuICAgIHRoaXMucnVuU2lsZW50bHkgPSBmYWxzZTtcclxuICAgIHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMgPSBmYWxzZTtcclxuICAgIHRoaXMua2V5SW5kZXggPSAwO1xyXG5cclxuICAgIC8vIFRPRE86IGdsb2JhbHMgc2hvdWxkIGJlIHBhcnQgb2YgdGhpcy5zeW1ib2xzIChuZXN0ZWQgc2NvcGVzKVxyXG4gICAgdGhpcy5nbG9iYWxzID0ge1xyXG4gICAgICBcInJvb3RcIjogYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAcm9vdCcpKSxcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5yZWdpc3RlckJ1aWx0aW5TY2hlbWEoKTtcclxuICB9XHJcblxyXG4gIC8vIFJldHVybiBGaXJlYmFzZSBjb21wYXRpYmxlIFJ1bGVzIEpTT04gZm9yIGEgdGhlIGdpdmVuIHN5bWJvbHMgZGVmaW5pdGlvbnMuXHJcbiAgZ2VuZXJhdGVSdWxlcygpOiBWYWxpZGF0b3Ige1xyXG4gICAgdGhpcy5lcnJvckNvdW50ID0gMDtcclxuICAgIHZhciBwYXRocyA9IHRoaXMuc3ltYm9scy5wYXRocztcclxuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hO1xyXG4gICAgdmFyIG5hbWU7XHJcblxyXG4gICAgcGF0aHMuZm9yRWFjaCgocGF0aCkgPT4ge1xyXG4gICAgICB0aGlzLnZhbGlkYXRlTWV0aG9kcyhlcnJvcnMuYmFkUGF0aE1ldGhvZCwgcGF0aC5tZXRob2RzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBbJ3ZhbGlkYXRlJywgJ3JlYWQnLCAnd3JpdGUnLCAnaW5kZXgnXSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBmb3IgKG5hbWUgaW4gc2NoZW1hKSB7XHJcbiAgICAgIGlmICghdXRpbC5hcnJheUluY2x1ZGVzKGJ1aWx0aW5TY2hlbWFOYW1lcywgbmFtZSkpIHtcclxuICAgICAgICB0aGlzLnZhbGlkYXRlTWV0aG9kcyhlcnJvcnMuYmFkU2NoZW1hTWV0aG9kLCBzY2hlbWFbbmFtZV0ubWV0aG9kcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBbJ3ZhbGlkYXRlJywgJ3JlYWQnLCAnd3JpdGUnXSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBpZiAocGF0aHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLm5vUGF0aHMpO1xyXG4gICAgfVxyXG5cclxuICAgIHBhdGhzLmZvckVhY2goKHBhdGgpID0+IHRoaXMudXBkYXRlUnVsZXMocGF0aCkpO1xyXG4gICAgdGhpcy5jb252ZXJ0RXhwcmVzc2lvbnModGhpcy5ydWxlcyk7XHJcblxyXG4gICAgaWYgKHRoaXMuZXJyb3JDb3VudCAhPT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmdlbmVyYXRlRmFpbGVkICsgdGhpcy5lcnJvckNvdW50ICsgXCIgZXJyb3JzLlwiKTtcclxuICAgIH1cclxuXHJcbiAgICB1dGlsLmRlbGV0ZVByb3BOYW1lKHRoaXMucnVsZXMsICckJHNjb3BlJyk7XHJcbiAgICB1dGlsLnBydW5lRW1wdHlDaGlsZHJlbih0aGlzLnJ1bGVzKTtcclxuXHJcbiAgICByZXR1cm4ge1xyXG4gICAgICBydWxlczogdGhpcy5ydWxlc1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHZhbGlkYXRlTWV0aG9kcyhtOiBzdHJpbmcsIG1ldGhvZHM6IHsgW25hbWU6IHN0cmluZ106IGFzdC5NZXRob2QgfSwgYWxsb3dlZDogc3RyaW5nW10pIHtcclxuICAgIGlmICh1dGlsLmFycmF5SW5jbHVkZXMoYWxsb3dlZCwgJ3dyaXRlJykpIHtcclxuICAgICAgYWxsb3dlZCA9IGFsbG93ZWQuY29uY2F0KE9iamVjdC5rZXlzKHdyaXRlQWxpYXNlcykpO1xyXG4gICAgfVxyXG4gICAgZm9yICh2YXIgbWV0aG9kIGluIG1ldGhvZHMpIHtcclxuICAgICAgaWYgKCF1dGlsLmFycmF5SW5jbHVkZXMoYWxsb3dlZCwgbWV0aG9kKSkge1xyXG4gICAgICAgIGxvZ2dlci53YXJuKG0gKyB1dGlsLnF1b3RlU3RyaW5nKG1ldGhvZCkgK1xyXG4gICAgICAgICAgICAgICAgICAgIFwiIChhbGxvd2VkOiBcIiArIGFsbG93ZWQubWFwKHV0aWwucXVvdGVTdHJpbmcpLmpvaW4oJywgJykgKyBcIilcIik7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICgnd3JpdGUnIGluIG1ldGhvZHMpIHtcclxuICAgICAgT2JqZWN0LmtleXMod3JpdGVBbGlhc2VzKS5mb3JFYWNoKChhbGlhcykgPT4ge1xyXG4gICAgICAgIGlmIChhbGlhcyBpbiBtZXRob2RzKSB7XHJcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5iYWRXcml0ZUFsaWFzICsgYWxpYXMpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZWdpc3RlckJ1aWx0aW5TY2hlbWEoKSB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICB2YXIgdGhpc1ZhciA9IGFzdC52YXJpYWJsZSgndGhpcycpO1xyXG5cclxuICAgIGZ1bmN0aW9uIHJlZ2lzdGVyQXNDYWxsKG5hbWUsIG1ldGhvZE5hbWUpIHtcclxuICAgICAgc2VsZi5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKG5hbWUsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwge1xyXG4gICAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuY2FsbChhc3QucmVmZXJlbmNlKGFzdC5jYXN0KHRoaXNWYXIsICdBbnknKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3Quc3RyaW5nKG1ldGhvZE5hbWUpKSkpXHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlclNjaGVtYSgnQW55JywgYXN0LnR5cGVUeXBlKCdBbnknKSwgdW5kZWZpbmVkLCB7XHJcbiAgICAgIHZhbGlkYXRlOiBhc3QubWV0aG9kKFsndGhpcyddLCBhc3QuYm9vbGVhbih0cnVlKSlcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZ2lzdGVyQXNDYWxsKCdPYmplY3QnLCAnaGFzQ2hpbGRyZW4nKTtcclxuXHJcbiAgICB0aGlzLnN5bWJvbHMucmVnaXN0ZXJTY2hlbWEoJ051bGwnLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHtcclxuICAgICAgdmFsaWRhdGU6IGFzdC5tZXRob2QoWyd0aGlzJ10sIGFzdC5lcSh0aGlzVmFyLCBhc3QubnVsbFR5cGUoKSkpXHJcbiAgICB9KTtcclxuXHJcbiAgICBzZWxmLnN5bWJvbHMucmVnaXN0ZXJTY2hlbWEoJ1N0cmluZycsIGFzdC50eXBlVHlwZSgnQW55JyksIHVuZGVmaW5lZCwge1xyXG4gICAgICB2YWxpZGF0ZTogYXN0Lm1ldGhvZChbJ3RoaXMnXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdCh0aGlzVmFyLCAnQW55JyksIGFzdC5zdHJpbmcoJ2lzU3RyaW5nJykpKSksXHJcbiAgICAgIGluY2x1ZGVzOiBhc3QubWV0aG9kKFsndGhpcycsICdzJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdjb250YWlucycpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpIF0pKSxcclxuICAgICAgc3RhcnRzV2l0aDogYXN0Lm1ldGhvZChbJ3RoaXMnLCAncyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdiZWdpbnNXaXRoJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LnZhbHVlKGFzdC52YXJpYWJsZSgncycpKSBdKSksXHJcbiAgICAgIGVuZHNXaXRoOiBhc3QubWV0aG9kKFsndGhpcycsICdzJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdlbmRzV2l0aCcpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpIF0pKSxcclxuICAgICAgcmVwbGFjZTogYXN0Lm1ldGhvZChbJ3RoaXMnLCAncycsICdyJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QudmFsdWUodGhpc1ZhciksIGFzdC5zdHJpbmcoJ3JlcGxhY2UnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWyBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdzJykpLCBhc3QudmFsdWUoYXN0LnZhcmlhYmxlKCdyJykpIF0pKSxcclxuICAgICAgdGVzdDogYXN0Lm1ldGhvZChbJ3RoaXMnLCAnciddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgIGFzdC5jYWxsKGFzdC5yZWZlcmVuY2UoYXN0LnZhbHVlKHRoaXNWYXIpLCBhc3Quc3RyaW5nKCdtYXRjaGVzJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFsgYXN0LmNhbGwoYXN0LnZhcmlhYmxlKCdAUmVnRXhwJyksIFthc3QudmFyaWFibGUoJ3InKV0pIF0pKSxcclxuICAgIH0pO1xyXG5cclxuICAgIHJlZ2lzdGVyQXNDYWxsKCdOdW1iZXInLCAnaXNOdW1iZXInKTtcclxuICAgIHJlZ2lzdGVyQXNDYWxsKCdCb29sZWFuJywgJ2lzQm9vbGVhbicpO1xyXG5cclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdAUmVnRXhwJywgWydyJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLmVuc3VyZVR5cGUuYmluZCh0aGlzLCAnUmVnRXhwJykpKTtcclxuXHJcbiAgICBsZXQgbWFwID0gdGhpcy5zeW1ib2xzLnJlZ2lzdGVyU2NoZW1hKCdNYXAnLCBhc3QudHlwZVR5cGUoJ0FueScpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgWydLZXknLCAnVmFsdWUnXSk7XHJcbiAgICBtYXAuZ2V0VmFsaWRhdG9yID0gdGhpcy5nZXRNYXBWYWxpZGF0b3IuYmluZCh0aGlzKTtcclxuICB9XHJcblxyXG4gIC8vIHR5cGUgTWFwPEtleSwgVmFsdWU+ID0+IHtcclxuICAvLyAgICRrZXk6IHtcclxuICAvLyAgICAgJy52YWxpZGF0ZSc6ICRrZXkgaW5zdGFuY2VvZiBLZXkgYW5kIHRoaXMgaW5zdGFuY2VvZiBWYWx1ZTtcclxuICAvLyB9XHJcbiAgLy8gS2V5IG11c3QgZGVyaXZlIGZyb20gU3RyaW5nXHJcbiAgZ2V0TWFwVmFsaWRhdG9yKHBhcmFtczogYXN0LkV4cFtdKTogVmFsaWRhdG9yIHtcclxuICAgIGxldCBrZXlUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBwYXJhbXNbMF07XHJcbiAgICBsZXQgdmFsdWVUeXBlID0gPGFzdC5FeHBUeXBlPiBwYXJhbXNbMV07XHJcbiAgICBpZiAoa2V5VHlwZS50eXBlICE9PSAndHlwZScgfHwgIXRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKGtleVR5cGUsICdTdHJpbmcnKSkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmludmFsaWRNYXBLZXkgKyBcIiAgKFwiICsgYXN0LmRlY29kZUV4cHJlc3Npb24oa2V5VHlwZSkgKyBcIiBkb2VzIG5vdClcIik7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHZhbGlkYXRvciA9IDxWYWxpZGF0b3I+IHt9O1xyXG4gICAgbGV0IGluZGV4ID0gdGhpcy51bmlxdWVLZXkoKTtcclxuICAgIHZhbGlkYXRvcltpbmRleF0gPSA8VmFsaWRhdG9yPiB7fTtcclxuXHJcbiAgICAvLyBGaXJzdCB2YWxpZGF0ZSB0aGUga2V5IChvbWl0IHRlcm1pbmFsIFN0cmluZyB0eXBlIHZhbGlkYXRpb24pLlxyXG4gICAgd2hpbGUgKGtleVR5cGUubmFtZSAhPT0gJ1N0cmluZycpIHtcclxuICAgICAgbGV0IHNjaGVtYSA9IHRoaXMuc3ltYm9scy5zY2hlbWFba2V5VHlwZS5uYW1lXTtcclxuICAgICAgaWYgKHNjaGVtYS5tZXRob2RzWyd2YWxpZGF0ZSddKSB7XHJcbiAgICAgICAgbGV0IGV4cCA9IHRoaXMucGFydGlhbEV2YWwoc2NoZW1hLm1ldGhvZHNbJ3ZhbGlkYXRlJ10uYm9keSwgeyd0aGlzJzogYXN0LmxpdGVyYWwoaW5kZXgpfSk7XHJcbiAgICAgICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZhbGlkYXRvcltpbmRleF0sIDxWYWxpZGF0b3I+IHsnLnZhbGlkYXRlJzogW2V4cF19KTtcclxuICAgICAgfVxyXG4gICAgICBrZXlUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBzY2hlbWEuZGVyaXZlZEZyb207XHJcbiAgICB9XHJcblxyXG4gICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZhbGlkYXRvcltpbmRleF0sIHRoaXMuZW5zdXJlVmFsaWRhdG9yKHZhbHVlVHlwZSkpO1xyXG4gICAgcmV0dXJuIHZhbGlkYXRvcjtcclxuICB9XHJcblxyXG4gIHVuaXF1ZUtleSgpOiBzdHJpbmcge1xyXG4gICAgdGhpcy5rZXlJbmRleCArPSAxO1xyXG4gICAgcmV0dXJuICcka2V5JyArIHRoaXMua2V5SW5kZXg7XHJcbiAgfVxyXG5cclxuICAvLyBDb2xsZWN0aW9uIHNjaGVtYSBoYXMgZXhhY3RseSBvbmUgJHdpbGRjaGlsZCBwcm9wZXJ0eVxyXG4gIGlzQ29sbGVjdGlvblNjaGVtYShzY2hlbWE6IGFzdC5TY2hlbWEpOiBib29sZWFuIHtcclxuICAgIGxldCBwcm9wcyA9IE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKTtcclxuICAgIGxldCByZXN1bHQgPSBwcm9wcy5sZW5ndGggPT09IDEgJiYgcHJvcHNbMF1bMF0gPT09ICckJztcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvLyBFbnN1cmUgd2UgaGF2ZSBhIGRlZmluaXRpb24gZm9yIGEgdmFsaWRhdG9yIGZvciB0aGUgZ2l2ZW4gc2NoZW1hLlxyXG4gIGVuc3VyZVZhbGlkYXRvcih0eXBlOiBhc3QuRXhwVHlwZSk6IFZhbGlkYXRvciB7XHJcbiAgICB2YXIga2V5ID0gYXN0LmRlY29kZUV4cHJlc3Npb24odHlwZSk7XHJcbiAgICBpZiAoIXRoaXMudmFsaWRhdG9yc1trZXldKSB7XHJcbiAgICAgIHRoaXMudmFsaWRhdG9yc1trZXldID0geycudmFsaWRhdGUnOiBhc3QubGl0ZXJhbCgnKioqVFlQRSBSRUNVUlNJT04qKionKSB9O1xyXG4gICAgICB0aGlzLnZhbGlkYXRvcnNba2V5XSA9IHRoaXMuY3JlYXRlVmFsaWRhdG9yKHR5cGUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRoaXMudmFsaWRhdG9yc1trZXldO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlVmFsaWRhdG9yKHR5cGU6IGFzdC5FeHBUeXBlKTogVmFsaWRhdG9yIHtcclxuICAgIHN3aXRjaCAodHlwZS50eXBlKSB7XHJcbiAgICBjYXNlICd0eXBlJzpcclxuICAgICAgcmV0dXJuIHRoaXMuY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYU5hbWUoKDxhc3QuRXhwU2ltcGxlVHlwZT4gdHlwZSkubmFtZSk7XHJcblxyXG4gICAgY2FzZSAndW5pb24nOlxyXG4gICAgICBsZXQgdW5pb24gPSA8VmFsaWRhdG9yPiB7fTtcclxuICAgICAgKDxhc3QuRXhwVW5pb25UeXBlPiB0eXBlKS50eXBlcy5mb3JFYWNoKCh0eXBlUGFydDogYXN0LkV4cFR5cGUpID0+IHtcclxuICAgICAgICAvLyBNYWtlIGEgY29weVxyXG4gICAgICAgIHZhciBzaW5nbGVUeXBlID0gZXh0ZW5kVmFsaWRhdG9yKHt9LCB0aGlzLmVuc3VyZVZhbGlkYXRvcih0eXBlUGFydCkpO1xyXG4gICAgICAgIG1hcFZhbGlkYXRvcihzaW5nbGVUeXBlLCBhc3QuYW5kQXJyYXkpO1xyXG4gICAgICAgIGV4dGVuZFZhbGlkYXRvcih1bmlvbiwgc2luZ2xlVHlwZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgICBtYXBWYWxpZGF0b3IodW5pb24sIGFzdC5vckFycmF5KTtcclxuICAgICAgcmV0dXJuIHVuaW9uO1xyXG5cclxuICAgIGNhc2UgJ2dlbmVyaWMnOlxyXG4gICAgICBsZXQgZ2VuZXJpY1R5cGUgPSA8YXN0LkV4cEdlbmVyaWNUeXBlPiB0eXBlO1xyXG4gICAgICByZXR1cm4gdGhpcy5jcmVhdGVWYWxpZGF0b3JGcm9tR2VuZXJpYyhnZW5lcmljVHlwZS5uYW1lLCBnZW5lcmljVHlwZS5wYXJhbXMpO1xyXG5cclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcImludmFsaWQgaW50ZXJuYWwgdHlwZTogXCIgKyB0eXBlLnR5cGUpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY3JlYXRlVmFsaWRhdG9yRnJvbUdlbmVyaWMoc2NoZW1hTmFtZTogc3RyaW5nLCBwYXJhbXM6IGFzdC5FeHBUeXBlW10pOiBWYWxpZGF0b3Ige1xyXG4gICAgdmFyIHNjaGVtYSA9IHRoaXMuc3ltYm9scy5zY2hlbWFbc2NoZW1hTmFtZV07XHJcblxyXG4gICAgaWYgKCFzY2hlbWEgfHwgIXRoaXMuaXNHZW5lcmljKHNjaGVtYSkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5ub1N1Y2hUeXBlICsgc2NoZW1hTmFtZSArIFwiIChnZW5lcmljKVwiKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAocGFyYW1zLmxlbmd0aCAhPT0gc2NoZW1hLnBhcmFtcy5sZW5ndGgpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5pbnZhbGlkR2VuZXJpYyArIFwiIGV4cGVjdGVkIDxcIiArIHNjaGVtYS5wYXJhbXMuam9pbignLCAnKSArIFwiPlwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDYWxsIGN1c3RvbSB2YWxpZGF0b3IsIGlmIGdpdmVuLlxyXG4gICAgaWYgKHNjaGVtYS5nZXRWYWxpZGF0b3IpIHtcclxuICAgICAgcmV0dXJuIHNjaGVtYS5nZXRWYWxpZGF0b3IocGFyYW1zKTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgYmluZGluZ3MgPSA8YXN0LlR5cGVQYXJhbXM+IHt9O1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgYmluZGluZ3Nbc2NoZW1hLnBhcmFtc1tpXV0gPSBwYXJhbXNbaV07XHJcbiAgICB9XHJcblxyXG4gICAgLy8gRXhwYW5kIGdlbmVyaWNzIGFuZCBnZW5lcmF0ZSB2YWxpZGF0b3IgZnJvbSBzY2hlbWEuXHJcbiAgICBzY2hlbWEgPSB0aGlzLnJlcGxhY2VHZW5lcmljc0luU2NoZW1hKHNjaGVtYSwgYmluZGluZ3MpO1xyXG4gICAgcmV0dXJuIHRoaXMuY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYShzY2hlbWEpO1xyXG4gIH1cclxuXHJcbiAgcmVwbGFjZUdlbmVyaWNzSW5TY2hlbWEoc2NoZW1hOiBhc3QuU2NoZW1hLCBiaW5kaW5nczogYXN0LlR5cGVQYXJhbXMpOiBhc3QuU2NoZW1hIHtcclxuICAgIHZhciBleHBhbmRlZFNjaGVtYSA9IDxhc3QuU2NoZW1hPiB7XHJcbiAgICAgIGRlcml2ZWRGcm9tOiA8YXN0LkV4cFR5cGU+IHRoaXMucmVwbGFjZUdlbmVyaWNzSW5FeHAoc2NoZW1hLmRlcml2ZWRGcm9tLCBiaW5kaW5ncyksXHJcbiAgICAgIHByb3BlcnRpZXM6IHsgfSxcclxuICAgICAgbWV0aG9kczoge30sXHJcbiAgICB9O1xyXG4gICAgbGV0IHByb3BzID0gT2JqZWN0LmtleXMoc2NoZW1hLnByb3BlcnRpZXMpO1xyXG4gICAgcHJvcHMuZm9yRWFjaCgocHJvcCkgPT4ge1xyXG4gICAgICBleHBhbmRlZFNjaGVtYS5wcm9wZXJ0aWVzW3Byb3BdID1cclxuICAgICAgICA8YXN0LkV4cFR5cGU+IHRoaXMucmVwbGFjZUdlbmVyaWNzSW5FeHAoc2NoZW1hLnByb3BlcnRpZXNbcHJvcF0sIGJpbmRpbmdzKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGxldCBtZXRob2RzID0gT2JqZWN0LmtleXMoc2NoZW1hLm1ldGhvZHMpO1xyXG4gICAgbWV0aG9kcy5mb3JFYWNoKChtZXRob2ROYW1lKSA9PiB7XHJcbiAgICAgIGV4cGFuZGVkU2NoZW1hLm1ldGhvZHNbbWV0aG9kTmFtZV0gPSB0aGlzLnJlcGxhY2VHZW5lcmljc0luTWV0aG9kKHNjaGVtYS5tZXRob2RzW21ldGhvZE5hbWVdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJpbmRpbmdzKTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIGV4cGFuZGVkU2NoZW1hO1xyXG4gIH1cclxuXHJcbiAgcmVwbGFjZUdlbmVyaWNzSW5FeHAoZXhwOiBhc3QuRXhwLCBiaW5kaW5nczogYXN0LlR5cGVQYXJhbXMpOiBhc3QuRXhwIHtcclxuICAgIHZhciBzZWxmID0gdGhpcztcclxuXHJcbiAgICBmdW5jdGlvbiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KGV4cHM6IGFzdC5FeHBbXSk6IGFzdC5FeHBbXSB7XHJcbiAgICAgIHJldHVybiBleHBzLm1hcChmdW5jdGlvbihleHBQYXJ0KSB7XHJcbiAgICAgICAgcmV0dXJuIHNlbGYucmVwbGFjZUdlbmVyaWNzSW5FeHAoZXhwUGFydCwgYmluZGluZ3MpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBzd2l0Y2ggKGV4cC50eXBlKSB7XHJcbiAgICBjYXNlICdvcCc6XHJcbiAgICBjYXNlICdjYWxsJzpcclxuICAgICAgbGV0IG9wVHlwZSA9IDxhc3QuRXhwT3A+IGFzdC5jb3B5RXhwKGV4cCk7XHJcbiAgICAgIG9wVHlwZS5hcmdzID0gcmVwbGFjZUdlbmVyaWNzSW5BcnJheShvcFR5cGUuYXJncyk7XHJcbiAgICAgIHJldHVybiBvcFR5cGU7XHJcblxyXG4gICAgY2FzZSAndHlwZSc6XHJcbiAgICAgIGxldCBzaW1wbGVUeXBlID0gPGFzdC5FeHBTaW1wbGVUeXBlPiBleHA7XHJcbiAgICAgIHJldHVybiBiaW5kaW5nc1tzaW1wbGVUeXBlLm5hbWVdIHx8IHNpbXBsZVR5cGU7XHJcblxyXG4gICAgY2FzZSAndW5pb24nOlxyXG4gICAgICBsZXQgdW5pb25UeXBlID0gPGFzdC5FeHBVbmlvblR5cGU+IGV4cDtcclxuICAgICAgcmV0dXJuIGFzdC51bmlvblR5cGUoPGFzdC5FeHBUeXBlW10+IHJlcGxhY2VHZW5lcmljc0luQXJyYXkodW5pb25UeXBlLnR5cGVzKSk7XHJcblxyXG4gICAgY2FzZSAnZ2VuZXJpYyc6XHJcbiAgICAgIGxldCBnZW5lcmljVHlwZSA9IDxhc3QuRXhwR2VuZXJpY1R5cGU+IGV4cDtcclxuICAgICAgcmV0dXJuIGFzdC5nZW5lcmljVHlwZShnZW5lcmljVHlwZS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhc3QuRXhwVHlwZVtdPiByZXBsYWNlR2VuZXJpY3NJbkFycmF5KGdlbmVyaWNUeXBlLnBhcmFtcykpO1xyXG5cclxuICAgIGRlZmF1bHQ6XHJcbiAgICAgIHJldHVybiBleHA7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXBsYWNlR2VuZXJpY3NJbk1ldGhvZChtZXRob2Q6IGFzdC5NZXRob2QsIGJpbmRpbmdzOiBhc3QuVHlwZVBhcmFtcyk6IGFzdC5NZXRob2Qge1xyXG4gICAgdmFyIGV4cGFuZGVkTWV0aG9kID0gPGFzdC5NZXRob2Q+IHtcclxuICAgICAgcGFyYW1zOiBtZXRob2QucGFyYW1zLFxyXG4gICAgICBib2R5OiBtZXRob2QuYm9keVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBhbmRlZE1ldGhvZC5ib2R5ID0gdGhpcy5yZXBsYWNlR2VuZXJpY3NJbkV4cChtZXRob2QuYm9keSwgYmluZGluZ3MpO1xyXG4gICAgcmV0dXJuIGV4cGFuZGVkTWV0aG9kO1xyXG4gIH1cclxuXHJcbiAgY3JlYXRlVmFsaWRhdG9yRnJvbVNjaGVtYU5hbWUoc2NoZW1hTmFtZTogc3RyaW5nKTogVmFsaWRhdG9yIHtcclxuICAgIHZhciBzY2hlbWEgPSB0aGlzLnN5bWJvbHMuc2NoZW1hW3NjaGVtYU5hbWVdO1xyXG5cclxuICAgIGlmICghc2NoZW1hKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubm9TdWNoVHlwZSArIHNjaGVtYU5hbWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICh0aGlzLmlzR2VuZXJpYyhzY2hlbWEpKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMubm9TdWNoVHlwZSArIHNjaGVtYU5hbWUgKyBcIiB1c2VkIGFzIG5vbi1nZW5lcmljIHR5cGUuXCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0aGlzLmNyZWF0ZVZhbGlkYXRvckZyb21TY2hlbWEoc2NoZW1hKTtcclxuICB9XHJcblxyXG4gIGlzR2VuZXJpYyhzY2hlbWEpIHtcclxuICAgIHJldHVybiBzY2hlbWEucGFyYW1zLmxlbmd0aCA+IDA7XHJcbiAgfVxyXG5cclxuICBjcmVhdGVWYWxpZGF0b3JGcm9tU2NoZW1hKHNjaGVtYTogYXN0LlNjaGVtYSk6IFZhbGlkYXRvciB7XHJcbiAgICB2YXIgaGFzUHJvcHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucHJvcGVydGllcykubGVuZ3RoID4gMCAmJlxyXG4gICAgICAhdGhpcy5pc0NvbGxlY3Rpb25TY2hlbWEoc2NoZW1hKTtcclxuXHJcbiAgICBpZiAoaGFzUHJvcHMgJiYgIXRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHNjaGVtYS5kZXJpdmVkRnJvbSwgJ09iamVjdCcpKSB7XHJcbiAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLm5vbk9iamVjdCArIFwiIChpcyBcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKHNjaGVtYS5kZXJpdmVkRnJvbSkgKyBcIilcIik7XHJcbiAgICAgIHJldHVybiB7fTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgdmFsaWRhdG9yID0gPFZhbGlkYXRvcj4ge307XHJcblxyXG4gICAgaWYgKCEoc2NoZW1hLmRlcml2ZWRGcm9tLnR5cGUgPT09ICd0eXBlJyAmJlxyXG4gICAgICAgICAgKDxhc3QuRXhwU2ltcGxlVHlwZT4gc2NoZW1hLmRlcml2ZWRGcm9tKS5uYW1lID09PSAnQW55JykpIHtcclxuICAgICAgZXh0ZW5kVmFsaWRhdG9yKHZhbGlkYXRvciwgdGhpcy5lbnN1cmVWYWxpZGF0b3Ioc2NoZW1hLmRlcml2ZWRGcm9tKSk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHJlcXVpcmVkUHJvcGVydGllcyA9IFtdO1xyXG4gICAgbGV0IHdpbGRQcm9wZXJ0aWVzID0gMDtcclxuICAgIE9iamVjdC5rZXlzKHNjaGVtYS5wcm9wZXJ0aWVzKS5mb3JFYWNoKChwcm9wTmFtZSkgPT4ge1xyXG4gICAgICBpZiAocHJvcE5hbWVbMF0gPT09ICckJykge1xyXG4gICAgICAgIHdpbGRQcm9wZXJ0aWVzICs9IDE7XHJcbiAgICAgICAgaWYgKElOVkFMSURfS0VZX1JFR0VYLnRlc3QocHJvcE5hbWUuc2xpY2UoMSkpKSB7XHJcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5pbnZhbGlkUHJvcGVydHlOYW1lICsgcHJvcE5hbWUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBpZiAoSU5WQUxJRF9LRVlfUkVHRVgudGVzdChwcm9wTmFtZSkpIHtcclxuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmludmFsaWRQcm9wZXJ0eU5hbWUgKyBwcm9wTmFtZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGlmICghdmFsaWRhdG9yW3Byb3BOYW1lXSkge1xyXG4gICAgICAgIHZhbGlkYXRvcltwcm9wTmFtZV0gPSB7fTtcclxuICAgICAgfVxyXG4gICAgICB2YXIgcHJvcFR5cGUgPSBzY2hlbWEucHJvcGVydGllc1twcm9wTmFtZV07XHJcbiAgICAgIGlmIChwcm9wTmFtZVswXSAhPT0gJyQnICYmICF0aGlzLmlzTnVsbGFibGVUeXBlKHByb3BUeXBlKSkge1xyXG4gICAgICAgIHJlcXVpcmVkUHJvcGVydGllcy5wdXNoKHByb3BOYW1lKTtcclxuICAgICAgfVxyXG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdmFsaWRhdG9yW3Byb3BOYW1lXSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IocHJvcFR5cGUpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGlmICh3aWxkUHJvcGVydGllcyA+IDEgfHwgd2lsZFByb3BlcnRpZXMgPT09IDEgJiYgcmVxdWlyZWRQcm9wZXJ0aWVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgdGhpcy5mYXRhbChlcnJvcnMuaW52YWxpZFdpbGRDaGlsZHJlbik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHJlcXVpcmVkUHJvcGVydGllcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgIC8vIHRoaXMuaGFzQ2hpbGRyZW4ocmVxdWlyZWRQcm9wZXJ0aWVzKVxyXG4gICAgICBleHRlbmRWYWxpZGF0b3IodmFsaWRhdG9yLFxyXG4gICAgICAgICAgICAgICAgICAgICAgeycudmFsaWRhdGUnOiBbaGFzQ2hpbGRyZW5FeHAocmVxdWlyZWRQcm9wZXJ0aWVzKV19KTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBEaXNhbGxvdyAkb3RoZXIgcHJvcGVydGllcyBieSBkZWZhdWx0XHJcbiAgICBpZiAoaGFzUHJvcHMpIHtcclxuICAgICAgdmFsaWRhdG9yWyckb3RoZXInXSA9IHt9O1xyXG4gICAgICBleHRlbmRWYWxpZGF0b3IoPFZhbGlkYXRvcj4gdmFsaWRhdG9yWyckb3RoZXInXSxcclxuICAgICAgICAgICAgICAgICAgICAgIDxWYWxpZGF0b3I+IHsnLnZhbGlkYXRlJzogYXN0LmJvb2xlYW4oZmFsc2UpfSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5leHRlbmRWYWxpZGF0aW9uTWV0aG9kcyh2YWxpZGF0b3IsIHNjaGVtYS5tZXRob2RzKTtcclxuXHJcbiAgICByZXR1cm4gdmFsaWRhdG9yO1xyXG4gIH1cclxuXHJcbiAgaXNOdWxsYWJsZVR5cGUodHlwZTogYXN0LkV4cFR5cGUpOiBib29sZWFuIHtcclxuICAgIGxldCByZXN1bHQgPSB0aGlzLnN5bWJvbHMuaXNEZXJpdmVkRnJvbSh0eXBlLCAnTnVsbCcpIHx8IHRoaXMuc3ltYm9scy5pc0Rlcml2ZWRGcm9tKHR5cGUsICdNYXAnKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvLyBVcGRhdGUgcnVsZXMgYmFzZWQgb24gdGhlIGdpdmVuIHBhdGggZXhwcmVzc2lvbi5cclxuICB1cGRhdGVSdWxlcyhwYXRoOiBhc3QuUGF0aCkge1xyXG4gICAgdmFyIGk7XHJcbiAgICB2YXIgbG9jYXRpb24gPSA8VmFsaWRhdG9yPiB1dGlsLmVuc3VyZU9iamVjdFBhdGgodGhpcy5ydWxlcywgcGF0aC50ZW1wbGF0ZS5nZXRMYWJlbHMoKSk7XHJcbiAgICB2YXIgZXhwO1xyXG5cclxuICAgIGV4dGVuZFZhbGlkYXRvcihsb2NhdGlvbiwgdGhpcy5lbnN1cmVWYWxpZGF0b3IocGF0aC5pc1R5cGUpKTtcclxuICAgIGxvY2F0aW9uWyckJHNjb3BlJ10gPSBwYXRoLnRlbXBsYXRlLmdldFNjb3BlKCk7XHJcblxyXG4gICAgdGhpcy5leHRlbmRWYWxpZGF0aW9uTWV0aG9kcyhsb2NhdGlvbiwgcGF0aC5tZXRob2RzKTtcclxuXHJcbiAgICAvLyBXcml0ZSBpbmRpY2VzXHJcbiAgICBpZiAocGF0aC5tZXRob2RzWydpbmRleCddKSB7XHJcbiAgICAgIHN3aXRjaCAocGF0aC5tZXRob2RzWydpbmRleCddLmJvZHkudHlwZSkge1xyXG4gICAgICBjYXNlICdTdHJpbmcnOlxyXG4gICAgICAgIGV4cCA9IGFzdC5hcnJheShbcGF0aC5tZXRob2RzWydpbmRleCddLmJvZHldKTtcclxuICAgICAgICBicmVhaztcclxuICAgICAgY2FzZSAnQXJyYXknOlxyXG4gICAgICAgIGV4cCA9IHBhdGgubWV0aG9kc1snaW5kZXgnXS5ib2R5O1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZEluZGV4KTtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuICAgICAgdmFyIGluZGljZXMgPSBbXTtcclxuICAgICAgZm9yIChpID0gMDsgaSA8IGV4cC52YWx1ZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgIGlmIChleHAudmFsdWVbaV0udHlwZSAhPT0gJ1N0cmluZycpIHtcclxuICAgICAgICAgIHRoaXMuZmF0YWwoZXJyb3JzLmJhZEluZGV4ICsgXCIgKG5vdCBcIiArIGV4cC52YWx1ZVtpXS50eXBlICsgXCIpXCIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBpbmRpY2VzLnB1c2goZXhwLnZhbHVlW2ldLnZhbHVlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgLy8gVE9ETzogRXJyb3IgY2hlY2sgbm90IG92ZXItd3JpdGluZyBpbmRleCBydWxlcy5cclxuICAgICAgbG9jYXRpb25bJy5pbmRleE9uJ10gPSBpbmRpY2VzO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgZXh0ZW5kVmFsaWRhdGlvbk1ldGhvZHModmFsaWRhdG9yOiBWYWxpZGF0b3IsIG1ldGhvZHM6IHsgW21ldGhvZDogc3RyaW5nXTogYXN0Lk1ldGhvZCB9KSB7XHJcbiAgICBsZXQgd3JpdGVNZXRob2RzID0gW107XHJcbiAgICBbJ2NyZWF0ZScsICd1cGRhdGUnLCAnZGVsZXRlJ10uZm9yRWFjaCgobWV0aG9kKSA9PiB7XHJcbiAgICAgIGlmIChtZXRob2QgaW4gbWV0aG9kcykge1xyXG4gICAgICAgIHdyaXRlTWV0aG9kcy5wdXNoKGFzdC5hbmRBcnJheShbd3JpdGVBbGlhc2VzW21ldGhvZF0sIG1ldGhvZHNbbWV0aG9kXS5ib2R5XSkpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICAgIGlmICh3cml0ZU1ldGhvZHMubGVuZ3RoICE9PSAwKSB7XHJcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIDxWYWxpZGF0b3I+IHsgJy53cml0ZSc6IGFzdC5vckFycmF5KHdyaXRlTWV0aG9kcykgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgWyd2YWxpZGF0ZScsICdyZWFkJywgJ3dyaXRlJ10uZm9yRWFjaCgobWV0aG9kKSA9PiB7XHJcbiAgICAgIGlmIChtZXRob2QgaW4gbWV0aG9kcykge1xyXG4gICAgICAgIHZhciBtZXRob2RWYWxpZGF0b3IgPSA8VmFsaWRhdG9yPiB7fTtcclxuICAgICAgICBtZXRob2RWYWxpZGF0b3JbJy4nICsgbWV0aG9kXSA9IG1ldGhvZHNbbWV0aG9kXS5ib2R5O1xyXG4gICAgICAgIGV4dGVuZFZhbGlkYXRvcih2YWxpZGF0b3IsIG1ldGhvZFZhbGlkYXRvcik7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLy8gUmV0dXJuIHVuaW9uIHZhbGlkYXRvciAofHwpIG92ZXIgZWFjaCBzY2hlbWFcclxuICB1bmlvblZhbGlkYXRvcnMoc2NoZW1hOiBzdHJpbmdbXSk6IFZhbGlkYXRvciB7XHJcbiAgICB2YXIgdW5pb24gPSA8VmFsaWRhdG9yPiB7fTtcclxuICAgIHNjaGVtYS5mb3JFYWNoKGZ1bmN0aW9uKHR5cGVOYW1lOiBzdHJpbmcpIHtcclxuICAgICAgLy8gRmlyc3QgYW5kIHRoZSB2YWxpZGF0b3IgdGVybXMgZm9yIGEgc2luZ2xlIHR5cGVcclxuICAgICAgLy8gVG9kbyBleHRlbmQgdG8gdW5pb25zIGFuZCBnZW5lcmljc1xyXG4gICAgICB2YXIgc2luZ2xlVHlwZSA9IGV4dGVuZFZhbGlkYXRvcih7fSwgdGhpcy5lbnN1cmVWYWxpZGF0b3IodHlwZU5hbWUpKTtcclxuICAgICAgbWFwVmFsaWRhdG9yKHNpbmdsZVR5cGUsIGFzdC5hbmRBcnJheSk7XHJcbiAgICAgIGV4dGVuZFZhbGlkYXRvcih1bmlvbiwgc2luZ2xlVHlwZSk7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gICAgbWFwVmFsaWRhdG9yKHVuaW9uLCBhc3Qub3JBcnJheSk7XHJcbiAgICByZXR1cm4gdW5pb247XHJcbiAgfVxyXG5cclxuICBjb252ZXJ0RXhwcmVzc2lvbnModmFsaWRhdG9yOiBWYWxpZGF0b3IpIHtcclxuICAgIHZhciBtZXRob2RUaGlzSXMgPSB7ICcudmFsaWRhdGUnOiAnbmV3RGF0YScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnLnJlYWQnOiAnZGF0YScsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAnLndyaXRlJzogJ25ld0RhdGEnIH07XHJcblxyXG4gICAgbWFwVmFsaWRhdG9yKHZhbGlkYXRvciwgZnVuY3Rpb24odmFsdWU6IGFzdC5FeHBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb3A6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlOiBhc3QuUGFyYW1zLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogYXN0LlBhdGhUZW1wbGF0ZSkge1xyXG4gICAgICBpZiAocHJvcCBpbiBtZXRob2RUaGlzSXMpIHtcclxuICAgICAgICBsZXQgcmVzdWx0ID0gdGhpcy5nZXRFeHByZXNzaW9uVGV4dChhc3QuYW5kQXJyYXkoY29sbGFwc2VIYXNDaGlsZHJlbih2YWx1ZSkpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZFRoaXNJc1twcm9wXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoKTtcclxuICAgICAgICBpZiAocHJvcCA9PT0gJy52YWxpZGF0ZScgJiYgcmVzdWx0ID09PSAndHJ1ZScgfHxcclxuICAgICAgICAgICAgKHByb3AgPT09ICcucmVhZCcgfHwgcHJvcCA9PT0gJy53cml0ZScpICYmIHJlc3VsdCA9PT0gJ2ZhbHNlJykge1xyXG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gdmFsdWU7XHJcbiAgICB9LmJpbmQodGhpcykpO1xyXG4gIH1cclxuXHJcbiAgZ2V0RXhwcmVzc2lvblRleHQoZXhwOiBhc3QuRXhwLCB0aGlzSXM6IHN0cmluZywgc2NvcGU6IGFzdC5QYXJhbXMsIHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpOiBzdHJpbmcge1xyXG4gICAgaWYgKCEoJ3R5cGUnIGluIGV4cCkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiTm90IGFuIGV4cHJlc3Npb246IFwiICsgdXRpbC5wcmV0dHlKU09OKGV4cCkpO1xyXG4gICAgfVxyXG4gICAgLy8gRmlyc3QgZXZhbHVhdGUgdy9vIGJpbmRpbmcgb2YgdGhpcyB0byBzcGVjaWZpYyBsb2NhdGlvbi5cclxuICAgIHRoaXMuYWxsb3dVbmRlZmluZWRGdW5jdGlvbnMgPSB0cnVlO1xyXG4gICAgc2NvcGUgPSA8YXN0LlBhcmFtcz4gdXRpbC5leHRlbmQoe30sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHsgJ3RoaXMnOiBhc3QuY2FzdChhc3QuY2FsbChhc3QudmFyaWFibGUoJ0BnZXRUaGlzJykpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdTbmFwc2hvdCcpIH0pO1xyXG4gICAgZXhwID0gdGhpcy5wYXJ0aWFsRXZhbChleHAsIHNjb3BlKTtcclxuICAgIC8vIE5vdyByZS1ldmFsdWF0ZSB0aGUgZmxhdHRlbmVkIGV4cHJlc3Npb24uXHJcbiAgICB0aGlzLmFsbG93VW5kZWZpbmVkRnVuY3Rpb25zID0gZmFsc2U7XHJcbiAgICB0aGlzLnRoaXNJcyA9IHRoaXNJcztcclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdAZ2V0VGhpcycsIFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5nZXRUaGlzLmJpbmQodGhpcykpKTtcclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdAcm9vdCcsIFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYXN0LmJ1aWx0aW4odGhpcy5nZXRSb290UmVmZXJlbmNlLmJpbmQodGhpcywgcGF0aCkpKTtcclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdwcmlvcicsIFsnZXhwJ10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhc3QuYnVpbHRpbih0aGlzLnByaW9yLmJpbmQodGhpcykpKTtcclxuICAgIHRoaXMuc3ltYm9scy5yZWdpc3RlckZ1bmN0aW9uKCdrZXknLCBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzdC5idWlsdGluKHRoaXMuZ2V0S2V5LmJpbmQoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgubGVuZ3RoKCkgPT09IDAgPyAnJyA6IHBhdGguZ2V0UGFydCgtMSkubGFiZWwpKSk7XHJcblxyXG4gICAgZXhwID0gdGhpcy5wYXJ0aWFsRXZhbChleHApO1xyXG5cclxuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydAZ2V0VGhpcyddO1xyXG4gICAgZGVsZXRlIHRoaXMuc3ltYm9scy5mdW5jdGlvbnNbJ0Byb290J107XHJcbiAgICBkZWxldGUgdGhpcy5zeW1ib2xzLmZ1bmN0aW9uc1sncHJpb3InXTtcclxuICAgIGRlbGV0ZSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zWydrZXknXTtcclxuXHJcbiAgICAvLyBUb3AgbGV2ZWwgZXhwcmVzc2lvbnMgc2hvdWxkIG5ldmVyIGJlIHRvIGEgc25hcHNob3QgcmVmZXJlbmNlIC0gc2hvdWxkXHJcbiAgICAvLyBhbHdheXMgZXZhbHVhdGUgdG8gYSBib29sZWFuLlxyXG4gICAgZXhwID0gYXN0LmVuc3VyZUJvb2xlYW4oZXhwKTtcclxuICAgIHJldHVybiBhc3QuZGVjb2RlRXhwcmVzc2lvbihleHApO1xyXG4gIH1cclxuXHJcbiAgLypcclxuICAgKiAgV3JhcHBlciBmb3IgcGFydGlhbEV2YWwgZGVidWdnaW5nLlxyXG4gICAqL1xyXG5cclxuICBwYXJ0aWFsRXZhbChleHA6IGFzdC5FeHAsXHJcbiAgICAgICAgICAgICAgcGFyYW1zID0gPGFzdC5QYXJhbXM+IHt9LFxyXG4gICAgICAgICAgICAgIGZ1bmN0aW9uQ2FsbHM6IHsgW25hbWU6IHN0cmluZ106IGJvb2xlYW4gfSA9IHt9KVxyXG4gIDogYXN0LkV4cCB7XHJcbiAgICAvLyBXcmFwIHJlYWwgY2FsbCBmb3IgZGVidWdnaW5nLlxyXG4gICAgbGV0IHJlc3VsdCA9IHRoaXMucGFydGlhbEV2YWxSZWFsKGV4cCwgcGFyYW1zLCBmdW5jdGlvbkNhbGxzKTtcclxuICAgIC8vIGNvbnNvbGUubG9nKGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cCkgKyBcIiA9PiBcIiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKHJlc3VsdCkpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxuICB9XHJcblxyXG4gIC8vIFBhcnRpYWwgZXZhbHVhdGlvbiBvZiBleHByZXNzaW9ucyAtIGNvcHkgb2YgZXhwcmVzc2lvbiB0cmVlIChpbW11dGFibGUpLlxyXG4gIC8vXHJcbiAgLy8gLSBFeHBhbmQgaW5saW5lIGZ1bmN0aW9uIGNhbGxzLlxyXG4gIC8vIC0gUmVwbGFjZSBsb2NhbCBhbmQgZ2xvYmFsIHZhcmlhYmxlcyB3aXRoIHRoZWlyIHZhbHVlcy5cclxuICAvLyAtIEV4cGFuZCBzbmFwc2hvdCByZWZlcmVuY2VzIHVzaW5nIGNoaWxkKCdyZWYnKS5cclxuICAvLyAtIENvZXJjZSBzbmFwc2hvdCByZWZlcmVuY2VzIHRvIHZhbHVlcyBhcyBuZWVkZWQuXHJcbiAgcGFydGlhbEV2YWxSZWFsKGV4cDogYXN0LkV4cCxcclxuICAgICAgICAgICAgICBwYXJhbXMgPSA8YXN0LlBhcmFtcz4ge30sXHJcbiAgICAgICAgICAgICAgZnVuY3Rpb25DYWxscyA9IDx7IFtuYW1lOiBzdHJpbmddOiBib29sZWFuIH0+IHt9KVxyXG4gIDogYXN0LkV4cCB7XHJcbiAgICB2YXIgc2VsZiA9IHRoaXM7XHJcblxyXG4gICAgZnVuY3Rpb24gc3ViRXhwcmVzc2lvbihleHAyOiBhc3QuRXhwKTogYXN0LkV4cCB7XHJcbiAgICAgIHJldHVybiBzZWxmLnBhcnRpYWxFdmFsKGV4cDIsIHBhcmFtcywgZnVuY3Rpb25DYWxscyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdmFsdWVFeHByZXNzaW9uKGV4cDI6IGFzdC5FeHApOiBhc3QuRXhwIHtcclxuICAgICAgcmV0dXJuIGFzdC5lbnN1cmVWYWx1ZShzdWJFeHByZXNzaW9uKGV4cDIpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBib29sZWFuRXhwcmVzc2lvbihleHAyOiBhc3QuRXhwKTogYXN0LkV4cCB7XHJcbiAgICAgIHJldHVybiBhc3QuZW5zdXJlQm9vbGVhbihzdWJFeHByZXNzaW9uKGV4cDIpKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBsb29rdXBWYXIoZXhwMikge1xyXG4gICAgICAvLyBUT0RPOiBVbmJvdW5kIHZhcmlhYmxlIGFjY2VzcyBzaG91bGQgYmUgYW4gZXJyb3IuXHJcbiAgICAgIHJldHVybiBwYXJhbXNbZXhwMi5uYW1lXSB8fCBzZWxmLmdsb2JhbHNbZXhwMi5uYW1lXSB8fCBleHAyO1xyXG4gICAgfVxyXG5cclxuICAgIHN3aXRjaCAoZXhwLnR5cGUpIHtcclxuICAgIGNhc2UgJ29wJzpcclxuICAgICAgbGV0IGV4cE9wID0gPGFzdC5FeHBPcD4gYXN0LmNvcHlFeHAoZXhwKTtcclxuICAgICAgLy8gRW5zdXJlIGFyZ3VtZW50cyBhcmUgYm9vbGVhbiAob3IgdmFsdWVzKSB3aGVyZSBuZWVkZWQuXHJcbiAgICAgIGlmIChleHBPcC5vcCA9PT0gJ3ZhbHVlJykge1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1swXSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoZXhwT3Aub3AgPT09ICd8fCcgfHwgZXhwT3Aub3AgPT09ICcmJicgfHwgZXhwT3Aub3AgPT09ICchJykge1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZXhwT3AuYXJncy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgZXhwT3AuYXJnc1tpXSA9IGJvb2xlYW5FeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSBlbHNlIGlmIChleHBPcC5vcCA9PT0gJz86Jykge1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMF0gPSBib29sZWFuRXhwcmVzc2lvbihleHBPcC5hcmdzWzBdKTtcclxuICAgICAgICBleHBPcC5hcmdzWzFdID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbMV0pO1xyXG4gICAgICAgIGV4cE9wLmFyZ3NbMl0gPSB2YWx1ZUV4cHJlc3Npb24oZXhwT3AuYXJnc1syXSk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBPcC5hcmdzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICBleHBPcC5hcmdzW2ldID0gdmFsdWVFeHByZXNzaW9uKGV4cE9wLmFyZ3NbaV0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZXhwT3A7XHJcblxyXG4gICAgY2FzZSAndmFyJzpcclxuICAgICAgcmV0dXJuIGxvb2t1cFZhcihleHApO1xyXG5cclxuICAgIGNhc2UgJ3JlZic6XHJcbiAgICAgIC8vIENvbnZlcnQgcmVmW3Byb3BdID0+IHJlZi5jaGlsZChwcm9wKVxyXG4gICAgICBmdW5jdGlvbiBzbmFwc2hvdENoaWxkKHJlZjogYXN0LkV4cFJlZmVyZW5jZSk6IGFzdC5FeHAge1xyXG4gICAgICAgIHJldHVybiBhc3QuY2FzdChhc3QuY2FsbChhc3QucmVmZXJlbmNlKHJlZi5iYXNlLCBhc3Quc3RyaW5nKCdjaGlsZCcpKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgW3JlZi5hY2Nlc3Nvcl0pLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnU25hcHNob3QnKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGV0IGV4cFJlZiA9IDxhc3QuRXhwUmVmZXJlbmNlPiBhc3QuY29weUV4cChleHApO1xyXG4gICAgICBleHBSZWYuYmFzZSA9IHN1YkV4cHJlc3Npb24oZXhwUmVmLmJhc2UpO1xyXG5cclxuICAgICAgLy8gdmFyW3JlZl0gPT4gdmFyW3JlZl1cclxuICAgICAgaWYgKGV4cFJlZi5iYXNlLnZhbHVlVHlwZSAhPT0gJ1NuYXBzaG90Jykge1xyXG4gICAgICAgIGV4cFJlZi5hY2Nlc3NvciA9IHN1YkV4cHJlc3Npb24oZXhwUmVmLmFjY2Vzc29yKTtcclxuICAgICAgICByZXR1cm4gZXhwUmVmO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsZXQgcHJvcE5hbWUgPSBhc3QuZ2V0UHJvcE5hbWUoZXhwUmVmKTtcclxuXHJcbiAgICAgIC8vIHNuYXBzaG90LnByb3AgKHN0YXRpYyBzdHJpbmcgcHJvcGVydHkpXHJcbiAgICAgIGlmIChwcm9wTmFtZSAhPT0gJycpIHtcclxuICAgICAgICAvLyBzbmFwc2hvdC52YWx1ZU1ldGhvZCA9PiBzbmFwc2hvdC52YWwoKS52YWx1ZU1ldGhvZFxyXG4gICAgICAgIGlmICh1dGlsLmFycmF5SW5jbHVkZXModmFsdWVNZXRob2RzLCBwcm9wTmFtZSkpIHtcclxuICAgICAgICAgIGV4cFJlZi5iYXNlID0gdmFsdWVFeHByZXNzaW9uKGV4cFJlZi5iYXNlKTtcclxuICAgICAgICAgIHJldHVybiBleHBSZWY7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBzbmFwc2hvdC5zc01ldGhvZCA9PiBzbmFwc2hvdC5zc01ldGhvZFxyXG4gICAgICAgIGlmICh1dGlsLmFycmF5SW5jbHVkZXMoc25hcHNob3RNZXRob2RzLCBwcm9wTmFtZSkpIHtcclxuICAgICAgICAgIHJldHVybiBleHBSZWY7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBzbmFwc2hvdFtleHBdID0+IHNuYXBzaG90LmNoaWxkKGV4cCkgb3JcclxuICAgICAgLy8gc25hcHNob3RbcmVmXSA9PiBzbmFwc2hvdC5jaGlsZChyZWYudmFsKCkpXHJcbiAgICAgIGV4cFJlZi5hY2Nlc3NvciA9IHZhbHVlRXhwcmVzc2lvbihleHBSZWYuYWNjZXNzb3IpO1xyXG4gICAgICByZXR1cm4gc25hcHNob3RDaGlsZChleHBSZWYpO1xyXG5cclxuICAgIGNhc2UgJ2NhbGwnOlxyXG4gICAgICBsZXQgZXhwQ2FsbCA9IDxhc3QuRXhwQ2FsbD4gYXN0LmNvcHlFeHAoZXhwKTtcclxuICAgICAgZXhwQ2FsbC5yZWYgPSA8YXN0LkV4cFZhcmlhYmxlIHwgYXN0LkV4cFJlZmVyZW5jZT4gc3ViRXhwcmVzc2lvbihleHBDYWxsLnJlZik7XHJcbiAgICAgIHZhciBjYWxsZWUgPSB0aGlzLmxvb2t1cEZ1bmN0aW9uKGV4cENhbGwucmVmKTtcclxuXHJcbiAgICAgIC8vIEV4cGFuZCB0aGUgZnVuY3Rpb24gY2FsbCBpbmxpbmVcclxuICAgICAgaWYgKGNhbGxlZSkge1xyXG4gICAgICAgIHZhciBmbiA9IGNhbGxlZS5mbjtcclxuXHJcbiAgICAgICAgaWYgKGNhbGxlZS5zZWxmKSB7XHJcbiAgICAgICAgICBleHBDYWxsLmFyZ3MudW5zaGlmdChhc3QuZW5zdXJlVmFsdWUoY2FsbGVlLnNlbGYpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChmbi5wYXJhbXMubGVuZ3RoICE9PSBleHBDYWxsLmFyZ3MubGVuZ3RoKSB7XHJcbiAgICAgICAgICB0aGlzLmZhdGFsKGVycm9ycy5taXNtYXRjaFBhcmFtcyArIFwiICggXCIgK1xyXG4gICAgICAgICAgICAgICAgICAgICBjYWxsZWUubWV0aG9kTmFtZSArIFwiIGV4cGVjdHMgXCIgKyBmbi5wYXJhbXMubGVuZ3RoICtcclxuICAgICAgICAgICAgICAgICAgICAgXCIgYnV0IGFjdHVhbGx5IHBhc3NlZCBcIiArIGV4cENhbGwuYXJncy5sZW5ndGggKyBcIilcIik7XHJcbiAgICAgICAgICByZXR1cm4gZXhwO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGZuLmJvZHkudHlwZSA9PT0gJ2J1aWx0aW4nKSB7XHJcbiAgICAgICAgICByZXR1cm4gKDxhc3QuRXhwQnVpbHRpbj4gZm4uYm9keSkuZm4oZXhwQ2FsbC5hcmdzLCBwYXJhbXMpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbGV0IGlubmVyUGFyYW1zID0gPGFzdC5QYXJhbXM+IHt9O1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGZuLnBhcmFtcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgaW5uZXJQYXJhbXNbZm4ucGFyYW1zW2ldXSA9IHN1YkV4cHJlc3Npb24oZXhwQ2FsbC5hcmdzW2ldKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGZ1bmN0aW9uQ2FsbHNbY2FsbGVlLm1ldGhvZE5hbWVdKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLnJlY3Vyc2l2ZSArIFwiIChcIiArIGNhbGxlZS5tZXRob2ROYW1lICsgXCIpXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmdW5jdGlvbkNhbGxzW2NhbGxlZS5tZXRob2ROYW1lXSA9IHRydWU7XHJcbiAgICAgICAgbGV0IHJlc3VsdCA9IHRoaXMucGFydGlhbEV2YWwoZm4uYm9keSwgaW5uZXJQYXJhbXMsIGZ1bmN0aW9uQ2FsbHMpO1xyXG4gICAgICAgIGZ1bmN0aW9uQ2FsbHNbY2FsbGVlLm1ldGhvZE5hbWVdID0gZmFsc2U7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQ2FuJ3QgZXhwYW5kIGZ1bmN0aW9uIC0gYnV0IGp1c3QgZXhwYW5kIHRoZSBhcmd1bWVudHMuXHJcbiAgICAgIGlmICghdGhpcy5hbGxvd1VuZGVmaW5lZEZ1bmN0aW9ucykge1xyXG4gICAgICAgIHZhciBmdW5jTmFtZSA9IGFzdC5nZXRNZXRob2ROYW1lKGV4cENhbGwpO1xyXG4gICAgICAgIGlmIChmdW5jTmFtZSAhPT0gJycgJiYgIShmdW5jTmFtZSBpbiB0aGlzLnN5bWJvbHMuc2NoZW1hWydTdHJpbmcnXS5tZXRob2RzIHx8XHJcbiAgICAgICAgICAgICAgdXRpbC5hcnJheUluY2x1ZGVzKHNuYXBzaG90TWV0aG9kcywgZnVuY05hbWUpKSkge1xyXG4gICAgICAgICAgdGhpcy5mYXRhbChlcnJvcnMudW5kZWZpbmVkRnVuY3Rpb24gKyBhc3QuZGVjb2RlRXhwcmVzc2lvbihleHBDYWxsLnJlZikpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG5cclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBleHBDYWxsLmFyZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBleHBDYWxsLmFyZ3NbaV0gPSBzdWJFeHByZXNzaW9uKGV4cENhbGwuYXJnc1tpXSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEhhY2sgZm9yIHNuYXBzaG90LnBhcmVudCgpLnZhbCgpXHJcbiAgICAgIC8vIFRvZG8gLSBidWlsZCB0YWJsZS1iYXNlZCBtZXRob2Qgc2lnbmF0dXJlcy5cclxuICAgICAgaWYgKGFzdC5nZXRNZXRob2ROYW1lKGV4cENhbGwpID09PSAncGFyZW50Jykge1xyXG4gICAgICAgIGV4cENhbGwgPSA8YXN0LkV4cENhbGw+IGFzdC5jYXN0KGV4cENhbGwsICdTbmFwc2hvdCcpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICByZXR1cm4gZXhwQ2FsbDtcclxuXHJcbiAgICAvLyBFeHByZXNzaW9uIHR5cGVzIChsaWtlIGxpdGVyYWxzKSB0aGFuIG5lZWQgbm8gZXhwYW5zaW9uLlxyXG4gICAgZGVmYXVsdDpcclxuICAgICAgcmV0dXJuIGV4cDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSBjb252ZXJ0IGFsbCAndGhpcycgdG8gJ2RhdGEnIChmcm9tICduZXdEYXRhJykuXHJcbiAgLy8gQXJncyBhcmUgZnVuY3Rpb24gYXJndW1lbnRzLCBhbmQgcGFyYW1zIGFyZSB0aGUgbG9jYWwgKGZ1bmN0aW9uKSBzY29wZSB2YXJpYWJsZXMuXHJcbiAgcHJpb3IoYXJnczogYXN0LkV4cFtdLCBwYXJhbXM6IGFzdC5QYXJhbXMpOiBhc3QuRXhwIHtcclxuICAgIHZhciBsYXN0VGhpc0lzID0gdGhpcy50aGlzSXM7XHJcbiAgICB0aGlzLnRoaXNJcyA9ICdkYXRhJztcclxuICAgIHZhciBleHAgPSB0aGlzLnBhcnRpYWxFdmFsKGFyZ3NbMF0sIHBhcmFtcyk7XHJcbiAgICB0aGlzLnRoaXNJcyA9IGxhc3RUaGlzSXM7XHJcbiAgICByZXR1cm4gZXhwO1xyXG4gIH1cclxuXHJcbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIGN1cnJlbnQgdmFsdWUgb2YgJ3RoaXMnXHJcbiAgZ2V0VGhpcyhhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcyk6IGFzdC5FeHAge1xyXG4gICAgcmV0dXJuIGFzdC5zbmFwc2hvdFZhcmlhYmxlKHRoaXMudGhpc0lzKTtcclxuICB9XHJcblxyXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSBlbnN1cmUgdHlwZSBvZiBhcmd1bWVudFxyXG4gIGVuc3VyZVR5cGUodHlwZTogc3RyaW5nLCBhcmdzOiBhc3QuRXhwW10sIHBhcmFtczogYXN0LlBhcmFtcykge1xyXG4gICAgaWYgKGFyZ3MubGVuZ3RoICE9PSAxKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvcnMuYXBwbGljYXRpb24gKyBcImVuc3VyZVR5cGUgYXJndW1lbnRzLlwiKTtcclxuICAgIH1cclxuICAgIHZhciBleHAgPSA8YXN0LkV4cFZhbHVlPiB0aGlzLnBhcnRpYWxFdmFsKGFyZ3NbMF0sIHBhcmFtcyk7XHJcbiAgICBpZiAoZXhwLnR5cGUgIT09IHR5cGUpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5jb2VyY2lvbiArIGFzdC5kZWNvZGVFeHByZXNzaW9uKGV4cCkgKyBcIiA9PiBcIiArIHR5cGUpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGV4cDtcclxuICB9XHJcblxyXG4gIC8vIEJ1aWx0aW4gZnVuY3Rpb24gLSByZXR1cm4gdGhlIHBhcmVudCBrZXkgb2YgJ3RoaXMnLlxyXG4gIGdldEtleShrZXk6IHN0cmluZywgYXJnczogYXN0LkV4cFtdLCBwYXJhbXM6IGFzdC5QYXJhbXMpIHtcclxuICAgIGlmIChhcmdzLmxlbmd0aCAhPT0gMCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLm1pc21hdGNoUGFyYW1zICsgXCIoZm91bmQgXCIgKyBhcmdzLmxlbmd0aCArIFwiIGJ1dCBleHBlY3RlZCAxKVwiKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4ga2V5WzBdID09PSAnJCcgPyBhc3QubGl0ZXJhbChrZXkpIDogYXN0LnN0cmluZyhrZXkpO1xyXG4gIH1cclxuXHJcbiAgLy8gQnVpbHRpbiBmdW5jdGlvbiAtIHJldHVybiB0aGUgcmVmZXJlbmNlIHRvIHRoZSByb290XHJcbiAgLy8gV2hlbiBpbiByZWFkIG1vZGUgLSB1c2UgJ3Jvb3QnXHJcbiAgLy8gV2hlbiBpbiB3cml0ZS92YWxpZGF0ZSAtIHVzZSBwYXRoIHRvIHJvb3QgdmlhIG5ld0RhdGEucGFyZW50KCkuLi5cclxuICBnZXRSb290UmVmZXJlbmNlKHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUsIGFyZ3M6IGFzdC5FeHBbXSwgcGFyYW1zOiBhc3QuUGFyYW1zKSB7XHJcbiAgICBpZiAoYXJncy5sZW5ndGggIT09IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9ycy5hcHBsaWNhdGlvbiArIFwiQHJvb3QgYXJndW1lbnRzLlwiKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyAnZGF0YScgY2FzZVxyXG4gICAgaWYgKHRoaXMudGhpc0lzID09PSAnZGF0YScpIHtcclxuICAgICAgcmV0dXJuIGFzdC5zbmFwc2hvdFZhcmlhYmxlKCdyb290Jyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gJ25ld0RhdGEnIGNhc2UgLSB0cmF2ZXJzZSB0byByb290IHZpYSBwYXJlbnQoKSdzLlxyXG4gICAgbGV0IHJlc3VsdDogYXN0LkV4cCA9IGFzdC5zbmFwc2hvdFZhcmlhYmxlKCduZXdEYXRhJyk7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhdGgubGVuZ3RoKCk7IGkrKykge1xyXG4gICAgICByZXN1bHQgPSBhc3Quc25hcHNob3RQYXJlbnQocmVzdWx0KTtcclxuICAgIH1cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvLyBMb29rdXAgZ2xvYmFsbHkgZGVmaW5lZCBmdW5jdGlvbi5cclxuICBsb29rdXBGdW5jdGlvbihyZWY6IGFzdC5FeHBWYXJpYWJsZSB8IGFzdC5FeHBSZWZlcmVuY2UpOiB7XHJcbiAgICBzZWxmPzogYXN0LkV4cCxcclxuICAgIGZuOiBhc3QuTWV0aG9kLFxyXG4gICAgbWV0aG9kTmFtZTogc3RyaW5nXHJcbiAgfSB7XHJcbiAgICAvLyBGdW5jdGlvbiBjYWxsLlxyXG4gICAgaWYgKHJlZi50eXBlID09PSAndmFyJykge1xyXG4gICAgICBsZXQgcmVmVmFyID0gPGFzdC5FeHBWYXJpYWJsZT4gcmVmO1xyXG4gICAgICB2YXIgZm4gPSB0aGlzLnN5bWJvbHMuZnVuY3Rpb25zW3JlZlZhci5uYW1lXTtcclxuICAgICAgaWYgKCFmbikge1xyXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICAgIH1cclxuICAgICAgcmV0dXJuIHsgc2VsZjogdW5kZWZpbmVkLCBmbjogZm4sIG1ldGhvZE5hbWU6IHJlZlZhci5uYW1lfTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBNZXRob2QgY2FsbC5cclxuICAgIGlmIChyZWYudHlwZSA9PT0gJ3JlZicpIHtcclxuICAgICAgbGV0IHJlZlJlZiA9IDxhc3QuRXhwUmVmZXJlbmNlPiByZWY7XHJcbiAgICAgIC8vIFRPRE86IFJlcXVpcmUgc3RhdGljIHR5cGUgdmFsaWRhdGlvbiBiZWZvcmUgY2FsbGluZyBTdHJpbmcgbWV0aG9kcy5cclxuICAgICAgaWYgKCg8YXN0LkV4cE9wPiByZWZSZWYuYmFzZSkub3AgIT09ICd2YWx1ZScgJiZcclxuICAgICAgICAgIDxzdHJpbmc+ICg8YXN0LkV4cFZhbHVlPiByZWZSZWYuYWNjZXNzb3IpLnZhbHVlIGluIHRoaXMuc3ltYm9scy5zY2hlbWFbJ1N0cmluZyddLm1ldGhvZHMpIHtcclxuICAgICAgICBsZXQgbWV0aG9kTmFtZSA9IDxzdHJpbmc+ICg8YXN0LkV4cFZhbHVlPiByZWZSZWYuYWNjZXNzb3IpLnZhbHVlO1xyXG4gICAgICAgIHJldHVybiB7IHNlbGY6IHJlZlJlZi5iYXNlLFxyXG4gICAgICAgICAgICAgICAgIGZuOiB0aGlzLnN5bWJvbHMuc2NoZW1hWydTdHJpbmcnXS5tZXRob2RzW21ldGhvZE5hbWVdLFxyXG4gICAgICAgICAgICAgICAgIG1ldGhvZE5hbWU6ICdTdHJpbmcuJyArIG1ldGhvZE5hbWVcclxuICAgICAgICAgICAgICAgfTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcblxyXG4gIGZhdGFsKHM6IHN0cmluZykge1xyXG4gICAgbG9nZ2VyLmVycm9yKHMpO1xyXG4gICAgdGhpcy5lcnJvckNvdW50ICs9IDE7XHJcbiAgfVxyXG59O1xyXG5cclxuLy8gTWVyZ2UgYWxsIC5YIHRlcm1zIGludG8gdGFyZ2V0LlxyXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kVmFsaWRhdG9yKHRhcmdldDogVmFsaWRhdG9yLCBzcmM6IFZhbGlkYXRvcik6IFZhbGlkYXRvciB7XHJcbiAgaWYgKHNyYyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJJbGxlZ2FsIHZhbGlkYXRpb24gc291cmNlLlwiKTtcclxuICB9XHJcbiAgZm9yICh2YXIgcHJvcCBpbiBzcmMpIHtcclxuICAgIGlmICghc3JjLmhhc093blByb3BlcnR5KHByb3ApKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG4gICAgaWYgKHByb3BbMF0gPT09ICcuJykge1xyXG4gICAgICBpZiAodGFyZ2V0W3Byb3BdID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICB0YXJnZXRbcHJvcF0gPSBbXTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodXRpbC5pc1R5cGUoc3JjW3Byb3BdLCAnYXJyYXknKSkge1xyXG4gICAgICAgIHV0aWwuZXh0ZW5kQXJyYXkodGFyZ2V0W3Byb3BdLCBzcmNbcHJvcF0pO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgICg8YXN0LkV4cFtdPiB0YXJnZXRbcHJvcF0pLnB1c2goPGFzdC5FeHA+IHNyY1twcm9wXSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGlmICghdGFyZ2V0W3Byb3BdKSB7XHJcbiAgICAgICAgdGFyZ2V0W3Byb3BdID0ge307XHJcbiAgICAgIH1cclxuICAgICAgZXh0ZW5kVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHRhcmdldFtwcm9wXSwgPFZhbGlkYXRvcj4gc3JjW3Byb3BdKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiB0YXJnZXQ7XHJcbn1cclxuXHJcbi8vIENhbGwgZm4odmFsdWUsIHByb3AsIHBhdGgpIG9uIGFsbCAnLnByb3BzJyBhbmQgYXNzaWdpbmcgdGhlIHZhbHVlIGJhY2sgaW50byB0aGVcclxuLy8gdmFsaWRhdG9yLlxyXG5leHBvcnQgZnVuY3Rpb24gbWFwVmFsaWRhdG9yKHY6IFZhbGlkYXRvcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmbjogKHZhbDogVmFsaWRhdG9yVmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzY29wZTogYXN0LlBhcmFtcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IGFzdC5QYXRoVGVtcGxhdGUpID0+IFZhbGlkYXRvclZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNjb3BlPzogYXN0LlBhcmFtcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoPzogYXN0LlBhdGhUZW1wbGF0ZSkge1xyXG4gIGlmICghc2NvcGUpIHtcclxuICAgIHNjb3BlID0gPGFzdC5QYXJhbXM+IHt9O1xyXG4gIH1cclxuICBpZiAoIXBhdGgpIHtcclxuICAgIHBhdGggPSBuZXcgYXN0LlBhdGhUZW1wbGF0ZSgpO1xyXG4gIH1cclxuICBpZiAoJyQkc2NvcGUnIGluIHYpIHtcclxuICAgIHNjb3BlID0gPGFzdC5QYXJhbXM+IHZbJyQkc2NvcGUnXTtcclxuICB9XHJcbiAgZm9yICh2YXIgcHJvcCBpbiB2KSB7XHJcbiAgICBpZiAoIXYuaGFzT3duUHJvcGVydHkocHJvcCkpIHtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcbiAgICBpZiAocHJvcFswXSA9PT0gJy4nKSB7XHJcbiAgICAgIHZbcHJvcF0gPSBmbih2W3Byb3BdLCBwcm9wLCBzY29wZSwgcGF0aCk7XHJcbiAgICAgIGlmICh2W3Byb3BdID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICBkZWxldGUgdltwcm9wXTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmICghdXRpbC5pc1R5cGUodltwcm9wXSwgJ29iamVjdCcpKSB7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbGV0IGNoaWxkID0gbmV3IGFzdC5QYXRoVGVtcGxhdGUoW3Byb3BdKTtcclxuICAgICAgcGF0aC5wdXNoKGNoaWxkKTtcclxuICAgICAgbWFwVmFsaWRhdG9yKDxWYWxpZGF0b3I+IHZbcHJvcF0sIGZuLCBzY29wZSwgcGF0aCk7XHJcbiAgICAgIHBhdGgucG9wKGNoaWxkKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbi8vIENvbGxhcHNlIGFsbCBoYXNDaGlsZHJlbiBjYWxscyBpbnRvIG9uZSAoY29tYmluaW5nIHRoZWlyIGFyZ3VtZW50cykuXHJcbi8vIEUuZy4gW25ld0RhdGEuaGFzQ2hpbGRyZW4oKSwgbmV3RGF0YS5oYXNDaGlsZHJlbihbJ3gnXSksIG5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd5J10pXSA9PlxyXG4vLyAgICAgIG5ld0RhdGEuaGFzQ2hpbGRyZW4oWyd4JywgJ3knXSlcclxuZnVuY3Rpb24gY29sbGFwc2VIYXNDaGlsZHJlbihleHBzOiBhc3QuRXhwW10pOiBhc3QuRXhwW10ge1xyXG4gIHZhciBoYXNIYXNDaGlsZHJlbjogYm9vbGVhbiA9IGZhbHNlO1xyXG4gIHZhciBjb21iaW5lZCA9IDxzdHJpbmdbXT4gW107XHJcbiAgdmFyIHJlc3VsdCA9IDxhc3QuRXhwW10+IFtdO1xyXG4gIGV4cHMuZm9yRWFjaChmdW5jdGlvbihleHApIHtcclxuICAgIGlmIChleHAudHlwZSAhPT0gJ2NhbGwnKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKGV4cCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZXhwQ2FsbCA9IDxhc3QuRXhwQ2FsbD4gZXhwO1xyXG4gICAgaWYgKGFzdC5nZXRNZXRob2ROYW1lKGV4cENhbGwpICE9PSAnaGFzQ2hpbGRyZW4nKSB7XHJcbiAgICAgIHJlc3VsdC5wdXNoKGV4cCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZXhwQ2FsbC5hcmdzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICBoYXNIYXNDaGlsZHJlbiA9IHRydWU7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuXHJcbiAgICAvLyBFeHBlY3Qgb25lIGFyZ3VtZW50IG9mIEFycmF5IHR5cGUuXHJcbiAgICBpZiAoZXhwQ2FsbC5hcmdzLmxlbmd0aCAhPT0gMSB8fCBleHBDYWxsLmFyZ3NbMF0udHlwZSAhPT0gJ0FycmF5Jykge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJJbnZhbGlkIGFyZ3VtZW50IHRvIGhhc0NoaWxkcmVuKCk6IFwiICtcclxuICAgICAgICAgICAgICAgICAgICAgIGV4cENhbGwuYXJnc1swXS50eXBlKTtcclxuICAgIH1cclxuICAgIGxldCBhcmdzID0gKDxhc3QuRXhwVmFsdWU+IGV4cENhbGwuYXJnc1swXSkudmFsdWU7XHJcblxyXG4gICAgYXJncy5mb3JFYWNoKGZ1bmN0aW9uKGFyZykge1xyXG4gICAgICBoYXNIYXNDaGlsZHJlbiA9IHRydWU7XHJcbiAgICAgIGlmIChhcmcudHlwZSAhPT0gJ1N0cmluZycpIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JzLmFwcGxpY2F0aW9uICsgXCJFeHBlY3Qgc3RyaW5nIGFyZ3VtZW50IHRvIGhhc0NoaWxkcmVuKCksIG5vdDogXCIgK1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhcmcudHlwZSk7XHJcbiAgICAgIH1cclxuICAgICAgY29tYmluZWQucHVzaChhcmcudmFsdWUpO1xyXG4gICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIGlmIChoYXNIYXNDaGlsZHJlbikge1xyXG4gICAgcmVzdWx0LnVuc2hpZnQoaGFzQ2hpbGRyZW5FeHAoY29tYmluZWQpKTtcclxuICB9XHJcbiAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuLy8gR2VuZXJhdGUgdGhpcy5oYXNDaGlsZHJlbihbcHJvcHMsIC4uLl0pIG9yIHRoaXMuaGFzQ2hpbGRyZW4oKVxyXG5mdW5jdGlvbiBoYXNDaGlsZHJlbkV4cChwcm9wczogc3RyaW5nW10pOiBhc3QuRXhwIHtcclxuICB2YXIgYXJncyA9IHByb3BzLmxlbmd0aCA9PT0gMCA/IFtdIDogW2FzdC5hcnJheShwcm9wcy5tYXAoYXN0LnN0cmluZykpXTtcclxuICByZXR1cm4gYXN0LmNhbGwoYXN0LnJlZmVyZW5jZShhc3QuY2FzdChhc3QudmFyaWFibGUoJ3RoaXMnKSwgJ0FueScpLCBhc3Quc3RyaW5nKCdoYXNDaGlsZHJlbicpKSxcclxuICAgICAgICAgICAgICAgICAgYXJncyk7XHJcbn1cclxuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
