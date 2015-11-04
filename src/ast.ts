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
/// <reference path="typings/node.d.ts" />

import util = require('./util');

export type Map = { [prop: string]: any };

export interface Exp {
  type: string;
  valueType: string;
}

export interface ExpValue extends Exp {
  value: any;
}

export interface ExpNull extends Exp {
}

export interface ExpOp extends Exp {
  op: string;
  args: Exp[];
}

export interface ExpVariable extends Exp {
  name: string;
}

export interface ExpLiteral extends Exp {
  name: string;
}

// base[accessor]
export interface ExpReference extends Exp {
  base: Exp;
  accessor: Exp;
}

export interface ExpCall extends Exp {
  // Object reference or global symbol
  ref: ExpReference | ExpVariable;
  args: Exp[];
}

export type BuiltinFunction = (args: Exp[], params: { [name: string]: Exp; }) => Exp;

export interface ExpBuiltin extends Exp {
  fn: BuiltinFunction;
}

export type ExpType = ExpSimpleType | ExpUnionType | ExpGenericType;

// Simple Type (reference)
export interface ExpSimpleType extends Exp {
  name: string;
}

// Union Type: Type1 | Type2 | ...
export interface ExpUnionType extends Exp {
  types: ExpType[];
}

// Generic Type (reference): Type<Type1, Type2, ...>
export interface ExpGenericType extends Exp {
  name: string;
  params: ExpType[];
}

export interface Method {
  params: string[];
  body: Exp;
}

export interface Path {
  parts: string[];
  isType: ExpType;
  methods: { [name: string]: Method };
};

export interface Schema {
  derivedFrom: ExpType;
  properties: { [prop: string]: ExpType };
  methods: { [name: string]: Method };

  // Generic parameters - if a Generic schema
  params?: string[];
  getValidator?: (params: Exp[]) => Map;
};

export interface Loggers {
  error: (message: string) => void;
  warn: (message: string) => void;
};
export var string: (string) => ExpValue = valueGen('String');
export var boolean: (boolean) => ExpValue = valueGen('Boolean');
export var number: (number) => ExpValue  = valueGen('Number');
export var array = valueGen('Array');
export var regexp = valueGen('RegExp');

export var neg = opGen('neg', 1);
export var not = opGen('!', 1);
export var mult = opGen('*');
export var div = opGen('/');
export var mod = opGen('%');
export var add = opGen('+');
export var sub = opGen('-');
export var eq = opGen('==');
export var lt = opGen('<');
export var lte = opGen('<=');
export var gt = opGen('>');
export var gte = opGen('>=');
export var ne = opGen('!=');
export var and = opGen('&&');
export var or = opGen('||');
export var ternary = opGen('?:', 3);
export var value = opGen('value', 1);

var errors = {
  typeMismatch: "Unexpected type: ",
};

export function variable(name): ExpVariable {
  return { type: 'var', valueType: 'Any', name: name };
}

export function literal(name): ExpLiteral {
  return { type: 'literal', valueType: 'Any', name: name };
}

export function nullType(): ExpNull {
  return { type: 'Null', valueType: 'Null' };
}

export function reference(base: Exp, prop: Exp): ExpReference {
  return {
    type: 'ref',
    valueType: 'Any',
    base: base,
    accessor: prop
  };
}

let reIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_]*$/;

export function isIdentifierStringExp(exp: Exp) {
  return exp.type === 'String' && reIdentifier.test((<ExpValue> exp).value);
}

// Shallow copy of an expression (so it can be modified and preserve
// immutability of the original expression).
export function copyExp(exp: Exp): Exp {
  exp = <Exp> util.extend({}, exp);
  switch (exp.type) {
  case 'op':
  case 'call':
    let opExp = <ExpOp> exp;
    opExp.args = util.copyArray(opExp.args);
    return opExp;

  case 'union':
    let unionExp = <ExpUnionType> exp;
    unionExp.types = util.copyArray(unionExp.types);
    return unionExp;

  case 'generic':
    let genericExp = <ExpGenericType> exp;
    genericExp.params = util.copyArray(genericExp.params);
    return genericExp;

  default:
     return exp;
  }
}

// Make a (shallow) copy of the base expression, setting (or removing) it's
// valueType.
//
// valueType is a string indicating the type of evaluating an expression (e.g.
// 'Snapshot') - used to know when type coercion is needed in the context
// of parent expressions.
export function cast(base: Exp, valueType: string): Exp {
  var result = copyExp(base);
  result.valueType = valueType;
  return result;
}

export function call(ref: ExpReference | ExpVariable, args: Exp[]= []): ExpCall {
  return { type: 'call', valueType: 'Any', ref: ref, args: args };
}

// Return empty string if not a function.
export function getFunctionName(exp: ExpCall): string {
  if (exp.ref.type === 'ref') {
    return '';
  }
  return (<ExpVariable> exp.ref).name;
}

// Return empty string if not a (simple) method call -- ref.fn()
export function getMethodName(exp: ExpCall): string {
  if (exp.ref.type === 'var') {
    return (<ExpVariable> exp.ref).name;
  }
  if (exp.ref.type !== 'ref') {
    return '';
  }
  return getPropName(<ExpReference> exp.ref);
}

