/*
 * Firebase helper functions for REST API (using Promises).
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
/// <reference path="typings/node.d.ts" />
/// <reference path="typings/es6-promise.d.ts" />
/// <reference path="typings/node-uuid.d.ts" />

import Promise = require('promise');
import https = require('https');
import http = require('http');
import util = require('./util');
import querystring = require('querystring');
import uuid = require('node-uuid');
var FirebaseTokenGenerator = require('firebase-token-generator');

var FIREBASE_HOST = 'firebaseio.com';

export var RULES_LOCATION =  '/.settings/rules';
export var TIMESTAMP = {".sv": "timestamp"};

export function Client(appName, authToken?, uid?) {
  this.appName = appName;
  this.authToken = authToken;
  this.uid = uid;
}

util.methods(Client, {
  setDebug: function(debug) {
    if (debug === undefined) {
      debug = true;
    }
    this.debug = debug;
    return this;
  },

  get: function(location) {
    return this.request({method: 'GET'}, location);
  },

  put: function(location, content) {
    return this.request({method: 'PUT', print: 'silent'}, location, content);
  },

  request: function(opt, path, content) {
    var options = {
      hostname: this.appName + '.' + FIREBASE_HOST,
      path: path + '.json',
      method: opt.method
    };

    var query: any = {};
    if (opt.print) {
      query.print = opt.print;
    }

    if (this.authToken) {
      query.auth = this.authToken;
    }

    if (Object.keys(query).length > 0) {
      options.path += '?' + querystring.stringify(query);
    }

    content = util.prettyJSON(content);

    return request(options, content, this.debug)
      .then(function(body) {
        return body === '' ? null : JSON.parse(body);
      });
  }
});

var ridNext = 0;

function request(options, content, debug): Promise<string> {
  ridNext += 1;
  var rid = ridNext;

  function log(s) {
    if (debug) {
      console.log("Request<" + rid + ">: " + s);
    }
  }

  log("Request: " + util.prettyJSON(options));
  if (content) {
    log("Body: '" + content + "'");
  }

  return new Promise(function(resolve, reject) {
    // TODO: Why isn't this argument typed as per https.request?
    var req = https.request(options, function(res: http.ClientResponse) {
      var chunks = [];

      res.on('data', function(body) {
        chunks.push(body);
      });

      res.on('end', function() {
        var result: string = chunks.join('');
        log("Result (" + res.statusCode + "): '" + result + "'");
        if (Math.floor(res.statusCode / 100) !== 2) {
          reject(new Error("Status = " + res.statusCode + " " + result));
        } else {
          resolve(result);
        }
      });
    });

    if (content) {
      req.write(content, 'utf8');
    }
    req.end();

    req.on('error', function(error) {
      log("Request error: " + error);
      reject(error);
    });
  });
}

// opts { debug: Boolean, admin: Boolean }
export function generateUidAuthToken(secret, opts) {
  opts = util.extend({ debug: false, admin: false }, opts);

  var tokenGenerator = new FirebaseTokenGenerator(secret);
  var uid = uuid.v4();
  var token = tokenGenerator.createToken({ uid: uid }, opts);
  return { uid: uid, token: token };
}
