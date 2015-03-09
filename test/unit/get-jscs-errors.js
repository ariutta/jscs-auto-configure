var fs = require('fs');
var getJscsErrors = require('../../lib/get-jscs-errors');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var colors = require('colors');
var expect = chai.expect;
var highland = require('highland');
var run = require('gulp-run');
var sinon      = require('sinon');
var testUtils = require('../test-utils.js');
var wd = require('wd');

chai.use(chaiAsPromised);
chai.should();
chaiAsPromised.transferPromiseness = wd.transferPromiseness;

describe('jscsAutoconfigure.getJscsErrors', function() {
  var allPassed = true;
  var that = this;
  var update;
  var lkgDataPath;
  var lkgDataString;

  before(function(done) {
    // Find whether user requested to update the expected JSON result
    update = testUtils.getUpdateState(that.title);
    done();
  });

  beforeEach(function(done) {
    done();
  });

  afterEach(function(done) {
    allPassed = allPassed && (this.currentTest.state === 'passed');
    done();
  });

  after(function(done) {
    done();
  });

  it('should get errors for sample file using google style', function(done) {
    lkgDataPath = __dirname + '/jscs-errors-expected.json';
    lkgDataString = testUtils.getLkgDataString(lkgDataPath);

    var inputPath = __dirname + '/../input-data/open-id-connect.js';
    var option = {
      preset: 'google'
    };

    getJscsErrors(option, inputPath)
      .map(function(data) {
        return JSON.stringify(data);
      })
      .pipe(highland.pipeline(function(s) {
        if (update) {
          s.fork()
          .map(function(dataString) {
            lkgDataString = dataString;
            return dataString;
          })
          .pipe(fs.createWriteStream(lkgDataPath));
        }

        return s.fork();
      }))
      .map(function(dataString) {
        return testUtils.compareJson(dataString, lkgDataString);
      })
      .map(function(passed) {
        return expect(passed).to.be.true;
      })
      .last()
      .each(function() {
        return done();
      });
  });

  it('should handle the case when there are no errors', function(done) {
    lkgDataString = '[]';

    var inputPath = __dirname + '/../input-data/no-jscs-errors.js';
    var option = {
      preset: 'google'
    };

    getJscsErrors(option, inputPath)
      .map(function(data) {
        return JSON.stringify(data);
      })
      .pipe(highland.pipeline(function(s) {
        if (update) {
          s.fork()
          .map(function(dataString) {
            lkgDataString = dataString;
            return dataString;
          })
          .pipe(fs.createWriteStream(lkgDataPath));
        }

        return s.fork();
      }))
      .map(function(dataString) {
        return testUtils.compareJson(dataString, lkgDataString);
      })
      .map(function(passed) {
        return expect(passed).to.be.true;
      })
      .last()
      .each(function() {
        return done();
      });
  });
});
