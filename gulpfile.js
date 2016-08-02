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

var argv = require('yargs').argv;
var path = require('path');
var gulp = require('gulp');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var mkdirp = require('mkdirp');
var del = require('del');
var merge = require('merge-stream');

var eslint = require('gulp-eslint');
var tslint = require('gulp-tslint');
var mocha = require('gulp-mocha');
var gutil = require('gulp-util');
var ts = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var peg = require('gulp-peg');
var mustache = require('gulp-mustache');
var rename = require('gulp-rename');

var LIB_DIR = 'lib';
var TEST_DIR = path.join(LIB_DIR, 'test');
var DIST_DIR = 'dist';
var TMP_DIR = 'tmp';

var JS_SOURCES = ['gulpfile.js', 'bin/firebase-bolt'];
var TS_SOURCES = ['src/*.ts', 'src/test/*.ts'];

var COMMON_TESTS = ['ast', 'generator', 'parser', 'util'];
var NETWORK_TESTS = ['firebase-rest', 'firebase-rules', 'chat', 'mail', 'regexp'];
var CI_TESTS = COMMON_TESTS.concat(['cli']);
var BROWSER_TESTS = COMMON_TESTS.concat(NETWORK_TESTS);

var TEST_SETS = [
  { title: "Common Tests",
    filename: 'index.html',
    tests: COMMON_TESTS },
  { title: "Network Tests",
    filename: 'network.html',
    tests: NETWORK_TESTS },
  { title: "All Tests",
    filename: 'all.html',
    tests: BROWSER_TESTS }
];

gulp.task('clean', function(cb) {
  del([LIB_DIR, DIST_DIR, TMP_DIR], cb);
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
    .pipe(tslint.report('prose'));
});

gulp.task('lint', ['eslint', 'tslint']);

gulp.task('ts-compile', ['build-peg'], function() {
  var tsProject = ts.createProject('tsconfig.json', {
    // Use the repo-installed version of typescript instead of
    // the version built into gulp-typescript.
    typescript: require('typescript')
  });
  return tsProject.src()
      .pipe(sourcemaps.init())
      .pipe(ts(tsProject))
      .pipe(sourcemaps.write())
      .pipe(gulp.dest(LIB_DIR));
});

gulp.task('build', ['ts-compile', 'browserify-bolt']);

gulp.task('build-peg', function() {
  return gulp.src('src/rules-parser.pegjs')
    .pipe(peg())
    .pipe(gulp.dest(LIB_DIR));
});

gulp.task('build-browser-tests', ['browserify-tests'], function() {
  return merge(TEST_SETS.map(function(set) {
    // Mark the current set as selected for CSS class in test template
    var sets = TEST_SETS.map(function(otherSet) {
      if (set === otherSet) {
        return extend({}, otherSet, { selected: 'selected' });
      }
      return otherSet;
    });

    return gulp.src('src/test/index.html')
      .pipe(mustache({ sets: sets, set: set }))
      .pipe(rename(set.filename))
      .pipe(gulp.dest(DIST_DIR));
  }));
});

gulp.task('browserify-tests', ['build'], function() {
  return merge(BROWSER_TESTS.map(testFileSource).map(browserifyToDist));
});

gulp.task('browserify-bolt', ['ts-compile'], function() {
  return browserifyToDist(path.join(LIB_DIR, 'bolt.js'));
});

// Runs the Mocha test suite
gulp.task('test', ['lint', 'build'], function() {
  mkdirp(TMP_DIR);
  var mochaOptions = {
    ui: 'tdd',
    require: ['source-map-support/register']
  };
  if (argv.grep) {
    mochaOptions['grep'] = argv.grep;
  }
  return gulp.src(CI_TESTS.map(testFileSource))
    .pipe(mocha(mochaOptions));
});

gulp.task('default', ['test']);

// Don't depend on 'build' in case current state is failing to compile - need to edit file
// to kick off first watch build.
gulp.task('watch', function() {
  gulp.watch(['src/*', 'src/test/*'], ['default']);
});

gulp.task('watch-build', function() {
  gulp.watch(['src/*', 'src/test/*'], ['build', 'lint']);
});

function browserifyToDist(entry, opts) {
  // Browserify options include:
  //   standalone: name of exported module
  //   debug: Include sourcemap in output.
  opts = extend({ entries: [entry], debug: true }, opts);
  var b = browserify(opts);
  return b
    .bundle()
    .pipe(source(path.basename(entry)))
    .on('error', gutil.log)
    .pipe(gulp.dest(DIST_DIR));
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

function testFileSource(name) {
  return path.join(TEST_DIR, name + '-test.js');
}
