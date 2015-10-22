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
/// <reference path="typings/node.d.ts" />
import util = require('./util');
import ast = require('./ast');

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
  coercion: "Cannot convert value: ",
  undefinedFunction: "Undefined function: ",
  application: "Bolt application error: ",
  invalidGeneric: "Invalid generic schema usage: ",
  invalidMapKey: "Map<Key, T> - Key must derive from String type.",
  invalidWildChildren: "Types can have at most one $wild property and cannot mix with other properties.",
};

/*
   A Validator is a JSON heriarchical structure. The "leaves" are "dot-properties"
   (see below). The intermediate nodes in the tree are "prop" or "$prop"
   properties.

   A Validator is mutated to have different forms based on the the phase of
   generation.

   In the first phase, they are Exp[]. Later the Exp[] are ANDed together and
   combined into expression text (and returned as the final JSON-rules that
   Firebase uses.

   Note: TS does not allow for special properties to have distinct
   types from the 'index' property given for the interface.  :-(

   '.read': ast.Exp[] | string;
   '.write': ast.Exp[] | string;
   '.validate': ast.Exp[] | string;
   '.indexOn': string[];
*/
export type ValidatorValue = ast.Exp | ast.Exp[] | string | string[] | Validator;
export interface Validator {
  [name: string]: ValidatorValue;
};

interface OpPriority {
  rep?: string;
  p: number;
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
var JS_OPS: { [op: string]: OpPriority; } = {
  'value': { rep: "", p: 16 },

  'neg': { rep: "-", p: 15},
  '!': { p: 15},
  '*': { p: 14},
  '/': { p: 14},
  '%': { p: 14},
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
  ',': { p: 0},
};

var builtinSchemaNames = ['Any', 'Null', 'String', 'Number', 'Boolean', 'Object'];
// Method names allowed in Bolt files.
var valueMethods = ['length', 'includes', 'startsWith', 'beginsWith', 'endsWith',
                    'replace', 'toLowerCase', 'toUpperCase', 'test', 'contains',
                    'matches'];
// TODO: Make sure users don't call internal methods...make private to impl.
var snapshotMethods = ['parent', 'child', 'hasChildren', 'val', 'isString', 'isNumber',
                       'isBoolean'].concat(valueMethods);

// Symbols contains:
//   functions: {}
//   schema: {}
//   paths: {}
export class Generator {
  symbols: ast.Symbols;
  log: ast.Loggers;
  validators: { [schemaName: string]: Validator; };
  rules: Validator;
  errorCount: number;
  runSilently: boolean;
  allowUndefinedFunctions: boolean;
  globals: { [name: string]: ast.Exp };
  thisIs: string;
  keyIndex: number;

  constructor(symbols: ast.Symbols) {
    this.symbols = symbols;
    this.log = symbols.log;
    this.validators = {};
    this.rules = {};
    this.errorCount = 0;
    this.runSilently = false;
    this.allowUndefinedFunctions = false;
    this.keyIndex = 0;

    // TODO: globals should be part of this.symbols (nested scopes)
    this.globals = {
      "root": ast.call(ast.variable('@root')),
    };

    this.registerBuiltinSchema();
  }

  // Return Firebase compatible Rules JSON for a the given symbols definitions.
  generateRules(): Validator {
    this.errorCount = 0;
    var paths = this.symbols.paths;
    var schema = this.symbols.schema;
    var name;

    for (name in paths) {
      if (!paths.hasOwnProperty(name)) {
        continue;
      }

      this.validateMethods(errors.badPathMethod, paths[name].methods,
                           ['validate', 'read', 'write', 'index']);
    }

    for (name in schema) {
      if (!util.arrayIncludes(builtinSchemaNames, name)) {
        this.validateMethods(errors.badSchemaMethod, schema[name].methods,
                             ['validate', 'read', 'write', 'index']);
      }
    }

    if (Object.keys(paths).length === 0) {
      this.fatal(errors.noPaths);
    }

    for (var pathName in paths) {
      if (!paths.hasOwnProperty(pathName)) {
        continue;
      }

      this.updateRules(paths[pathName]);
    }
    this.convertExpressions(this.rules);

    if (this.errorCount !== 0) {
      throw new Error(errors.generateFailed + this.errorCount + " errors.");
    }

    util.pruneEmptyChildren(this.rules);

    return {
      rules: this.rules
    };
  }