export function getPropName(ref: ExpReference): string {
  if (ref.accessor.type !== 'String') {
    return '';
  }
  return (<ExpValue> ref.accessor).value;
}

// TODO: Type of function signature does not fail this declaration?
export function builtin(fn: BuiltinFunction): ExpBuiltin {
  return { type: 'builtin', valueType: 'Any', fn: fn };
}

export function snapshotVariable(name: string): ExpVariable {
  return <ExpVariable> cast(variable(name), 'Snapshot');
}

export function snapshotParent(base: Exp): Exp {
  if (base.valueType !== 'Snapshot') {
    throw new Error(errors.typeMismatch + "expected Snapshot");
  }
  return cast(call(reference(cast(base, 'Any'), string('parent'))),
              'Snapshot');
}

export function ensureValue(exp: Exp): Exp {
  if (exp.valueType === 'Snapshot') {
    return snapshotValue(exp);
  }
  return exp;
}

// ref.val()
export function snapshotValue(exp): ExpCall {
  return call(reference(cast(exp, 'Any'), string('val')));
}

// Ensure expression is a boolean (when used in a boolean context).
export function ensureBoolean(exp: Exp): Exp {
  exp = ensureValue(exp);
  if (isCall(exp, 'val')) {
    exp = eq(exp, boolean(true));
  }
  return exp;
}

export function isCall(exp: Exp, methodName: string): boolean {
  return exp.type === 'call' && (<ExpCall> exp).ref.type === 'ref' &&
    (<ExpReference> (<ExpCall> exp).ref).accessor.type === 'String' &&
    (<ExpValue> (<ExpReference> (<ExpCall> exp).ref).accessor).value === methodName;
}

// Return value generating function for a given Type.
function valueGen(typeName: string): ((val: any) => ExpValue) {
  return function(val): ExpValue {
    return {
      type: typeName,      // Exp type identifying a constant value of this Type.
      valueType: typeName, // The type of the result of evaluating this expression.
      value: val           // The (constant) value itself.
    };
  };
}

function cmpValues(v1: ExpValue, v2: ExpValue): boolean {
  return v1.type === v2.type && v1.value === v2.value;
}

function isOp(opType: string, exp: Exp): boolean {
  return exp.type === 'op' && (<ExpOp> exp).op === opType;
}

// Return a generating function to make an operator exp node.
function opGen(opType: string, arity: number = 2): ((...args: Exp[]) => ExpOp) {
  return function(...args): ExpOp {
    if (args.length !== arity) {
      throw new Error("Operator has " + args.length +
                      " arguments (expecting " + arity + ").");
    }
    return op(opType, args);
  };
}

