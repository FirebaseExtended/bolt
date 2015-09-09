# Bolt Compiler

[![Build Status](https://travis-ci.org/firebase/bolt.svg?branch=master)](https://travis-ci.org/firebase/bolt)

Bolt is an experimental security and rules compiler for Firebase.  It is currently
in early alpha.  There are known bugs and incomplete features in the current
implementation, so PLEASE DO NOT USE IN PRODUCTION applications.

Otherwise, we'd love to have feedback from early adopters.  You can email questions
to firebase-talk@googlegroups.com using "Bolt" in the subject line.

# Language Definition

  - [Firebase Security and Modeling Language](docs/language.md) - Language documentation and syntax.

# Using the Bolt Compiler

You can easily install the bolt compiler using [npm](https://docs.npmjs.com/cli/install):

    $ npm install --global firebase-bolt

Execute a Bolt compiler from the command line (it reads a Bolt file from standard input and write a JSON
rules file to standard output):

    $ firebase-bolt < <bolt-file>

# Developing with this Repo

You should have node.js and npm installed to use this repository.

Setup command line environment and lint, build, test.

    $ source tools/use
    $ configure-project
    $ gulp

# Useful commands

Check JavaScript source files for required formatting conventions:

    $ gulp lint

Build Bolt parser from PEG grammar:

    $ gulp build

Run command line tests:

    $ gulp test

More extensive tests which include running against a sandboxed Firebase app:

    $ run-tests

Run browser-based tests:

    $ browser-tests