  validateMethods(m: string, methods: { [name: string]: ast.Method }, allowed: string[]) {
    for (var method in methods) {
      if (!util.arrayIncludes(allowed, method)) {
        this.log.warn(m + util.quoteString(method) +
                      " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
      }
    }
  }

  registerBuiltinSchema() {
    var self = this;
    var thisVar = ast.variable('this');

    function registerAsCall(name, methodName) {
      self.symbols.registerSchema(name, ast.typeType('Any'), undefined, {
        validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'),
                                                              ast.string(methodName))))
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
      validate: ast.method(['this'],
                           ast.call(ast.reference(ast.cast(thisVar, 'Any'), ast.string('isString')))),
      includes: ast.method(['this', 's'],
                           ast.call(ast.reference(ast.value(thisVar), ast.string('contains')),
                                    [ ast.value(ast.variable('s')) ])),
      startsWith: ast.method(['this', 's'],
                             ast.call(ast.reference(ast.value(thisVar), ast.string('beginsWith')),
                                      [ ast.value(ast.variable('s')) ])),
      endsWith: ast.method(['this', 's'],
                           ast.call(ast.reference(ast.value(thisVar), ast.string('endsWith')),
                                    [ ast.value(ast.variable('s')) ])),
      replace: ast.method(['this', 's', 'r'],
                          ast.call(ast.reference(ast.value(thisVar), ast.string('replace')),
                                   [ ast.value(ast.variable('s')), ast.value(ast.variable('r')) ])),
      test: ast.method(['this', 's'],
                       ast.call(ast.reference(ast.value(thisVar), ast.string('matches')),
                                [ ast.call(ast.variable('@RegExp'), [ast.variable('s')]) ])),
    });

    registerAsCall('Number', 'isNumber');
    registerAsCall('Boolean', 'isBoolean');

    this.symbols.registerFunction('@RegExp', ['s'],
                                  ast.builtin(this.makeRegExp.bind(this)));

    let map = this.symbols.registerSchema('Map', ast.typeType('Any'), undefined, undefined,
                                          ['Key', 'Value']);
    map.getValidator = this.getMapValidator.bind(this);
  }

  // type Map<Key, Value> => {
  //   $key: {
  //     '.validate': $key instanceof Key and this instanceof Value;
  // }
  // Key must derive from String
  getMapValidator(params: ast.Exp[]): Validator {
    let keyType = <ast.ExpSimpleType> params[0];
    let valueType = <ast.ExpType> params[1];
    if (keyType.type !== 'type' || !this.symbols.isDerivedFrom(keyType, 'String')) {
      throw new Error(errors.invalidMapKey + "  (" + decodeExpression(keyType) + " does not)");
    }

    let validator = <Validator> {};
    let index = this.uniqueKey();
    validator[index] = <Validator> {};

    // First validate the key (not needed if just String type).
    if (keyType.name !== 'String') {
      let schema = this.symbols.schema[keyType.name];
      if (schema.methods['validate']) {
        let exp = this.partialEval(schema.methods['validate'].body, {'this': ast.literal(index)});
        extendValidator(<Validator> validator[index], <Validator> {'.validate': [exp]});
      }
    }

    extendValidator(<Validator> validator[index], this.ensureValidator(valueType));
    return validator;
  }

  uniqueKey(): string {
    this.keyIndex += 1;
    return '$key' + this.keyIndex;
  }

  // Collection schema has exactly one $wildchild property
  isCollectionSchema(schema: ast.Schema): boolean {
    let props = Object.keys(schema.properties);
    let result = props.length === 1 && props[0][0] === '$';
    return result;
  }

