/*
 * Firebase Storage simulator.
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

import util = require('./util');
import bolt = require('./bolt');
import ast = require('./ast');
var parse = bolt.parse;

export class Storage {
  rules: Object;
  user: string;
  path: string[];
  root: Object;
  status: boolean;

  constructor(rules: Object, root: Object = {}) {
    if (!(rules['rules'] instanceof Object)) {
      throw new Error("Must initialize with a value rules object.");
    }
    this.rules = parseExpressions(rules['rules']);
    this.root = root;
  }

  as(user: string): Storage {
    this.user = user;
    return this;
  }

  at(path: string): Storage {
    this.path = partsFromPath(path);
    return this;
  }

  write(value: any): Storage {
    if (!this.testAnyPathRules('.write')) {
      console.log("No write allowed.");
      this.status = false;
      return;
    }
    if (!this.testAllPathRules('.validate')) {
      console.log("Some validate not allowed.");
      this.status = false;
      return;
    }
    this.status = this.set(this.path, value);
    return this;
  }

  read(): Storage {
    if (!this.testAnyPathRules('.read')) {
      console.log("No read allowed.");
      this.status = false;
      return;
    }
    this.get(this.path);
    this.status = true;
    return this;
  }

  get(path: string[]) {
    util.pruneEmptyChildren(this.root);
    if (path.length === 0) {
      return this.root;
    }
    let key = path.slice(-1)[0];
    let location = util.ensureObjectPath(this.root, path.slice(0, -1));
    if (location[key] !== undefined) {
      return location[key];
    } else {
      util.pruneEmptyChildren(this.root);
      return null;
    }
  }

  set(path: string[], value: any) {
    if (util.isType(value, 'object')) {
      value = util.deepExtend({}, value);

    }
    if (path.length === 0) {
      this.root = value;
      return true;
    }
    let key = path.slice(-1)[0];
    let location = util.ensureObjectPath(this.root, path.slice(0, -1));
    location[key] = value;
    util.pruneEmptyChildren(this.root);
    return true;
  }

  testAnyPathRules(name: string): boolean {
    let rules = this.rules;
    let globals = <{ [name: string]: any; }> {
      'data': new DataSnapshot([], this.root),
    };

    let i = 0;
    do {
      let exp = rules[name];
      if (exp !== undefined && evalJSONExpression(exp, globals)) {
        return true;
      }
      rules = rules[this.path[i]];
      if (rules === undefined) {
        return false;
      }
      globals['data'] = globals['data'].child(this.path[i]);
      i += 1;
    } while (i <= this.path.length);

    return false;
  }

  testAllPathRules(name: string): boolean {
    let rules = this.rules;
    let globals = <{ [name: string]: any; }> {
      'data': new DataSnapshot([], this.root)
    };

    let i = 0;
    do {
      let exp = rules[name];
      if (exp !== undefined && !evalJSONExpression(exp, globals)) {
        return false;
      }
      rules = rules[this.path[i]];
      if (rules === undefined) {
        return true;
      }
      globals['data'] = globals['data'].child(this.path[i]);
      i++;
    } while (i <= this.path.length);

    return true;
  }
}

export function partsFromPath(path: string): string[] {
  let parts = path.split('/');
  if (parts[0] !== '') {
    throw new Error("Path must begin with '/'.");
  }
  parts.shift();
  if (parts.slice(-1)[0] === '') {
    parts.pop();
  }
  return parts;
}

export function parseExpressions(rules: Object): Object {
  let result = {};
  for (let key in rules) {
    if (key[0] === '.') {
      let symbols = parse('function f() = ' + rules[key] + ';');
      result[key] = symbols.functions.f.body;
    } else {
      result[key] = parseExpressions(rules[key]);
    }
  }
  return result;
}

// Evaluation of expressions matching Firebase JSON expression evaluator (NOT
// Bolt expressions).
export function evalJSONExpression(exp: ast.Exp, globals: {[name: string]: any}): any {
  function subExpression(exp2: ast.Exp) {
    return evalJSONExpression(exp2, globals);
  }

  switch (exp.type) {
  case 'Boolean':
  case 'Number':
  case 'String':
  case 'Array':
    return (<ast.ExpValue> exp).value;

  case 'RegExp':
    return new RegExp((<ast.ExpValue> exp).value);

  case 'Null':
    return null;

  case 'var':
  case 'literal':
    let expVariable = <ast.ExpVariable> exp;
    let value2 = globals[expVariable.name];
    if (value2 === undefined) {
      throw new Error("Cannot evaluate unknown variable: " + expVariable.name);
    }
    return value2;

  case 'ref':
    let expRef = <ast.ExpReference> exp;
    let base = subExpression(expRef.base);
    let accessor = subExpression(expRef.accessor);
    if (!util.isType(accessor, 'string')) {
      throw new Error("Can't evaluate non-string reference: '" + accessor + "'");
    }

    // Handle auth.prop === null, when auth === null.
    if (base === null) {
      return null;
    }

    // Special-case for Firebase strings methods (that are not support JS String methods).
    if (util.isType(base, 'string') && FirebaseString.prototype[accessor] !== undefined) {
      base = new FirebaseString(base);
    }

    if (base[accessor] !== undefined) {
      // A function/method - bind here
      if (util.isType(base[accessor], 'function')) {
        return base[accessor].bind(base);
      }
      return base[accessor];
    }

    throw new Error("Undefined property reference: " + ast.decodeExpression(expRef));

  case 'call':
    let expCall = <ast.ExpCall> exp;
    let fnCall = subExpression(expCall.ref);

    // No such method or function
    if (!util.isType(fnCall, 'function')) {
      throw new Error("Not a function: " + ast.decodeExpression(expCall));
    }
    let callArgs = expCall.args.map(subExpression);
    return fnCall.apply(undefined, callArgs);

  case 'builtin':
    throw new Error("Unknown builtin function");

  case 'op':
    let expOp = <ast.ExpOp> exp;
    let args = expOp.args.map(subExpression);
    let fn = ast.JS_OPS[expOp.op].fn;
    if (fn === undefined) {
      throw new Error("Don't know how to evaluate operator '" + expOp.op + "'");
    };
    return fn.apply(undefined, args);

  case 'type':
  case 'union':
  case 'generic':
    throw new Error("Can't evaluate type expressions.");

  default:
    throw new Error("Can't evaluate unknown expression type (" + exp.type + ")");
  }
}

export class DataSnapshot {
  path: string[];
  root: Object;

  constructor(path: string[], root: Object) {
    this.path = path;
    this.root = root;
  }

  parent() {
    if (this.path.length === 0) {
      throw new Error("Cannot call parent() on root reference.");
    }
    return new DataSnapshot(this.path.slice(0, - 1), this.root);
  }

  child(name: string) {
    let childPath = util.copyArray(this.path);
    childPath.push(name);
    let result = new DataSnapshot(childPath, this.root);
    return result;
  }

  val() {
    let location = util.ensureObjectPath(this.root, this.path.slice(0, -1));
    let value = location[this.path.slice(-1)[0]];
    if (value === undefined) {
      return null;
    }
    return value;
  }

  hasChild(name: string) {
    return this.child(name).val() !== null;
  }

  hasChildren(props: string[]) {
    for (var i = 0; i < props.length; i++) {
      if (!this.hasChild(props[i])) {
        return false;
      }
    }
    return true;
  }

  exists() {
    return this.val() !== null;
  }

  isNumber() {
    return util.isType(this.val(), 'number');
  }

  isString() {
    return util.isType(this.val(), 'string');
  }

  isBoolean() {
    return util.isType(this.val(), 'boolean');
  }
}

export class FirebaseString {
  s: string;

  constructor(s: string) {
    this.s = s;
  }

  beginsWith(s: string): boolean {
    return this.s.slice(0, s.length) === s;
  }

  endsWith(s: string): boolean {
    return this.s.slice(-s.length) === s;
  }

  matches(regexp: RegExp): boolean {
    return regexp.test(this.s);
  }

  replace(s: string, t: string): string {
    return this.s.split(s).join(t);
  }
}
