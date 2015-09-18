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
import fs = require('fs');
import util = require('./util');

export var readFile = util.maybePromise(readFileSync);
export var readJSONFile = util.maybePromise(readJSONFileSync);
export var writeFile = util.maybePromise(writeFileSync);
export var writeJSONFile = util.maybePromise(writeJSONFileSync);

function readJSONFileSync(path, fnFallback) {
  return readFileSync(path)
    .then(function(response) {
      return JSON.parse(response.content);
    })
    .catch(function(error) {
      if (error.code === 'ENOENT' && typeof fnFallback === 'function') {
        return fnFallback();
      }
      throw error;
    });
}

function writeJSONFileSync(path, data) {
  return writeFileSync(path, util.prettyJSON(data));
}

function readFileSync(path) {
  return request('GET', path) || readFS(path);
}

function writeFileSync(path, data) {
  return request('PUT', path, data) || writeFS(path, data);
}

function request(method, url, data?) {
  if (!global.XMLHttpRequest) {
    return undefined;
  }

  return new Promise(function(resolve, reject) {
    var req = new XMLHttpRequest();

    req.open(method, '/' + url);

    req.onload = function() {
      if (req.status === 200) {
        resolve({content: req.response, url: url});
      } else {
        reject(new Error(url + " " + req.statusText));
      }
    };

    req.onerror = function() {
      reject(new Error(url + " Network Error"));
    };

    if (data) {
      req.setRequestHeader('Content-Type', 'text');
    }

    req.send(data);
  });
}

function readFS(path) {
  return new Promise(function(resolve, reject) {
    fs.readFile(path, {encoding: 'utf8'}, function(error, data) {
      if (error) {
        reject(error);
        return;
      }
      resolve({url: path, content: data});
    });
  });
}

function writeFS(path, data) {
  return new Promise(function(resolve, reject) {
    fs.writeFile(path, data, {encoding: 'utf8'}, function(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({url: path, content: "ok"});
    });
  });
}