  // Ensure we have a definition for a validator for the given schema.
  ensureValidator(type: ast.ExpType): Validator {
    var key = decodeExpression(type);
    if (!this.validators[key]) {
      this.validators[key] = {'.validate': ast.literal('***TYPE RECURSION***') };
      this.validators[key] = this.createValidator(type);
    }
    return this.validators[key];
  }

  createValidator(type: ast.ExpType): Validator {
    switch (type.type) {
    case 'type':
      return this.createValidatorFromSchemaName((<ast.ExpSimpleType> type).name);

    case 'union':
      let union = <Validator> {};
      (<ast.ExpUnionType> type).types.forEach((typePart: ast.ExpType) => {
        // Make a copy
        var singleType = extendValidator({}, this.ensureValidator(typePart));
        mapValidator(singleType, ast.andArray);
        extendValidator(union, singleType);
      });
      mapValidator(union, ast.orArray);
      return union;

    case 'generic':
      let genericType = <ast.ExpGenericType> type;
      return this.createValidatorFromGeneric(genericType.name, genericType.params);

    default:
      throw new Error(errors.application + "invalid internal type: " + type.type);
    }
  }

  createValidatorFromGeneric(schemaName: string, params: ast.ExpType[]): Validator {
    var schema = this.symbols.schema[schemaName];

    if (!schema || !this.isGeneric(schema)) {
      throw new Error(errors.noSuchType + schemaName + " (generic)");
    }

    if (params.length !== schema.params.length) {
      throw new Error(errors.invalidGeneric + " expected <" + schema.params.join(', ') + ">");
    }

    // Call custom validator, if given.
    if (schema.getValidator) {
      return schema.getValidator(params);
    }

    let bindings = <{[name: string]: ast.ExpType}> {};
    for (let i = 0; i < params.length; i++) {
      bindings[schema.params[i]] = params[i];
    }

    // Expand generics and generate validator from schema.
    schema = this.replaceGenericsInSchema(schema, bindings);
    return this.createValidatorFromSchema(schema);
  }

  replaceGenericsInSchema(schema: ast.Schema, bindings: {[name: string]: ast.ExpType}): ast.Schema {
    var expandedSchema = <ast.Schema> {
      derivedFrom: <ast.ExpType> this.replaceGenericsInExp(schema.derivedFrom, bindings),
      properties: { },
      methods: {},
    };
    let props = Object.keys(schema.properties);
    props.forEach((prop) => {
      expandedSchema.properties[prop] =
        <ast.ExpType> this.replaceGenericsInExp(schema.properties[prop], bindings);
    });

    let methods = Object.keys(schema.methods);
    methods.forEach((methodName) => {
      expandedSchema.methods[methodName] = this.replaceGenericsInMethod(schema.methods[methodName],
                                                                       bindings);
    });
    return expandedSchema;
  }

  replaceGenericsInExp(exp: ast.Exp, bindings: {[name: string]: ast.ExpType}): ast.Exp {
    var self = this;

    function replaceGenericsInArray(exps: ast.Exp[]): ast.Exp[] {
      return exps.map(function(expPart) {
        return self.replaceGenericsInExp(expPart, bindings);
      });
    }

    switch (exp.type) {
    case 'op':
    case 'call':
      let opType = <ast.ExpOp> ast.copyExp(exp);
      opType.args = replaceGenericsInArray(opType.args);
      return opType;

    case 'type':
      let simpleType = <ast.ExpSimpleType> exp;
      return bindings[simpleType.name] || simpleType;

    case 'union':
      let unionType = <ast.ExpUnionType> exp;
      return ast.unionType(<ast.ExpType[]> replaceGenericsInArray(unionType.types));

    case 'generic':
      let genericType = <ast.ExpGenericType> exp;
      return ast.genericType(genericType.name,
                             <ast.ExpType[]> replaceGenericsInArray(genericType.params));

    default:
      return exp;
    }
  }

