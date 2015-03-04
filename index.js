/*jslint devel: true */

var _ = require('lodash');
var fs = require('fs');
var gulp = require('gulp');
var jscs = require('./jscs-runner');
var highland = require('highland');

var jscsrc = {
	'preset': 'google'
};

var inputPath = '../OpenIDConnect/index.js';
var outputFile = './new-jscsrc.json';

var customJscsrc = {};

var presets = [
  'airbnb',
  'crockford',
  'google',
  'grunt',
  'jquery',
  'mdcs',
  'wikimedia',
  'yandex'
];

var lowestErrorCount = Infinity;
highland(presets).map(function(preset) {
  return {
    preset: preset
  };
})
.flatMap(function(option) {
  console.log('option');
  console.log(option);
  return gulp.src(inputPath)
      .pipe(jscs(option))
      .pipe(highland.pipeline(function(s) {
        return s
        .errors(function(err, push) {
          console.log('err2a');
          console.log(err);
          push(null, err);
        })
        .map(function(file) {
          return {
            preset: option.preset,
            errors: file.jscs.errors
          };
        })
        .flatFilter(function(errorsByPreset) {
          return highland(errorsByPreset.errors)
          .uniqBy(function(a, b) {
            return a.rule === b.rule;
          })
          .collect()
          .map(function(errors) {
            var errorCount = errors.length;
            console.log('errorCount');
            console.log(errorCount);
            if (errorCount < lowestErrorCount) {
              lowestErrorCount = errorCount;
              return true;
            } else {
              return false;
            }
          });
        })
        .errors(function(err, push) {
          console.log('err2b');
          console.log(err);
          push(null, err);
        });
      }))
      .errors(function(err, push) {
        console.log('err2c');
        console.log(err);
        push(null, err);
      });
})
.errors(function(err, push) {
  console.log('err first line');
  console.log(err);
  push(null, err);
})
.last()
.flatMap(function(data) {
  var presetJson = JSON.parse(fs.readFileSync(
      './node_modules/jscs/presets/' + data.preset + '.json',
      {encoding: 'utf8'}));
  customJscsrc.preset = data.preset;
  console.log('weeee');
  console.log(customJscsrc);
  fs.writeFileSync(outputFile, JSON.stringify(customJscsrc, null, '  '));
  return highland(data.errors).group('rule')
  .flatMap(highland.pairs)
  .map(function(pair) {
    return {
      preset: data.preset,
      presetJson: presetJson,
      rule: pair[0],
      errors: pair[1],
      errorCount: pair[1].length
    };
  });
})
.filter(function(data) {
  var rule = data.rule;
  console.log('rule in filter');
  console.log(rule);
  if (rule === 'validateQuoteMarks') {
    customJscsrc.validateQuoteMarks = {'mark': true, 'escape': true};
    return false;
  } else if (rule.indexOf('SpacesInsideArrayBrackets') > -1) {
    customJscsrc[rule] = 'all';
    return false;
  }
  return rule.indexOf('require') > -1 || rule.indexOf('disallow') > -1;
})
.flatMap(function(data) {
  var rule = data.rule;

  var alternateRule = rule.replace('require', 'DISALLOW')
    .replace('disallow', 'REQUIRE')
    .replace('DISALLOW', 'disallow')
    .replace('REQUIRE', 'require');

  var alternateOption = {
    preset: data.preset,
  };

  var ruleValue = data.presetJson[rule];
  var existingOption = {};
  existingOption[rule] = ruleValue;

  /*
  alternateOption[alternateRule] = ruleValue;
  //*/

  //*
  if (ruleValue === true || ruleValue === false) {
    alternateOption[alternateRule] = ruleValue;
  } else if (_.isArray(ruleValue)) {
    return highland(ruleValue).flatFilter(function(item) {
      var itemExistingOption = {};
      itemExistingOption[rule] = [item];
      var itemAlternateOption = {};
      itemAlternateOption[alternateRule] = [item];
      console.log('[][][][][][][][][][][][][][][][][][][][][][][][][][][][]');
      console.log('Testing existing:');
      console.log(itemExistingOption);
      console.log('vs alternate:');
      console.log(itemAlternateOption);
      return compare(itemExistingOption, itemAlternateOption);
    })
    .last()
    .map(function() {
      var existingRuleValuePruned = _.difference(
          ruleValue, customJscsrc[alternateRule] || []);
      if (!_.isEmpty(existingRuleValuePruned)) {
        customJscsrc[rule] = existingRuleValuePruned;
      } else {
        delete customJscsrc[rule];
      }

      return customJscsrc;
    });
  } else {
    // TODO handle plain object rule values property by property
    alternateOption[alternateRule] = ruleValue;
  }
  //*/

  console.log('*************************************');
  console.log('Testing existing (' + rule +
        ') vs alternate (' + alternateRule + ')');

  return check(data.errorCount, alternateOption);

  /*
  console.log('alternateOption');
  console.log(alternateOption);
  //*/

})
.last()
.map(function(data) {
  console.log('final data');
  console.log(data);
  //return JSON.stringify(data, null, '  ');
  return JSON.stringify(customJscsrc, null, '  ');
})
.pipe(fs.createWriteStream(outputFile));
//.pipe(fs.createWriteStream('./.jscsrc'));
/*
.map(function(data) {
  console.log('customJscsrc');
  console.log(customJscsrc);
  return '';
  //return data.toString();
  //return JSON.stringify(data);
})
.pipe(process.stdout);
//*/

