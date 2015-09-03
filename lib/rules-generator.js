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
var ast = require('./ast');

module.exports = {
  'Generator': Generator,
  'decodeExpression': decodeExpression
};

var errors = {
  badIndex: "Index function must return (an array of) string(s).",
  noPaths: "Must have at least one path expression.",
  nonObject: "Type contains properties and must extend 'Object'.",
  missingSchema: "Missing definition for type.",
  recursive: "Recursive function call.",
  mismatchParams: "Incorrect number of function arguments.",
  generateFailed: "Could not generate JSON: ",
  noSuchType: "No type definition for: ",
  badSchemaMethod: "Unsupported method name in type statement: ",
  badPathMethod: "Unsupported method name in path statement: ",
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
  this.log = symbols.log;
  this.rules = {};
  this.errorCount = 0;
  this.runSilently = false;

  this.globals = {
    "this": ast.snapshotVariable('newData'),
    "root": ast.snapshotVariable('root'),
    "data": ast.snapshotVariable('data'),
  };

  this.registerBuiltinSchema();
}

util.methods(Generator, {
  generateRules: function() {
    this.errorCount = 0;
    var paths = this.symbols.paths;
    var schema = this.symbols.schema;
    var name;

    for (name in paths) {
      this.validateMethods(errors.badPathMethod, paths[name].methods,
                           ['validate', 'read', 'write', 'index']);
      this.validateType(paths[name].isType);
    }

    for (name in schema) {
      this.validateMethods(errors.badSchemaMethod, schema[name].methods, ['validate']);
    }

    for (var schemaName in this.symbols.schema) {
      this.registerSchemaValidator(schemaName);
    }


    if (Object.keys(paths).length === 0) {
      this.fatal(errors.noPaths);
    }

    for (var pathName in paths) {
      this.updateRules(paths[pathName]);
    }

    if (this.errorCount != 0) {
      throw new Error(errors.generateFailed + this.errorCount + " errors.");
    }

    return {
      rules: this.rules
    };
  },

  validateMethods: function(m, methods, allowed) {
    util.forNotIn(Object.keys(methods), allowed, function(method) {
      this.log.warn(m + util.quoteString(method) +
                    " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
    }.bind(this));
  },

  validateType: function(typeName) {
    if (!(typeName in this.symbols.schema)) {
      this.fatal(errors.noSuchType + util.quoteString(typeName));
    }
  },

  registerBuiltinSchema: function() {
    var self = this;
    var thisVar = ast.variable('this');

    function registerAsCall(name, fnCall) {
      self.symbols.registerSchema(name, 'Any', undefined, {
        validate: ast.method(['this'], ast.call(ast.reference(thisVar, fnCall)))
      });
    }

    this.symbols.registerSchema('Any', 'Any', undefined, {
      validate: ast.method(['this'], ast.boolean(true))
    });

    this.symbols.registerSchema('Null', 'Any', undefined, {
      validate: ast.method(['this'], ast.eq(thisVar, ast.nullType()))
    });

    registerAsCall('Object', 'hasChildren');
    registerAsCall('String', 'isString');
    registerAsCall('Number', 'isNumber');
    registerAsCall('Boolean', 'isBoolean');
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

    if (hasProps && !this.symbols.isDerivedFrom(schemaName, 'Object')) {
      this.fatal(errors.nonObject + " (" + schemaName + " is " + schema.derivedFrom + ")");
      return;
    }

    // @validator@<T>(this)
    if (schema.derivedFrom != 'Any' && !hasProps) {
      terms.push(ast.call(ast.variable('@validator@' + schema.derivedFrom),
                          [ thisVar ]));
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

    if (terms.length == 0) {
      terms.push(ast.boolean(true));
    }

    var exp = ast.andArray(terms);
    this.registerValidator(schemaName, exp);
  },

  // TODO: Should validators be functions stored in a schema?
  registerValidator: function(type, exp) {
    this.symbols.registerFunction('@validator@' + type, ['this'], exp);
  },

  // Update rules based on the given path expression.
  updateRules: function(path) {
    var i;
    var pathMethods = ['read', 'write'];
    var location = this.ensurePath(path.parts);

    // Write validation (if non-trivial)
    location['.validate'] = this.getExpressionText(
      this.partialEval(this.symbols.functions['@validator@' + path.isType].body));
    if (location['.validate'] == 'true') {
      delete location['.validate'];
    }

    // Write read and write methods
    for (i = 0; i < pathMethods.length; i++) {
      var method = pathMethods[i];
      if (path.methods[method]) {
        location['.' + method] = this.getExpressionText(path.methods[method].body);
      }
    }

    // Write indices
    if (path.methods.index) {
      var exp = path.methods.index.body;
      if (exp.type == 'String') {
        exp = ast.array([exp]);
      }
      if (exp.type != 'Array') {
        this.fatal(errors.badIndex);
        return;
      }
      var indices = [];
      for (i = 0; i < exp.value.length; i++) {
        if (exp.value[i].type != 'String') {
          this.fatal(errors.badIndex + " (not " + exp.value[i].type + ")");
        } else {
          indices.push(exp.value[i].value);
        }
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
      if (exp2.valueType == 'Snapshot') {
        isModified = true;
      }
      return ast.ensureValue(exp2);
    }

    function booleanExpression(exp2) {
      if (exp2.valueType == 'Snapshot') {
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
      // Ensure arguments are boolean (or values) where needed.
      if (exp.op == '||' || exp.op == '&&' || exp.op == '!') {
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
      if (base.valueType == 'Snapshot' && snapshotMethods.indexOf(accessor) == -1) {
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
          this.fatal(errors.mismatchParams + " ( " +
                     ref.name + " expects " + fn.params.length +
                     "but actually passed " + exp.args.length + ")");
          break;
        }
        for (i = 0; i < fn.params.length; i++) {
          innerParams[fn.params[i]] = subExpression(exp.args[i]);
        }
        functionCalls[ref.name] = true;
        exp = this.partialEval(fn.body, innerParams, functionCalls);
        functionCalls[ref.name] = false;
      } else {
        // Not a global function - expand args.
        // TODO: Check snapshot and string-specific methods arguments here.
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
        this.fatal("Undefined global function: " + ref.name);
      }
      return fn;
    }
    // TODO: Validate "method" calls against a prototype.
    return undefined;
  },

  setLoggers: function(loggers) {
    this.symbols.setLoggers(loggers);
    this.log = this.symbols.log;
  },

  fatal: function(s) {
    this.log.error(s);
    this.errorCount += 1;
  }

});

// From an AST, decode as an expression (string).
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

  case 'Null':
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

  case 'Array':
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