  replaceGenericsInMethod(method: ast.Method, bindings: {[name: string]: ast.ExpType}): ast.Method {
    var expandedMethod = <ast.Method> {
      params: method.params,
      body: method.body
    };

    expandedMethod.body = this.replaceGenericsInExp(method.body, bindings);
    return expandedMethod;
  }

  createValidatorFromSchemaName(schemaName: string): Validator {
    var schema = this.symbols.schema[schemaName];

    if (!schema) {
      throw new Error(errors.noSuchType + schemaName);
    }

    if (this.isGeneric(schema)) {
      throw new Error(errors.noSuchType + schemaName + " used as non-generic type.");
    }

    return this.createValidatorFromSchema(schema);
  }

  isGeneric(schema) {
    return schema.params.length > 0;
  }

  createValidatorFromSchema(schema: ast.Schema): Validator {
    var hasProps = Object.keys(schema.properties).length > 0 &&
      !this.isCollectionSchema(schema);

    if (hasProps && !this.symbols.isDerivedFrom(schema.derivedFrom, 'Object')) {
      this.fatal(errors.nonObject + " (is " + decodeExpression(schema.derivedFrom) + ")");
      return {};
    }

    let validator = <Validator> {};

    if (!(schema.derivedFrom.type === 'type' &&
          (<ast.ExpSimpleType> schema.derivedFrom).name === 'Any')) {
      extendValidator(validator, this.ensureValidator(schema.derivedFrom));
    }

    let requiredProperties = [];
    let wildProperties = 0;
    Object.keys(schema.properties).forEach((propName) => {
      if (propName[0] === '$') {
        wildProperties += 1;
      }
      if (!validator[propName]) {
        validator[propName] = {};
      }
      var propType = schema.properties[propName];
      if (propName[0] !== '$' && !this.isNullableType(propType)) {
        requiredProperties.push(propName);
      }
      extendValidator(<Validator> validator[propName], this.ensureValidator(propType));
    });

    if (wildProperties > 1 || wildProperties === 1 && requiredProperties.length > 0) {
      this.fatal(errors.invalidWildChildren);
    }

    if (requiredProperties.length > 0) {
      // this.hasChildren(requiredProperties)
      extendValidator(validator,
                      {'.validate': [hasChildrenExp(requiredProperties)]});
    }

    // Disallow $other properties by default
    if (hasProps) {
      validator['$other'] = {};
      extendValidator(<Validator> validator['$other'],
                      <Validator> {'.validate': ast.boolean(false)});
    }

    ['validate', 'read', 'write'].forEach(function(method) {
      if (schema.methods[method]) {
        var methodValidator = <Validator> {};
        methodValidator['.' + method] = [schema.methods[method].body];
        extendValidator(validator, methodValidator);
      }
    });

    return validator;
  }

  isNullableType(type: ast.ExpType): boolean {
    let result = this.symbols.isDerivedFrom(type, 'Null') || this.symbols.isDerivedFrom(type, 'Map');
    return result;
  }

