# Firebase Security and Rules Using the Bolt Compiler

Firebase is secured using a JSON-formatted [Security and
Rules](https://www.firebase.com/docs/security/guide/understanding-security.html) language. It
is a powerful feature of Firebase, but can be error prone to write by hand.

The Bolt compiler helps developers express the schema and authorization rules for their
database using a familiar JavaScript-like language. The complete [language
reference](language.md) describes the syntax. This guide introduces the concepts and
features of Bolt along with a cookbook of common recipies.

# Getting Started

The Firebase Bolt compiler is a command-line based tool, written in node.js. You can install it
using the [Node Package Manager](https://nodejs.org/en/download/):

    $ npm install --global firebase-bolt

You can use the Bolt compiler to compile the examples in this guide, and inspect the output
JSON.

## Default Firebase Permissions

When you first create a Firebase app, you get a default rule set that allows everyone to read
and write all data. This makes it easy to test your code, but is unsafe for production apps
since anyone can read and overwrite any data saved by your app. In Bolt, these default
permissions can be written as:

[all_access.bolt](../samples/all_access.bolt)
```javascript
path / {
  read() { true }
  write() { true }
}
```

The `read() { true }` and `write() { true }` methods allow everyone to read and write this location
(and all children under this location). You can also use more complex expressions instead of
`true`.  When the expression evaluates to `true` the read or write operation is allowed.

Use the Bolt compiler to convert this to Firebase JSON-formatted rules:

    $ firebase-bolt < all_access.bolt

```JSON
{
  "rules": {
    ".read": "true",
    ".write": "true"
  }
}
```

In general, Firebase `read` and `write` expresses grant access to data based on the authentication
state of the user, while `validate` expressions enforce data types and the schema of data
you allow to be saved in the database.

It is important to keep in mind that, unless specified by a read or write expression, no permission
will be granted to your database; a read/write rule will grant access to the data stored
at a path location (and **ALL** its children).  To determine if a location is readable (writable) - you can
look to see if **ANY** of the read (write) expressions at that location or higher evaluate to `true` (i.e.
the effect is a boolean **OR** of all the parent read (write) expressions).

Validatation rules are treated differently - all applicable validation rules at the written
location (and higher) must evaluate to `true` in order for the write to be permitted (i.e., the
effect is a boolean **AND** of all the parent validate expressions).

For a more complete description of the way rules are evaluated, see the [Firebase Security and
Rules Quickstart](https://www.firebase.com/docs/security/quickstart.html).

## How to Use Bolt in Your Application

Bolt is not (yet) integrated into the online [Firebase Security and Rules
Dashboard](https://www.firebase.com/account/). There are two ways to use Bolt to define rules
for your application:

1. Use the firebase-bolt command line tool to generate a JSON file from your Bolt file, and
   then copy and paste the result into the Dashboard _Security and Rules_ section.
2. Use the [Firebase Command Line](https://www.firebase.com/docs/hosting/command-line-tool.html)
   tool.  If you have _firebase-bolt_ installed on your computer, you can set the `rules` property
   in your [firebase.json](https://www.firebase.com/docs/hosting/guide/full-config.html) file
   to the name of your Bolt file.  When you issue the `firebase deploy` command, it will
   read and compile your Bolt file and upload the compiled JSON to your Firebase application.

## Data Validation

The Firebase database is "schemaless" - which means that, unless you specify otherwise, any
type or structure of data can be written anywhere in the database. By specifying a specific
schema, you can catch coding errors early, and prevent malicious programs from writing data
that you don't expect.

Lets say your chat application wants to allow users to write messages to your database. Each
message can be up to 140 characters and must indicate who sent the message. In Bolt, you can
express this using a `type` statement:

_posts.bolt_
```javascript
// Allow anyone to read the list of Posts.
path /posts {
  read() { true }
}

// All individual Posts are writable by anyone.
path /posts/{id} is Post {
  write() { true }
}

type Post {
  validate() { this.message.length <= 140 }

  message: String,
  from: String
}
```

This database allows for a collection of _Posts_ to be stored at the `/posts` path. Each one
must have a unique ID key. Note that a path expression (after the `path` keyword) can contain a
_captured_ component. This matches any string, and the value of the match is available to be
used in expressions, if desired.

For example, writing data at `/posts/123` will match the `path /posts/{id}` statement with the
captured variable `id` being equal to (the string) '123'.

The Post type allows for exactly two string properties in each post (message and
from). It also ensures that no message is longer than 140 characters.

Bolt type statements can contain a `validate()` method (defined as `validate() { <expression> }`,
where the expression evaluates to `true` if the data is valid (can be saved to the
database). When the expression evaluates to `false`, the attempt to write the data will return
an error to the Firebase client and the database will be unmodified.

To access properties of a type in an expression, use the `this` variable  (e.g. `this.message`).

    $ firebase-bolt < posts.bolt

```JSON
{
  "rules": {
    "posts": {
      ".read": "true",
      "$id": {
        ".validate": "newData.hasChildren(['message', 'from']) && newData.child('message').val().length <= 140",
        "message": {
          ".validate": "newData.isString()"
        },
        "from": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": "false"
        },
        ".write": "true"
      }
    }
  }
}
```

Bolt supports the built-in datatypes of `String`, `Number`, `Boolean`, `Object`, `Any`, and
`Null` (`Null` is useful for specifying optional properties):

_person.bolt_
```javascript
path / is Person;

type Person {
  name: String,
  age: Number,
  isMember: Boolean,

  // Optional data (allows an Object or null/missing value).
  extra: Object | Null
}
```

    $ firebase-bolt < person.bolt

```JSON
{
  "rules": {
    ".validate": "newData.hasChildren(['name', 'age', 'isMember'])",
    "name": {
      ".validate": "newData.isString()"
    },
    "age": {
      ".validate": "newData.isNumber()"
    },
    "isMember": {
      ".validate": "newData.isBoolean()"
    },
    "extra": {
      ".validate": "newData.hasChildren() || newData.val() == null"
    },
    "$other": {
      ".validate": "false"
    }
  }
}
```

## Extending Builtin Types

Bolt allows user-defined types to extend the built-in types.  This can make it easier for you
to define a validation expression in one place, and use it in several places.  For example,
suppose we have several places where we use a _NameString_ - and we require that it be a non-empty
string of no more than 32 characters:

```javascript
path /users/{id} is User;
path /rooms/{id} is Room;

type User {
  name: NameString,
  isAdmin: Boolean
}

type Room {
  name: NameString,
  creator: String
}

type NameString extends String {
  validate() { this.length > 0 && this.length <= 32 }
}
```

_NameString_ can be used anywhere the String type can be used - but it adds the additional
validation constraint that it be non-empty and not too long.

_Note that the `this` keyword refers to the value of the string in this case._

This example compiles to:

```JSON
{
  "rules": {
    "users": {
      "$id": {
        ".validate": "newData.hasChildren(['name', 'isAdmin'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 32"
        },
        "isAdmin": {
          ".validate": "newData.isBoolean()"
        },
        "$other": {
          ".validate": "false"
        }
      }
    },
    "rooms": {
      "$id": {
        ".validate": "newData.hasChildren(['name', 'creator'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 32"
        },
        "creator": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": "false"
        }
      }
    }
  }
}
```

## Functions

Bolt also allows you to organize common expressions as top-level functions in a Bolt file.  Function
definitions look just like _type_ and _path_ methods, except they can also accept parameters.

```javascript
path /users/{userid} is User {
  read() { true }
  write() { isCurrentUser(userid) }
}

type User {
  name: String,
  age: Number | Null
}

// Define isCurrentUser() function to test if the given user id
// matches the currently signed-in user.
isCurrentUser(uid) { auth != null && auth.uid == uid }
```

```JSON
{
  "rules": {
    "users": {
      "$userid": {
        ".validate": "newData.hasChildren(['name'])",
        "name": {
          ".validate": "newData.isString()"
        },
        "age": {
          ".validate": "newData.isNumber() || newData.val() == null"
        },
        "$other": {
          ".validate": "false"
        },
        ".read": "true",
        ".write": "auth != null && auth.uid == $userid"
      }
    }
  }
}
```

# Bolt Cookbook

The rest of this guide will provide sample recipes to solve typical problems that developers
face in securing their Firebase databases.

## Dealing with Timestamps

You can write timestamps (Unix time in milliseconds) in Firebase data and ensure that whenever
a time is written, it exactly matches the (trusted) server time (independent of the clock on
the client device).

```javascript
path /posts/{id} is Post;

type Post {
  // Make sure that the only value allowed to be written is now.
  validate() { this.modified == now }

  message: String,
  modified: Number
}
```

Each time the Post is written, modified must be set to the current time (using
[ServerValue.TIMESTAMP](https://www.firebase.com/docs/web/api/servervalue/timestamp.html)).

A handy way to express this is to use a user-defined type for the CurrentTimestamp:

```javascript
path /posts/{id} is Post {
  read() { true }
  write() { true }
}

type Post {
  message: String,
  modified: CurrentTimestamp
}

type CurrentTimestamp extends Number {
  validate() { this == now }
}
```

Similarly, if you want to have a `created` property, it should match the current time
when first written, and never change thereafter:

```javascript
path /posts/{id} is Post {
  read() { true }
  write() { true }
}

type Post {
  message: String,
  modified: CurrentTimestamp,
  created: InitialTimestamp
}

type CurrentTimestamp extends Number {
  validate() { this == now }
}

type InitialTimestamp extends Number {
  validate() { initial(this, now) }
}

// Returns true if the value is intialized to init, or if it retains it's prior
// value, otherwise.
initial(value, init) { value == (prior(value) == null ? init : prior(value)) }
```

Note the special function `prior(ref)` - returns the previous value stored at a given database location
(only to be used in validate() and write() rules).

```JSON
{
  "rules": {
    "posts": {
      "$id": {
        ".validate": "newData.hasChildren(['message', 'modified', 'created'])",
        "message": {
          ".validate": "newData.isString()"
        },
        "modified": {
          ".validate": "newData.isNumber() && newData.val() == now"
        },
        "created": {
          ".validate": "newData.isNumber() && newData.val() == (data.val() == null ? now : data.val())"
        },
        "$other": {
          ".validate": "false"
        },
        ".read": "true",
        ".write": "true"
      }
    }
  }
}
```

## Timestamped Generic (parameterized) Types

Bolt allows types to be parameterized - much like Java Generic types are defined.  An alternate way
to define the Timestamp example above is:

```javascript
// Note the use of Timestamped version of a Post type.
path /posts/{id} is Timestamped<Post> {
  read() { true }
  write() { true }
}

type Post {
  message: String,
}

type Timestamped<T> extends T {
  modified: CurrentTimestamp,
  created: InitialTimestamp
}

type CurrentTimestamp extends Number {
  validate() { this == now }
}

type InitialTimestamp extends Number {
  validate() { initial(this, now) }
}

// Returns true if the value is intialized to init, or retains it's prior
// value, otherwise.
initial(value, init) { value == (prior(value) == null ? init : prior(value)) }
```

```JSON
{
  "rules": {
    "posts": {
      "$id": {
        ".validate": "newData.hasChildren(['message', 'modified', 'created'])",
        "message": {
          ".validate": "newData.isString()"
        },
        "$other": {
          ".validate": "false"
        },
        "modified": {
          ".validate": "newData.isNumber() && newData.val() == now"
        },
        "created": {
          ".validate": "newData.isNumber() && newData.val() == (data.val() == null ? now : data.val())"
        },
        ".read": "true",
        ".write": "true"
      }
    }
  }
}
```

## Authenticated Chat Example

Compare to [JSON Authenticated Chat
Rules](https://www.firebase.com/docs/security/guide/user-security.html#section-revisiting-advanced-example).

```javascript
//
// Room Names
//
path /rooms_names is String[] {
  read() { isSignedIn() }
}

getRoomName(id) { prior(root.room_names[id]) }

//
// Room Members
//
path /members/{room_id} {
  read() { isRoomMember(room_id) }
}

path /members/{room_id}/{user_id} is NameString {
  write() { isCurrentUser(user_id) }
}

isRoomMember(room_id) { isSignedIn() && prior(root.members[room_id][auth.uid]) != null }

//
// Messages
//
path /messages/{room_id} {
  read() { isRoomMember(room_id) }
  validate() { getRoomName(room_id) != null }
}

path /messages/{room_id}/{message_id} is Message {
  write() { createOnly(this) && isRoomMember(room_id) }
}

type Message {
  name: NameString,
  message: MessageString,
  timestamp: CurrentTimestamp,
}

type MessageString extends String {
  validate() { this.length > 0 && this.length < 50 }
}

//
// Helper Types
//
type CurrentTimestamp extends Number {
  validate() { this == now }
}

type NameString {
  validate() { this.length > 0 && this.length < 20 }
}

//
// Helper Functions
//
isCurrentUser(uid) { isSignedIn() && auth.uid == uid }
isSignedIn() { auth != null }
createOnly(value) { prior(value) == null && value != null }
```

```JSON
{
  "rules": {
    "rooms_names": {
      "$key1": {
        ".validate": "newData.isString()"
      },
      ".read": "auth != null"
    },
    "members": {
      "$room_id": {
        ".read": "auth != null && root.child('members').child($room_id).child(auth.uid).val() != null",
        "$user_id": {
          ".validate": "newData.val().length > 0 && newData.val().length < 20",
          ".write": "auth != null && auth.uid == $user_id"
        }
      }
    },
    "messages": {
      "$room_id": {
        ".validate": "root.child('room_names').child($room_id).val() != null",
        ".read": "auth != null && root.child('members').child($room_id).child(auth.uid).val() != null",
        "$message_id": {
          ".validate": "newData.hasChildren(['name', 'message', 'timestamp'])",
          "name": {
            ".validate": "newData.val().length > 0 && newData.val().length < 20"
          },
          "message": {
            ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length < 50"
          },
          "timestamp": {
            ".validate": "newData.isNumber() && newData.val() == now"
          },
          "$other": {
            ".validate": "false"
          },
          ".write": "data.val() == null && newData.val() != null && (auth != null && root.child('members').child($room_id).child(auth.uid).val() != null)"
        }
      }
    }
  }
}
```

## Future Topics (TBD)

- Controlling Access to Users' Own Data
- Controlling Creation, Modification, and Deletion.
- Don't Overwrite Data w/o Reading it First
