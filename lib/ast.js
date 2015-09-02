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
"use strict";

var util = require('./util');

var string = valueGen('String');
var eq = opGen('==');
var boolean = valueGen('Boolean');

module.exports = {
  'variable': variable,
  'nullType': nullType,
  'reference': reference,
  'call': call,
  'snapshotVariable': snapshotVariable,
  'snapshotChild': snapshotChild,
  'snapshotValue': snapshotValue,
  'ensureValue': ensureValue,
  'ensureBoolean': ensureBoolean,

  'number': valueGen('Number'),
  'boolean': boolean,
  'string': string,
  'array': array,

  'neg': opGen('neg', 1),
  'not': opGen('!', 1),
  'mult': opGen('*'),
  'div': opGen('/'),
  'mod': opGen('%'),
  'add': opGen('+'),
  'sub': opGen('-'),
  'lt': opGen('<'),
  'lte': opGen('<='),
  'gt': opGen('>'),
  'gte': opGen('>='),
  'eq': eq,
  'ne': opGen('!='),
  'and': opGen('&&'),
  'or': opGen('||'),
  'ternary': opGen('?:', 3),
  'instanceOf': opGen('instanceof'),

  'andArray': leftAssociateGen('&&'),
  'orArray': leftAssociateGen('||'),

  'op': op,

  'Symbols': Symbols
};

function variable(name) {
  return { type: 'var', name: name };
}

function nullType() {
  return { type: 'Null' };
}

function reference(base, prop) {
  return {
    type: 'ref',
    base: base,
    accessor: prop
  };
}

function call(ref, args) {
  return { type: 'call', ref: ref, args: args };
}

function snapshotVariable(name) {
  var result = variable(name);
  result.valueType = 'Snapshot';
  return result;
}

function snapshotChild(base, accessor) {
  if (typeof accessor == 'string') {
    accessor = string(accessor);
  }
  var result = call(reference(base, 'child'), [accessor]);
  result.valueType = 'Snapshot';
  return result;
}

function ensureValue(exp) {
  if (exp.valueType == 'Snapshot') {
    return snapshotValue(exp);
  }
  return exp;
}

// Ensure expression is a boolean (when used in a boolean context).
function ensureBoolean(exp) {
  exp = ensureValue(exp);
  if (isCall(exp, 'val')) {
    exp = eq(exp, boolean(true));
  }
  return exp;
}

function isCall(exp, method) {
  return exp.type == 'call' && exp.ref.type == 'ref' && exp.ref.accessor == method;
}

function snapshotValue(exp) {
  return call(reference(exp, 'val'), []);
}

function valueGen(type) {
  return function(value) {
    return { type: type, value: value };
  };
}

function opGen(opType, arity) {
  if (arity === undefined) {
    arity = 2;
  }
  return function(/* variable */) {
    if (arguments.length != arity) {
      throw new Error("Operator has " + arguments.length +
                      " arguments (expecting " + arity + ").");
    }
    return op(opType, util.copyArray(arguments));
  };
}

// A reducing function for binary operators - use with [].reduce
function leftAssociateGen(opType) {
  function reducer(result, current) {
    if (result === undefined) {
      return current;
    }
    return op(opType, [result, current]);
  }

  return function(a) {
    return a.reduce(reducer);
  };
}

function op(opType, args) {
  return { type: 'op', op: opType, args: args };
}

function array(args) {
  return { type: 'Array', value: args };
}

function Symbols() {
  this.functions = {};
  this.paths = {};
  this.schema = {};
}

util.methods(Symbols, {
  register: function(type, name, object) {
    if (!this[type]) {
      throw new Error("Invalid registration type: " + type);
    }
    if (this[type][name]) {
      error("Duplicated " + type + " definition: " + name + ".");
      return;
    }
    this[type][name] = object;
  },

  registerFunction: function(name, params, body) {
    var fn = {
      params: params,
      body: body
    };
    this.register('functions', name, fn);
  },

  registerPath: function(parts, isType, methods) {
    isType = isType || 'Any';
    var p = {
      parts: parts,
      isType: isType,
      methods: methods
    };
    this.register('paths', '/' + parts.join('/'), p);
  },

  registerSchema: function(name, derivedFrom, properties, methods) {
    derivedFrom = derivedFrom || (Object.keys(properties).length > 0 ? 'Object' : 'Any');
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

    if (descendant == ancestor) {
      return true;
    }

    var schema = this.schema[descendant];
    if (!schema) {
      return false;
    }
    return this.isDerivedFrom(schema.derivedFrom, ancestor, visited);
  }
});
