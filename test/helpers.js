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
