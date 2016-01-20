# Firebase Bolt Security and Modeling Language

This language is meant to be used as a convenient front-end to the existing
Firebase JSON-based rules language.

# File Structure

A bolt file consists of 3 types of statements:

  - Types: Definition of an object schema.
  - Paths: Definition of storage locations, and what type of accesses are allowed there.
  - Functions: Global function expressions which can be called from other expressions
    to be used as helpers.

A bolt file can also contain JavaScript-style comments:

```javascript
// Single line comment

/* Multi
   line
   comment
*/
```

# Types

A (user-defined) type statement describes a value that can be stored in the Firebase database.

```javascript
type MyType [extends BaseType] {
  property1: Type,
  property2: Type,
  ...

  validate() { <validation expression> }
  }
}
```

If the `validate` expression is `false`, then the value is deemed to be invalid and cannot
be saved to the database (an error will be returned to the Firebase client).

Within the `validate` expression, the special value `this` references the object
of type, `MyType`. Properties of `MyType` can be referenced in expressions like
`this.property1`.

Types can extend other types by using the `extends` clause. If not given,
`Object` is assumed when `MyType` has child properties (or `Any` if it does not).  Types
which extend an Object, can add additional properties to the Object, in addition to
a `validate` expression.

Property names in type statements should be valid Identifiers (see below).  If you need
to use any other character in a property name, you can enclose them in quotes (note
that Firebase allows any character in a path *except* for `.`, `$`, `#`, `[`, `[`, `/`,
or control characters).

Built-in base types are also similar to JavaScript types:

    String            - Character strings
    Number            - Integer or floating point
    Boolean           - Values `true` or `false`
    Object            - A structured object containing named properties.
    Any               - Every non-null value is of type Any.
    Null              - Value `null` (same as absence of a value, or deleted)
    Map<Key, Value>   - A generic type - maps string valued keys to corresponding
                        values (similar to an Object type).
    Type[]            - An "array-like" type (actually same as Map<String, Type>
                        where Type can be any other built-in or user-defined type.

Any of the built-in scalar types can be _extended_ by adding a validation expression, e.g.:

```javascript
type ShortString extends String {
  validate() { this.length < 32 }
}

type Percentage extends Number {
  validate() { this >=0 && this <= 100 }
}
```

Notes:

- Object types are required to have at least one property when present.
- Map types can be empty collections (they need not contain any child keys).

## Type Expressions

Any place a Type can be used, it can be replaced with a Type expression.  We support
three types of type expressions:

### Union Types

    Type1 | Type2    - Value can be either of two types.
    Type | Null      - An optional `Type` value (value can be deleted or missing).


### Map Types (Collections)

A Map type is a built-in Generic Type (see below).  It is used to specify collections
within a model:

```javascript
type Model {
  users: Map<String, User>,
  products: Map<ProductID, Product>
}

type ProductID extends String {
  validate() { this.length <= 20 }
}
```

As a shortcut for the common `Map<String, Type>`, "array-like" notation can be used:

```javascript
type Model {
  users: User[],
  products: Product[]
}
```

### Generic Types

A generic type is like a "type macro" - it is used to specify a type generically,
but then make it specific to a particular use case:

```javascript
type Pair<X, Y> {
  first: X,
  second: Y
}
```

Note that the types of the `first` and `second` properties uses the placeholder types,
`X` and `Y`.  Using a generic type is much like a function call - except using `<...>` instead
of `(...)`:

```javascript
type Model {
  name: String,
  prop: Pair<Number, String>;
}
```

# Paths

A path statement provides access and validation rules for data stored at a given path.

```javascript
path /path/to/data [is Type] {
  read() { <true-iff-reading-this-path-is-allowed> }

  write() { <true-iff-writing-this-path-is-allowed> }

  validate() { <additional-validation-rules> }
}
```

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
templates can include _captured_ parts whose values can then be used within
an expression as a variable parameter:

```javascript
path /users/{uid} is User {
  // Anyone can read a User's information.
  read() { true }

  // Only an authenticated user can write their information.
  write() { auth != null && auth.uid == uid }
}
```

If a path needs no expressions, the following abbreviated form (without a body)
can be used:

    path /users/{uid} is User;

and the `path` keyword can also be omitted.

    /users/{uid} is User;

## Write Aliases

A common pattern is to have distinct rules for allowing writes to a location that represent,
new object creation (create), modification of existing data (update), or deleting data (delete).
Bolt allows you to use these methods in lieu of the write() method in any path or type
statement.

Alias            | Write Equivalent
-----------------| ----------------
create() { exp } | write() { prior(this) == null && exp }
update() { exp } | write() { prior(this) != null && this != null && exp }
delete() { exp } | write() { prior(this) != null && this == null && exp }

If you use any of create(), update(), or delete(), you may not use a write() method in your
path or type statement.


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

`prior()` can be used to wrap any expressions (including function calls) that
use `this`.

The parent key of the current location can be read using the key() function.

    key()               - The (text) value of the inner-most parent property of the current location.

This can be used to create a validation expression that relates the key used to store a value
and one of its properties:

```javascript
path /products is Product[];

type Product {
  validate() { this.id == key() }

  id: String,
  name: String
}

```


# Functions and Methods

Functions must be simple return expressions with zero or more parameters.  All of the following
examples are identical and can be used interchangably.

```javascript
function isUser(uid) {
  return auth != null && auth.uid == uid;
}

function isUser(uid) { auth != null && auth.uid == uid }

isUser(uid) { auth != null && auth.uid == uid }
```

Similarly, methods in path and type statements can use the abbreviated functional form (all
these are equivalent):

```javascript
write() { return this.user == auth.uid; }
write() { this.user == auth.uid; }
write() { this.user == auth.uid }
```

# Identifiers

Identifiers in expressions, property names, and path captured parts, must begin with one of
alphabetic, _ or $ characters and can contain any alphabetic, numeric, _ or $.

# Expressions

Rule expressions are a subset of JavaScript expressions, and include:

  - Unary operators: - (minus), ! (boolean negation)
  - Binary operators: +, -, *, /, %
  - String constants can be expressed using single or double quotes and can
    include Hex escape characters (\xXX), Unicode escape characters (\uXXXX)
    or special escape characters \b, \f, \n, \r, or \t.

# Global variables

These global variables are available in expressions:

    root - The root location of a Firebase database.
    auth - The current auth state (if auth != null the user is authenticated, and auth.uid
           is their user identifier string).
    now -  The (Unix) timestamp of the current time (a Number).

# Appendix A. Firebase Expressions and their Bolt equivalents.

The special [Security and Rules API](https://www.firebase.com/docs/security/api/) in Firebase is
not identical in Bolt.  This section demonstrates how equivalent behavior is achieved in Bolt.

## Rules

API | Bolt Equivalent
----| ---------------
".read" : "exp" | read() { exp }
".write" : "exp" | write() { exp }
".validate": "exp" | validate() { exp }
".indexOn": [ "prop", ...] | index() { [ "prop", ... ] }

## Variables

API | Bolt Equivalent
----| ---------------
auth | auth
$location | {location} (in path statement)
now | now
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
s.matches(/reg/) | s.test(/reg/)
