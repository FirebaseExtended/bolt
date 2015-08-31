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
"use strict";

var util = require('./util');
var methods = util.methods;
var ast = require('./ast');

module.exports = {
  'Generator': Generator,
  'decodeExpression': decodeExpression
};

var errors = {
  badIndex: "Index function must return (an array of) string(s).",
  noPaths: "Must have at least one path expression.",
  nonObject: "Type contains properties and must extend 'object'.",
  missingSchema: "Missing definition for type.",
  recursive: "Recursive function call.",
  mismatchParams: "Incorrect number of function arguments.",
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
var JS_OPS = {
  "neg": { rep: "-", p: 15},
  "!": { p: 15},
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
  'instanceof': { p: 11 },
  '==': { p: 10 },
  "!=": { p: 10 },
  '&&': { p: 6 },
  '||': { p: 5 },
  '?:': { p: 4 },
  ',': { p: 0},
};

// Value returning methods directly on a snapshot.
var snapshotMethods = ['isString', 'isNumber', 'isBoolean',
                       'val', 'child', 'parent', 'getPriority',
                       'hasChildren', 'hasChild', 'exists', 'matches'];

// Symbols contains:
//   functions: {}
//   schema: {}
//   paths: {}
function Generator(symbols) {
  this.symbols = symbols;
  this.rules = {};
  this.globals = {
    // Hack - this in path validation functions is newData.
    "this": ast.snapshotVariable('newData'),
    "newData": ast.snapshotVariable('newData'),
    "root": ast.snapshotVariable('root'),
    "data": ast.snapshotVariable('data'),
  };

  this.registerBuiltinValidators();
  for (var schemaName in this.symbols.schema) {
    this.registerSchemaValidator(schemaName);
  }
}

methods(Generator, {
  generateRules: function() {
    var paths = this.symbols.paths;

    if (Object.keys(paths).length === 0) {
      throw new Error(errors.noPaths);
    }

    for (var pathName in paths) {
      this.updateRules(paths[pathName]);
    }

    return {
      rules: this.rules
    };
  },

  registerBuiltinValidators: function() {
    var thisVar = ast.variable('this');

    // TODO: These functions are value-creating...should remove "snapshot" of parameter.

    // this.hasChildren()
    this.registerValidator('object', ast.call(ast.reference(thisVar, 'hasChildren'), []));
    // this.isString()
    this.registerValidator('string', ast.call(ast.reference(thisVar, 'isString'), []));
    // this.isNumber()
    this.registerValidator('number', ast.call(ast.reference(thisVar, 'isNumber'), []));
    // this.isBoolean()
    this.registerValidator('boolean', ast.call(ast.reference(thisVar, 'isBoolean'), []));
    // this == null
    this.registerValidator('null', ast.eq(thisVar, ast.nullType()));
  },

  // Return a validator expression that returns true iff
  // *this* conforms to the defined schema:
  // 1. Conforms to derivedFrom schema. &&
  // 2. Each property in properties conforms to it's type.
  // 3. Conforms to the validate method.
  registerSchemaValidator: function(schemaName) {
    var schema = this.symbols.schema[schemaName];
    var terms = [];
    var thisVar = ast.variable('this');

    var hasProps = Object.keys(schema.properties).length > 0;

    // @validator@<T>(this)
    if (schema.derivedFrom != 'object' || !hasProps) {
      terms.push(ast.call(ast.variable('@validator@' + schema.derivedFrom),
                          [ thisVar ]));
    }

    if (hasProps && !this.symbols.isDerivedFrom(schemaName, 'object')) {
      throw new Error(errors.nonObject + " (" + schemaName + ")");
    }

    for (var propName in schema.properties) {
      var property = schema.properties[propName];
      var propTerms = [];
      for (var i = 0; i < property.types.length; i++) {
        var type = property.types[i];
        // @validator@<type>(this[propName])
        propTerms.push(ast.call(ast.variable('@validator@' + type),
                                [ ast.reference(thisVar, propName) ]));
      }
      if (propTerms.length > 0) {
        terms.push(ast.orArray(propTerms));
      }
    }

    if (schema.methods.validate) {
      terms.push(schema.methods.validate.body);
    }

    var result = ast.andArray(terms);
    this.registerValidator(schemaName, result);
  },

  // TODO: Should validators be functions stored in a schema?
  registerValidator: function(type, exp) {
    this.symbols.registerFunction('@validator@' + type, ['this'], exp);
  },

  // Update rules based on the given path expression.
  updateRules: function(path) {
    var i;
    var pathMethods = ['read', 'write', 'validate'];
    var location = this.ensurePath(path.parts);

    for (i = 0; i < pathMethods.length; i++) {
      var method = pathMethods[i];
      if (path.methods[method]) {
        location['.' + method] = this.getExpressionText(path.methods[method].body);
      }
    }

    if (path.methods.index) {
      var exp = path.methods.index.body;
      if (exp.type == 'string') {
        exp = ast.array([exp]);
      }
      if (exp.type != 'array') {
        throw new Error(errors.badIndex);
      }
      var indices = [];
      for (i = 0; i < exp.value.length; i++) {
        if (exp.value[i].type != 'string') {
          throw new Error(errors.badIndex + " (not " + exp.value[i].type + ")");
        }
        indices.push(exp.value[i].value);
      }
      location['.indexOn'] = indices;
    }
  },

  getExpressionText: function(exp) {
    exp = this.partialEval(exp);
    // Top level expressions should never be to a snapshot reference - should
    // always evaluate to a boolean.
    exp = ast.ensureBoolean(exp);
    return decodeExpression(exp);
  },

  ensurePath: function(parts) {
    var obj = this.rules;
    for (var i = 0; i < parts.length; i++) {
      var name = parts[i];
      if (!(name in obj)) {
        obj[name] = {};
      }
      obj = obj[name];
    }
    return obj;
  },

  // Partial evaluation of expressions - copy of expression tree (immuatable).
  //
  // - Inline function calls.
  // - Replace local and global variables.
  // - Expand snapshot references using child('ref').
  // - Coerce snapshot references to values as needed.
  partialEval: function(exp, params, functionCalls) {
    var innerParams = {};
    var args = [];
    var i;

    if (!params) {
      params = {};
    }
    if (!functionCalls) {
      functionCalls = {};
    }
    var self = this;
    var isModified = false;

    function subExpression(exp2) {
      var subExp = self.partialEval(exp2, params, functionCalls);
      if (subExp !== exp2) {
        isModified = true;
      }
      return subExp;
    }

    function valueExpression(exp2) {
      if (exp2.valueType == 'snapshot') {
        isModified = true;
      }
      return ast.ensureValue(exp2);
    }

    function booleanExpression(exp2) {
      if (exp2.valueType == 'snapshot') {
        isModified = true;
      }
      return ast.ensureBoolean(exp2);
    }

    function replaceExp() {
      if (isModified) {
        exp = util.extend({}, exp);
      }
      return isModified;
    }

    function lookupVar(exp2) {
      return params[exp2.name] || self.globals[exp2.name] || exp2;
    }

    switch (exp.type) {
    case 'op':
      if (exp.op == 'instanceof') {
        var dataType = exp.args[1];
        if (dataType.type != 'var' || !this.symbols.schema[dataType.name]) {
          throw new Error(errors.missingType + " (" + dataType.name + ")");
        }
        innerParams['this'] = subExpression(exp.args[0]);
        // TODO: Do as call - to get arg checking on expansion...
        exp = this.partialEval(this.symbols.functions['@validator@' + dataType.name].body,
                               innerParams,
                               functionCalls);
        break;
      }

      // Ensure arguments are boolean (or values) where needed.
      if (exp.op == '||' || exp.op == '&&') {
        for (i = 0; i < exp.args.length; i++) {
          args[i] = booleanExpression(subExpression(exp.args[i]));
        }
      } else if (exp.op == '?:') {
        args[0] = booleanExpression(subExpression(exp.args[0]));
        args[1] = subExpression(exp.args[1]);
        args[2] = subExpression(exp.args[2]);
      } else {
        for (i = 0; i < exp.args.length; i++) {
          args[i] = valueExpression(subExpression(exp.args[i]));
        }
      }
      if (replaceExp()) {
        exp.args = args;
      }
      break;

    case 'var':
      exp = lookupVar(exp);
      break;

    case 'ref':
      var base;
      var accessor;
      base = subExpression(exp.base);
      if (typeof exp.accessor == 'string') {
        accessor = exp.accessor;
      } else {
        accessor = subExpression(exp.accessor);
      }
      accessor = valueExpression(accessor);
      // snapshot references use child() wrapper - EXCEPT for built-in methods
      // TODO: Resolve ambiguity between built-ins and user-defined property names
      // (use functions instead)?
      if (base.valueType == 'snapshot' && snapshotMethods.indexOf(accessor) == -1) {
        exp = ast.snapshotChild(base, accessor);
      } else {
        if (replaceExp()) {
          exp.base = base;
          exp.accessor = accessor;
        }
      }
      break;

    case 'call':
      var ref = subExpression(exp.ref);
      var fn = this.lookupFunction(ref);
      if (fn) {
        if (functionCalls[ref.name]) {
          throw new Error(errors.recursive + " (" + ref.name + ")");
        }
        if (fn.params.length != exp.args.length) {
          throw new Error(errors.mismatchParams + " ( " +
                          ref.name + " expects " + fn.params.length +
                          "but actually passed " + exp.args.length + ")");
        }
        for (i = 0; i < fn.params.length; i++) {
          innerParams[fn.params[i]] = subExpression(exp.args[i]);
        }
        functionCalls[ref.name] = true;
        exp = this.partialEval(fn.body, innerParams, functionCalls);
        functionCalls[ref.name] = false;
      } else {
        for (i = 0; i < exp.args.length; i++) {
          args[i] = subExpression(exp.args[i]);
        }
        if (replaceExp()) {
          exp.ref = ref;
          exp.args = args;
        }
      }
      break;
    }

    return exp;
  },

  // Lookup globally defined function.
  lookupFunction: function(ref) {
    if (ref.type == 'var') {
      var fn = this.symbols.functions[ref.name];
      if (!fn) {
        throw new Error('Missing function: ' + ref.name);
      }
      return fn;
    }
  },

});

// From an AST, decode as an expression (string).
function decodeExpression(exp, outerPrecedence) {
  if (outerPrecedence === undefined) {
    outerPrecedence = 0;
  }
  var innerPrecedence = precedenceOf(exp);
  var result;
  switch (exp.type) {
  case 'boolean':
  case 'number':
    result = JSON.stringify(exp.value);
    break;

  case 'string':
    result = quoteString(exp.value);
    break;

  case 'null':
    result = 'null';
    break;

  case 'var':
    result = exp.name;
    break;

  case 'ref':
    if (typeof exp.accessor == 'string') {
      result = decodeExpression(exp.base) + '.' + exp.accessor;
    } else {
      result = decodeExpression(exp.base, innerPrecedence) +
        '[' + decodeExpression(exp.accessor) + ']';
    }
    break;

  case 'call':
    result = decodeExpression(exp.ref) + '(' + decodeArray(exp.args) + ')';
    break;

  case 'op':
    var rep = JS_OPS[exp.op].rep || exp.op;
    if (exp.args.length == 1) {
      result = rep + decodeExpression(exp.args[0], innerPrecedence);
    } else if (exp.args.length == 2) {
      result =
        decodeExpression(exp.args[0], innerPrecedence) +
        ' ' + rep + ' ' +
        // All ops are left associative - so nudge the innerPrecendence
        // down on the right hand side to force () for right-associating
        // operations.
        decodeExpression(exp.args[1], innerPrecedence + 1);
    } else if (exp.args.length == 3) {
      result =
        decodeExpression(exp.args[0], innerPrecedence) + ' ? ' +
        decodeExpression(exp.args[1], innerPrecedence) + ' : ' +
        decodeExpression(exp.args[2], innerPrecedence);
    }
    break;

  case 'array':
    result = '[' + decodeArray(exp.value) + ']';
    break;

  default:
    result = "***UNKNOWN TYPE*** (" + exp.type + ")";
    break;
  }

  if (innerPrecedence < outerPrecedence) {
    result = '(' + result + ')';
  }

  return result;
}

function decodeArray(args) {
  return args
    .map(function(x) {
      return decodeExpression(x);
    })
    .join(', ');
}

function precedenceOf(exp) {
  switch (exp.type) {
  case 'op':
    return JS_OPS[exp.op].p;
  case 'call':
    return 17;
  case 'ref':
    return 18;
  default:
    return 19;
  }
}

// Like JSON.stringify - but for single-quoted strings instead of double-quoted ones.
// This just makes the compiled rules much easier to read.

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
  s = s.replace(quotableCharacters, function(c) {
    if (specialQuotes[c]) {
      return specialQuotes[c];
    }
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
  return "'" + s + "'";
}
