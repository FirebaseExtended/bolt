# Firebase Security and Rules Using Bolt

Firebase is secured using a JSON-formatted [Security and
Rules](https://www.firebase.com/docs/security/guide/understanding-security.html) language. It
is a powerful feature of Firebase, but can be error prone to write by hand.

The Bolt compiler helps developers express the schema and authorization rules for their
database using a familiar JavaScript-like language. The complete [language
reference](language.md) describes the syntax of the language. This tutorial introduces the
concepts and features of Bolt to introduce developers to the language.

# Getting Started

The Firebase Bolt compiler is a command-line based tool, written in node.js. You can install it
using the [Node Package Manager](https://nodejs.org/en/download/):

    $ npm install --global firebase-bolt

You can use the Bolt compiler to compile the examples in this tutorial, and inspect the output.

## Default Firebase Permissions

By default, Firebase has a permissive security model - this makes it easy to test your code
(but is unsafe for production apps since anyone can read and overwrite all your data). In Bolt,
default permissions are written as:

[all_access.bolt](../samples/all_access.bolt)
```javascript
path / {
  read() = true;
  write() = true;
}
```

This _path_ statement, gives open read and write permissions to every part of your database
(all paths beneath the root (`/`) of the database).

Use the Bolt compiler to convert this to Firebase JSON-formatting rules:

    $ firebase-bolt < all_access.bolt

```JSON
{
  "rules": {
    ".read": "true",
    ".write": "true"
  }
}
```

## Data Validation

The Firebase database is "schemaless" - which means that, unless you specify otherwise, any
type or structure of data can be written anywhere in the database. By specifying a specific
schema, you can catch coding errors early, and prevent malicious programs from writing data
that you don't expect.

Let say your application wants to allow users to write messages to your database. Each message
can be up to 140 characters and must by _signed_ by the user. In Bolt, you can express this
using a `type` statement:

_posts.bolt_
```javascript
path /posts {
  read() = true;
}

path /posts/$id is Post {
  write() = true;
}

type Post {
  validate() = this.message.length <= 140;

  message: String,
  from: String
}
```

This database allows for a collection of `Posts` to be stored at the `/posts` path. Each one
must have a unique ID (such as created if you use `ref.push()`). It allows for exactly two
string properties in each post (message and from). It also ensures that no message be longer
than 140 characters.

Bolt type statement can contain a `validate()` method (defined as `validate() = <expression>`,
where the expression evaluates to a `true` value if the data is the type is valid (can be saved
to the database). When the expression evaluates to `false`, the attempt to write the data will
return an error to the Firebase client and the database will be unmodified.

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

_sample.bolt_
```javascript
path / is Sample;

type Sample {
  name: String,
  age: Number,
  isMember: Boolean,
  attributes: Object | Null
}
```

    $ firebase-bolt < sample.bolt

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
    "attributes": {
      ".validate": "newData.hasChildren() || newData.val() == null"
    },
    "$other": {
      ".validate": "false"
    }
  }
}
```
