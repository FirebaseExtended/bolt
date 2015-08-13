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

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var browserify = require('browserify');
var source = require('vinyl-source-stream');

var mocha = require('gulp-mocha');
var gutil = require('gulp-util');

var peg = require('gulp-peg');

var JS_SOURCES = ['gulpfile.js',
                  'lib/*.js',
                  'bin/firebase-bolt',
                  'test/*.js'];

gulp.task('lint', function() {
  return gulp.src(JS_SOURCES.concat(['!lib/rules-parser.js']))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', function() {
  return gulp.src('src/rules-parser.pegjs')
    .pipe(peg())
    .pipe(gulp.dest('lib'));
});

gulp.task('browserify', function() {
  return browserify({ entries: ['lib/bolt'] })
    .bundle()
    .pipe(source('bolt-bundle.js'))
    .on('error', gutil.log)
    .pipe(gulp.dest('dist'));
});

// Runs the Mocha test suite
gulp.task('test', function() {
  gulp.src(paths.testFiles)
    .pipe(mocha({
      reporter: 'spec',
      timeout: 5000
    }));
});

gulp.task('default', ['lint', 'build', 'test'], function() {
});
