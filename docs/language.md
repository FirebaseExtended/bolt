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

    [path] /path/to/data [is Type] {
      read() {
        return <true-iff-reading-this-location-is-allowed>;
      }

      write() {
        return <true-iff-writing-this-location-is-allowed>;
      }

      validate() {
        return <additional-validation-of-path-keys-here>
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

If a path has no body the following form can be used:

    path /top/$wildcard/$id is Type;

or

    /top/$wildcard/$id is Type;

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

    String  - Stings
    Number  - Integer or floating point
    Boolean - Values true or false
    Object  - A structured object containing named properties.
    Null    - Value null (same as absence of a value, or deleted)
    Any     - Matches any of the other types.
    Array   - Sequence of values.

## String methods

The following methods can be used on string (static valued or strings stored
in the database):

    s.length            - Number of characters in the string.
    s.includes(sub)     - Returns true iff sub is a substring of s.
    s.startsWith(sub)   - Returns true iff sub is a prefix of s.
    s.endsWith(sub)     - Returns true iff sub is a suffix of s.
    s.replace(old, new) - Replaces all occurancs of ole ins s with new.
    s.toLowerCase()     - Returns an all lower case version of s.
    s.toUpperCase()     - Returns an all upper case version of s.
    s.test(regexp)      - Returns true iff the string matches the regular expression.
                          Note that, in Bolt, the regexp is quoted inside a string value
                          (e.g., '/test/i').

[Regular Expression Syntax](https://www.firebase.com/docs/security/api/string/matches.html)

## Location reference methods

    `ref.parent()`        - Returns the database location of the parent of the given
                            location (e.g., ref.prop.parent() is the same as ref).

# Global variables

You can also use:

    root - The root of your Firebase database.
    auth - The current auth state (if auth != null the user is authenticated and his
           (opaque string) user-id is auth.uid).
    now -  The (Unix) timestamp of the current time (a Number).

# Functions

Functions must be simple return expressions with zero or more parameters.  All of the following
examples are identical and can be used interchangably.

    function myFunction(arg1, arg2) {
      return arg1 == arg2.value;
    }

    function myFunction(arg1, arg2) { arg1 == arg2.value }

    myFunction(arg1, arg2) = arg1 == arg2.value;

Similarly, methods in path and type statements can use the abbreviated functional form (all
these are equivalent):

    write() { return this.user == auth.uid; }
    write() { this.user == auth.uid }
    write() = this.user == auth.uid;

# Expressions

Rule expressions are a subset of JavaScript expressions, and include:

  - Unary operators: - (minus), ! (boolean negation)
  - Binary operators: +, -, *, /, %

References to data locations (starting with `this` or `root`) can be further qualified
using the . and [] operators (just as in JavaScript Object references).

    this.prop  - Refers to property of the current location named 'prop'.
    this[prop] - Refers to a property of the current location named with the value of the
                (string) variable, prop.

To reference the previous value of a property (in a write() or validate() rule), wrap
the reference in a `prior()` function:

    prior(this) - Value of `this` before the write is completed.
    prior(this.prop) - Value of a property before the write is completed.

You can also use `prior()` to wrap any expressions (including function calls) that
use `this`.

# Apendix A. Firebase Expressions and their Bolt equivalents.

The special [Security and Rules API](https://www.firebase.com/docs/security/api/) in Firebase is
not identical in Bolt.  This section demonstrates how equivalent behavior is achieved in Bolt.

## Rules

API | Bolt Equivalent
----| ---------------
".read" : "exp" | read() { return exp; }
".write" : "exp" | write() { return exp; }
".validate": "exp" | validate() { return exp; }
".indexOn": [ "prop", ...] | index() { return [ "prop", ... ] }

## Variables

API | Bolt Equivalent
----| ---------------
auth | auth
$location | $location (in path statement)
now | NYI
data | prior(this)
newData | this (in validate() and write() rules)

## RuleDataSnapshot Methods

API | Bolt Equivalent
----| ---------------
ref.val() | Implicit.  Just use ref in an expression (e.g., ref > 0).
ref.child('prop') | ref.prop
ref.child(exp) | ref[exp]
ref.parent() | ref.parent()
ref.hasChild(prop) | ref.prop != null
ref.hasChildren | implicit using "path is Type"
ref.exists | ref != null
ref.getPriority | Not Supported
ref.isNumber | prop: Number
ref.isString | prop: String
ref.isBoolean | prop: Boolean

## String Methods

API | Bolt Equivalent
----| ---------------
s.length | s.length
s.contains(sub) | s.includes(sub)
s.beginsWith(sub) | s.startsWith(sub)
s.endsWith(sub) | s.endsWith(sub)
s.replace(old, new) | s.replace(old, new)
s.matches(/reg/) | s.test('/reg/')
