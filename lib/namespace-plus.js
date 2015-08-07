/* Source: src/namespace.js */
/* Namespace.js - modular namespaces in JavaScript

   by Mike Koss - placed in the public domain
*/

(function(global) {
  var globalNamespace = global['namespace'];
  var VERSION = '3.0.1';

  function Module() {}

  function numeric(s) {
    if (!s) {
      return 0;
    }
    var a = s.split('.');
    return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
  }

  if (globalNamespace) {
    if (numeric(VERSION) <= numeric(globalNamespace['VERSION'])) {
      return;
    }
    Module = globalNamespace.constructor;
  } else {
    global['namespace'] = globalNamespace = new Module();
  }
  globalNamespace['VERSION'] = VERSION;

  function require(path) {
    path = path.replace(/-/g, '_');
    var parts = path.split('.');
    var ns = globalNamespace;
    for (var i = 0; i < parts.length; i++) {
      if (ns[parts[i]] === undefined) {
        ns[parts[i]] = new Module();
      }
      ns = ns[parts[i]];
    }
    return ns;
  }

  var proto = Module.prototype;

  proto['module'] = function(path, closure) {
    var exports = require(path);
    if (closure) {
      closure(exports, require);
    }
    return exports;
  };

  proto['extend'] = function(exports) {
    for (var sym in exports) {
      if (exports.hasOwnProperty(sym)) {
        this[sym] = exports[sym];
      }
    }
  };
}(this));
/* Source: src/types.js */
namespace.module('namespace.types', function (exports, require) {
  exports.extend({
    'VERSION': '0.2.2',
    'isArguments': function (value) { return isType(value, 'arguments'); },
    'isArray': function (value) { return isType(value, 'array'); },
    'copyArray': copyArray,
    'isType': isType,
    'typeOf': typeOf,
    'extend': extend,
    'project': project,
    'getFunctionName': getFunctionName,
    'keys': Object.keys || keys,
    'patch': patch
  });

  function patch() {
    Object.keys = Object.keys || keys;  // JavaScript 1.8.5
    return exports;
  }

  // Can be used to copy Arrays and Arguments into an Array
  function copyArray(arg) {
    return Array.prototype.slice.call(arg);
  }

  var baseTypes = ['number', 'string', 'boolean', 'array', 'function', 'date',
                   'regexp', 'arguments', 'undefined', 'null'];

  function internalType(value) {
    return Object.prototype.toString.call(value).match(/\[object (.*)\]/)[1].toLowerCase();
  }

  function isType(value, type) {
    return typeOf(value) == type;
  }

  // Return one of the baseTypes as a string
  function typeOf(value) {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    var type = internalType(value);
    if (baseTypes.indexOf(type) == -1) {
      type = typeof(value);
    }
    return type;
  }

  // IE 8 has bug that does not enumerates even own properties that have
  // these internal names.
  var enumBug = !{toString: true}.propertyIsEnumerable('toString');
  var internalNames = ['toString', 'toLocaleString', 'valueOf',
                       'constructor', 'isPrototypeOf'];

  // Copy the (own) properties of all the arguments into the first one (in order).
  function extend(dest) {
    var i, j;
    var source;
    var prop;

    if (dest === undefined) {
      dest = {};
    }
    for (i = 1; i < arguments.length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (source.hasOwnProperty(prop)) {
          dest[prop] = source[prop];
        }
      }
      if (!enumBug) {
        continue;
      }
      for (j = 0; j < internalNames.length; j++) {
        prop = internalNames[j];
        if (source.hasOwnProperty(prop)) {
          dest[prop] = source[prop];
        }
      }
    }
    return dest;
  }

  // Return new object with just the listed properties "projected"
  // into the new object.  Ignore undefined properties.
  function project(obj, props) {
    var result = {};
    if (typeof props == 'string') {
      props = [props];
    }
    for (var i = 0; i < props.length; i++) {
      var name = props[i];
      if (obj && obj.hasOwnProperty(name)) {
        result[name] = obj[name];
      }
    }
    return result;
  }

  function getFunctionName(fn) {
    if (typeof fn != 'function') {
      return undefined;
    }
    var result = fn.toString().match(/function\s*(\S+)\s*\(/);
    if (!result) {
      return '';
    }
    return result[1];
  }

  function keys(obj) {
    var list = [];

    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        list.push(prop);
      }
    }
    return list;
  }
});