  // Update rules based on the given path expression.
  updateRules(path: ast.Path) {
    var i;
    var location = <Validator> util.ensureObjectPath(this.rules, path.parts);
    var exp;

    extendValidator(location, this.ensureValidator(path.isType));

    ['validate', 'read', 'write'].forEach(function(method) {
      if (path.methods[method]) {
        var validator = <Validator> {};
        validator['.' + method] = [path.methods[method].body];
        extendValidator(location, validator);
      }
    });

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
        } else {
          indices.push(exp.value[i].value);
        }
      }
      // TODO: Error check not over-writing index rules.
      location['.indexOn'] = indices;
    }
  }

  // Return union validator (||) over each schema
  unionValidators(schema: string[]): Validator {
    var union = <Validator> {};
    schema.forEach(function(typeName: string) {
      // First and the validator terms for a single type
      // Todo extend to unions and generics
      var singleType = extendValidator({}, this.ensureValidator(typeName));
      mapValidator(singleType, ast.andArray);
      extendValidator(union, singleType);
    }.bind(this));
    mapValidator(union, ast.orArray);
    return union;
  }

  convertExpressions(validator: Validator) {
    var methodThisIs = { '.validate': 'newData',
                         '.read': 'data',
                         '.write': 'newData' };

    mapValidator(validator, function(value: ast.Exp[], prop: string, path: string[]) {
      if (prop in methodThisIs) {
        let result = this.getExpressionText(ast.andArray(collapseHasChildren(value)),
                                            methodThisIs[prop],
                                            path);
        if (prop === '.validate' && result === 'true' ||
            (prop === '.read' || prop === '.write') && result === 'false') {
          return undefined;
        }
        return result;
      }
      return value;
    }.bind(this));
  }

  getExpressionText(exp: ast.Exp, thisIs: string, path: string[]): string {
    if (!('type' in exp)) {
      throw new Error(errors.application + "Not an expression: " + util.prettyJSON(exp));
    }
    // First evaluate w/o binding of this to specific location.
    this.allowUndefinedFunctions = true;
    exp = this.partialEval(exp, { 'this': ast.cast(ast.call(ast.variable('@getThis')),
                                                   'Snapshot') });
    // Now re-evaluate the flattened expression.
    this.allowUndefinedFunctions = false;
    this.thisIs = thisIs || 'newData';
    this.symbols.registerFunction('@getThis', [],
                                  ast.builtin(this.getThis.bind(this)));
    this.symbols.registerFunction('@root', [],
                                  ast.builtin(this.getRootReference.bind(this, path)));
    this.symbols.registerFunction('prior', ['exp'],
                                  ast.builtin(this.prior.bind(this)));
    this.symbols.registerFunction('key', [],
                                  ast.builtin(this.getKey.bind(this, path[path.length - 1])));

    exp = this.partialEval(exp);

    delete this.symbols.functions['@getThis'];
    delete this.symbols.functions['@root'];
    delete this.symbols.functions['prior'];
    delete this.symbols.functions['key'];

    // Top level expressions should never be to a snapshot reference - should
    // always evaluate to a boolean.
    exp = ast.ensureBoolean(exp);
    return decodeExpression(exp);
  }

  /*
   *  Wrapper for partialEval debugging.
   */

  partialEval(exp: ast.Exp,
              params: { [name: string]: ast.Exp } = {},
              functionCalls: { [name: string]: boolean } = {})
  : ast.Exp {
    // Wrap real call for debugging.
    let result = this.partialEvalReal(exp, params, functionCalls);
    // console.log(decodeExpression(exp) + " => " + decodeExpression(result));
    return result;
  }

  // Partial evaluation of expressions - copy of expression tree (immutable).
  //
  // - Expand inline function calls.
  // - Replace local and global variables with their values.
  // - Expand snapshot references using child('ref').
  // - Coerce snapshot references to values as needed.
  partialEvalReal(exp: ast.Exp,
              params: { [name: string]: ast.Exp } = {},
              functionCalls: { [name: string]: boolean } = {})
  : ast.Exp {
    var self = this;

    function subExpression(exp2: ast.Exp): ast.Exp {
      return self.partialEval(exp2, params, functionCalls);
    }

    function valueExpression(exp2: ast.Exp): ast.Exp {
      return ast.ensureValue(subExpression(exp2));
    }

    function booleanExpression(exp2: ast.Exp): ast.Exp {
      return ast.ensureBoolean(subExpression(exp2));
    }

    function lookupVar(exp2) {
      // TODO: Unbound variable access should be an error.
      return params[exp2.name] || self.globals[exp2.name] || exp2;
    }

    switch (exp.type) {
    case 'op':
      let expOp = <ast.ExpOp> ast.copyExp(exp);
      // Ensure arguments are boolean (or values) where needed.
      if (expOp.op === 'value') {
        expOp.args[0] = valueExpression(expOp.args[0]);
      } else if (expOp.op === '||' || expOp.op === '&&' || expOp.op === '!') {
        for (let i = 0; i < expOp.args.length; i++) {
          expOp.args[i] = booleanExpression(expOp.args[i]);
        }
      } else if (expOp.op === '?:') {
        expOp.args[0] = booleanExpression(expOp.args[0]);
        expOp.args[1] = valueExpression(expOp.args[1]);
        expOp.args[2] = valueExpression(expOp.args[2]);
      } else {
        for (let i = 0; i < expOp.args.length; i++) {
          expOp.args[i] = valueExpression(expOp.args[i]);
        }
      }
      return expOp;

    case 'var':
      return lookupVar(exp);

    case 'ref':
      // Convert ref[prop] => ref.child(prop)
      function snapshotChild(ref: ast.ExpReference): ast.Exp {
        return ast.cast(ast.call(ast.reference(ref.base, ast.string('child')),
                                 [ref.accessor]),
                        'Snapshot');
      }

      let expRef = <ast.ExpReference> ast.copyExp(exp);
      expRef.base = subExpression(expRef.base);

      // var[ref] => var[ref]
      if (expRef.base.valueType !== 'Snapshot') {
        expRef.accessor = subExpression(expRef.accessor);
        return expRef;
      }

      let propName = ast.getPropName(expRef);

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
      let expCall = <ast.ExpCall> ast.copyExp(exp);
      expCall.ref = <ast.ExpVariable | ast.ExpReference> subExpression(expCall.ref);
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
          return (<ast.ExpBuiltin> fn.body).fn(expCall.args, params);
        }

        let innerParams: { [arg: string]: ast.Exp } = {};

        for (let i = 0; i < fn.params.length; i++) {
          innerParams[fn.params[i]] = subExpression(expCall.args[i]);
        }
        if (functionCalls[callee.methodName]) {
          throw new Error(errors.recursive + " (" + callee.methodName + ")");
        }
        functionCalls[callee.methodName] = true;
        let result = this.partialEval(fn.body, innerParams, functionCalls);
        functionCalls[callee.methodName] = false;
        return result;
      }

      // Can't expand function - but just expand the arguments.
      if (!this.allowUndefinedFunctions) {
        var funcName = ast.getMethodName(expCall);
        if (funcName !== '' && !(funcName in this.symbols.schema['String'].methods ||
              util.arrayIncludes(snapshotMethods, funcName))) {
          this.fatal(errors.undefinedFunction + decodeExpression(expCall.ref));
        }
      }

      for (let i = 0; i < expCall.args.length; i++) {
        expCall.args[i] = subExpression(expCall.args[i]);
      }

      // Hack for snapshot.parent().val()
      // Todo - build table-based method signatures.
      if (ast.getMethodName(expCall) === 'parent') {
        expCall = <ast.ExpCall> ast.cast(expCall, 'Snapshot');
      }

      return expCall;

    // Expression types (like literals) than need no expansion.
    default:
      return exp;
    }
  }

  // Builtin function - convert all 'this' to 'data' (from 'newData').
  // Args are function arguments, and params are the local (function) scope variables.
  prior(args: ast.Exp[], params: { [name: string]: ast.Exp }): ast.Exp {
    var lastThisIs = this.thisIs;
    this.thisIs = 'data';
    var exp = this.partialEval(args[0], params);
    this.thisIs = lastThisIs;
    return exp;
  }

  // Builtin function - current value of 'this'
  getThis(args: ast.Exp[], params: { [name: string]: ast.Exp }): ast.Exp {
    return ast.snapshotVariable(this.thisIs);
  }

  // Builtin function - convert string to RegExp
  makeRegExp(args: ast.Exp[], params: { [name: string]: ast.Exp }) {
    if (args.length !== 1) {
      throw new Error(errors.application + "RegExp arguments.");
    }
    var exp = <ast.ExpValue> this.partialEval(args[0], params);
    if (exp.type !== 'String' || !/\/.*\//.test(exp.value)) {
      throw new Error(errors.coercion + decodeExpression(exp) + " => RegExp");
    }
    return ast.regexp(exp.value);
  }

  // Builtin function - return the parent key of 'this'.
  getKey(key: string, args: ast.Exp[], params: { [name: string]: ast.Exp }) {
    if (args.length !== 0) {
      throw new Error(errors.mismatchParams + "(found " + args.length + " but expected 1)");
    }

    return key[0] === '$' ? ast.literal(key) : ast.string(key);
  }

  // Builtin function - return the reference to the root
  // When in read mode - use 'root'
  // When in write/validate - use path to root via newData.parent()...
  getRootReference(path: string[], args: ast.Exp[], params: { [name: string]: ast.Exp }) {
    if (args.length !== 0) {
      throw new Error(errors.application + "@root arguments.");
    }

    // 'data' case
    if (this.thisIs === 'data') {
      return ast.snapshotVariable('root');
    }

    // 'newData' case - traverse to root via parent()'s.
    let result: ast.Exp = ast.snapshotVariable('newData');
    for (let i = 0; i < path.length; i++) {
      result = ast.snapshotParent(result);
    }
    return result;
  }

  // Lookup globally defined function.
  lookupFunction(ref: ast.ExpVariable | ast.ExpReference): {
    self?: ast.Exp,
    fn: ast.Method,
    methodName: string
  } {
    // Function call.
    if (ref.type === 'var') {
      let refVar = <ast.ExpVariable> ref;
      var fn = this.symbols.functions[refVar.name];
      if (!fn) {
        return undefined;
      }
      return { self: undefined, fn: fn, methodName: refVar.name};
    }

    // Method call.
    if (ref.type === 'ref') {
      let refRef = <ast.ExpReference> ref;
      // TODO: Require static type validation before calling String methods.
      if ((<ast.ExpOp> refRef.base).op !== 'value' &&
          <string> (<ast.ExpValue> refRef.accessor).value in this.symbols.schema['String'].methods) {
        let methodName = <string> (<ast.ExpValue> refRef.accessor).value;
        return { self: refRef.base,
                 fn: this.symbols.schema['String'].methods[methodName],
                 methodName: 'String.' + methodName
               };
      }
    }
    return undefined;
  }

  setLoggers(loggers: ast.Loggers) {
    this.symbols.setLoggers(loggers);
    this.log = this.symbols.log;
  }

  fatal(s: string) {
    this.log.error(s);
    this.errorCount += 1;
  }
};

