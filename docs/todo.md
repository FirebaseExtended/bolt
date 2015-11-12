# Known issues and tasks.

# Language changes

- Generate (Java) language stubs based on schema (cf bolt_compiler experiment).

# Testing

- Concept of "coverage" for behavioral tests?  (Like ensure every property that
  can be testing against is tested in success and failing tests, and that every clause
  of a validation rule is executed in both the true and false cases).


# Repo structure and OSS

- Cleanup browserify rules - ugly (prefer glob-ing test files and running as a merged stream).
- Setup code coverage (istanbul).
- Remove browser-test and web-server bash scripts (replace in gulp).
