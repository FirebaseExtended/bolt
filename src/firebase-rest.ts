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
import https = require('https');
import http = require('http');
import * as util from './util';
import querystring = require('querystring');
let uuid = require('node-uuid');
var FirebaseTokenGenerator = require('firebase-token-generator');

var FIREBASE_HOST = 'firebaseio.com';
var DEBUG_HEADER = 'x-firebase-auth-debug';

export var RULES_LOCATION =  '/.settings/rules';
export var TIMESTAMP = {".sv": "timestamp"};

type RequestOptions = {
  method: string,
  print?: string;
}

export class Client {
  private debug = false;

  constructor(private appName: string,
              private authToken?: string,
              public uid?: string) {}

  setDebug(debug = true) {
    this.debug = debug;
    return this;
  }

  get(location: string): Promise<string> {
    return this.request({method: 'GET'}, location);
  }

  put(location: string, content: any): Promise<string> {
    return this.request({method: 'PUT', print: 'silent'}, location, content);
  }

  request(opt: RequestOptions, path: string, content?: any) {
    var options = {
      hostname: this.appName + '.' + FIREBASE_HOST,
      path: path + '.json',
      method: opt.method,
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
      .then(function(body: string) {
        return body === '' ? null : JSON.parse(body);
      });
  }
}

var ridNext = 0;

function request(options: any, content: any, debug: boolean): Promise<string> {
  ridNext += 1;
  var rid = ridNext;

  function log(s: string): void {
    if (debug) {
      console.error("Request<" + rid + ">: " + s);
    }
  }

  log("Request: " + util.prettyJSON(options));
  if (content) {
    log("Body: '" + content + "'");
  }

  return new Promise(function(resolve, reject) {
    // TODO: Why isn't this argument typed as per https.request?
    var req = https.request(options, function(res: http.ClientResponse) {
      var chunks = <string[]>[];

      res.on('data', function(body: string) {
        chunks.push(body);
      });

      res.on('end', function() {
        var result: string = chunks.join('');
        log("Result (" + res.statusCode + "): '" + result + "'");
        let message = "Status = " + res.statusCode + " " + result;

        // Dump debug information if present for both successful and failed requests.
        if (res.headers[DEBUG_HEADER]) {
          let formattedHeader = res.headers[DEBUG_HEADER].split(' /').join('\n  /');
          log(formattedHeader);
          message += "\n" + formattedHeader;
        }

        if (Math.floor(res.statusCode / 100) !== 2) {
          reject(new Error(message));
        } else {
          resolve(result);
        }
      });
    });

    if (content) {
      req.write(content, 'utf8');
    }
    req.end();

    req.on('error', function(error: Error) {
      log("Request error: " + error);
      reject(error);
    });
  });
}

// opts { debug: Boolean, admin: Boolean }
export function generateUidAuthToken(secret: string, opts: any) {
  opts = util.extend({ debug: false, admin: false }, opts);

  var tokenGenerator = new FirebaseTokenGenerator(secret);
  var uid = uuid.v4();
  var token = tokenGenerator.createToken({ uid: uid }, opts);
  return { uid: uid, token: token };
}

/**
 * Fancy ID generator that creates 20-character string identifiers with the following properties:
 *
 * 1. They're based on timestamp so that they sort *after* any existing ids.
 * 2. They contain 72-bits of random data after the timestamp so that IDs won't collide with other clients' IDs.
 * 3. They sort *lexicographically* (so the timestamp is converted to characters that will sort properly).
 * 4. They're monotonically increasing.  Even if you generate more than one in the same timestamp, the
 *    latter ones will sort after the former ones.  We do this by using the previous random bits
 *    but "incrementing" them by 1 (only in the case of a timestamp collision).
 */

// Modeled after base64 web-safe chars, but ordered by ASCII.
var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

// Timestamp of last push, used to prevent local collisions if you push twice in one ms.
var lastPushTime = 0;

// We generate 72-bits of randomness which get turned into 12 characters and appended to the
// timestamp to prevent collisions with other clients.  We store the last characters we
// generated because in the event of a collision, we'll use those same characters except
// "incremented" by one.
var lastRandChars = <number[]>[];

export function generatePushID(): string {
  var now = new Date().getTime();
  var duplicateTime = (now === lastPushTime);
  lastPushTime = now;

  var timeStampChars = new Array(8);
  for (var i = 7; i >= 0; i--) {
    timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
    // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
    now = Math.floor(now / 64);
  }
  if (now !== 0) {
    throw new Error('We should have converted the entire timestamp.');
  }

  var id = timeStampChars.join('');

  if (!duplicateTime) {
    for (i = 0; i < 12; i++) {
      lastRandChars[i] = Math.floor(Math.random() * 64);
    }
  } else {
    // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
    for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
      lastRandChars[i] = 0;
    }
    lastRandChars[i]++;
  }
  for (i = 0; i < 12; i++) {
    id += PUSH_CHARS.charAt(lastRandChars[i]);
  }
  if (id.length !== 20) {
    throw new Error('Length should be 20.');
  }

  return id;
}
