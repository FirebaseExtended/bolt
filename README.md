# Firebase Security and Modeling Language

# Language Definition

  - [Firebase Security and Modeling Language](docs/language.md) - Language documentation and syntax.

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

Run browser-based tests:

    $ browser-tests

Execute a Bolt compiler from the command line:

    $ firebase-bolt < <bolt-file>

A Firebase JSON file is sent to standard output.
