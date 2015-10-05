# Firebase Bold Security and Modeling Language

This language is meant to be used as a convenient front-end to the existing
Firebase JSON-based rules language.

# File Structure

A bolt file consists of 3 types of statements:

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

# Types

A (user-defined) type statement describes a value that can be stored in the Firebase database.

    type MyType [extends BaseType] {
      property1: Type,
      property2: Type,
      ...

      validate() = <validation expression>;
      }
    }

If the `validate` expression is `false`, then the value is deemed to be invalid and cannot
be saved to the database (an error will be returned to the Firebase client).

Within the `validate` expression, the special value `this` references the object
of type, `MyType`. Properties of `MyType` can be referenced in expressions like
`this.property1`.

Types can extend other types by using the `extends` clause. If not given,
`Object` is assumed when `MyType` has child properties (or `Any` if it does not).  Types
which extend an Object, can add additional properties to the Object, in addition to
a `validate` expression.

Built-in base types are also similar to JavaScript types:

    String  - Stings
    Number  - Integer or floating point
    Boolean - Values true or false
    Object  - A structured object containing named properties.
    Any     - Every non-null value is of type Any.
    Null    - Value null (same as absence of a value, or deleted)

You can _extend_ any of the built-in scalar types by adding a validation expression, e.g.:

    type ShortString extends String {
      validate() = this.length < 32;
    }

    type Percentage extends Number {
      validate() = this >=0 && this <= 100;
    }

## Type Expressions

Any place a Type can be used, it can be replaced with a Type expression.

    Type1 | Type2    - Value can be either of two types.
    Type | Null      - An optional `Type` value (value can be deleted or missing).

# Paths

A path statement provides access and validation rules for data stored at a given path.

    [path] /path/to/data [is Type] {
      read() = <true-iff-reading-this-path-is-allowed>;

      write() = <true-iff-writing-this-path-is-allowed>;

      validate() = <additional-validation-rules>;
    }

If a Type is not given, `Any` is assumed.

In `read` expressions, the value of `this` is the value stored at the path of
type, `Type`.  In `write` and `validate` expressions `this` is the value to be
stored at the path (use the `prior(this)` function to reference the previously stored
value of `this`).

The `read` and `write` expressions are used to determine when users are allowed
to read or modify the data at the given path.  These rules typically test the
value of the global `auth` variable and possibly reference other locations of the
database to determine these permissions.

The `validate` expression can be used to check for additional constraints
(beyond the Type `validate` rules) required to store a value at the given path,
and especially perform constraints that are path-dependent.  Path
statements can include wildcard parts whose values can then be used within
an expression as a variable parameter:

    path /users/$uid is User {
      // Anyone can read a User's information.
      read() = true;

      // Only an authenticated user can write their information.
      write() = auth != null && auth.uid == $uid;
    }

If a path needs no expressions, the following abbreviated form (without a body)
can be used:

    path /users/$uid is User;

or

    /users/$uid is User;

## String methods

The following methods can be used on string (static valued or strings stored
in the database):

    s.length            - Number of characters in the string.
    s.includes(sub)     - Returns true iff sub is a substring of s.
    s.startsWith(sub)   - Returns true iff sub is a prefix of s.
    s.endsWith(sub)     - Returns true iff sub is a suffix of s.
    s.replace(old, new) - Returns a string where all occurances of string, `old`, are
                          replaced by `new`.
    s.toLowerCase()     - Returns an all lower case version of s.
    s.toUpperCase()     - Returns an all upper case version of s.
    s.test(regexp)      - Returns true iff the string matches the regular expression.
                          Note that, in Bolt, the regexp is quoted inside a string value
                          (e.g., '/test/i').

[Regular Expression Syntax](https://www.firebase.com/docs/security/api/string/matches.html)

## Database references

References to data locations (starting with `this` or `root`) can be further qualified
using the `.` and `[]` operators (just as in JavaScript Object references).

    ref.child           - Returns the property `child` of the reference.
    ref[s]              - Return property referenced by the string, variable, `s`.
    ref.parent()        - Returns the parent of the given refererence
                          (e.g., ref.prop.parent() is the same as ref).

To reference the previous value of a property (in a write() or validate() rule), use
the `prior()` function:

    prior(this)         - Value of `this` before the write is completed.
    prior(this.prop)    - Value of a property before the write is completed.

You can also use `prior()` to wrap any expressions (including function calls) that
use `this`.

# Functions and Methods

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

# Global variables

These global variables are available in expressions:

    root - The root of your Firebase database.
    auth - The current auth state (if auth != null the user is authenticated auth.uid
           is their user identifier (a unique string value).
    now -  The (Unix) timestamp of the current time (a Number).

# Appendix A. Firebase Expressions and their Bolt equivalents.

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
ref.hasChildren(props) | implicit using "path is Type"
ref.exists() | ref != null
ref.getPriority() | Not Supported
ref.isNumber() | prop: Number
ref.isString() | prop: String
ref.isBoolean() | prop: Boolean

## String Methods

API | Bolt Equivalent
----| ---------------
s.length | s.length
s.contains(sub) | s.includes(sub)
s.beginsWith(sub) | s.startsWith(sub)
s.endsWith(sub) | s.endsWith(sub)
s.replace(old, new) | s.replace(old, new)
s.matches(/reg/) | s.test('/reg/')
