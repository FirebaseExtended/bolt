"use strict";
var Promise = require('promise');
var https = require('https');
var util = require('./util');
var querystring = require('querystring');
var uuid = require('node-uuid');
var firebase = require('firebase');
var FIREBASE_HOST = 'firebaseio.com';
var DEBUG_HEADER = 'x-firebase-auth-debug';
exports.RULES_LOCATION = '/.settings/rules';
exports.TIMESTAMP = { ".sv": "timestamp" };
function Client(appName, secret) {
    this.appName = appName;
    this.secret = secret;
}
exports.Client = Client;
util.methods(Client, {
    setDebug: function (debug) {
        if (debug === undefined) {
            debug = true;
        }
        this.debug = debug;
        return this;
    },
    get: function (location) {
        return this.request({ method: 'GET' }, location);
    },
    put: function (location, content) {
        return this.request({ method: 'PUT', print: 'silent' }, location, content);
    },
    request: function (opt, path, content) {
        var options = {
            hostname: this.appName + '.' + FIREBASE_HOST,
            path: path + '.json',
            method: opt.method
        };
        var query = {};
        if (opt.print) {
            query.print = opt.print;
        }
        query.auth = this.secret;
        if (Object.keys(query).length > 0) {
            options.path += '?' + querystring.stringify(query);
        }
        content = util.prettyJSON(content);
        return request(options, content, this.debug)
            .then(function (body) {
            return body === '' ? null : JSON.parse(body);
        });
    }
});
var ridNext = 0;
function request(options, content, debug) {
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
    return new Promise(function (resolve, reject) {
        var req = https.request(options, function (res) {
            var chunks = [];
            res.on('data', function (body) {
                chunks.push(body);
            });
            res.on('end', function () {
                var result = chunks.join('');
                log("Result (" + res.statusCode + "): '" + result + "'");
                if (Math.floor(res.statusCode / 100) !== 2) {
                    var message = "Status = " + res.statusCode + " " + result;
                    if (res.headers[DEBUG_HEADER]) {
                        var formattedHeader = res.headers[DEBUG_HEADER].split(' /').join('\n  /');
                        log(formattedHeader);
                        message += "\n" + formattedHeader;
                    }
                    reject(new Error(message));
                }
                else {
                    resolve(result);
                }
            });
        });
        if (content) {
            req.write(content, 'utf8');
        }
        req.end();
        req.on('error', function (error) {
            log("Request error: " + error);
            reject(error);
        });
    });
}
function createFirebaseDbRefForUser(username) {
    var uid = uuid.v4();
    var fbClient;
    if (username === 'anon') {
        fbClient = firebase.initializeApp({
            databaseURL: "https://maintestapp.firebaseio.com/"
        }, uid);
    }
    else {
        fbClient = firebase.initializeApp({
            databaseURL: "https://maintestapp.firebaseio.com/",
            serviceAccount: "./serviceAccountCredentials.json",
            databaseAuthVariableOverride: {
                uid: uid
            }
        }, uid);
    }
    fbClient.uid = uid;
    return fbClient;
}
exports.createFirebaseDbRefForUser = createFirebaseDbRefForUser;