// From an AST, decode as an expression (string).
export function decodeExpression(exp: ast.Exp, outerPrecedence?: number): string {
  if (outerPrecedence === undefined) {
    outerPrecedence = 0;
  }
  var innerPrecedence = precedenceOf(exp);
  var result;
  switch (exp.type) {
  case 'Boolean':
  case 'Number':
    result = JSON.stringify((<ast.ExpValue> exp).value);
    break;

  case 'String':
    result = util.quoteString((<ast.ExpValue> exp).value);
    break;

  // RegExp assumed to be in correct format.
  case 'RegExp':
    result = (<ast.ExpValue> exp).value;
    break;

  case 'Array':
    result = '[' + decodeArray((<ast.ExpValue> exp).value) + ']';
    break;

  case 'Null':
    result = 'null';
    break;

  case 'var':
  case 'literal':
    result = (<ast.ExpVariable> exp).name;
    break;

  case 'ref':
    let expRef = <ast.ExpReference> exp;
    if (ast.isIdentifierStringExp(expRef.accessor)) {
      result = decodeExpression(expRef.base) + '.' + (<ast.ExpValue> expRef.accessor).value;
    } else {
      result = decodeExpression(expRef.base, innerPrecedence) +
        '[' + decodeExpression(expRef.accessor) + ']';
    }
    break;

  case 'call':
    let expCall = <ast.ExpCall> exp;
    result = decodeExpression(expCall.ref) + '(' + decodeArray(expCall.args) + ')';
    break;

  case 'builtin':
    result = decodeExpression(exp);
    break;

  case 'op':
    let expOp = <ast.ExpOp> exp;
    var rep = JS_OPS[expOp.op].rep === undefined ? expOp.op : JS_OPS[expOp.op].rep;
    if (expOp.args.length === 1) {
      result = rep + decodeExpression(expOp.args[0], innerPrecedence);
    } else if (expOp.args.length === 2) {
      result =
        decodeExpression(expOp.args[0], innerPrecedence) +
        ' ' + rep + ' ' +
        // All ops are left associative - so nudge the innerPrecendence
        // down on the right hand side to force () for right-associating
        // operations.
        decodeExpression(expOp.args[1], innerPrecedence + 1);
    } else if (expOp.args.length === 3) {
      result =
        decodeExpression(expOp.args[0], innerPrecedence) + ' ? ' +
        decodeExpression(expOp.args[1], innerPrecedence) + ' : ' +
        decodeExpression(expOp.args[2], innerPrecedence);
    }
    break;

  case 'type':
    result = (<ast.ExpSimpleType> exp).name;
    break;

  case 'union':
    result = (<ast.ExpUnionType> exp).types.map(decodeExpression).join(' | ');
    break;

  case 'generic':
    let genericType = <ast.ExpGenericType> exp;
    return genericType.name + '<' + decodeArray(genericType.params) + '>';

  default:
    result = "***UNKNOWN TYPE*** (" + exp.type + ")";
    break;
  }

  if (innerPrecedence < outerPrecedence) {
    result = '(' + result + ')';
  }

  return result;
}

