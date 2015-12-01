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

let reverseOp = {
  '<': '>',
  '>': '<',
  '<=': '>=',
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
    return this.path[0].exp;
  }

}

// "[(<params>)] <pattern> => <replacement>"
// E.g. "(a) a.val() => a"
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

  apply(exp: ast.Exp): ast.Exp {
    let match: Match;
    let limit = 50;

    while (match = findExp(this.pattern, exp, this.paramNames)) {
      if (match.exp === null) {
        break;
      }
      console.log("A", ast.decodeExpression(match.exp));
      if (limit-- <= 0) {
        throw new Error("Too many patterns (" + ast.decodeExpression(this.pattern) +
                        ") in expression: " + ast.decodeExpression(exp));
      }
      let replacement = replaceVars(this.replacement, match.params);
      exp = match.replaceExp(replacement);
    }
    return exp;
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
    console.log("FE", ast.decodeExpression(match.exp));
    if (equivalent(pattern, match.exp, paramNames, params)) {
      console.log("FE2", ast.decodeExpression(match.exp));
      match.params = params;
      return match;
    }
    match.next();
  }
  return match;
}

function equivalent(pattern: ast.Exp,
                    exp: ast.Exp,
                    paramNames?: string[],
                    params: ast.ExpParams = {}
                   ): boolean {
  if (paramNames !== undefined && pattern.type === 'var') {
    let name = (<ast.ExpVariable> pattern).name;
    if (util.arrayIncludes(paramNames, name)) {
      if (params[name] === undefined) {
        console.log("EQ", name + " = " + ast.decodeExpression(exp));
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
      // Find any (unique) occurance for all children of the pattern.
      let matches: number[] = [];
      while (matches.length < patternOp.args.length) {
        let j: number;
        for (j = 0; j < expOp.args.length; j++) {
          if (util.arrayIncludes(matches, j)) {
            continue;
          }
          if (equivalent(patternOp.args[matches.length], expOp.args[j], paramNames, params)) {
            matches.push(j);
            break;
          }
        }
        if (j >= expOp.args.length) {
          return false;
        }
      }
    }
    return true;

  case 'literal':
  case 'var':
    return (<ast.ExpVariable> pattern).name === (<ast.ExpVariable> exp).name;

  default:
    return false;
  }
}
