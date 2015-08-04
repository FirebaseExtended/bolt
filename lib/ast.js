//
// AST builders for Firebase Rules Language.
//
namespace.module('firebase.rules.ast', function(exports, require) {
  "use strict";

  var types = require('namespace.types');
  require('namespace.funcs').patch();

  exports.extend({
    'variable': variable,
    'nullType': nullType,
    'reference': reference,
    'call': call,
    'snapshotVariable': snapshotVariable,
    'snapshotChild': snapshotChild,
    'snapshotValue': snapshotValue,
    'ensureValue': ensureValue,
    'ensureBoolean': ensureBoolean,

    'number': valueGen('number'),
    'boolean': valueGen('boolean'),
    'string': valueGen('string'),
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
    'eq': opGen('=='),
    'ne': opGen('!='),
    'and': opGen('&&'),
    'or': opGen('||'),
    'ternary': opGen('?:', 3),
    'instanceOf': opGen('instanceof'),

    'andArray': leftAssociateGen('&&'),
    'orArray': leftAssociateGen('||'),

    'op': op,

    'Symbols': Symbols
  });

  function variable(name) {
    return { type: 'var', name: name };
  }

  function nullType() {
    return { type: 'null' };
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
    result.valueType = 'snapshot';
    return result;
  }

  function snapshotChild(base, accessor) {
    if (typeof accessor == 'string') {
      accessor = string(accessor);
    }
    var result = call(reference(base, 'child'), [accessor]);
    result.valueType = 'snapshot';
    return result;
  }

  function ensureValue(exp) {
    if (exp.valueType == 'snapshot') {
      return snapshotValue(exp);
    }
    return exp;
  }

  // Ensure expression is a boolean (when used in a boolean context).
  function ensureBoolean(exp) {
    exp = ensureValue(exp);
    if (isCall(exp, 'val')) {
      exp = exports.eq(exp, boolean(true));
    }
    return exp;
  }

  function isCall(exp, method) {
    return exp.type == 'call' && exp.ref.type == 'ref' && exp.ref.accessor == method;
  }

  function snapshotValue(exp) {
    return call(reference(exp, 'val'), []);
  }

  var number = valueGen('number');
  var boolean = valueGen('boolean');
  var string = valueGen('string');

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
        throw new Error("Operator has " + arguments.length + " arguments (expecting " + arity + ").");
      }
      return op(opType, types.copyArray(arguments));
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
    return { type: 'array', value: args };
  }

  function Symbols() {
    this.functions = {};
    this.paths = {};
    this.schema = {};
  }

  Symbols.methods({
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

    registerPath: function(parts, methods) {
      var p = {
        parts: parts,
        methods: methods
      };
      this.register('paths', '/' + parts.join('/'), p);
    },

    registerSchema: function(name, derivedFrom, properties, methods) {
      var s = {
        derivedFrom: derivedFrom || 'object',
        properties: properties,
        methods: methods
      };
      this.register('schema', name, s);
    },
  });

});
