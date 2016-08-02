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
import {assert} from 'chai';
import * as helper from './test-helper';
import * as proc from 'child_process';
import * as fs from 'fs';

var TMP_DIR = 'tmp/';

suite("firebase-bolt CLI", function() {
  suiteSetup(() => {
    try {
      fs.mkdirSync(TMP_DIR);
    } catch (e) {
      // do nothing
    }
  });

  var tests = [
    // Simple options tests.
    { data: "--help",
      expect: {out: /^$/, err: /helpful message/} },
    { data: "--h",
      expect: {out: /^$/, err: /helpful message/} },
    { data: "--version",
      expect: {out: /^Firebase Bolt v\d+\.\d+\.\d+\n$/, err: /^$/} },
    { data: "--v",
      expect: {out: /^Firebase Bolt v\d+\.\d+\.\d+\n$/, err: /^$/} },

    // Reading from stdin
    { label: "stdin -> stdout",
      data: { stdin: "path / is String;" },
      expect: {out: /newData\.isString/, err: /^$/} },
    { label: "stdin -> file",
      data: { stdin: "path / is String;", args: "--o " + TMP_DIR + "test" },
      expect: {out: /^$/, err: new RegExp("^bolt: Generating " + TMP_DIR + "test")} },

    // Reading from a file
    { data: "samples/all_access",
      expect: {out: /^$/, err: /^bolt: Generating samples\/all_access.json\.\.\.\n$/} },
    { data: "samples/all_access.bolt",
      expect: {out: /^$/, err: /^bolt: Generating samples\/all_access.json\.\.\.\n$/} },
    { data: "samples/all_access --output " + TMP_DIR + "all_access",
      expect: {out: /^$/, err: new RegExp("^bolt: Generating " + TMP_DIR + "all_access.json\\.\\.\\.\\n$")} },
    { data: "samples/all_access.json",
      expect: {out: /^$/, err: /bolt: Cannot overwrite/} },

    // Argument errors
    { data: "--output",
      expect: {out: /^$/, err: /^bolt: Missing output file name/} },
    { data: "nosuchfile",
      expect: {out: /^$/, err: /bolt: Could not read file: nosuchfile.bolt/} },
    { data: "two files",
      expect: {out: /^$/, err: /bolt: Can only compile a single file/} },
  ];

  helper.dataDrivenTest(tests, function(data, expect) {
    return new Promise(function(resolve, reject) {
      let args: string;

      if (typeof(data) === 'string') {
        args = data;
      } else {
        args = data.args || '';
      }
      let child = proc.exec('bin/firebase-bolt ' + args, function(error, stdout, stderr) {
        if (expect.err) {
          assert.isTrue(expect.err.test(stderr), "Unexpected message: '" + stderr + "'");
        }
        if (expect.out) {
          assert.isTrue(expect.out.test(stdout), "Unexpected output: '" + stdout + "'");
        }
        resolve();
      });
      if (data.stdin) {
        child.stdin.write(data.stdin);
        child.stdin.end();
      }
    });
  });
});