/* Source: src/funcs.js */
namespace.module('namespace.funcs', function (exports, require) {
  var types = require('namespace.types');

  exports.extend({
    'VERSION': '0.3.1',
    'methods': methods,
    'bind': bind,
    'decorate': decorate,
    'create': Object.create || create,
    'subclass': subclass,
    'mro': mro,
    'numericVersion': numericVersion,
    'singleton': singleton,
    'monkeyPatch': monkeyPatch,
    'patch': patch
  });

  // Convert 3-part version number to comparable integer.
  // Note: No part should be > 99.
  function numericVersion(s) {
    if (!s) {
      return 0;
    }
    var a = s.split('.');
    return 10000 * parseInt(a[0]) + 100 * parseInt(a[1]) + parseInt(a[2]);
  }

  // Monkey patch additional methods to constructor prototype, but only
  // if patch version is newer than current patch version.
  function monkeyPatch(ctor, by, version, patchMethods) {
    if (ctor._patches) {
      var patchVersion = ctor._patches[by];
      if (numericVersion(patchVersion) >= numericVersion(version)) {
        return;
      }
    }
    ctor._patches = ctor._patches || {};
    ctor._patches[by] = version;
    methods(ctor, patchMethods);
  }

  function patch() {
    if (!Object.create) {
      Object.create = create;
    }

    monkeyPatch(Function, 'namespace.funcs', exports.VERSION, {
      'methods': function (obj) { methods(this, obj); },
      'curry': function () {
        var args = [this, undefined].concat(types.copyArray(arguments));
        return bind.apply(undefined, args);
      },
      'curryThis': function (self) {
        var args = types.copyArray(arguments);
        args.unshift(this);
        return bind.apply(undefined, args);
      },
      'decorate': function (decorator) {
        return decorate(this, decorator);
      },
      'subclass': function(parent, extraMethods) {
        subclass(this, parent, extraMethods);
      },
      'mro': function(ctors, extraMethods) {
        ctors.unshift(this);
        mro(ctors, extraMethods);
      }
    });
    return exports;
  }

  // Copy methods to a Constructor Function's prototype
  function methods(ctor, obj) {
    types.extend(ctor.prototype, obj);
  }

  // Bind 'this' and/or arguments and return new function.
  // Differs from native bind (if present) in that undefined
  // parameters are merged.
  function bind(fn, self) {
    var presets;

    // Handle the monkey-patched and in-line forms of curry
    if (arguments.length == 3 && types.isArguments(arguments[2])) {
      presets = Array.prototype.slice.call(arguments[2], self1);
    } else {
      presets = Array.prototype.slice.call(arguments, 2);
    }

    function merge(a1, a2) {
      var merged = types.copyArray(a1);
      a2 = types.copyArray(a2);
      for (var i = 0; i < merged.length; i++) {
        if (merged[i] === undefined) {
          merged[i] = a2.shift();
        }
      }
      return merged.concat(a2);
    }

    return function curried() {
      return fn.apply(self || this, merge(presets, arguments));
    };
  }

  // Wrap the fn function with a generic decorator like:
  //
  // function decorator(fn, arguments, wrapper) {
  //   if (fn == undefined) { ... init ...; return;}
  //   ...
  //   result = fn.apply(this, arguments);
  //   ...
  //   return result;
  // }
  //
  // The decorated function is created for each call
  // of the decorate function.  In addition to wrapping
  // the decorated function, it can be used to save state
  // information between calls by adding properties to it.
  function decorate(fn, decorator) {
    function decorated() {
      return decorator.call(this, fn, arguments, decorated);
    }
    // Init call - pass undefined fn - but available in this
    // if needed.
    decorator.call(fn, undefined, arguments, decorated);
    return decorated;
  }

  // Create an empty object whose __proto__ points to the given object.
  // It's properties will "shadow" those of the given object until modified.
  function create(obj) {
    function Create() {}
    Create.prototype = obj;
    return new Create();
  }

  // Classical JavaScript single-inheritance pattern.
  // Call super constructor via this._super(args);
  // Call super methods via this._proto.method.call(this, args)
  function subclass(ctor, parent, extraMethods) {
    ctor.prototype = exports.create(parent.prototype);
    ctor.prototype.constructor = ctor;
    methods(ctor, extraMethods);
    return ctor;
  }

  // Define method resolution order for multiple inheritance.
  // Builds a custom prototype chain, where each constructor's
  // prototype appears exactly once.
  function mro(ctors, extraMethods) {
    var parent = ctors.pop().prototype;
    var ctor;
    while (ctors.length > 0) {
      ctor = ctors.pop();
      var ctorName = types.getFunctionName(ctor);
      var proto = exports.create(parent);
      types.extend(proto, ctor.prototype);
      proto.constructor = ctor;
      proto[ctorName + '_super'] = parent;
      parent = proto;
    }
    ctor.prototype = parent;
    methods(ctor, extraMethods);
  }

  // Singleton memo-ization function
  // Returns a function that alway returns the same value.
  function singleton(fn) {
    var result;
    return function (var_args) {
      if (result !== undefined) {
        return result;
      }
      result = fn.apply(undefined, arguments);
      return result;
    }
  }
});

/* Source: src/string.js */
namespace.module('namespace.string', function (exports, require) {
  var funcs = require('namespace.funcs');

  exports.extend({
    'VERSION': '0.3.1',
    'patch': patch,
    'format': format,
    'strip': strip
  });

  function patch() {
    funcs.monkeyPatch(String, 'namespace.string', exports.VERSION, {
      'format': function formatFunction () {
        if (arguments.length == 1 && typeof arguments[0] == 'object') {
          return format(this, arguments[0]);
        } else {
          return format(this, arguments);
        }
      }
    });
    return exports;
  }

  var reFormat = /\{\s*([^} ]+)\s*\}/g;

  // Format a string using values from a dictionary or array.
  // {n} - positional arg (0 based)
  // {key} - object property (first match)
  // .. same as {0.key}
  // {key1.key2.key3} - nested properties of an object
  // keys can be numbers (0-based index into an array) or
  // property names.
  function format(st, args, re) {
    re = re || reFormat;
    if (st == undefined) {
      return "undefined";
    }
    st = st.toString();
    st = st.replace(re, function(whole, key) {
      var value = args;
      var keys = key.split('.');
      for (var i = 0; i < keys.length; i++) {
        key = keys[i];
        var n = parseInt(key);
        if (!isNaN(n)) {
          value = value[n];
        } else {
          value = value[key];
        }
        if (value == undefined) {
          return "";
        }
      }
      // Implicit toString() on this.
      return value;
    });
    return st;
  }

  // Like Python strip() - remove leading/trailing space
  function strip(s) {
    return (s || "").replace(/^\s+|\s+$/g, "");
  }
});
