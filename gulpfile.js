/*
 * Copyright 2015 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var path = require('path');
var gulp = require('gulp');
var eslint = require('gulp-eslint');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var util = require('./lib/util');

var mocha = require('gulp-mocha');
var gutil = require('gulp-util');

var peg = require('gulp-peg');

var JS_SOURCES = ['gulpfile.js',
                  'lib/*.js',
                  'bin/firebase-bolt',
                  'test/*.js'];

var TEST_FILES = ['test/generator-test.js', 'test/parser-test.js'];

gulp.task('lint', function() {
  return gulp.src(JS_SOURCES.concat(['!lib/rules-parser.js']))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', ['build-peg', 'browserify-bolt']);

gulp.task('build-peg', function() {
  return gulp.src('src/rules-parser.pegjs')
    .pipe(peg())
    .pipe(gulp.dest('lib'));
});

gulp.task('browserify-bolt', ['build-peg'], function() {
  return browserifyToDist('lib/bolt.js', { standalone: 'bolt' });
});

// TODO: Use source to pipe glob of test files through browserify.
gulp.task('browserify-parser-test', function() {
  return browserifyToDist('test/parser-test.js', { exclude: 'bolt' });
});

gulp.task('browserify-generator-test', function() {
  return browserifyToDist('test/generator-test.js', { exclude: 'bolt' });
});

gulp.task('browserify-mail-test', function() {
  return browserifyToDist('test/mail-test', { exclude: 'bolt' });
});

gulp.task('browserify', ['browserify-bolt',
                         'browserify-parser-test',
                         'browserify-generator-test',
                         'browserify-mail-test']);

// Runs the Mocha test suite
gulp.task('test', ['build'], function() {
  return gulp.src(TEST_FILES)
    .pipe(mocha({ui: 'tdd'}));
});

gulp.task('default', ['lint', 'build', 'test']);

function browserifyToDist(entry, opts) {
  // Browserify options include:
  //   standalone: name of exported module
  //   exclude: Don't include namespace.
  //   debug: Include sourcemap in output.
  opts = util.extend({}, opts, { entries: [entry], debug: true });
  var exclude = opts.exclude;
  delete opts.exclude;
  var b = browserify(opts);
  if (exclude) {
    b.exclude(exclude);
  }
  return b
    .bundle()
    .pipe(source(path.basename(entry)))
    .on('error', gutil.log)
    .pipe(gulp.dest('dist'));
}
