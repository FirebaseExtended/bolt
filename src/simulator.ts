/*
 * Firebase Rules test simulator.
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
import {assert} from 'chai';
import * as rest from './firebase-rest';
import * as util from './util';
import * as fileIO from './file-io';
import * as bolt from './bolt';

let generate = util.lift(bolt.generate);
let readFile = util.liftArgs(fileIO.readFile);

var MAX_TEST_MS = 60000;

export type SuiteFunction = (fn: TestFunction) => void;

// Interface for 'test' function passed back to rulesSuite callback.
// test is a function as well as a namespace for some static methods
// and constants.
export interface TestFunction {
  (name: string, fnTest: (rules: RulesTest) => void): void;
  rules: (path: string) => void;
  database: (appName: string, secret: string) => void;
  uid: (username: string) => string;
  TIMESTAMP: Object;
};

export function rulesSuite(suiteName: string, fnSuite: SuiteFunction) {
  new RulesSuite(suiteName, fnSuite).run();
}

class RulesSuite {
  public  debug = false;
  private users = <{[name: string]: rest.Client}>{};
  private tests = <RulesTest[]>[];
  private rulesPath: string;
  private rulesPathResolve: (path: string) => void;
  private databaseReady: () => void;
  private ready: Promise<any>;
  private adminClient: rest.Client;
  private appName: string;
  private appSecret: string;

  constructor(public suiteName: string,
              private fnSuite: SuiteFunction) {}

  setDebug(debug = true) {
    this.debug = debug;
    return this;
  }

  run() {
    var self = this;

    // Run Mocha Test Suite - serialize with any other mocha test suites.
    suite("Firebase Rules Simulator: " + self.suiteName, function() {
      this.timeout(MAX_TEST_MS);
      suiteSetup(function() {
        var rulesPath = new Promise(function(resolve) {
          self.rulesPathResolve = resolve;
        });

        var database = new Promise(function(resolve) {
          self.databaseReady = resolve;
        });

        var rulesJSON = generate(util.getProp(readFile(rulesPath), 'content'));

        self.ready = Promise.all([rulesJSON, database])
          .then(self.onRulesReady.bind(self));

        // Execute initialization and get test definitions (in client code).
        self.fnSuite(self.getInterface());

        return self.ready;
      });

      test("Initialization.", function() {
        // pass
      });

      test("Rules test.", function() {
        return self.runTests();
      });
    });
  }

  getInterface() {
    var test = this.test.bind(this);
    test.rules = this.rules.bind(this);
    test.database = this.database.bind(this);
    test.uid = this.uid.bind(this);
    test.TIMESTAMP = rest.TIMESTAMP;
    return test;
  }

  // Called when rules are generated and test database is known.
  onRulesReady(prereq: [Object, any]) {
    let rulesJSON = prereq[0];
    return this.adminClient.put(rest.RULES_LOCATION, rulesJSON);
  }

  runTests() {
    var p = Promise.resolve();

    function next(prev: Promise<any>, test: RulesTest): Promise<any> {
      return prev.then(function() {
        return test.run();
      });
    }

    for (var i = 0; i < this.tests.length; i++) {
      p = next(p, this.tests[i]);
    }

    return p;
  }

  test(testName: string, fnTest: (rules: RulesTest) => void): void {
    this.tests.push(new RulesTest(testName, this, fnTest));
  }

  rules(rulesPath: string): void {
    if (this.rulesPath) {
      throw new Error("Only expect a single call to the test.rules function.");
    }
    this.rulesPath = rulesPath;
    this.rulesPathResolve(util.ensureExtension(rulesPath, bolt.FILE_EXTENSION));
  }

  database(appName: string, appSecret: string) {
    if (this.adminClient) {
      throw new Error("Only expect a single call to the test.database function.");
    }
    this.appName = appName;
    this.appSecret = appSecret;
    this.adminClient = this.ensureUser('admin');
    this.databaseReady();
  }

  uid(username: string): string | undefined {
    return this.ensureUser(username).uid;
  }

  ensureUser(username: string): rest.Client {
    if (!(username in this.users)) {
      if (username === 'anon') {
        this.users[username] = new rest.Client(this.appName);
      } else {
        let tokenInfo = rest.generateUidAuthToken(
          this.appSecret,
          { debug: true,
            admin: username === 'admin' });
        this.users[username] = new rest.Client(this.appName, tokenInfo.token, tokenInfo.uid);
      }
    }

    return this.users[username];
  }
}

interface Step {
  label: string;
  fn: () => Promise<any>;
}

export class RulesTest {
  private lastError: string;
  private steps: Step[] = [];
  private failed = false;
  private path: string | undefined;
  private client: rest.Client;
  private status: boolean | undefined;

  constructor(private testName: string,
              private suite: RulesSuite,
              private fnTest: (rules: RulesTest) => void) {}

  run() {
    this.debug(false);
    this.as('admin');
    this.at('/');
    this.write(null);
    this.succeeds("initialization");

    this.at(undefined);
    this.as('anon');

    this.fnTest(this);

    this.debug(false);

    return this.executeQueue()
      .then(() => {
        this.log("Finished");
      })
      .catch((error) => {
        this.log("Failed: " + error);
        throw error;
      });
  }

  // Queue a function to be called in sequence after previous step
  // in test is (successfully) completed.
  queue(op: string, args: ArrayLike<any>, fn: () => Promise<any>) {
    if (this.failed) {
      return;
    }
    let argsT = util.copyArray(args).map(function(x) {
      return util.prettyJSON(x);
    });
    var label = op + '(' + argsT.join(', ') + ')';
    this.steps.push({label: label, fn: fn});
  }

  executeQueue() {
    var self = this;

    this.log("Executing (" + this.steps.length + " steps)");
    var p = Promise.resolve(true);

    function next(prev: Promise<any>, step: Step): Promise<any> {
      return prev.then(function() {
        self.log(step.label);
        return step.fn();
      });
    }

    for (var i = 0; i < this.steps.length; i++) {
      p = next(p, this.steps[i]);
    }

    return p;
  }

  debug(debug?: boolean): RulesTest {
    this.suite.setDebug(debug);
    this.queue('debug', arguments, () => {
      this.suite.setDebug(debug);
      return Promise.resolve();
    });
    return this;
  }

  as(username: string): RulesTest {
    var client = this.suite.ensureUser(username);
    this.queue('as', arguments, () => {
      client.setDebug(this.suite.debug);
      this.client = client;
      return Promise.resolve();
    });
    return this;
  }

  at(opPath: string | undefined): RulesTest {
    this.queue('at', arguments, () => {
      this.path = opPath;
      return Promise.resolve();
    });
    return this;
  }

  write(obj: any): RulesTest {
    this.queue('write', arguments, () => {
      if (this.path === undefined) {
        return Promise.reject(new Error("Use at() function to set path to write."));
      }
      return this.client.put(this.path, obj)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
    });
    return this;
  }

  push(obj: any): RulesTest {
    this.queue('write', arguments, () => {
      if (this.path === undefined) {
        return Promise.reject(new Error("Use at() function to set path to push."));
      }
      let path = this.path;
      if (path.slice(-1)[0] !== '/') {
        path += '/';
      }
      path += rest.generatePushID();
      return this.client.put(path, obj)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
    });
    return this;
  }

  read(): RulesTest {
    this.queue('read', arguments, () => {
      if (this.path === undefined) {
        return Promise.reject(new Error("Use at() function to set path to read."));
      }
      return this.client.get(this.path)
        .then(() => {
          this.status = true;
        })
        .catch((error) => {
          this.status = false;
          this.lastError = error;
        });
    });
    return this;
  }

  succeeds(message: string): RulesTest {
    this.queue('succeeds', arguments, () => {
      assert(this.status === true,
             this.messageFormat(message + " (should have succeed)\n" + this.lastError));
      this.good(message);
      this.status = undefined;
      return Promise.resolve();
    });
    return this;
  }

  fails(message: string): RulesTest {
    this.queue('fails', arguments, () => {
      assert(this.status === false,
             this.messageFormat(message + " (should have failed)"));
      this.good(message);
      this.status = undefined;
      return Promise.resolve();
    });
    return this;
  }

  private good(message: string): void {
    this.log(message + " (Correct)");
  }

  private log(message: string): void {
    if (this.suite.debug) {
      console.log(this.messageFormat(message));
    }
  }

  messageFormat(message: string): string {
    return this.suite.suiteName + "." + this.testName + " " + message;
  }
}