//# sourceMappingURL=data:application/json;base64,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QUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxvQ0FBMkMsUUFBUTtJQUNqRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7SUFFcEIsSUFBSSxRQUFRLENBQUU7SUFDZCxFQUFFLENBQUEsQ0FBQyxRQUFRLEtBQUksTUFBTSxDQUFDLENBQUEsQ0FBQztRQUNyQixRQUFRLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUNoQyxXQUFXLEVBQUUscUNBQXFDO1NBQ25ELEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDVixDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFFTixRQUFRLEdBQUcsUUFBUSxDQUFDLGFBQWEsQ0FBQztZQUM5QixXQUFXLEVBQUUscUNBQXFDO1lBQ2xELGNBQWMsRUFBRSxrQ0FBa0M7WUFDbEQsNEJBQTRCLEVBQUU7Z0JBQzVCLEdBQUcsRUFBRSxHQUFHO2FBQ1Q7U0FDRixFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRVYsQ0FBQztJQUNELFFBQVEsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO0lBQ3BCLE1BQU0sQ0FBQyxRQUFRLENBQUM7QUFDbkIsQ0FBQztBQXJCZSxrQ0FBMEIsNkJBcUJ6QyxDQUFBIiwiZmlsZSI6ImZpcmViYXNlLXJlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBGaXJlYmFzZSBoZWxwZXIgZnVuY3Rpb25zIGZvciBSRVNUIEFQSSAodXNpbmcgUHJvbWlzZXMpLlxyXG4gKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ0eXBpbmdzL25vZGUuZC50c1wiIC8+XHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ0eXBpbmdzL2VzNi1wcm9taXNlLmQudHNcIiAvPlxyXG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwidHlwaW5ncy9ub2RlLXV1aWQuZC50c1wiIC8+XHJcblxyXG4vLyBUT0RPOiBGaXJlYmFzZSAzLjAgdHNkIHVwZ3JhZGUsIGRvZXNuJ3QgYXBwZWFyIHRvIGJlIGFuIGlzc3VlIGhlcmUuXHJcbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCJ0eXBpbmdzL2ZpcmViYXNlLmQudHNcIiAvPlxyXG5cclxuaW1wb3J0IFByb21pc2UgPSByZXF1aXJlKCdwcm9taXNlJyk7XHJcbmltcG9ydCBodHRwcyA9IHJlcXVpcmUoJ2h0dHBzJyk7XHJcbmltcG9ydCBodHRwID0gcmVxdWlyZSgnaHR0cCcpO1xyXG5pbXBvcnQgdXRpbCA9IHJlcXVpcmUoJy4vdXRpbCcpO1xyXG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xyXG5pbXBvcnQgdXVpZCA9IHJlcXVpcmUoJ25vZGUtdXVpZCcpO1xyXG5cclxudmFyIGZpcmViYXNlID0gcmVxdWlyZSgnZmlyZWJhc2UnKTtcclxuXHJcbnZhciBGSVJFQkFTRV9IT1NUID0gJ2ZpcmViYXNlaW8uY29tJztcclxudmFyIERFQlVHX0hFQURFUiA9ICd4LWZpcmViYXNlLWF1dGgtZGVidWcnO1xyXG5cclxuZXhwb3J0IHZhciBSVUxFU19MT0NBVElPTiA9ICAnLy5zZXR0aW5ncy9ydWxlcyc7XHJcbmV4cG9ydCB2YXIgVElNRVNUQU1QID0ge1wiLnN2XCI6IFwidGltZXN0YW1wXCJ9O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIENsaWVudChhcHBOYW1lLCBzZWNyZXQpIHtcclxuICB0aGlzLmFwcE5hbWUgPSBhcHBOYW1lO1xyXG4gIHRoaXMuc2VjcmV0ID0gc2VjcmV0O1xyXG59XHJcblxyXG51dGlsLm1ldGhvZHMoQ2xpZW50LCB7XHJcbiAgc2V0RGVidWc6IGZ1bmN0aW9uKGRlYnVnKSB7XHJcbiAgICBpZiAoZGVidWcgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBkZWJ1ZyA9IHRydWU7XHJcbiAgICB9XHJcbiAgICB0aGlzLmRlYnVnID0gZGVidWc7XHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9LFxyXG5cclxuICBnZXQ6IGZ1bmN0aW9uKGxvY2F0aW9uKSB7XHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHttZXRob2Q6ICdHRVQnfSwgbG9jYXRpb24pO1xyXG4gIH0sXHJcblxyXG4gIHB1dDogZnVuY3Rpb24obG9jYXRpb24sIGNvbnRlbnQpIHtcclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qoe21ldGhvZDogJ1BVVCcsIHByaW50OiAnc2lsZW50J30sIGxvY2F0aW9uLCBjb250ZW50KTtcclxuICB9LFxyXG5cclxuICByZXF1ZXN0OiBmdW5jdGlvbihvcHQsIHBhdGgsIGNvbnRlbnQpIHtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICBob3N0bmFtZTogdGhpcy5hcHBOYW1lICsgJy4nICsgRklSRUJBU0VfSE9TVCxcclxuICAgICAgcGF0aDogcGF0aCArICcuanNvbicsXHJcbiAgICAgIG1ldGhvZDogb3B0Lm1ldGhvZCxcclxuICAgIH07XHJcblxyXG4gICAgdmFyIHF1ZXJ5OiBhbnkgPSB7fTtcclxuICAgIGlmIChvcHQucHJpbnQpIHtcclxuICAgICAgcXVlcnkucHJpbnQgPSBvcHQucHJpbnQ7XHJcbiAgICB9XHJcblxyXG4gICAgcXVlcnkuYXV0aCA9IHRoaXMuc2VjcmV0O1xyXG5cclxuICAgIGlmIChPYmplY3Qua2V5cyhxdWVyeSkubGVuZ3RoID4gMCkge1xyXG4gICAgICBvcHRpb25zLnBhdGggKz0gJz8nICsgcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuICAgIH1cclxuXHJcbiAgICBjb250ZW50ID0gdXRpbC5wcmV0dHlKU09OKGNvbnRlbnQpO1xyXG5cclxuICAgIHJldHVybiByZXF1ZXN0KG9wdGlvbnMsIGNvbnRlbnQsIHRoaXMuZGVidWcpXHJcbiAgICAgIC50aGVuKGZ1bmN0aW9uKGJvZHkpIHtcclxuICAgICAgICByZXR1cm4gYm9keSA9PT0gJycgPyBudWxsIDogSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG59KTtcclxuXHJcbnZhciByaWROZXh0ID0gMDtcclxuXHJcbmZ1bmN0aW9uIHJlcXVlc3Qob3B0aW9ucywgY29udGVudCwgZGVidWcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gIHJpZE5leHQgKz0gMTtcclxuICB2YXIgcmlkID0gcmlkTmV4dDtcclxuXHJcbiAgZnVuY3Rpb24gbG9nKHMpIHtcclxuICAgIGlmIChkZWJ1Zykge1xyXG4gICAgICBjb25zb2xlLmxvZyhcIlJlcXVlc3Q8XCIgKyByaWQgKyBcIj46IFwiICsgcyk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBsb2coXCJSZXF1ZXN0OiBcIiArIHV0aWwucHJldHR5SlNPTihvcHRpb25zKSk7XHJcbiAgaWYgKGNvbnRlbnQpIHtcclxuICAgIGxvZyhcIkJvZHk6ICdcIiArIGNvbnRlbnQgKyBcIidcIik7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24ocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAvLyBUT0RPOiBXaHkgaXNuJ3QgdGhpcyBhcmd1bWVudCB0eXBlZCBhcyBwZXIgaHR0cHMucmVxdWVzdD9cclxuICAgIHZhciByZXEgPSBodHRwcy5yZXF1ZXN0KG9wdGlvbnMsIGZ1bmN0aW9uKHJlczogaHR0cC5DbGllbnRSZXNwb25zZSkge1xyXG4gICAgICB2YXIgY2h1bmtzID0gW107XHJcblxyXG4gICAgICByZXMub24oJ2RhdGEnLCBmdW5jdGlvbihib2R5KSB7XHJcbiAgICAgICAgY2h1bmtzLnB1c2goYm9keSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgcmVzLm9uKCdlbmQnLCBmdW5jdGlvbigpIHtcclxuICAgICAgICB2YXIgcmVzdWx0OiBzdHJpbmcgPSBjaHVua3Muam9pbignJyk7XHJcbiAgICAgICAgbG9nKFwiUmVzdWx0IChcIiArIHJlcy5zdGF0dXNDb2RlICsgXCIpOiAnXCIgKyByZXN1bHQgKyBcIidcIik7XHJcbiAgICAgICAgaWYgKE1hdGguZmxvb3IocmVzLnN0YXR1c0NvZGUgLyAxMDApICE9PSAyKSB7XHJcbiAgICAgICAgICBsZXQgbWVzc2FnZSA9IFwiU3RhdHVzID0gXCIgKyByZXMuc3RhdHVzQ29kZSArIFwiIFwiICsgcmVzdWx0O1xyXG4gICAgICAgICAgaWYgKHJlcy5oZWFkZXJzW0RFQlVHX0hFQURFUl0pIHtcclxuICAgICAgICAgICAgbGV0IGZvcm1hdHRlZEhlYWRlciA9IHJlcy5oZWFkZXJzW0RFQlVHX0hFQURFUl0uc3BsaXQoJyAvJykuam9pbignXFxuICAvJyk7XHJcbiAgICAgICAgICAgIGxvZyhmb3JtYXR0ZWRIZWFkZXIpO1xyXG4gICAgICAgICAgICBtZXNzYWdlICs9IFwiXFxuXCIgKyBmb3JtYXR0ZWRIZWFkZXI7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZWplY3QobmV3IEVycm9yKG1lc3NhZ2UpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBpZiAoY29udGVudCkge1xyXG4gICAgICByZXEud3JpdGUoY29udGVudCwgJ3V0ZjgnKTtcclxuICAgIH1cclxuICAgIHJlcS5lbmQoKTtcclxuXHJcbiAgICByZXEub24oJ2Vycm9yJywgZnVuY3Rpb24oZXJyb3IpIHtcclxuICAgICAgbG9nKFwiUmVxdWVzdCBlcnJvcjogXCIgKyBlcnJvcik7XHJcbiAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpcmViYXNlRGJSZWZGb3JVc2VyKHVzZXJuYW1lKSB7XHJcbiAgdmFyIHVpZCA9IHV1aWQudjQoKTtcclxuICAvL3ZhciBjZXJ0ID0gcmVxdWlyZSgnLi4vc2VydmljZUFjY291bnRDcmVkZW50aWFscy5qc29uJyk7XHJcbiAgdmFyIGZiQ2xpZW50IDtcclxuICBpZih1c2VybmFtZSA9PT0nYW5vbicpe1xyXG4gICAgZmJDbGllbnQgPSBmaXJlYmFzZS5pbml0aWFsaXplQXBwKHtcclxuICAgICAgZGF0YWJhc2VVUkw6IFwiaHR0cHM6Ly9tYWludGVzdGFwcC5maXJlYmFzZWlvLmNvbS9cIlxyXG4gICAgfSwgdWlkKTtcclxuICB9IGVsc2Uge1xyXG5cclxuICAgIGZiQ2xpZW50ID0gZmlyZWJhc2UuaW5pdGlhbGl6ZUFwcCh7XHJcbiAgICAgICAgZGF0YWJhc2VVUkw6IFwiaHR0cHM6Ly9tYWludGVzdGFwcC5maXJlYmFzZWlvLmNvbS9cIixcclxuICAgICAgICBzZXJ2aWNlQWNjb3VudDogXCIuL3NlcnZpY2VBY2NvdW50Q3JlZGVudGlhbHMuanNvblwiLFxyXG4gICAgICAgIGRhdGFiYXNlQXV0aFZhcmlhYmxlT3ZlcnJpZGU6IHtcclxuICAgICAgICAgIHVpZDogdWlkXHJcbiAgICAgICAgfVxyXG4gICAgICB9LCB1aWQpO1xyXG5cclxuICAgIH1cclxuICAgIGZiQ2xpZW50LnVpZCA9IHVpZDtcclxuICAgcmV0dXJuIGZiQ2xpZW50O1xyXG59XHJcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==