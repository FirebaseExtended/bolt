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
var parser = require('./rules-parser');

export let PREAMBLE = "// Bolt file auto-generated from JSON file.\n";

let typeIndicators = {
  "newData.isString()": "String",
  "newData.isNumber()": "Number",
  "newData.isBoolean()": "Boolean"
};

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

class Formatter {
  exps: { [path: string]: PathConstraints };
  indent: number;

  constructor() {
    this.exps = {};
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

  emit(path: string, method: string, expString: string) {
    // Normalize expression
    try {
      expString = ast.decodeExpression(parse(expString));
    } catch (e) {
      throw new Error("Could not parse expression: '" + expString + "'");
    }

    if (this.exps[path] === undefined) {
      this.exps[path] = new PathConstraints('Any');
    }

    let pc = this.exps[path];

    if (method === 'validate' && typeIndicators[expString]) {
      pc.type = ast.typeType(typeIndicators[expString]);
    } else {
      pc.methods[method] = expString;
    }
  }

  toString(): string {
    let lines = [];
    Object.keys(this.exps).sort().forEach((path) => {
      let pc = this.exps[path];
      let line = "path " + path;

      if ((<ast.ExpSimpleType> pc.type).name !== 'Any') {
        line += " is " + ast.decodeExpression(pc.type);
      }
      if (Object.keys(pc.methods).length === 0) {
        lines.push(line + ";");
        return;
      }
      lines.push(line + " {");
      for (let method in pc.methods) {
        lines.push("  " + method + "() = " + pc.methods[method] + ";");
      }
      lines.push("}");
    });
    return PREAMBLE + lines.join('\n');
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
