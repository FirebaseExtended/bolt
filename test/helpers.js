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
 *  distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
namespace.module('firebase.test.helpers', function(exports, require) {
  // For eslint
  require;

  exports.extend({
    'readURL': readURL
  });

  function readURL(url) {
    return new Promise(function(resolve, reject) {
      var req = new XMLHttpRequest();

      req.open('GET', url);

      req.onload = function() {
        if (req.status == 200) {
          resolve({content: req.responseText, url: url});
        } else {
          reject(new Error(url + " " + req.statusText));
        }
      };

      req.onerror = function() {
        reject(new Error(url + " Network Error"));
      };

      req.send();
    });
  }
});
