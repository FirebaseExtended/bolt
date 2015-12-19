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

var parser = require('./rules-parser');
import generator = require('./rules-generator');
import decoder = require('./rules-decoder');
import simulator = require('./simulator');
import parseUtil = require('./parseUtil');
export import ast = require('./ast');

export var FILE_EXTENSION = 'bolt';

export var parse = parser.parse;
export var Generator = generator.Generator;
export var decodeExpression = ast.decodeExpression;
export var decodeRules = decoder.decodeRules;
export var rulesSuite = simulator.rulesSuite;
export var parseExpression = parseUtil.parseExpression;

export function generate(boltText: string): generator.Validator {
  let symbols = <ast.Symbols> parser.parse(boltText);
  var gen = new generator.Generator(symbols);
  return gen.generateRules();
}
