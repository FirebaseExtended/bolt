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
"use strict";
var Promise = require('promise');
var https = require('https');
var util = require('./util');
var querystring = require('querystring');

module.exports = {
  "Client": Client
};

var FIREBASE_HOST = 'firebaseio.com';
var RULES_LOCATION = '/.settings/rules';

function Client(appName, authToken) {
  this.appName = appName;
  this.authToken = authToken;
}

util.methods(Client, {
  setDebug: function(debug) {
    if (debug === undefined) {
      debug = true;
    }
    this.debug = debug;
    return this;
  },

  uploadRules: function(rules) {
    return this.put(RULES_LOCATION, rules);
  },

  get: function(location) {
    return this.request({method: 'GET'}, location);
  },

  put: function(location, content) {
    return this.request({method: 'PUT', print: 'silent'}, location, content);
  },

  request: function(opt, path, content) {
    content = JSON.stringify(content);
    var options = {
      hostname: this.appName + '.' + FIREBASE_HOST,
      path: path + '.json',
      method: opt.method,
    };

    var query = {};
    if (opt.print) {
      query.print = opt.print;
    }

    if (this.authToken) {
      query.auth = this.authToken;
    }

    if (Object.keys(query).length > 0) {
      options.path += '?' + querystring.stringify(query);
    }

    return request(options, content, this.debug)
      .then(function(body) {
        return body == '' ? null : JSON.parse(body);
      }.bind(this));
  },
});

function request(options, content, debug) {
  if (debug) {
    console.log("Request: " + JSON.stringify(options, undefined, 2));
  }
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function(res) {
      if (debug) {
        console.log("Result status: " + res.statusCode);
      }
      if (Math.floor(res.statusCode / 100) != 2) {
        reject(new Error("Request failed: " + res.statusCode));
        return;
      }
      if (res.headers['content-length'] == '0') {
        resolve('');
        return;
      }
      res.on('data', function(body) {
        if (debug) {
          console.log("Result body: \n'" + body + "'\n");
        }
        resolve(body);
      });
    });

    if (content) {
      req.write(content, 'utf8');
    }
    req.end();

    req.on('error', reject);
  });
}
