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
/// <reference path="../typings/node.d.ts" />

import util = require('./util');

export var string = valueGen('String');
export var boolean = valueGen('Boolean');
export var number = valueGen('Number');
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
  typeMismatch: "Unexpected type: "
};

export function variable(name) {
  return { type: 'var', valueType: 'Any', name: name };
}

export function literal(name) {
  return { type: 'literal', valueType: 'Any', name: name };
}

export function nullType() {
  return { type: 'Null', valueType: 'Null' };
}

export function reference(base, prop) {
  return {
    type: 'ref',
    valueType: 'Any',
    base: base,
    accessor: prop
  };
}

// Make a (shallow) copy of the base expression, setting (or removing) it's
// valueType.
//
// valueType is a string indicating the type of evaluating an expression (e.g.
// 'Snapshot') - used to know when type coercion is needed in the context
// of parent expressions.
export function cast(base, valueType) {
  var result = util.extend({}, base);
  result.valueType = valueType;
  return result;
}

export function call(ref, args?) {
  args = args || [];
  return { type: 'call', valueType: 'Any', ref: ref, args: args };
}

export function builtin(fn) {
  return { type: 'builtin', valueType: 'Any', fn: fn };
}

export function snapshotVariable(name) {
  return cast(variable(name), 'Snapshot');
}

export function snapshotChild(base, accessor) {
  if (typeof accessor === 'string') {
    accessor = string(accessor);
  }
  if (base.valueType !== 'Snapshot') {
    throw new Error(errors.typeMismatch + "expected Snapshot");
  }
  var result = cast(call(reference(base, 'child'), [accessor]), 'Snapshot');
  return result;
}

export function snapshotParent(base) {
  if (base.valueType !== 'Snapshot') {
    throw new Error(errors.typeMismatch + "expected Snapshot");
  }
  return cast(reference(cast(base, 'Any'), 'parent'), 'Snapshot');
}

export function snapshotValue(exp) {
  return call(reference(cast(exp, 'Any'), 'val'), []);
}

export function ensureValue(exp) {
  if (exp.valueType === 'Snapshot') {
    return snapshotValue(exp);
  }
  return exp;
}

// Ensure expression is a boolean (when used in a boolean context).
export function ensureBoolean(exp) {
  exp = ensureValue(exp);
  if (isCall(exp, 'val')) {
    exp = eq(exp, boolean(true));
  }
  return exp;
}

export function isCall(exp, methodName) {
  return exp.type === 'call' && exp.ref.type === 'ref' && exp.ref.accessor === methodName;
}

// Return value generating function for a given Type.
function valueGen(typeName) {
  return function(val) {
    return {
      type: typeName,      // Exp type identifying a constant value of this Type.
      valueType: typeName, // The type of the result of evaluating this expression.
      value: val           // The (constant) value itself.
    };
  };
}

function cmpValues(v1, v2) {
  return v1.typeName === v2.typeName && v1.value === v2.value;
}

function isOp(opType, exp) {
  return exp.type === 'op' && exp.op === opType;
}

// Return a generating function to make an operator exp node.
function opGen(opType: string, arity: number = 2) {
  return function(...args) {
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
function leftAssociateGen(opType, identityValue, zeroValue) {
  return function(a) {
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
export function flatten(opType, exp, flat) {
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

function op(opType, args) {
  return {
    type: 'op',     // This is (multi-argument) operator.
    valueType: 'Any',
    op: opType,     // The operator (string, e.g. '+').
    args: args      // Arguments to the operator Array<exp>
  };
}

// Warning: NOT an expression type!
export function method(params, body) {
  return {
    params: params,
    body: body
  };
}

export function typeType(typeName) {
  return { type: "type", name: typeName };
}

export function unionType(types) {
  return { type: "union", types: types };
}

export function getTypeNames(type) {
  switch (type.type) {
  case 'type':
    return [type.name];
  case 'union':
    return type.types.map(getTypeNames).reduce(util.extendArray);
  default:
    throw new Error("Unknown type: " + type.type);
  }
}

export function Symbols() {
  this.functions = {};
  this.paths = {};
  this.schema = {};
  this.log = {
    error: function(s) { console.error(s); },
    warn: function(s) { console.warn(s); }
  };
}

util.methods(Symbols, {
  register: function(type, name, object) {
    if (!this[type]) {
      throw new Error("Invalid registration type: " + type);
    }

    if (this[type][name]) {
      this.log.error("Duplicated " + type + " definition: " + name + ".");
      return;
    }
    this[type][name] = object;
  },

  registerFunction: function(name, params, body) {
    this.register('functions', name, method(params, body));
  },

  registerPath: function(parts, isType, methods) {
    methods = methods || {};

    isType = isType || typeType('Any');
    var p = {
      parts: parts,
      isType: isType,
      methods: methods
    };
    this.register('paths', '/' + parts.join('/'), p);
  },

  registerSchema: function(name, derivedFrom, properties, methods) {
    methods = methods || {};
    properties = properties || {};

    derivedFrom = derivedFrom || typeType(Object.keys(properties).length > 0 ? 'Object' : 'Any');
    var s = {
      derivedFrom: derivedFrom,
      properties: properties,
      methods: methods
    };
    this.register('schema', name, s);
  },

  isDerivedFrom: function(descendant, ancestor, visited) {
    if (!visited) {
      visited = {};
    }
    if (visited[descendant]) {
      return false;
    }
    visited[descendant] = true;

    if (descendant === ancestor) {
      return true;
    }

    var schema = this.schema[descendant];
    if (!schema) {
      return false;
    }
    return this.isDerivedFrom(schema.derivedFrom.name, ancestor, visited);
  },

  setLoggers: function(loggers) {
    this.log = loggers;
  }
});
