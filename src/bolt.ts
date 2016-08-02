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

// TODO(koss): After node 0.10 leaves LTS - remove polyfilled Promise library.
if (typeof Promise === 'undefined') {
  require('es6-promise').polyfill();
}

let parser = require('./rules-parser');
import * as generator from './rules-generator';
import * as astImport from './ast';

export let FILE_EXTENSION = 'bolt';

export let ast = astImport;
export let parse = parser.parse;
export let Generator = generator.Generator;
export let decodeExpression = ast.decodeExpression;
export let generate = generator.generate;
