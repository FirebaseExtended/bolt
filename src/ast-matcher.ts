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
import ast = require('./ast');
import bolt = require('./bolt');
import util = require('./util');

import {Permutation} from './permutation';

let reverseOp = {
  '<': '>',
  '>': '<',
  '<=': '>=',
  '>=': '<=',
};

/*
 * Post-order iterator over AST nodes.
 */
export class Match {
  path: {exp: ast.Exp,
         index: number}[];
  index: number;
  params: ast.ExpParams;

  constructor(public exp: ast.Exp) {
    this.path = [];
    this.index = 0;
    this.params = {};
    this.advance();
  }

  advance(): ast.Exp {
    while (ast.childCount(this.exp) > this.index) {
      this.path.push({exp: this.exp, index: this.index});
      this.exp = ast.getChild(this.exp, this.index);
      this.index = 0;
    }
    this.index = -1;
    return this.exp;
  }

  next(): ast.Exp {
    // Already finished enumeration.
    if (this.exp === null) {
      throw new Error("Continued past end of AST enumeration.");
    }

    // No more children in current - go to parent.
    this.pop();
    if (this.exp === null) {
      return null;
    }

    // Parent has no more children to enumerate - return the parent
    // and mark as visited (index == -1).
    if (this.index >= ast.childCount(this.exp)) {
      this.index = -1;
      return this.exp;
    }

    return this.advance();
  }

  pop() {
    if (this.path.length === 0) {
      this.exp = null;
      return;
    }
    let node = this.path.pop();
    this.exp = node.exp;
    this.index = node.index + 1;
  }

  replaceExp(replacement: ast.Exp) {
    if (this.path.length === 0) {
      return replacement;
    }
    let parentPart = this.path.slice(-1)[0];
    ast.setChild(replacement, parentPart.exp, parentPart.index);
    // When a boolean expression is collapsed to a single argument - hoist the argument
    // to the parent.
    if (parentPart.exp.type === 'op' && (<ast.ExpOp> parentPart.exp).args.length === 1) {
      this.path.slice(-1)[0].exp = (<ast.ExpOp> parentPart.exp).args[0];
    }
    return this.path[0].exp;
  }
}

// "[(<params>)] <pattern> => <replacement>"
// E.g. "(a, b) a.val() + b => a + b"
let descriptorRegexp = /^\s*(?:\((.*)\))?\s*(.*\S)\s*=>\s*(.*\S)\s*$/;

export class Rewriter {
  constructor(public paramNames: string[],
              public pattern: ast.Exp,
              public replacement: ast.Exp) {
  }

  static fromDescriptor(descriptor: string): Rewriter {
    let match = descriptorRegexp.exec(descriptor);
    if (match === null) {
      return null;
    }
    let paramNames: string[];
    if (match[1] === undefined) {
      paramNames = [];
    } else {
      paramNames = match[1].split(/,\s+/);
      if (paramNames.length === 1 && paramNames[0] === '') {
        paramNames = [];
      }
    }
    return new Rewriter(paramNames,
                        bolt.parseExpression(match[2]),
                        bolt.parseExpression(match[3]));
  }

  static fromFunction(name: string, method: ast.Method) {
    if (method.body.type === 'op') {
      let op = (<ast.ExpOp> method.body).op;
      if (op === '&&' || op === '||') {
        // f(a, b) = <boolean-exp> becomes (_x_, a, b) <boolean-exp> => _x_ <op> f(a, b)
        let free = ast.variable('_x_');
        let params = util.extendArray(['_x_'], method.params);
        let body = <ast.ExpOp> ast.copyExp(method.body);
        body.args = util.extendArray([free], body.args);
        let result = new Rewriter(params,
                              body,
                              ast.op(op, [free,
                                          ast.call(ast.variable(name),
                                                   method.params.map(ast.variable))]));
        console.log(result.toString());
        return result;
      }
    }

    // f(a, b) = <exp> becomes (a, b) <exp> => f(a, b)
    return new Rewriter(method.params,
                        method.body,
                        ast.call(ast.variable(name),
                                 method.params.map(ast.variable)));
  }

  apply(exp: ast.Exp): ast.Exp {
    let match: Match;
    let limit = 50;

    while (match = findExp(this.pattern, exp, this.paramNames)) {
      if (match.exp === null) {
        break;
      }
      if (limit-- <= 0) {
        throw new Error("Too many patterns (" + ast.decodeExpression(this.pattern) +
                        ") in expression: " + ast.decodeExpression(exp));
      }
      let replacement = replaceVars(this.replacement, match.params);
      exp = match.replaceExp(replacement);
    }
    return exp;
  }

  toString(): string {
    let result = '';
    if (this.paramNames.length > 0) {
      result += '(' + this.paramNames.join(', ') + ') ';
    }
    result += ast.decodeExpression(this.pattern);
    result += ' => ';
    result += ast.decodeExpression(this.replacement);
    return result;
  }
}

