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
var parser = require('./rules-parser');
var generator = require('./rules-generator');
var simulator = require('./simulator');
var ast = require('./ast');
var util = require('./util');

module.exports = {
  parse: util.maybePromise(parser.parse),
  generate: util.maybePromise(generate),

  Generator: generator.Generator,
  decodeExpression: generator.decodeExpression,
  ast: ast,

  rulesSuite: simulator.rulesSuite,

  FILE_EXTENSION: 'bolt'
};


// Usage:
//   json = bolt.generate(bolt-text)
function generate(symbols) {
  if (typeof symbols == 'string') {
    symbols = parser.parse(symbols);
  }
  var gen = new generator.Generator(symbols);
  return gen.generateRules();
}
