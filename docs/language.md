# Firebase Security and Modeling Language

This experimental Security and Rules language is meant to be used a
convenient front-end to the existing Firebase JSON-based rules language.

It has similarities to the [Blaze Compiler](https://github.com/firebase/blaze_compiler)
but diverges in some respects:

  - This compiler uses a syntax much more like JavaScript rather than relying on YAML
    as the primary structuring mechanism for statements.
  - Schema definitions are similar to [TypeScript syntax](http://www.typescriptlang.org/Handbook#classes).
  - Schema are divorced from their storage path locations - you can specify, and name, any object
    type, and then employ that definition in a path rule (called access rule in Blaze).

# File Structure

A bolt file consists of a sequence of 3 types of statements:

  - Types: Definition of an object schema.
  - Paths: Definition of storage locations, and what type of accesses are allowed there.
  - Functions: Global function expressions which can be called from other expressions
    to be used as helpers.

A bolt file can also contain JavaScript-style comments:

    // Single line comment

    /* Multi
       line
       comment
    */

# Paths

A path statement provides access and validation rules for data stored at a given path.

    path /path/to/data [is Type] {
      read() {
        return <true-iff-reading-this-location-is-allowed>;
      }

      write() {
        return <true-iff-writing-this-location-is-allowed>;
      }
    }

If a Type is not given, `Any` is assumed.

Path statements can also include wildcards parts whose values can then be used
within an expression as a variable parameter.

    path /top/$wildcard/$id is Type {
      write() {
        return $wildcard < "Z" && $id > 7;
      }
    }

In expressions, the value of `this` is either the current value to `read()` or the new value to `write()`.

# Types

    type TypeName [extends BaseType] {
      property1: PropertyType,
      property2: AnotherPropertyType,
      ...

      validate() {
        return <validation expression>;
      }
    }

The value of `this` is the object of type TypeName (so properties can be referenced
in expressions as `this.property`).

If a BaseType is not given, `Object` is assumed if the TypeName has child properties
(`Any` if not).

Built in base types are also similar to JavaScript types:

    String  -
    Number  - integer or floating point
    Boolean - true or false
    Object  - A structured object containing named properties.
    Null    - null (absence of a value, or deleted)
    Any     - Matches any of the other types.

# Global variables

You can also use:

    data - The value at a location BEFORE a write is done.
    root - The root of your Firebase database.

# Functions

Functions must be simple return expressions with zero or more parameters.

    function myFunction(arg1, arg2) {
      return arg1 == arg2.value;
    }

# Expressions

Rule expressions are a subset of JavaScript expressions, and include:

  - Unary operators: - (minus), ! (boolean negation)
  - Binary operators: +, -, *, /, %

References to data locations (starting with `this`, `data`, or `root`) can be further qualified
using the . and [] operators (just as in JavaScript Object references).

    this.prop  - Refers to property of the current location named 'prop'.
    this[prop] - Refers to a property of the current location named with the value of the
                (string) variable, prop.
