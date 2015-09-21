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
};

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Operator_Precedence
var JS_OPS = {
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
export function Generator(symbols) {
  this.symbols = symbols;
  this.log = symbols.log;
  this.validators = {};
  this.rules = {};
  this.errorCount = 0;
  this.runSilently = false;
  this.allowUndefinedFunctions = false;

  // TODO: globals should be part of this.symbols.
  this.globals = {
    "root": ast.cast(ast.literal('root'), 'Snapshot'),
  };
  this.globalStacks = {};

  this.registerBuiltinSchema();
}

util.methods(Generator, {
  generateRules: function() {
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
      this.validateType(paths[name].isType);
    }

    for (name in schema) {
      if (!util.arrayIncludes(builtinSchemaNames, name)) {
        this.validateMethods(errors.badSchemaMethod, schema[name].methods, ['validate']);
      }
    }

    for (var schemaName in this.symbols.schema) {
      if (!this.symbols.schema.hasOwnProperty(schemaName)) {
        continue;
      }

      this.ensureValidator(schemaName);
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
  },

  validateMethods: function(m, methods, allowed) {
    for (var method in methods) {
      if (!util.arrayIncludes(allowed, method)) {
        this.log.warn(m + util.quoteString(method) +
                      " (allowed: " + allowed.map(util.quoteString).join(', ') + ")");
      }
    }
  },

  validateType: function(type) {
    ast.getTypeNames(type).forEach(function(typeName) {
      if (!(typeName in this.symbols.schema)) {
        this.fatal(errors.noSuchType + util.quoteString(typeName));
      }
    }.bind(this));
  },

  registerBuiltinSchema: function() {
    var self = this;
    var thisVar = ast.variable('this');

    function registerAsCall(name, methodName) {
      self.symbols.registerSchema(name, ast.typeType('Any'), undefined, {
        validate: ast.method(['this'], ast.call(ast.reference(ast.cast(thisVar, 'Any'),
                                                              methodName)))
      });
    }

    this.symbols.registerSchema('Any', ast.typeType('Any'), undefined, {
      validate: ast.method(['this'], ast.boolean(true))
    });

    /*
    this.symbols.registerSchema('Object', ast.typeType('Any'), undefined, {
      validate: ast.method(['this'], ast.boolean(true))
    });
    */
    registerAsCall('Object', 'hasChildren');

    this.symbols.registerSchema('Null', ast.typeType('Any'), undefined, {
      validate: ast.method(['this'], ast.eq(thisVar, ast.nullType()))
    });

    self.symbols.registerSchema('String', ast.typeType('Any'), undefined, {
      validate: ast.method(['this'],
                           ast.call(ast.reference(ast.cast(thisVar, 'Any'), 'isString'))),
      includes: ast.method(['this', 's'],
                           ast.call(ast.reference(ast.value(thisVar), 'contains'),
                                    [ ast.value(ast.variable('s')) ])),
      startsWith: ast.method(['this', 's'],
                             ast.call(ast.reference(ast.value(thisVar), 'beginsWith'),
                                      [ ast.value(ast.variable('s')) ])),
      endsWith: ast.method(['this', 's'],
                           ast.call(ast.reference(ast.value(thisVar), 'endsWith'),
                                    [ ast.value(ast.variable('s')) ])),
      replace: ast.method(['this', 's', 'r'],
                          ast.call(ast.reference(ast.value(thisVar), 'replace'),
                                   [ ast.value(ast.variable('s')), ast.value(ast.variable('r')) ])),
      test: ast.method(['this', 's'],
                       ast.call(ast.reference(ast.value(thisVar), 'matches'),
                                [ ast.call(ast.variable('@RegExp'), [ast.variable('s')]) ])),
    });

    registerAsCall('Number', 'isNumber');
    registerAsCall('Boolean', 'isBoolean');

    this.symbols.registerFunction('@RegExp', ['s'],
                                  ast.builtin(this.makeRegExp.bind(this)));
  },

  // Ensure we have a definition for a validator for the given schema.
  ensureValidator: function(schemaName) {
    // TODO: Guard against recursion
    if (!this.validators[schemaName]) {
      this.validators[schemaName] = this.createValidator(schemaName);
      // console.log(schemaName + ": " + util.prettyJSON(this.validators[schemaName]));
    }
    return this.validators[schemaName];
  },

  // A validator is a structured object, where each leaf node
  // is:
  //     ".validate": [<expression>, ...]
  // All expressions will be ANDed together to form the file expresion.
  // Intermediate nodes can be "prop" or "$prop" values.
  createValidator: function(schemaName) {
    var schema = this.symbols.schema[schemaName];
    var validator: any = {};

    if (!schema) {
      throw new Error(errors.application + "Undefined schema: " + schemaName);
    }

    var hasProps = Object.keys(schema.properties).length > 0;

    if (hasProps && !this.symbols.isDerivedFrom(schemaName, 'Object')) {
      this.fatal(errors.nonObject + " (" + schemaName + " is " + schema.derivedFrom.name + ")");
      return {};
    }

    if (schema.derivedFrom.name !== 'Any') {
      extendValidator(validator, this.ensureValidator(schema.derivedFrom.name));
    }

    var requiredProperties = [];
    Object.keys(schema.properties).forEach(function(propName) {
      if (!validator[propName]) {
        validator[propName] = {};
      }
      var propType = schema.properties[propName];
      var propSchema = ast.getTypeNames(propType);
      if (!util.arrayIncludes(propSchema, 'Null')) {
        requiredProperties.push(propName);
      }
      extendValidator(validator[propName], this.unionValidators(propSchema));
    }.bind(this));

    if (requiredProperties.length > 0) {
      // this.hasChildren(requiredProperties)
      extendValidator(validator,
                      {'.validate': [hasChildrenExp(requiredProperties)]});
    }

    if (hasProps) {
      validator.$other = {};
      extendValidator(validator.$other, {'.validate': ast.boolean(false)});
    }

    if (schema.methods.validate) {
      extendValidator(validator, {'.validate': [schema.methods.validate.body]});
    }

    return validator;
  },

  // Update rules based on the given path expression.
  updateRules: function(path) {
    var i;
    var location = util.ensureObjectPath(this.rules, path.parts);
    var exp;

    // Path validation function && Type Validation
    if (path.methods.validate) {
      extendValidator(location, {'.validate': [path.methods.validate.body]});
    }

    ast.getTypeNames(path.isType).forEach(function(typeName) {
      extendValidator(location, this.validators[typeName]);
    }.bind(this));

    // Write .read and .write expressions
    ['read', 'write'].forEach(function(method) {
      if (path.methods[method]) {
        var validator = {};
        // TODO: What if two paths overwrite the same location?
        validator['.' + method] = [path.methods[method].body];
        extendValidator(location, validator);
      }
    });

    // Write indices
    if (path.methods.index) {
      switch (path.methods.index.body.type) {
      case 'String':
        exp = ast.array([path.methods.index.body]);
        break;
      case 'Array':
        exp = path.methods.index.body;
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
  },

  // Return union validator (||) over each schema
  unionValidators: function(schema) {
    var union = {};
    schema.forEach(function(typeName) {
      // First and the validator terms for a single type
      var singleType = extendValidator({}, this.ensureValidator(typeName));
      mapValidator(singleType, ast.andArray);
      extendValidator(union, singleType);
    }.bind(this));
    mapValidator(union, ast.orArray);
    return union;
  },

  convertExpressions: function(validator, thisIs) {
    var methodThisIs = { '.validate': 'newData',
                         '.read': 'data',
                         '.write': 'newData' };

    mapValidator(validator, function(value, prop) {
      if (prop in methodThisIs) {
        value = collapseHasChildren(value);
        value = this.getExpressionText(ast.andArray(value), methodThisIs[prop]);
        if (prop === '.validate' && value === 'true' ||
            (prop === '.read' || prop === '.write') && value === 'false') {
          value = undefined;
        }
      }
      return value;
    }.bind(this));
  },

  getExpressionText: function(exp, thisIs) {
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
    this.symbols.registerFunction('prior', ['exp'],
                                  ast.builtin(this.prior.bind(this)));

    exp = this.partialEval(exp);

    delete this.symbols.functions['@getThis'];
    delete this.symbols.functions.prior;

    // Top level expressions should never be to a snapshot reference - should
    // always evaluate to a boolean.
    exp = ast.ensureBoolean(exp);
    return decodeExpression(exp);
  },

  // Partial evaluation of expressions - copy of expression tree (immutable).
  //
  // - Inline function calls.
  // - Replace local and global variables.
  // - Expand snapshot references using child('ref').
  // - Coerce snapshot references to values as needed.
  partialEval: function(exp, params?, functionCalls?) {
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
      if (exp2.valueType === 'Snapshot') {
        isModified = true;
      }
      return ast.ensureValue(exp2);
    }

    function booleanExpression(exp2) {
      if (exp2.valueType === 'Snapshot') {
        isModified = true;
      }
      return ast.ensureBoolean(exp2);
    }

    // When we don't modify the returned expression, we return the original - otherwise
    // we make a copy so that expressions can be consider immutable.
    // TODO: Investigate code simplification if we always (deep) copy.
    function replaceExp() {
      if (isModified) {
        exp = util.extend({}, exp);
      }
      return isModified;
    }

    function lookupVar(exp2) {
      // TODO: Unbound variable access should be an error.
      return params[exp2.name] || self.globals[exp2.name] || exp2;
    }

    switch (exp.type) {
    case 'op':
      // Ensure arguments are boolean (or values) where needed.
      if (exp.op === 'value') {
        args[0] = valueExpression(subExpression(exp.args[0]));
      } else if (exp.op === '||' || exp.op === '&&' || exp.op === '!') {
        for (i = 0; i < exp.args.length; i++) {
          args[i] = booleanExpression(subExpression(exp.args[i]));
        }
      } else if (exp.op === '?:') {
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
      return exp;

    case 'var':
      return lookupVar(exp);

    case 'ref':
      var base;
      var accessor;
      base = subExpression(exp.base);
      if (typeof exp.accessor === 'string') {
        accessor = exp.accessor;
      } else {
        accessor = valueExpression(subExpression(exp.accessor));
      }
      // snapshot references use child() wrapper - EXCEPT for reserved methods
      // TODO: Only do this if we are dereferencing a function call OR if
      // there is no shadowed property in the object.
      if (base.valueType === 'Snapshot') {
        if (accessor === 'parent') {
          return ast.snapshotParent(base);
        } else if (!util.arrayIncludes(snapshotMethods, accessor)) {
          return ast.snapshotChild(base, accessor);
        }
      }
      if (util.arrayIncludes(valueMethods, accessor)) {
        base = valueExpression(base);
      }
      if (replaceExp()) {
        exp.base = base;
        exp.accessor = accessor;
      }
      return exp;

    case 'call':
      var ref = subExpression(exp.ref);
      var callee = this.lookupFunction(ref);
      if (callee) {
        var fn = callee.fn;

        var callArgs = exp.args;
        if (callee.self) {
          callArgs = util.copyArray(callArgs);
          callArgs.unshift(ast.ensureValue(callee.self));
        }

        if (fn.params.length !== callArgs.length) {
          this.fatal(errors.mismatchParams + " ( " +
                     ref.name + " expects " + fn.params.length +
                     " but actually passed " + callArgs.length + ")");
          return exp;
        }

        if (fn.body.type === 'builtin') {
          return fn.body.fn(callArgs, params);
        }

        for (i = 0; i < fn.params.length; i++) {
          innerParams[fn.params[i]] = subExpression(callArgs[i]);
        }

        if (functionCalls[ref.name]) {
          throw new Error(errors.recursive + " (" + ref.name + ")");
        }
        functionCalls[ref.name] = true;
        exp = this.partialEval(fn.body, innerParams, functionCalls);
        functionCalls[ref.name] = false;
      } else {
        // Not a global function - expand args.
        if (!this.allowUndefinedFunctions) {
          var funcName = ref.type === 'ref' ? ref.accessor : ref.name;
          if (!(funcName in this.symbols.schema.String.methods ||
                util.arrayIncludes(snapshotMethods, funcName))) {
            this.fatal(errors.undefinedFunction + decodeExpression(ref));
          }
        }
        for (i = 0; i < exp.args.length; i++) {
          args[i] = subExpression(exp.args[i]);
        }
        if (replaceExp()) {
          exp.ref = ref;
          exp.args = args;
          // TODO: Get rid of this hack (for data.parent().val())
          if (exp.ref.valueType === 'Snapshot') {
            exp.valueType = 'Snapshot';
          }
        }
      }

      return exp;

    // Expression types (like literals) than need no expansion.
    default:
      return exp;
    }
  },

  // Builtin function - convert all 'this' to 'data' (from 'newData').
  // Args are function arguments, and params are the local (function) scope variables.
  prior: function(args, params) {
    var lastThisIs = this.thisIs;
    this.thisIs = 'data';
    var exp = this.partialEval(args[0], params);
    this.thisIs = lastThisIs;
    return exp;
  },

  // Builtin function - current value of 'this'
  getThis: function(args, params) {
    var result = ast.snapshotVariable(this.thisIs);
    return result;
  },

  // Builtin function - convert string to RegExp
  makeRegExp: function(args, params) {
    if (args.length !== 1) {
      throw new Error(errors.application + "RegExp arguments.");
    }
    var exp = this.partialEval(args[0], params);
    if (exp.type !== 'String' || !/\/.*\//.test(exp.value)) {
      throw new Error(errors.coercion + decodeExpression(exp) + " => RegExp");
    }
    return ast.regexp(exp.value);
  },

  // Lookup globally defined function.
  lookupFunction: function(ref) {
    // Global function.
    if (ref.type === 'var') {
      var fn = this.symbols.functions[ref.name];
      if (!fn) {
        return undefined;
      }
      return { self: undefined, fn: fn};
    }

    // Method call.
    if (ref.type === 'ref') {
      // TODO: Require static type validation before calling String methods.
      if (ref.base.op !== 'value' && ref.accessor in this.symbols.schema.String.methods) {
        return { self: ref.base, fn: this.symbols.schema.String.methods[ref.accessor] };
      }
    }
    return undefined;
  },

  pushGlobal: function(name, exp) {
    if (!this.globalStacks[name]) {
      this.globalStacks[name] = [];
    }
    var stack = this.globalStacks[name];
    stack.push(this.globals[name]);
    this.globals[name] = exp;
  },

  popGlobal: function(name) {
    this.globals[name] = this.globalStacks[name].pop();
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
export function decodeExpression(exp, outerPrecedence?) {
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

  // RegExp assumed to be in correct format.
  case 'RegExp':
    result = exp.value;
    break;

  case 'Null':
    result = 'null';
    break;

  case 'var':
  case 'literal':
    result = exp.name;
    break;

  case 'ref':
    if (typeof exp.accessor === 'string') {
      result = decodeExpression(exp.base) + '.' + exp.accessor;
    } else {
      result = decodeExpression(exp.base, innerPrecedence) +
        '[' + decodeExpression(exp.accessor) + ']';
    }
    break;

  case 'call':
    result = decodeExpression(exp.ref) + '(' + decodeArray(exp.args) + ')';
    break;

  case 'builtin':
    result = decodeExpression(exp);
    break;

  case 'op':
    var rep = JS_OPS[exp.op].rep === undefined ? exp.op : JS_OPS[exp.op].rep;
    if (exp.args.length === 1) {
      result = rep + decodeExpression(exp.args[0], innerPrecedence);
    } else if (exp.args.length === 2) {
      result =
        decodeExpression(exp.args[0], innerPrecedence) +
        ' ' + rep + ' ' +
        // All ops are left associative - so nudge the innerPrecendence
        // down on the right hand side to force () for right-associating
        // operations.
        decodeExpression(exp.args[1], innerPrecedence + 1);
    } else if (exp.args.length === 3) {
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

// Merge all .X terms into target.
export function extendValidator(target, src) {
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
        target[prop].push(src[prop]);
      }
    } else {
      if (!target[prop]) {
        target[prop] = {};
      }
      extendValidator(target[prop], src[prop]);
    }
  }

  return target;
}

// Call fn(value, prop) on all '.props' and assiging the value back into the
// validator.
export function mapValidator(v, fn) {
  for (var prop in v) {
    if (!v.hasOwnProperty(prop)) {
      continue;
    }
    if (prop[0] === '.') {
      v[prop] = fn(v[prop], prop);
      if (v[prop] === undefined) {
        delete v[prop];
      }
    } else {
      mapValidator(v[prop], fn);
    }
  }
}

// Collapse all hasChildren calls into one (combining their arguments).
// E.g. newData.hasChildren() && newData.hasChildren(['x']) && newData.hasChildren(['y']) =>
//      newData.hasChildren(['x', 'y'])
function collapseHasChildren(exps) {
  var hasHasChildren = false;
  var combined = [];
  var result = [];
  exps.forEach(function(exp) {
    if (exp.type === 'call' && exp.ref.type === 'ref' && exp.ref.accessor === 'hasChildren') {
      if (exp.args.length === 0) {
        hasHasChildren = true;
        return;
      }
      // Expect one argument of Array type.
      if (exp.args.length !== 1 || exp.args[0].type !== 'Array') {
        throw new Error(errors.application + "Invalid argument to hasChildren(): " +
                        exp.args[0].type);
      }
      exp.args[0].value.forEach(function(arg) {
        hasHasChildren = true;
        if (arg.type !== 'String') {
          throw new Error(errors.application + "Expect string argument to hasChildren(), not: " +
                          arg.type);
        }
        combined.push(arg.value);
      });
    } else {
      result.push(exp);
    }
  });
  if (hasHasChildren) {
    result.unshift(hasChildrenExp(combined));
  }
  return result;
}

// Generate this.hasChildren([props, ...])
function hasChildrenExp(props) {
  var args = props.length === 0 ? [] : [ast.array(props.map(ast.string))];
  return ast.call(ast.reference(ast.cast(ast.variable('this'), 'Any'), 'hasChildren'), args);
}
