/*jslint devel: true */

var _ = require('lodash');
var getJscsErrors = require('./get-jscs-errors');
var highland = require('highland');
var utils = require('./utils');

module.exports = function(inputPath, presetJscsrcDereferenced) {

  /**
   * Get patch when rule value only has one independent variable, e.g.,
   * it's a boolean, number, string, map with just one property or
   * array with just one element.
   *
   * @param {object} existingOption
   * @param {object} alternateOption
   * @return {object} patch
   */
  function bestForOneIndependentVariable(existingOption, alternateOption) {
    var existingRule = _.keys(existingOption)[0];
    var existingRuleValue = existingOption[existingRule];
    var existingErrorStream = getJscsErrors(existingOption, inputPath);

    var alternateRule = _.keys(alternateOption)[0];
    var alternateRuleValue = alternateOption[alternateRule];
    var alternateErrorStream = getJscsErrors(alternateOption, inputPath);

    return existingErrorStream.zip(alternateErrorStream)
      .errors(function(err, push) {
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

  /*
   * Get patch when rule value is an array.
   */
  function bestOfArrays(
      existingRuleName, existingRuleValue, alternateRuleName) {
    var existingOption = utils.convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);
    var patch = {};
    return highland(existingRuleValue).flatMap(function(item) {
      var itemExistingOption = {};
      itemExistingOption[existingRuleName] = [item];
      var itemAlternateOption = {};
      itemAlternateOption[alternateRuleName] = [item];
      console.log('[][][][][][][][][][][][][][][][][][][][][][][][][][][][]');
      console.log('Testing existing:');
      console.log(itemExistingOption);
      console.log('vs alternate:');
      console.log(itemAlternateOption);
      return bestForOneIndependentVariable(
          itemExistingOption, itemAlternateOption)
        .map(function(bestOptionType) {

          if (bestOptionType === 'alternate') {
            patch.create = patch.create || {};
            patch.create[alternateRuleName] = patch.create[alternateRuleName] ||
                [];
            patch.create[alternateRuleName].push(item);
            var existingRuleValuePruned = _.difference(
                existingRuleValue, patch.create[alternateRuleName]);
            if (!_.isEmpty(existingRuleValuePruned)) {
              patch.replace = {};
              patch.replace[existingRuleName] = existingRuleValuePruned;
            } else {
              patch.delete = existingRuleName;
            }
          }

          console.log('patch99');
          console.log(patch);

          return patch;
        });
    });
  }

  /*
   * Get patch when rule value is a map (plain object).
   */
  function bestOfMaps(
      existingRuleName, existingRuleValue, alternateRuleName) {
    var existingOption = utils.convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);
    var patch = {};
    patch.create = {};
    patch.replace = existingOption;
    return highland(highland.pairs(existingRuleValue))
      .flatMap(function(pair) {
        var item = utils.convertPairToMap(pair);
        var itemExistingOption = utils.convertPairToMap(
            [existingRuleName, item]);
        var itemAlternateOption = utils.convertPairToMap(
            [alternateRuleName, item]);
        console.log('{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}{}');
        console.log('Testing existing:');
        console.log(itemExistingOption);
        console.log('vs alternate:');
        console.log(itemAlternateOption);
        return bestForOneIndependentVariable(
            itemExistingOption, itemAlternateOption)
          .map(function(bestOptionType) {
            if (bestOptionType === 'alternate') {

              var subKey = _.keys(item)[0];

              _.assign(patch.create, itemAlternateOption);

              delete patch.replace[existingRuleName][subKey];
              if (_.isEmpty(patch.replace[existingRuleName])) {
                delete patch.replace;
                patch.delete = existingRuleName;
              }
            }

            return patch;
          });
      });
  }

  /**
   *
   * Compare a rule option against an alternative.
   * Returns a patch for the best of the two options.
   *
   * Get a JSON patch for a .jscsrc, by comparing for two
   * JSCS rule options, picking the one that results in
   * the fewest errors and return the patch to make the
   * .jscsrc reflect that option.
   *
   * @param {object} args
   * @param {object} args.existingOption
   * @param {object} args.alternateOption
   * @return {object} patch
   * @return {string} [patch.delete] Name of rule to delete
   * @return {object} [patch.replace] Rule option to replace
   * @return {object} [patch.create] Rule option to create
   */
  function bestOfOptions(
      existingOption, alternateOption) {
    var existingRuleName = _.keys(existingOption)[0];
    var existingRuleValue = existingOption[existingRuleName] ||
        presetJscsrcDereferenced[existingRuleName];
    var alternateRuleName = _.keys(alternateOption)[0];

    if (_.isArray(existingRuleValue)) {
      return bestOfArrays(
          existingRuleName, existingRuleValue, alternateRuleName);
    } else if (_.isPlainObject(existingRuleValue)) {
      return bestOfMaps(
          existingRuleName, existingRuleValue, alternateRuleName);
    }

    console.log('*************************************');
    console.log('Testing existing vs alternate');
    console.log(existingOption);
    console.log('vs');
    console.log(alternateOption);

    var alternateRuleValue = alternateOption[alternateRuleName];

    return bestForOneIndependentVariable(existingOption, alternateOption)
      .map(function(bestOptionType) {
        var patch = {};
        if (bestOptionType === 'alternate') {
          patch.delete = existingRuleName;
          patch.create = {};
          patch.create[alternateRuleName] = alternateRuleValue;
        } else {
          patch.replace = existingOption;
        }
        return patch;
      });
  }

  return {
    getBest: bestOfOptions
  };
};
