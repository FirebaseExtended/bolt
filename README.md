# ![Bolt Icon](docs/images/flash.png) Bolt Compiler

[![Build Status](https://travis-ci.org/FirebaseExtended/bolt.svg?branch=master)](https://travis-ci.org/FirebaseExtended/bolt)
[![NPM Version](https://badge.fury.io/js/firebase-bolt.svg)](https://npmjs.org/package/firebase-bolt)
[![NPM Downloads](http://img.shields.io/npm/dm/firebase-bolt.svg)](https://npmjs.org/package/firebase-bolt)

Bolt is an experimental security and rules compiler for Firebase Realtime Database (not for Firebase Cloud Storage). 
It is currently in beta.  The language definition is converging, but not yet finalized.  We welcome
experimentation, but ask that you hand-verify the resulting JSON output before
using with production applications.

Otherwise, we'd love to have feedback from early adopters.  You can email questions
to firebase-talk@googlegroups.com using "Bolt" in the subject line, or post bugs
on our [Issue Tracker](https://github.com/FirebaseExtended/bolt/issues).


## Status

![Status: Frozen](https://img.shields.io/badge/Status-Frozen-yellow)

This repository is no longer under active development. No new features will be added and issues are not actively triaged. Pull Requests which fix bugs are welcome and will be reviewed on a best-effort basis.

If you maintain a fork of this repository that you believe is healthier than the official version, we may consider recommending your fork. Please open a Pull Request if you believe that is the case.


# Language Definition

  - [Guide to Using Firebase Bolt](docs/guide.md) - Introduction to using Bolt.
  - [Firebase Security and Modeling Language](docs/language.md) - Language documentation and syntax.

# Using the Bolt Compiler

You can easily install the bolt compiler using [npm](https://docs.npmjs.com/cli/install):

    $ npm install --global firebase-bolt

Execute the Bolt compiler from the command line:

    $ firebase-bolt rules.bolt

Will create a rules.json which you can then upload via the [Firebase Web Console](https://console.firebase.google.com/)
or the [Firebase command
line](https://firebase.google.com/docs/cli):

    $ firebase deploy

_The firebase command line tool version 2 will also compile your Bolt file directly if you have firebase-bolt
installed and you use the .bolt file extension in the rules property of your firebase.json
configuration file._

# Developing with this Repo

You should have node.js and npm installed to use this repository.

Setup command line environment and build and test.

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
