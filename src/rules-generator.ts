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
import * as util from './util';
import * as ast from './ast';
import {warn, error} from './logger';
let parser = require('./rules-parser');
import {parseExpression} from './parse-util';

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
  invalidPropertyName: "Property names cannot contain any of: . $ # [ ] / or control characters: ",
};

let INVALID_KEY_REGEX = /[\[\].#$\/\u0000-\u001F\u007F]/;

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
   '.scope': { [variable: string]: string }
*/
export type ValidatorValue = ast.Exp | ast.Exp[] | string | string[] | Validator;
export interface Validator {
  [name: string]: ValidatorValue;
};

var builtinSchemaNames = ['Any', 'Null', 'String', 'Number', 'Boolean', 'Object'];
// Method names allowed in Bolt files.
var valueMethods = ['length', 'includes', 'startsWith', 'beginsWith', 'endsWith',
                    'replace', 'toLowerCase', 'toUpperCase', 'test', 'contains',
                    'matches'];
// TODO: Make sure users don't call internal methods...make private to impl.
var snapshotMethods = ['parent', 'child', 'hasChildren', 'val', 'isString', 'isNumber',
                       'isBoolean'].concat(valueMethods);

var writeAliases = <{ [method: string]: ast.Exp }> {
  'create': parseExpression('prior(this) == null'),
  'update': parseExpression('prior(this) != null && this != null'),
  'delete': parseExpression('prior(this) != null && this == null')
};

// Usage:
//   json = bolt.generate(bolt-text)
export function generate(symbols: string | ast.Symbols): Validator {
  if (typeof symbols === 'string') {
    symbols = parser.parse(symbols);
  }
  var gen = new Generator(<ast.Symbols> symbols);
  return gen.generateRules();
}

// Symbols contains:
//   functions: {}
//   schema: {}
//   paths: {}
export class Generator {
  symbols: ast.Symbols;
  validators: { [schemaName: string]: Validator; };
  rules: Validator;
  errorCount: number;
  runSilently: boolean;
  allowUndefinedFunctions: boolean;
  globals: ast.Params;
  thisIs: string;
  keyIndex: number;

  constructor(symbols: ast.Symbols) {
    this.symbols = symbols;
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
    var name: string;

    paths.forEach((path) => {
      this.validateMethods(errors.badPathMethod, path.methods,
                           ['validate', 'read', 'write', 'index']);
    });

    for (name in schema) {
      if (!util.arrayIncludes(builtinSchemaNames, name)) {
        this.validateMethods(errors.badSchemaMethod, schema[name].methods,
                             ['validate', 'read', 'write']);
      }
    }

    if (paths.length === 0) {
      this.fatal(errors.noPaths);
    }

    paths.forEach((path) => this.updateRules(path));
    this.convertExpressions(this.rules);

    if (this.errorCount !== 0) {
      throw new Error(errors.generateFailed + this.errorCount + " errors.");
    }

    util.deletePropName(this.rules, '.scope');
    util.pruneEmptyChildren(this.rules);

    return {
      rules: this.rules
    };
  }

  validateMethods(m: string, methods: { [name: string]: ast.Method }, allowed: string[]) {
    if (util.arrayIncludes(allowed, 'write')) {
      allowed = allowed.concat(Object.keys(writeAliases));
    }
    for (var method in methods) {
      if (!util.arrayIncludes(allowed, method)) {
        warn(m + util.quoteString(method) +
             " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
      }
    }
    if ('write' in methods) {
      Object.keys(writeAliases).forEach((alias) => {
        if (alias in methods) {
          this.fatal(errors.badWriteAlias + alias);
        }
      });
    }
  }

  registerBuiltinSchema() {
    var self = this;
    var thisVar = ast.variable('this');

    function registerAsCall(name: string, methodName: string): void {
      self.symbols.registerSchema(name, ast.typeType('Any'), undefined, {
        validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'),
                                                              ast.string(methodName))))
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
      test: ast.method(['this', 'r'],
                       ast.call(ast.reference(ast.value(thisVar), ast.string('matches')),
                                [ ast.call(ast.variable('@RegExp'), [ast.variable('r')]) ])),
    });

    registerAsCall('Number', 'isNumber');
    registerAsCall('Boolean', 'isBoolean');

    this.symbols.registerFunction('@RegExp', ['r'],
                                  ast.builtin(this.ensureType.bind(this, 'RegExp')));

    let map = this.symbols.registerSchema('Map', ast.typeType('Any'), undefined, undefined,
                                          ['Key', 'Value']);
    map.getValidator = this.getMapValidator.bind(this);
  }

  // type Map<Key, Value> => {
  //   $key: {
  //     '.validate': $key instanceof Key and this instanceof Value;
  //   '.validate': 'newData.hasChildren()'
  // }
  // Key must derive from String
  getMapValidator(params: ast.Exp[]): Validator {
    let keyType = <ast.ExpSimpleType> params[0];
    let valueType = <ast.ExpType> params[1];
    if (keyType.type !== 'type' || !this.symbols.isDerivedFrom(keyType, 'String')) {
      throw new Error(errors.invalidMapKey + "  (" + ast.decodeExpression(keyType) + " does not)");
    }

    let validator = <Validator> {};
    let index = this.uniqueKey();
    validator[index] = <Validator> {};
    extendValidator(validator, this.ensureValidator(ast.typeType('Object')));

    // First validate the key (omit terminal String type validation).
    while (keyType.name !== 'String') {
      let schema = this.symbols.schema[keyType.name];
      if (schema.methods['validate']) {
        let exp = this.partialEval(schema.methods['validate'].body, {'this': ast.literal(index)});
        extendValidator(<Validator> validator[index], <Validator> {'.validate': [exp]});
      }
      keyType = <ast.ExpSimpleType> schema.derivedFrom;
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
    var key = ast.decodeExpression(type);
    if (!this.validators[key]) {
      this.validators[key] = {'.validate': ast.literal('***TYPE RECURSION***') };

      let allowSave = this.allowUndefinedFunctions;
      this.allowUndefinedFunctions = true;
      this.validators[key] = this.createValidator(type);
      this.allowUndefinedFunctions = allowSave;
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

    if (schema === undefined || !ast.Schema.isGeneric(schema)) {
      throw new Error(errors.noSuchType + schemaName + " (generic)");
    }

    let schemaParams = <string[]> schema.params;

    if (params.length !== schemaParams.length) {
      throw new Error(errors.invalidGeneric + " expected <" + schemaParams.join(', ') + ">");
    }

    // Call custom validator, if given.
    if (schema.getValidator) {
      return schema.getValidator(params);
    }

    let bindings = <ast.TypeParams> {};
    for (let i = 0; i < params.length; i++) {
      bindings[schemaParams[i]] = params[i];
    }

    // Expand generics and generate validator from schema.
    schema = this.replaceGenericsInSchema(schema, bindings);
    return this.createValidatorFromSchema(schema);
  }

  replaceGenericsInSchema(schema: ast.Schema, bindings: ast.TypeParams): ast.Schema {
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

  replaceGenericsInExp(exp: ast.Exp, bindings: ast.TypeParams): ast.Exp {
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

  replaceGenericsInMethod(method: ast.Method, bindings: ast.TypeParams): ast.Method {
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

    if (ast.Schema.isGeneric(schema)) {
      throw new Error(errors.noSuchType + schemaName + " used as non-generic type.");
    }

    return this.createValidatorFromSchema(schema);
  }

  createValidatorFromSchema(schema: ast.Schema): Validator {
    var hasProps = Object.keys(schema.properties).length > 0 &&
      !this.isCollectionSchema(schema);

    if (hasProps && !this.symbols.isDerivedFrom(schema.derivedFrom, 'Object')) {
      this.fatal(errors.nonObject + " (is " + ast.decodeExpression(schema.derivedFrom) + ")");
      return {};
    }

    let validator = <Validator> {};

    if (!(schema.derivedFrom.type === 'type' &&
          (<ast.ExpSimpleType> schema.derivedFrom).name === 'Any')) {
      extendValidator(validator, this.ensureValidator(schema.derivedFrom));
    }

    let requiredProperties = <string[]> [];
    let wildProperties = 0;
    Object.keys(schema.properties).forEach((propName) => {
      if (propName[0] === '$') {
        wildProperties += 1;
        if (INVALID_KEY_REGEX.test(propName.slice(1))) {
          this.fatal(errors.invalidPropertyName + propName);
        }
      } else {
        if (INVALID_KEY_REGEX.test(propName)) {
          this.fatal(errors.invalidPropertyName + propName);
        }
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

    this.extendValidationMethods(validator, schema.methods);

    return validator;
  }

  isNullableType(type: ast.ExpType): boolean {
    let result = this.symbols.isDerivedFrom(type, 'Null') ||
      this.symbols.isDerivedFrom(type, 'Map');
    return result;
  }

  // Update rules based on the given path expression.
  updateRules(path: ast.Path) {
    var i: number;
    var location = <Validator> util.ensureObjectPath(this.rules, path.template.getLabels());
    var exp: ast.ExpValue;

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
        exp = <ast.ExpValue> path.methods['index'].body;
        break;
      default:
        this.fatal(errors.badIndex);
        return;
      }
      var indices = <string[]> [];
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

  extendValidationMethods(validator: Validator, methods: { [method: string]: ast.Method }) {
    let writeMethods = <ast.Exp[]> [];
    ['create', 'update', 'delete'].forEach((method) => {
      if (method in methods) {
        writeMethods.push(ast.andArray([writeAliases[method], methods[method].body]));
      }
    });
    if (writeMethods.length !== 0) {
      extendValidator(validator, <Validator> { '.write': ast.orArray(writeMethods) });
    }

    ['validate', 'read', 'write'].forEach((method) => {
      if (method in methods) {
        var methodValidator = <Validator> {};
        methodValidator['.' + method] = methods[method].body;
        extendValidator(validator, methodValidator);
      }
    });
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

  // Convert expressions to text, and at the same time, apply pruning operations
  // to remove no-op rules.
  convertExpressions(validator: Validator) {
    var methodThisIs = <{[prop: string]: string}> { '.validate': 'newData',
                                                    '.read': 'data',
                                                    '.write': 'newData' };

    function hasWildcardSibling(path: ast.PathTemplate): boolean {
      let parts = path.getLabels();
      let childPart = parts.pop();
      let parent = util.deepLookup(validator, parts);
      if (parent === undefined) {
        return false;
      }
      for (let prop of Object.keys(parent)) {
        if (prop === childPart) {
          continue;
        }
        if (prop[0] === '$') {
          return true;
        }
      }
      return false;
    }

    mapValidator(validator, (value: ast.Exp[],
                             prop: string,
                             scope: ast.Params,
                             path: ast.PathTemplate) => {
      if (prop in methodThisIs) {
        let result = this.getExpressionText(ast.andArray(collapseHasChildren(value)),
                                            methodThisIs[prop],
                                            scope,
                                            path);
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
  }

  getExpressionText(exp: ast.Exp, thisIs: string, scope: ast.Params, path: ast.PathTemplate): string {
    if (!('type' in exp)) {
      throw new Error(errors.application + "Not an expression: " + util.prettyJSON(exp));
    }
    // First evaluate w/o binding of this to specific location.
    this.allowUndefinedFunctions = true;
    scope = <ast.Params> util.extend({},
                                     scope,
                                     { 'this': ast.cast(ast.call(ast.variable('@getThis')),
                                                        'Snapshot') });
    exp = this.partialEval(exp, scope);
    // Now re-evaluate the flattened expression.
    this.allowUndefinedFunctions = false;
    this.thisIs = thisIs;
    this.symbols.registerFunction('@getThis', [],
                                  ast.builtin(this.getThis.bind(this)));
    this.symbols.registerFunction('@root', [],
                                  ast.builtin(this.getRootReference.bind(this, path)));
    this.symbols.registerFunction('prior', ['exp'],
                                  ast.builtin(this.prior.bind(this)));
    this.symbols.registerFunction('key', [],
                                  ast.builtin(this.getKey.bind(
                                    this,
                                    path.length() === 0 ? '' : path.getPart(-1).label)));

    exp = this.partialEval(exp);

    delete this.symbols.functions['@getThis'];
    delete this.symbols.functions['@root'];
    delete this.symbols.functions['prior'];
    delete this.symbols.functions['key'];

    // Top level expressions should never be to a snapshot reference - should
    // always evaluate to a boolean.
    exp = ast.ensureBoolean(exp);
    return ast.decodeExpression(exp);
  }

  /*
   *  Wrapper for partialEval debugging.
   */

  partialEval(exp: ast.Exp,
              params = <ast.Params> {},
              functionCalls: { [name: string]: boolean } = {})
  : ast.Exp {
    // Wrap real call for debugging.
    let result = this.partialEvalReal(exp, params, functionCalls);
    // console.log(ast.decodeExpression(exp) + " => " + ast.decodeExpression(result));
    return result;
  }

  // Partial evaluation of expressions - copy of expression tree (immutable).
  //
  // - Expand inline function calls.
  // - Replace local and global variables with their values.
  // - Expand snapshot references using child('ref').
  // - Coerce snapshot references to values as needed.
  partialEvalReal(exp: ast.Exp,
              params = <ast.Params> {},
              functionCalls = <{ [name: string]: boolean }> {})
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

    function lookupVar(exp2: ast.ExpVariable) {
      // TODO: Unbound variable access should be an error.
      return params[exp2.name] || self.globals[exp2.name] || exp2;
    }

    // Convert ref[prop] => ref.child(prop)
    function snapshotChild(ref: ast.ExpReference): ast.Exp {
      return ast.cast(ast.call(ast.reference(ref.base, ast.string('child')),
                               [ref.accessor]),
                      'Snapshot');
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
      return lookupVar(<ast.ExpVariable> exp);

    case 'ref':
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

        let innerParams = <ast.Params> {};

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
          this.fatal(errors.undefinedFunction + ast.decodeExpression(expCall.ref));
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
  prior(args: ast.Exp[], params: ast.Params): ast.Exp {
    var lastThisIs = this.thisIs;
    this.thisIs = 'data';
    var exp = this.partialEval(args[0], params);
    this.thisIs = lastThisIs;
    return exp;
  }

  // Builtin function - current value of 'this'
  getThis(args: ast.Exp[], params: ast.Params): ast.Exp {
    return ast.snapshotVariable(this.thisIs);
  }

  // Builtin function - ensure type of argument
  ensureType(type: string, args: ast.Exp[], params: ast.Params) {
    if (args.length !== 1) {
      throw new Error(errors.application + "ensureType arguments.");
    }
    var exp = <ast.ExpValue> this.partialEval(args[0], params);
    if (exp.type !== type) {
      throw new Error(errors.coercion + ast.decodeExpression(exp) + " => " + type);
    }
    return exp;
  }

  // Builtin function - return the parent key of 'this'.
  getKey(key: string, args: ast.Exp[], params: ast.Params) {
    if (args.length !== 0) {
      throw new Error(errors.mismatchParams + "(found " + args.length + " but expected 1)");
    }

    return key[0] === '$' ? ast.literal(key) : ast.string(key);
  }

  // Builtin function - return the reference to the root
  // When in read mode - use 'root'
  // When in write/validate - use path to root via newData.parent()...
  getRootReference(path: ast.PathTemplate, args: ast.Exp[], params: ast.Params) {
    if (args.length !== 0) {
      throw new Error(errors.application + "@root arguments.");
    }

    // 'data' case
    if (this.thisIs === 'data') {
      return ast.snapshotVariable('root');
    }

    // TODO(koss): Remove this special case if JSON supports newRoot instead.
    // 'newData' case - traverse to root via parent()'s.
    let result: ast.Exp = ast.snapshotVariable('newData');
    for (let i = 0; i < path.length(); i++) {
      result = ast.snapshotParent(result);
    }
    return result;
  }

  // Lookup globally defined function.
  lookupFunction(ref: ast.ExpVariable | ast.ExpReference): {
    self?: ast.Exp,
    fn: ast.Method,
    methodName: string
  } | undefined {
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

  fatal(s: string) {
    error(s);
    this.errorCount += 1;
  }
};

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
        util.extendArray(<any[]> target[prop], <any[]> src[prop]);
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

// Call fn(value, prop, path) on all '.props' and assiging the value back into the
// validator.
export function mapValidator(v: Validator,
                             fn: (val: ValidatorValue,
                                  prop: string,
                                  scope: ast.Params,
                                  path: ast.PathTemplate) => ValidatorValue | undefined,
                             scope?: ast.Params,
                             path?: ast.PathTemplate) {
  if (!scope) {
    scope = <ast.Params> {};
  }
  if (!path) {
    path = new ast.PathTemplate();
  }
  if ('.scope' in v) {
    scope = <ast.Params> v['.scope'];
  }
  for (var prop in v) {
    if (!v.hasOwnProperty(prop)) {
      continue;
    }
    if (prop[0] === '.') {
      let value = fn(v[prop], prop, scope, path);
      if (value !== undefined) {
        v[prop] = value;
      } else {
        delete v[prop];
      }
    } else if (!util.isType(v[prop], 'object')) {
      continue;
    } else {
      let child = new ast.PathTemplate([prop]);
      path.push(child);
      mapValidator(<Validator> v[prop], fn, scope, path);
      path.pop(child);
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

    args.forEach(function(arg: ast.ExpValue) {
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
