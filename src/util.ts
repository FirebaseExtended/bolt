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
/// <reference path="typings/es6-promise.d.ts" />

import Promise = require('promise');

export function methods(ctor, obj: Object) {
  extend(ctor.prototype, obj);
}

export function extend(dest: Object, ...srcs: Object[]): Object {
  var i;
  var source;
  var prop;

  if (dest === undefined) {
    dest = {};
  }
  for (i = 0; i < srcs.length; i++) {
    source = srcs[i];
    for (prop in source) {
      if (source.hasOwnProperty(prop)) {
        dest[prop] = source[prop];
      }
    }
  }

  return dest;
}

export function copyArray(arg: any[]): any[] {
  return Array.prototype.slice.call(arg);
}

var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                 'regexp', 'arguments', 'undefined', 'null'];

function internalType(value): string {
  return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
}

export function isType(value, type: string): boolean {
  return typeOf(value) === type;
}

// Return one of the baseTypes as a string
export function typeOf(value): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  var type = internalType(value);
  if (!arrayIncludes(baseTypes, type)) {
    type = typeof value;
  }
  return type;
}

export function isThenable(obj): boolean {
  return typeOf(obj) === 'object' && 'then' in obj && typeof(obj.then) === 'function';
}

// Converts a synchronous function to one allowing Promises
// as arguments and returning a Promise value.
//
//   fn(a, b, c, ...):v => fn(aP, bP, cP, ...): Pv
//
// If none of the arguments are Thenables, then the wrapped
// function returns a synchronous value (not wrapped in a Promise).
export function maybePromise(fn: (...any) => any): (...any) => any {
  return function(...args) {
    var self = this;
    if (!args.some(isThenable)) {
      return fn.apply(self, args);
    }

    return Promise.all(args)
      .then(function(values) {
        return fn.apply(self, values);
      });
  };
}

export var getProp = maybePromise(function(obj, prop) {
  return obj[prop];
});

export function ensureExtension(fileName: string, extension: string) {
  return fileName + '.' + extension;
}

export function prettyJSON(o: any): string {
  return JSON.stringify(o, null, 2);
}

export function deepExtend(target: Object, source: Object): Object {
  for (var prop in source) {
    if (!source.hasOwnProperty(prop)) {
      continue;
    }

    if (target[prop] !== undefined) {
      throw new Error("Property overwrite: " + prop);
    }

    if (isType(source[prop], 'object')) {
      target[prop] = {};
      deepExtend(target[prop], source[prop]);
    } else {
      target[prop] = source[prop];
    }
  }
  return target;
}

// Like JSON.stringify - but for single-quoted strings instead of double-quoted ones.
// This just makes the compiled rules much easier to read.

// Quote all control characters, slash, single quotes, and non-ascii printables.
var quotableCharacters = /[\u0000-\u001f\\\'\u007f-\uffff]/g;
var specialQuotes = {
  '\'': '\\\'',
  '\b': '\\b',
  '\t': '\\t',
  '\n': '\\n',
  '\f': '\\f',
  '\r': '\\r'
};

export function quoteString(s: string): string {
  s = s.replace(quotableCharacters, function(c) {
    if (specialQuotes[c]) {
      return specialQuotes[c];
    }
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
  });
  return "'" + s + "'";
}

export function arrayIncludes(a: any[], e): boolean {
  return a.indexOf(e) !== -1;
}

// Like Python list.extend
export function extendArray(target, src) {
  if (target === undefined) {
    target = [];
  }
  Array.prototype.push.apply(target, src);
  return target;
}

export function or(target, src) {
  if (target === undefined) {
    return false;
  }
  return target || src;
}

export function ensureObjectPath(obj: Object, parts: string[]): Object {
  for (var i = 0; i < parts.length; i++) {
    var name = parts[i];
    if (!(name in obj)) {
      obj[name] = {};
    }
    if (!isType(obj[name], 'object')) {
      throw new Error("Cannot create child properties of '" +
                      parts.slice(0, i + 1).join('.') + "' (a " + typeOf(obj[name]) + ")");
    }
    obj = obj[name];
  }
  return obj;
}

// Remove all empty, '{}',  children - returns true iff obj is empty.
export function pruneEmptyChildren(obj: Object): boolean {
  if (obj === null || obj === undefined) {
    return true;
  }
  if (!isType(obj, 'object')) {
    return false;
  }
  var hasChildren = false;
  for (var prop in obj) {
    if (!obj.hasOwnProperty(prop)) {
      continue;
    }
    if (pruneEmptyChildren(obj[prop])) {
      delete obj[prop];
    } else {
      hasChildren = true;
    }
  }
  return !hasChildren;
}
