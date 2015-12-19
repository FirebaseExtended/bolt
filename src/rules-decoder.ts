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
// import util = require('./util');
import ast = require('./ast');
import util = require('./util');
import matcher = require('./ast-matcher');
var parser = require('./rules-parser');
var stripComments = require('strip-json-comments');

let typeIndicators = {
  "this.isString()": "String",
  "this.isNumber()": "Number",
  "this.isBoolean()": "Boolean"
};

export function decodeRules(jsonString: string,
                            functions: {[ name: string ]: ast.Method}): string {
  return decodeJSON(JSON.parse(cleanJSONString(jsonString)));
}

export function cleanJSONString(jsonString: string): string {
  jsonString = stripComments(jsonString);
  jsonString = jsonString.replace(/"([^\\"]|\\[^])*"/g, function(s) {
    return s.replace(/\n/g, '\\n');
  });
  return jsonString;
}

export function decodeJSON(json: Object): string {
  var formatter = new Formatter;
  formatter.decodeParts('/', json['rules']);
  return formatter.toString();
}

class PathConstraints {
  type: ast.ExpType;
  methods: { [name: string]: string };

  constructor(typeName: string) {
    this.type = ast.typeType('Any');
    this.methods = {};
  }
}

let readRules = [
  "data => this",
];

let writeRules = [
  "data => prior(this)",
  "root => _oldRoot_",
  "_oldRoot_ => prior(root)",
];

let genRules = [
  "newData => this",
  "(a, b) a.child(b) => a[b]",
  "(a) a.val() => a",
  "(a) a.exists() => a != null",
  "(a, b) a.hasChild(b) => a[b] != null",
  "(a, b) a.contains(b) => a.includes(b)",
  "(a, b) a.beginsWith(b) => a.startsWith(b)",
  "(a, b) a.matches(b) => a.test(b)",
  "(a, b) !(a != b) => a == b",
];

class Formatter {
  exps: { [path: string]: PathConstraints };
  indent: number;
  readRewriters: matcher.Rewriter[];
  writeRewriters: matcher.Rewriter[];
  genRewriters: matcher.Rewriter[];

  constructor() {
    this.exps = {};
    this.readRewriters = readRules.map(matcher.Rewriter.fromDescriptor);
    this.writeRewriters = writeRules.map(matcher.Rewriter.fromDescriptor);
    this.genRewriters = genRules.map(matcher.Rewriter.fromDescriptor);
  }

  applyRules(exp: ast.Exp, rules: matcher.Rewriter[]): ast.Exp {
    rules.forEach((rewriter) => {
      exp = rewriter.apply(exp);
    });
    return exp;
  }

  decodeParts(path: string, json: Object) {
    for (var key in json) {
      if (key[0] === '.') {
        this.emit(path, key.slice(1), json[key]);
      } else {
        this.decodeParts(childPath(path, key), json[key]);
      }
    }
  }

  emit(path: string, method: string, exp: string | Array<string>) {
    let expString = <string> exp;

    if (method !== 'indexOn') {
      // Normalize expression
      try {
        let expIn = parse(expString);
        let expOut = this.applyRules(expIn,
                                     method === 'read' ?
                                     this.readRewriters :
                                     this.writeRewriters);
        expOut = this.applyRules(expOut, this.genRewriters);
        expString = ast.decodeExpression(expOut);
      } catch (e) {
        throw new Error("Could not parse expression: '" + expString + "'");
      }
    }

    if (this.exps[path] === undefined) {
      this.exps[path] = new PathConstraints('Any');
    }

    let pc = this.exps[path];

    switch (method) {
    case 'indexOn':
      pc.methods['index'] = JSON.stringify(exp);
      break;
    case 'validate':
      if (typeIndicators[expString]) {
        pc.type = ast.typeType(typeIndicators[expString]);
      } else {
        pc.methods[method] = expString;
      }
      break;
    default:
      pc.methods[method] = expString;
      break;
    }
  }

  toString(): string {
    let lines = [];
    let paths = Object.keys(this.exps).sort();
    let openPaths: string[] = [];

    function closeOpenPaths(path: string) {
      while (openPaths.length > 0 &&
             (path === '' || !util.isPrefix(pathParts(currentPath()), pathParts(path)))) {
        openPaths.pop();
        lines.push(indent(openPaths.length) + "}");
      }
    }

    function currentPath(): string {
      if (openPaths.length === 0) {
        return '';
      }
      return openPaths.slice(-1)[0];
    }

    for (let i = 0; i < paths.length; i++) {
      let path = paths[i];
      let pc = this.exps[path];
      let isParent = i < paths.length - 1 && util.isPrefix(pathParts(path), pathParts(paths[i + 1]));

      closeOpenPaths(path);

      let childPath: string;
      childPath = currentPath() === '/' ? path : path.slice(currentPath().length);
      let line = indent(openPaths.length) + (openPaths.length === 0 ? 'path ' : '') + childPath;

      if ((<ast.ExpSimpleType> pc.type).name !== 'Any') {
        line += " is " + ast.decodeExpression(pc.type);
      }
      if (Object.keys(pc.methods).length === 0 && !isParent) {
        lines.push(line + ";");
        continue;
      }
      lines.push(line + " {");
      openPaths.push(path);
      for (let method in pc.methods) {
        lines.push(indent(openPaths.length) + method + "() = " + pc.methods[method] + ";");
      }
    }

    closeOpenPaths('');

    return lines.join('\n');
  }
}

function parse(s: string): ast.Exp {
  var result = parser.parse("f() = " + s + ";");
  return result.functions.f.body;
}

function childPath(path: string, child: string): string {
  if (path.slice(-1) === '/') {
    return path + child;
  }
  return path + '/' + child;
}

function pathParts(path: string): string[] {
  if (path === undefined) {
    return [];
  }
  // Remove initial slash.
  path = path.slice(1);
  if (path === '') {
    return [];
  }
  return path.split('/');
}

function indent(n: number): string {
  return util.repeatString(' ', 2 * n);
}
