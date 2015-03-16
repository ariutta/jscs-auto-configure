/*jslint devel: true */

var _ = require('lodash');
var fs = require('fs');
var getJscsErrors = require('./get-jscs-errors');
var ComparisonPatch = require('./comparison-patch');
var gulp = require('gulp');
var highland = require('highland');
var path = require('path');
var utils = require('./utils');

module.exports = function(providedInputPath, providedOutputPath) {
  providedOutputPath = providedOutputPath ||
      // TODO this should possibly look for the first existing
      // or parent directory with a git repo or a package.json.
      path.resolve(process.cwd(), './new-jscs.json');
  var comparisonPatch;
  var inputPath = path.resolve(providedInputPath);
  var outputPath = path.resolve(providedOutputPath);
  var customJscsrc = {};

  // TODO get this from the jscs code. Don't hard-code it here.
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

  /**
   * Determine which preset has the fewest errors.
   * Return the jscsrc, dereferenced, and the errors
   * for that preset.
   *
   */
  var presetStream = highland(presetNames)
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
        push(err);
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
    push(err);
  })
  .map(function(data) {
    var presetJscsrc = JSON.parse(fs.readFileSync(path.resolve(
        __dirname, '../node_modules/jscs/presets/' + data.preset + '.json'),
        {encoding: 'utf8'}));
    customJscsrc = _.clone(presetJscsrc);
    comparisonPatch = new ComparisonPatch(inputPath, presetJscsrc);
    return data;
  });

  var errorStream = presetStream.fork()
  .map(function(data) {
    return data.errors;
  })
  .sequence();

  /*********************************
   * Find the best JSCS values
   * for specific rules or types of rules.
   *********************************/

  var validateIndentationStream = errorStream.fork()
  .filter(function(error) {
    var ruleName = error.rule;
    return ruleName.indexOf('validateIndentation') > -1;
  })
  .flatMap(function(error) {
    var rule = error.rule;
    var indentationValues = [
      '\t',
      2,
      4
    ];
    return highland(indentationValues).map(function(indentationValue) {
      return highland([{
        replace: {
          'validateIndentation': indentationValue
        }
      }]);
    })
    .reduce1(function(previousStream, currentStream) {

      if (!highland.isStream(previousStream)) {
        previousStream = highland([previousStream]);
      }

      return previousStream.zip(currentStream).flatMap(function(item) {
        return comparisonPatch.getBest(
            item[0].replace, item[1].replace);
      });
    })
    .flatten();
  })
  .map(function(patch) {
    return patch;
  });

  var validateQuoteMarksStream = errorStream.fork()
  .filter(function(error) {
    var rule = error.rule;
    return rule === 'validateQuoteMarks';
  })
  .map(function(error) {
    return {
      validateQuoteMarks: {'mark': true, 'escape': true}
    };
  })
  .map(function(result) {
    var patch = {};
    patch.replace = null;
    patch.create = result;
    return patch;
  });

  var spacesInsideArrayBracketsStream = errorStream.fork()
  .filter(function(error) {
    var ruleName = error.rule;
    return ruleName.indexOf('SpacesInsideArrayBrackets') > -1;
  })
  .flatMap(function(error) {
    var existingRuleName = error.rule;
    var existingRuleValue = 'all';
    /* TODO should it be this?
    var existingRuleValue = {
      'allExcept': ['[', ']', '{', '}']
    };
    //*/

    var existingOption = utils.convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);

    var alternateRuleName = existingRuleName.replace('require', 'DISALLOW')
      .replace('disallow', 'REQUIRE')
      .replace('DISALLOW', 'disallow')
      .replace('REQUIRE', 'require');

    var alternateOption = utils.convertPairToMap([
      alternateRuleName,
      existingRuleValue
    ]);

    /*
    var existingOption = {};
    //existingRuleOption[alternateRuleName] = 'all';
    existingOption[alternateRuleName] = 'all';

    var alternateOption = {};
    alternateOption[existingRuleName] = 'all';
    //*/

    return comparisonPatch.getBest(
        existingOption, alternateOption);
    /*
    var patch = {};
    patch.create = alternateRuleOption;
    return patch;
    //*/
  });

  var multipleVarDeclStream = errorStream.fork()
  .filter(function(error) {
    var rule = error.rule;
    return rule.indexOf('MultipleVarDecl') > -1;
  })
  .map(function(error) {
    var existingRuleName = error.rule;
    var alternateRuleName = existingRuleName.replace('require', 'DISALLOW')
      .replace('disallow', 'REQUIRE')
      .replace('DISALLOW', 'disallow')
      .replace('REQUIRE', 'require');

    var alternateRuleOption = {};
    alternateRuleOption[alternateRuleName] = true;

    var patch = {};
    patch.delete = existingRuleName;
    patch.create = alternateRuleOption;
    return patch;
  });

  /**
   * General checker for rules that start with
   * "require" or "disallow".
   */
  var requireDisallowStream = errorStream.fork()
  .filter(function(error) {
    var rule = error.rule;
    return rule.indexOf('SpacesInsideArrayBrackets') === -1 &&
        rule.indexOf('requireMultipleVarDecl') === -1 &&
        (rule.indexOf('require') > -1 || rule.indexOf('disallow') > -1);
  })
  .flatMap(function(error) {
    var existingRuleName = error.rule;
    var existingRuleValue = customJscsrc[existingRuleName];

    var existingOption = utils.convertPairToMap([
      existingRuleName,
      existingRuleValue
    ]);

    var alternateRuleName = existingRuleName.replace('require', 'DISALLOW')
      .replace('disallow', 'REQUIRE')
      .replace('DISALLOW', 'disallow')
      .replace('REQUIRE', 'require');

    var alternateOption = utils.convertPairToMap([
      alternateRuleName,
      existingRuleValue || true
    ]);

    return comparisonPatch.getBest(existingOption, alternateOption);
  });

  /********************************
   * End checker for specific rules.
   ********************************/

  var ruleOptionStream = highland([
      validateIndentationStream,
      spacesInsideArrayBracketsStream,
      validateQuoteMarksStream,
      multipleVarDeclStream,
      requireDisallowStream
    ])
    .merge();

  var outputStream = ruleOptionStream
    .map(function(patch) {

      var create = patch.create;
      var nameOfRuleToDelete = patch.delete;
      var replace = patch.replace;

      if (!!nameOfRuleToDelete) {
        delete customJscsrc[nameOfRuleToDelete];
      }

      if (!!replace) {
        var replaceName = _.keys(replace)[0];
        var replaceValue = replace[replaceName];
        if (_.isEmpty(replace)) {
          delete customJscsrc[replaceName];
        } else {
          _.assign(customJscsrc, replace);
        }
      }

      _.assign(customJscsrc, create);
      return customJscsrc;
    })
    .map(function(jscsrc) {
      var jscsrcString = JSON.stringify(jscsrc, null, '  ');
      return jscsrcString;
    });

  outputStream
    .last()
    //.pipe(process.stdout)
    .pipe(fs.createWriteStream(outputPath));

};