function compare(existingOption, alternateOption) {
  var existingRule = _.keys(existingOption)[0];
  var existingRuleValue = existingOption[existingRule];
  var existingErrorStream = run(existingOption);

  var alternateRule = _.keys(alternateOption)[0];
  var alternateRuleValue = alternateOption[alternateRule];
  var alternateErrorStream = run(alternateOption);

  return existingErrorStream.zip(alternateErrorStream)
    .errors(function(err, push) {
      console.log('217');
      push(err);
    })
    .filter(function(pair) {
      // Filter to only include alternate rules that reduce
      // the error count.
      var existingErrors = pair[0];
      var existingErrorCount = existingErrors.length;
      var alternateErrors = pair[1];
      var alternateErrorCount = alternateErrors.length;
      console.log('Compare error count: existing (' +
          existingErrorCount.toString() +
          ') vs. alternate (' + alternateErrorCount.toString() + ')');
      console.log('');
      return alternateErrorCount < existingErrorCount;
    })
    .flatMap(function(pair) {
      console.log('good alternateOption');
      console.log(alternateOption);

      if (_.isArray(alternateRuleValue)) {
        customJscsrc[alternateRule] = customJscsrc[alternateRule] || [];
        customJscsrc[alternateRule] = customJscsrc[alternateRule]
          .concat(alternateRuleValue);
      } else {
        _.assign(customJscsrc, alternateOption);
      }
      return highland([alternateOption]);
    })
    .concat(highland([alternateOption]))
    .last();
}

function run(option) {
  var rule = _.keys(option)[0];
  var ruleValue = option[rule];
  return gulp.src(inputPath)
    .pipe(jscs(option))
    .pipe(highland.pipeline(function(s) {
      return s
      .errors(function(err, push) {
        console.log('253');
        push(err);
      })
      .map(function(file) {
        return file.jscs.errors;
      })
      .filter(function(errors) {
        // Make sure the rule is supported
        return errors.filter(function(error) {
          return !!error.message &&
              error.message.indexOf(rule) > -1 &&
              error.message.indexOf('Unsupported rule') > -1;
        }).length === 0;
      })
      .concat(highland([[null]]))
      .head()
      .errors(function(err, push) {
        console.log('268');
        push(err);
      });
    }))
    .errors(function(err, push) {
      console.log('273');
      push(err);
    });
}

function check(existingErrorCount, alternateOption) {
  var alternateRule = _.keys(alternateOption)[0];
  var alternateRuleValue = alternateOption[alternateRule];
  return gulp.src(inputPath)
      .pipe(jscs(alternateOption))
      .pipe(highland.pipeline(function(s) {
        return s
        .errors(function(err, push) {
          console.log('err2a');
          console.log(err);
          push(null, err);
        })
        .map(function(file) {
          return file.jscs.errors;
        })
        .filter(function(errors) {
          // Make sure the alternate rule is supported
          return errors.filter(function(error) {
            return !!error.message &&
                error.message.indexOf(alternateRule) > -1 &&
                error.message.indexOf('Unsupported rule') > -1;
          }).length === 0;
        })
        .filter(function(errors) {
          // Filter to only include alternate rules that reduce
          // the error count.
          var alternateErrors = errors.filter(function(error) {
            return error.rule === alternateRule;
          });
          console.log('Check error count: existing (' +
              existingErrorCount.toString() +
              ') vs. alternate (' + alternateErrors.length.toString() + ')');
          console.log('');
          return alternateErrors.length < existingErrorCount;
        })
        .flatMap(function(errors) {
          console.log('good alternateOption');
          console.log(alternateOption);

          if (_.isArray(alternateRuleValue)) {
            customJscsrc[alternateRule] = customJscsrc[alternateRule] || [];
            customJscsrc[alternateRule] = customJscsrc[alternateRule]
              .concat(alternateRuleValue);
          } else {
            _.assign(customJscsrc, alternateOption);
          }
          return highland([alternateOption]);
        })
        .errors(function(err, push) {
          console.log('err2b');
          console.log(err);
          push(null, err);
        });
      }))
      .errors(function(err, push) {
        push(null, err);
      });
}
