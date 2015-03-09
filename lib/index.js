/*jslint devel: true */

var _ = require('lodash');
var fs = require('fs');
var getJscsErrors = require('./get-jscs-errors');
var gulp = require('gulp');
var jscs = require('./jscs-runner');
var highland = require('highland');

module.exports = function(inputPath, outputFile) {
  var customJscsrc = {};

  var presetNames = [
    'airbnb',
    'crockford',
    'google',
    'grunt',
    'jquery',
    'mdcs',
    'wikimedia',
    'yandex'
  ];

  highland(presetNames)
  .flatMap(function(presetName) {
    var option = {
      preset: presetName
    };
    return getJscsErrors(option, inputPath)
      .sequence()
      .uniqBy(function(a, b) {
        return a.rule === b.rule;
      })
      .collect()
      .map(function(errors) {
        return {
          preset: presetName,
          errors: errors
        };
      })
      .errors(function(err, push) {
        console.log('err2c');
        console.log(err);
        push(null, err);
      });
  })
  .reduce1(function(a, b) {
    if (a.errors.length < b.errors.length) {
      return a;
    } else {
      return b;
    }
  })
  .errors(function(err, push) {
    console.log('err first line');
    console.log(err);
    push(null, err);
  })
  .map(function(data) {
    console.log('data87');
    console.log(data);
    var presetJscsrc = JSON.parse(fs.readFileSync(
        './node_modules/jscs/presets/' + data.preset + '.json',
        {encoding: 'utf8'}));
    customJscsrc = presetJscsrc;
    return data.errors;
  })
  .sequence()
  .filter(function(error) {
    var rule = error.rule;
    console.log('rule in filter');
    console.log(rule);
    if (rule === 'validateQuoteMarks') {
      customJscsrc.validateQuoteMarks = {'mark': true, 'escape': true};
      return false;
    } else if (rule.indexOf('SpacesInsideArrayBrackets') > -1) {
      customJscsrc[rule] = 'all';
      return false;
    } else if (rule.indexOf('requireMultipleVarDecl') > -1) {
      //customJscsrc[rule] = true;
      customJscsrc[rule] = 'onevar';
      return false;
    }
    return rule.indexOf('require') > -1 || rule.indexOf('disallow') > -1;
  })
  .flatMap(function(error) {
    console.log('error');
    console.log(error);
    var existingRuleName = error.rule;
    var existingRuleValue = customJscsrc[existingRuleName];

    var existingOption = convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);

    var alternateRuleName = existingRuleName.replace('require', 'DISALLOW')
      .replace('disallow', 'REQUIRE')
      .replace('DISALLOW', 'disallow')
      .replace('REQUIRE', 'require');

    var alternateOption = convertPairToMap([
      alternateRuleName,
      existingRuleValue || true
    ]);

    return compareOptions(existingOption, alternateOption);
  })
  .last()
  .map(function(data) {
    console.log('final data');
    console.log(data);
    return JSON.stringify(data, null, '  ');
    //return JSON.stringify(customJscsrc, null, '  ');
  })
  .pipe(fs.createWriteStream(outputFile));
  //.pipe(process.stdout);

  /*
   * Run JSCS for one specific rule, returning
   * only supported errors.
   */
  function getSupportedJscsErrors(option) {
    var rule = _.keys(option)[0];
    var ruleValue = option[rule];
    return getJscsErrors(option, inputPath)
      .sequence()
      .filter(function(error) {
        // Make sure the rule is supported
        return !!error.message &&
            error.message.indexOf(rule) > -1 &&
            error.message.indexOf('Unsupported rule') > -1;
      })
      .collect();
  }

  /*
   * Compare two JSCS rules to decide which, if either, to use.
   * This will only be comparing one-to-one, so if the rule value
   * is an array, we only compare one item, and if it's a map
   * with multiple properties, we only compare one property.
   */
  function compareOptionsSingleVariable(existingOption, alternateOption) {
    var existingRule = _.keys(existingOption)[0];
    var existingRuleValue = existingOption[existingRule];
    var existingErrorStream = getJscsErrors(existingOption, inputPath);

    var alternateRule = _.keys(alternateOption)[0];
    var alternateRuleValue = alternateOption[alternateRule];
    var alternateErrorStream = getJscsErrors(alternateOption, inputPath);

    return existingErrorStream.zip(alternateErrorStream)
      .errors(function(err, push) {
        console.log('217');
        push(err);
      })
      .map(function(pair) {
        var firstAlternateError = pair[1][0];
        // Make sure the alternate rule is supported
        var alternateErrorIsSupported =  !firstAlternateError ||
            !firstAlternateError.message ||
            firstAlternateError.message.indexOf('Unsupported rule') === -1;
        if (!alternateErrorIsSupported) {
          return 'existing';
        }

        // Check whether alternate rule reduces
        // the error count.
        var existingErrors = pair[0];
        var existingErrorCount = existingErrors.length;
        var alternateErrors = pair[1];
        var alternateErrorCount = alternateErrors.length;
        console.log('Compare error count: existing (' +
            existingErrorCount.toString() +
            ') vs. alternate (' + alternateErrorCount.toString() + ')');
        console.log('');
        if (alternateErrorCount < existingErrorCount) {
          return 'alternate';
        }

        return 'existing';
      });
  }

  function convertPairToMap(pair) {
    var key = pair[0];
    var value = pair[1];
    var option = {};
    option[key] = value;
    return option;
  }

  /*
   * Compare two JSCS rules to decide which, if either, to use.
   * This compares the full rule option against its alternative.
   */
  function compareOptions(existingOption, alternateOption) {
    var existingRuleName = _.keys(existingOption)[0];
    var existingRuleValue = customJscsrc[existingRuleName];
    var alternateRuleName = _.keys(alternateOption)[0];

    if (_.isArray(existingRuleValue)) {
      return compareOptionsArray(
          existingRuleName, existingRuleValue, alternateRuleName);
    } else if (_.isPlainObject(existingRuleValue)) {
      return compareOptionsMap(
          existingRuleName, existingRuleValue, alternateRuleName);
    }

    console.log('*************************************');
    console.log('Testing existing vs alternate');
    console.log(existingOption);
    console.log('vs');
    console.log(alternateOption);

    return compareOptionsSingleVariable(existingOption, alternateOption)
      .map(function(bestOptionType) {
        console.log('bestOptionType for 237: ' + bestOptionType);
        if (bestOptionType === 'alternate') {
          delete customJscsrc[existingRuleName];
        }
        return customJscsrc;
      });
  }

  /*
   * Compare two JSCS rules to decide which, if either, to use when the
   * rule value is an array.
   */
  function compareOptionsArray(
      existingRuleName, existingRuleValue, alternateRuleName) {
    var existingOption = convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);
    return highland(existingRuleValue).flatMap(function(item) {
      var itemExistingOption = {};
      itemExistingOption[existingRuleName] = [item];
      var itemAlternateOption = {};
      itemAlternateOption[alternateRuleName] = [item];
      console.log('[][][][][][][][][][][][][][][][][][][][][][][][][][][][]');
      console.log('Testing existing257:');
      console.log(itemExistingOption);
      console.log('vs alternate:');
      console.log(itemAlternateOption);
      return compareOptionsSingleVariable(
          itemExistingOption, itemAlternateOption)
        .map(function(bestOptionType) {
          console.log('bestOptionType for arrays266: ' + bestOptionType);
          if (bestOptionType === 'alternate') {
            console.log('alt');
            console.log(customJscsrc);
            customJscsrc[alternateRuleName] = customJscsrc[alternateRuleName] ||
                [];
            console.log('alt2');
            console.log(customJscsrc[alternateRuleName]);
            console.log('alternateRuleName');
            console.log(alternateRuleName);
            console.log('item');
            console.log(item);
            customJscsrc[alternateRuleName].push(item);
            var existingRuleValuePruned = _.difference(
                existingRuleValue, customJscsrc[alternateRuleName]);
            if (!_.isEmpty(existingRuleValuePruned)) {
              customJscsrc[existingRuleName] = existingRuleValuePruned;
            } else {
              delete customJscsrc[existingRuleName];
            }
          }

          return customJscsrc;
        });
    });
  }

  /*
   * Compare two JSCS rules to decide which, if either, to use when the
   * rule value is a map.
   */
  function compareOptionsMap(
      existingRuleName, existingRuleValue, alternateRuleName) {
    var existingOption = convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);
    return highland(highland.pairs(existingRuleValue))
      .flatMap(function(pair) {
        var item = convertPairToMap(pair);
        var itemExistingOption = convertPairToMap([existingRuleName, item]);
        var itemAlternateOption = convertPairToMap([alternateRuleName, item]);
        console.log('{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}');
        console.log('Testing itemExistingOption:');
        console.log(itemExistingOption);
        console.log('vs itemAlternateOption:');
        console.log(itemAlternateOption);
        return compareOptionsSingleVariable(
            itemExistingOption, itemAlternateOption)
          .map(function(bestOptionType) {
            console.log('bestOptionType317: ' + bestOptionType);
            if (bestOptionType === 'alternate') {

              var subKey = _.keys(item)[0];

              _.assign(customJscsrc, itemAlternateOption);

              delete customJscsrc[existingRuleName][subKey];
              if (_.isEmpty(customJscsrc[existingRuleName])) {
                delete customJscsrc[existingRuleName];
              }
            }

            return customJscsrc;
          });
      });
  }

};
