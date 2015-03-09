/*jslint devel: true */

var _ = require('lodash');
var gulp = require('gulp');
var jscs = require('./jscs-runner');
var highland = require('highland');

module.exports = function(option, inputPath) {
  return highland([option])
  .flatMap(function(option) {
    return gulp.src(inputPath)
      .pipe(jscs(option))
      .pipe(highland.pipeline(function(s) {
        return s
        .errors(function(err, push) {
          console.log('err');
          console.log(err);
          push(null, err);
        })
        .map(function(file) {
          return file.jscs.errors || [];
        });
      }))
      .errors(function(err, push) {
        console.log('err');
        console.log(err);
        push(null, err);
      });
  });
};