export var andArray = leftAssociateGen('&&', boolean(true), boolean(false));
export var orArray = leftAssociateGen('||', boolean(false), boolean(true));

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
function leftAssociateGen(opType: string, identityValue: ExpValue, zeroValue: ExpValue) {
  return function(a: Exp[]): Exp {
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
export function flatten(opType: string, exp: Exp, flat?: Exp[]): Exp[] {
  var i;

  if (flat === undefined) {
    flat = [];
  }

  if (!isOp(opType, exp)) {
    flat.push(exp);
    return flat;
  }

  for (i = 0; i < (<ExpOp> exp).args.length; i++) {
    flatten(opType, (<ExpOp> exp).args[i], flat);
  }

  return flat;
}

export function op(opType, args): ExpOp {
  return {
    type: 'op',     // This is (multi-argument) operator.
    valueType: 'Any',
    op: opType,     // The operator (string, e.g. '+').
    args: args      // Arguments to the operator Array<exp>
  };
}

// Warning: NOT an expression type!
export function method(params: string[], body: Exp): Method {
  return {
    params: params,
    body: body
  };
}

export function typeType(typeName: string): ExpSimpleType {
  return { type: "type", valueType: "type", name: typeName };
}

export function unionType(types: ExpType[]): ExpUnionType {
  return { type: "union", valueType: "type", types: types };
}

export function genericType(typeName: string, params: ExpType[]): ExpGenericType {
  return { type: "generic", valueType: "type", name: typeName, params: params };
}

export class Symbols {
  functions: { [name: string]: Method };
  paths: { [name: string]: Path };
  schema: { [name: string]: Schema };
  log: Loggers;

  constructor() {
    this.functions = {};
    this.paths = {};
    this.schema = {};
    this.log = {
      error: function(s) { console.error(s); },
      warn: function(s) { console.warn(s); },
    };
  }

  register(type: string, name: string, object: any) {
    if (!this[type]) {
      throw new Error("Invalid registration type: " + type);
    }

    if (this[type][name]) {
      this.log.error("Duplicated " + type + " definition: " + name + ".");
    } else {
      this[type][name] = object;
    }
    return this[type][name];
  }

  registerFunction(name: string, params: string[], body: Exp): Method {
    return <Method> this.register('functions', name, method(params, body));
  }

  registerPath(parts: string[], isType: ExpType | void, methods: { [name: string]: Method; } = {}): Path {
    isType = isType || typeType('Any');
    var p: Path = {
      parts: parts,
      isType: <ExpType> isType,
      methods: methods
    };
    return <Path> this.register('paths', '/' + parts.join('/'), p);
  }

  registerSchema(name: string,
                 derivedFrom?: ExpType,
                 properties: { [prop: string]: ExpType } = {},
                 methods: { [name: string]: Method } = {},
                 params: string[] = []): Schema {
    derivedFrom = derivedFrom || typeType(Object.keys(properties).length > 0 ? 'Object' : 'Any');

    var s: Schema = {
      derivedFrom: <ExpType> derivedFrom,
      properties: properties,
      methods: methods,
      params: params,
    };
    return <Schema> this.register('schema', name, s);
  }

  isDerivedFrom(type: ExpType, ancestor: string): boolean {
    if (ancestor === 'Any') {
      return true;
    }

    switch (type.type) {
    case 'type':
    case 'generic':
      let simpleType = <ExpSimpleType> type;
      if (simpleType.name === ancestor) {
        return true;
      }
      if (simpleType.name === 'Any') {
        return false;
      }
      let schema = this.schema[simpleType.name];
      if (!schema) {
        return false;
      }
      return this.isDerivedFrom(schema.derivedFrom, ancestor);

    case 'union':
      return (<ExpUnionType> type).types
        .map((subType) => this.isDerivedFrom(subType, ancestor))
        .reduce(util.or);

    default:
      throw new Error("Unknown type: " + type.type);
      }
  }

  setLoggers(loggers: Loggers) {
    this.log = loggers;
  }
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
export interface OpPriority {
  rep?: string;
  fn?: (...any) => any;
  p: number;
}

export var JS_OPS: { [op: string]: OpPriority; } = {
  'value': { rep: "", p: 16 },

  'neg': { rep: "-", p: 15, fn: function(val) { return -val; } },
  '!': { p: 15,  fn: function(val) { return !val; } },
  '*': { p: 14,  fn: function(a, b) { return a * b; } },
  '/': { p: 14,  fn: function(a, b) { return a / b; } },
  '%': { p: 14,  fn: function(a, b) { return a % b; } },
  '+': { p: 13,  fn: function(a, b) { return a + b; } },
  '-': { p: 13,  fn: function(a, b) { return a - b; } },
  '<': { p: 11,  fn: function(a, b) { return a < b; } },
  '<=': { p: 11, fn: function(a, b) { return a <= b; } },
  '>': { p: 11,  fn: function(a, b) { return a > b; } },
  '>=': { p: 11, fn: function(a, b) { return a >= b; } },
  'in': { p: 11, fn: function(a, b) { return a in b; } },
  '==': { p: 10, fn: function(a, b) { return a === b; } },
  "!=": { p: 10, fn: function(a, b) { return a !== b; } },
  '&&': { p: 6,  fn: function(a, b) { return a && b; } },
  '||': { p: 5,  fn: function(a, b) { return a || b; } },
  '?:': { p: 4,  fn: function(a, b, c) { return a ? b : c; } },
  ',': { p: 0},
};

// From an AST, decode as an expression (string).
export function decodeExpression(exp: Exp, outerPrecedence?: number): string {
  if (outerPrecedence === undefined) {
    outerPrecedence = 0;
  }
  var innerPrecedence = precedenceOf(exp);
  var result;
  switch (exp.type) {
  case 'Boolean':
  case 'Number':
    result = JSON.stringify((<ExpValue> exp).value);
    break;

  case 'String':
    result = util.quoteString((<ExpValue> exp).value);
    break;

  // RegExp assumed to be in correct format.
  case 'RegExp':
    result = (<ExpValue> exp).value;
    break;

  case 'Array':
    result = '[' + decodeArray((<ExpValue> exp).value) + ']';
    break;

  case 'Null':
    result = 'null';
    break;

  case 'var':
  case 'literal':
    result = (<ExpVariable> exp).name;
    break;

  case 'ref':
    let expRef = <ExpReference> exp;
    if (isIdentifierStringExp(expRef.accessor)) {
      result = decodeExpression(expRef.base) + '.' + (<ExpValue> expRef.accessor).value;
    } else {
      result = decodeExpression(expRef.base, innerPrecedence) +
        '[' + decodeExpression(expRef.accessor) + ']';
    }
    break;

  case 'call':
    let expCall = <ExpCall> exp;
    result = decodeExpression(expCall.ref) + '(' + decodeArray(expCall.args) + ')';
    break;

  case 'builtin':
    result = decodeExpression(exp);
    break;

  case 'op':
    let expOp = <ExpOp> exp;
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
    result = (<ExpSimpleType> exp).name;
    break;

  case 'union':
    result = (<ExpUnionType> exp).types.map(decodeExpression).join(' | ');
    break;

  case 'generic':
    let genericType = <ExpGenericType> exp;
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

function decodeArray(args: Exp[]): string {
  return args.map(decodeExpression).join(', ');
}

function precedenceOf(exp: Exp): number {
  switch (exp.type) {
  case 'op':
    return JS_OPS[(<ExpOp> exp).op].p;

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
