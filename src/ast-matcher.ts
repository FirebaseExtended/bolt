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

/*
 * Post-order iterator over AST nodes.
 */
export class Match {
  path: {exp: ast.Exp,
         index: number}[];
  index: number;

  constructor(public exp: ast.Exp) {
    this.path = [];
    this.index = 0;
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
}

export function forEachExp(pattern: ast.Exp,
                           exp: ast.Exp,
                           params?: string[],
                           emit?: (match: Match) => void): Match {
  let match = new Match(exp);

  while (match.exp !== null) {
    if (equivalent(pattern, match.exp, params)) {
      if (emit === undefined) {
        return match;
      } else {
        emit(match);
      }
    }
    match.next();
  }
  return match;
}

function equivalent(pattern: ast.Exp, exp: ast.Exp, params?: string[]): boolean {
  if (pattern.type !== exp.type) {
    return false;
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
  case 'op':
  case 'ref':
  case 'union':
  case 'generic':
    let patternCount = ast.childCount(pattern);
    if (patternCount !== ast.childCount(exp)) {
      return false;
    }
    for (let i = 0; i < patternCount; i++) {
      if (!equivalent(ast.getChild(pattern, i), ast.getChild(exp, i), params)) {
        return false;
      }
    }
    return true;

  case 'var':
    return (<ast.ExpVariable> pattern).name === (<ast.ExpVariable> exp).name;

  default:
    return false;
  }
}