export function replaceVars(exp: ast.Exp, params: ast.ExpParams): ast.Exp {
  exp = ast.deepCopy(exp);
  let match = new Match(exp);

  while (match.exp !== null) {
    if (match.exp.type === 'var') {
      let expVar = <ast.ExpVariable> match.exp;
      if (params[expVar.name] !== undefined) {
        exp = match.replaceExp(ast.deepCopy(params[expVar.name]));
      }
    }
    match.next();
  }
  return exp;
}

export function findExp(pattern: ast.Exp,
                        exp: ast.Exp,
                        paramNames?: string[]): Match {
  let match = new Match(exp);

  while (match.exp !== null) {
    let params: ast.ExpParams = {};
    if (equivalent(pattern, match.exp, paramNames, params)) {
      match.params = params;
      return match;
    }
    match.next();
  }
  return match;
}

/*
 * Test for equivalence of two expressions.  Allows for wildcard
 * subexpressions (given in paramNames).  When a match is found,
 * the value of the wildcards is returnd in params.
 */
function equivalent(pattern: ast.Exp,
                    exp: ast.Exp,
                    paramNames?: string[],
                    params: ast.ExpParams = {}
                   ): boolean {
  if (paramNames !== undefined && pattern.type === 'var') {
    let name = (<ast.ExpVariable> pattern).name;
    if (util.arrayIncludes(paramNames, name)) {
      if (params[name] === undefined) {
        params[name] = ast.copyExp(exp);
        return true;
      } else {
        return equivalent(params[name], exp, paramNames, params);
      }
    }
  }

  if (pattern.type !== exp.type) {
    return false;
  }

  function equivalentChildren(): boolean {
    let patternCount = ast.childCount(pattern);
    if (patternCount !== ast.childCount(exp)) {
      return false;
    }
    for (let i = 0; i < patternCount; i++) {
      if (!equivalent(ast.getChild(pattern, i), ast.getChild(exp, i), paramNames, params)) {
        return false;
      }
    }
    return true;
  }

  switch (pattern.type) {
  case 'Null':
    return true;

  case 'Boolean':
  case 'Number':
  case 'String':
  case 'RegExp':
    return ast.cmpValues(<ast.ExpValue> pattern, <ast.ExpValue> exp);

  case 'Array':
  case 'call':
  case 'ref':
  case 'union':
    return equivalentChildren();

  case 'generic':
    if ((<ast.ExpGenericType> pattern).name !== (<ast.ExpGenericType> exp).name) {
      return false;
    }
    // NYI
    return false;

  case 'op':
    let patternOp = <ast.ExpOp> pattern;
    let op = patternOp.op;
    let expOp = <ast.ExpOp> exp;
    if (op !== expOp.op) {
      if (reverseOp[op] === expOp.op) {
        op = expOp.op;
        exp = ast.copyExp(expOp);
        (<ast.ExpOp> exp).args = [expOp.args[1], expOp.args[0]];
      } else {
        return false;
      }
    }

    switch (patternOp.op) {
    default:
      return equivalentChildren();

    case '==':
    case '!=':
      if (equivalentChildren()) {
        return true;
      }
      exp = ast.copyExp(expOp);
      (<ast.ExpOp> exp).args = [expOp.args[1], expOp.args[0]];
      return equivalentChildren();

    case '||':
    case '&&':
      // For boolean expressions the first clause of the pattern must be a "free variable".
      // After matching remainder of pattern against a permutation of the arguments we assign
      // the free variable to the unmatched clauses.
      let freeName: string;
      if (patternOp.args[0].type === 'var' ||
          util.arrayIncludes(paramNames, (<ast.ExpVariable> patternOp.args[0]).name)) {
        freeName = (<ast.ExpVariable> patternOp.args[0]).name;
      } else {
        throw new Error("First clause of boolean pattern must be a free variable.");
      }
      let p: Permutation<ast.Exp>;
      for (p = new Permutation(expOp.args, patternOp.args.length - 1);
           p.getCurrent() != null;
           p.next()) {
        let tempParams = <ast.ExpParams> util.extend({}, params);
        var args = p.getCurrent();
        let i: number;
        for (i = 0; i < args.length; i++) {
          if (!equivalent(patternOp.args[i + 1], args[i], paramNames, tempParams)) {
            break;
          }
        }

        // Found a match!
        if (i === args.length) {
          util.extend(params, tempParams);
          if (params[freeName] !== undefined) {
            throw new Error("First clause of boolean expression cannot be repeated.");
          }
          var extraArgs: ast.Exp[] = [];
          expOp.args.forEach((arg) => {
            if (!util.arrayIncludes(args, arg)) {
              extraArgs.push(arg);
            }
          });
          if (extraArgs.length === 0) {
            params[freeName] = ast.voidType();
          } else if (extraArgs.length === 1) {
            params[freeName] = extraArgs[0];
          } else {
            params[freeName] = ast.op(patternOp.op, extraArgs);
          }
          return true;
        }
      }
      return false;
    }
    break;

  case 'literal':
  case 'var':
    return (<ast.ExpVariable> pattern).name === (<ast.ExpVariable> exp).name;

  default:
    return false;
  }
}
