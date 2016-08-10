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
let lastError: string | undefined;
let lastMessage: string | undefined;
let errorCount: number;
let silenceOutput: boolean;

let DEBUG = false;

let getContext = () => (<ErrorContext> {});

reset();

export function reset() {
  lastError = undefined;
  lastMessage = undefined;
  errorCount = 0;
  silenceOutput = false;
}

export function setDebug(debug = true) {
  DEBUG = debug;
}

export function silent(f = true) {
  silenceOutput = f;
}

export interface ErrorContext {
  line?: number;
  column?: number;
}

export function setContext(fn: () => ErrorContext) {
  getContext = fn;
}

export function error(s: string) {
  let err = errorString(s);
  // De-dup identical messages
  if (err  === lastMessage) {
    return;
  }
  lastMessage = err;
  lastError = lastMessage;
  if (!silenceOutput) {
    console.error(lastError);
    if (DEBUG) {
      let e = new Error("Stack trace");
      console.error(e.stack);
    }
  }
  errorCount += 1;
}

export function warn(s: string) {
  let err = errorString(s);
  // De-dup identical messages
  if (err === lastMessage) {
    return;
  }
  lastMessage = err;
  if (!silenceOutput) {
    console.warn(lastMessage);
  }
}

export function getLastMessage(): string | undefined {
  return lastMessage;
}

function errorString(s: string) {
  let ctx = getContext();
  if (ctx.line !== undefined && ctx.column !== undefined) {
    return 'bolt:' + ctx.line + ':' + ctx.column + ': ' + s;
  } else {
    return 'bolt: ' + s;
  }
}

export function hasErrors(): boolean {
  return errorCount > 0;
}

export function errorSummary(): string {
  if (errorCount === 1) {
    return <string> lastError;
  }

  if (errorCount !== 0) {
    return "Fatal errors: " + errorCount;
  }
  return "";
}
