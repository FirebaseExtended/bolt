# Firebase Security and Rules Using Bolt

Firebase is secured using a JSON-formatted [Security and Rules](https://www.firebase.com/docs/security/guide/understanding-security.html)
language.  It is a power feature of Firebase, but can be error prone to write by hand.

The Bolt compiler helps developers express the schema and authorization rules for their database
using a familiar JavaScript-like language.  The complete [language reference](language.md) describes
the syntax of the language.  This tutorial introduces the concepts in features of Bolt to introduce
developers to the language.

# Getting Started

The Firebase Bolt compiler is a command-line based tool, written in node.js.  You can install
it using the [Node Package Manager](https://docs.npmjs.com/cli/install):

    $ npm install --global firebase-bolt

You can use the Bolt compiler to compile the examples in this tutorial, and inspect the output.

# The Default Firebase Permissions

By default, Firebase has NO SECURITY - this makes it easy to test your code (but is unsafe for production apps
since anyone can read and overwrite all your data).  In Bolt, the default permissions are written as:

_all_access.bolt_
```javascript
path / {
  read() = true;
  write() = true;
}
```

    $ firebase-bolt < all_access.bolt

will output:

```JSON
{
  "rules": {
    ".read": "true",
    ".write": "true"
  }
}
```