function decodeArray(args: ast.Exp[]): string {
  return args.map(decodeExpression).join(', ');
}

function precedenceOf(exp: ast.Exp): number {
  switch (exp.type) {
  case 'op':
    return JS_OPS[(<ast.ExpOp> exp).op].p;

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
  // lists call as 17 and ref as 18 - but how could they be anything other than left to right?
  // http://www.scriptingmaster.com/javascript/operator-precedence.asp - agrees.
  case 'call':
    return 18;
  case 'ref':
    return 18;
  default:
    return 19;
  }
}

// Merge all .X terms into target.
export function extendValidator(target: Validator, src: Validator): Validator {
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
      } else {
        (<ast.Exp[]> target[prop]).push(<ast.Exp> src[prop]);
      }
    } else {
      if (!target[prop]) {
        target[prop] = {};
      }
      extendValidator(<Validator> target[prop], <Validator> src[prop]);
    }
  }

  return target;
}

// Call fn(value, prop) on all '.props' and assiging the value back into the
// validator.
export function mapValidator(v: Validator,
                             fn: (val: ValidatorValue, prop: string, path: string[]) => ValidatorValue,
                             path?: string[]) {
  if (!path) {
    path = [];
  }
  for (var prop in v) {
    if (!v.hasOwnProperty(prop)) {
      continue;
    }
    if (prop[0] === '.') {
      v[prop] = fn(v[prop], prop, path);
      if (v[prop] === undefined) {
        delete v[prop];
      }
    } else {
      path.push(prop);
      mapValidator(<Validator> v[prop], fn, path);
      path.pop();
    }
  }
}

// Collapse all hasChildren calls into one (combining their arguments).
// E.g. [newData.hasChildren(), newData.hasChildren(['x']), newData.hasChildren(['y'])] =>
//      newData.hasChildren(['x', 'y'])
function collapseHasChildren(exps: ast.Exp[]): ast.Exp[] {
  var hasHasChildren: boolean = false;
  var combined = <string[]> [];
  var result = <ast.Exp[]> [];
  exps.forEach(function(exp) {
    if (exp.type !== 'call') {
      result.push(exp);
      return;
    }

    let expCall = <ast.ExpCall> exp;
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
    let args = (<ast.ExpValue> expCall.args[0]).value;

    args.forEach(function(arg) {
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
function hasChildrenExp(props: string[]): ast.Exp {
  var args = props.length === 0 ? [] : [ast.array(props.map(ast.string))];
  return ast.call(ast.reference(ast.cast(ast.variable('this'), 'Any'), ast.string('hasChildren')),
                  args);
}
