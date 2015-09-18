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
var del = require('del');
var eslint = require('gulp-eslint');
var tslint = require('gulp-tslint');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');

var peg = require('gulp-peg');

var JS_SOURCES = ['gulpfile.js',
                  'bin/firebase-bolt'];
var TS_SOURCES = ['src/*.ts',
                  'src/test/*.ts'];

// Subset of tests required for 'gulp test'.
var TEST_FILES = ['lib/test/generator-test.js', 'lib/test/parser-test.js',
                  'lib/test/ast-test.js', 'lib/test/util-test.js'];

var TS_SETTINGS = {
  sortOutput: true,
  declarationFiles: true,
  noExternalResolve: false,
  module: 'commonjs'
};

gulp.task('clean', function(cb) {
  del(['lib', 'dist'], cb);
});

gulp.task('eslint', function() {
  return gulp.src(JS_SOURCES)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('tslint', function() {
  return gulp.src(TS_SOURCES)
    .pipe(tslint())
    .pipe(tslint.report('prose', {
      emitError: false
    }));
});

gulp.task('lint', ['eslint', 'tslint']);

gulp.task('ts-compile', ['build-peg'], function() {
  var tsProject = ts.createProject(TS_SETTINGS);

  return gulp.src('src/*.ts')
    .pipe(sourcemaps.init())
    .pipe(ts(tsProject))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('lib/'));
});

gulp.task('ts-compile-test', ['ts-compile'], function() {
  var tsTestProject = ts.createProject(TS_SETTINGS);

  return gulp.src('src/test/*.ts')
    .pipe(sourcemaps.init())
    .pipe(ts(tsTestProject))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('lib/test/'));
});

gulp.task('build', ['ts-compile', 'ts-compile-test', 'browserify-bolt']);

gulp.task('build-peg', function() {
  return gulp.src('src/rules-parser.pegjs')
    .pipe(peg())
    .pipe(gulp.dest('lib'));
});

gulp.task('browserify-bolt', ['ts-compile'], function() {
  return browserifyToDist('lib/bolt.js', { standalone: 'bolt' });
});

// TODO: Use source to pipe glob of test files through browserify.
gulp.task('browserify-parser-test', function() {
  return browserifyToDist('lib/test/parser-test.js', { exclude: 'bolt' });
});

gulp.task('browserify-generator-test', function() {
  return browserifyToDist('lib/test/generator-test.js', { exclude: 'bolt' });
});

gulp.task('browserify-mail-test', function() {
  return browserifyToDist('lib/test/mail-test', { exclude: 'bolt' });
});

gulp.task('browserify-ast-test', function() {
  return browserifyToDist('lib/test/ast-test.js', { exclude: 'bolt' });
});

gulp.task('browserify-util-test', function() {
  return browserifyToDist('lib/test/util-test.js', { exclude: 'bolt' });
});

gulp.task('browserify', ['browserify-bolt',
                         'browserify-parser-test',
                         'browserify-generator-test',
                         'browserify-mail-test',
                         'browserify-util-test',
                         'browserify-ast-test',
                        ]);

// Runs the Mocha test suite
gulp.task('test', ['lint', 'build'], function() {
  return gulp.src(TEST_FILES)
    .pipe(mocha({ui: 'tdd'}));
});

gulp.task('default', ['test']);

gulp.task('watch', ['default'], function() {
  gulp.watch(['src/*', 'src/test/*'], ['default']);
});

function browserifyToDist(entry, opts) {
  // Browserify options include:
  //   standalone: name of exported module
  //   exclude: Don't include namespace.
  //   debug: Include sourcemap in output.
  opts = extend({}, opts, { entries: [entry], debug: true });
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

function extend(dest) {
  var i;
  var src;
  var prop;

  if (dest === undefined) {
    dest = {};
  }
  for (i = 1; i < arguments.length; i++) {
    src = arguments[i];
    for (prop in src) {
      if (src.hasOwnProperty(prop)) {
        dest[prop] = src[prop];
      }
    }
  }

  return dest;
}
