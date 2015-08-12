'use strict';

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var mocha = require('gulp-mocha');

var peg = require('gulp-peg');

var JS_SOURCES = ['gulpfile.js',
                  'lib/rules-generator.js', 'lib/ast.js',
                  'bin/firebase-bolt',
                  'test/*.js'];

gulp.task('lint', function() {
  return gulp.src(JS_SOURCES)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('build', function() {
  return gulp.src('src/rules-parser.pegjs')
    .pipe(peg())
    .pipe(gulp.dest('lib'));
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
