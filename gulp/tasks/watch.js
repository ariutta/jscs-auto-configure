var gulp = require('gulp');

gulp.task('watch', function() {
  // TODO add dependent files to watch
  //gulp.watch('./lib/index.js', ['testLocalhost']);
  gulp.watch('./lib/get-jscs-errors.js', ['testGetJscsErrors']);
});
