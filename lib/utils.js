var fs = require('fs');
var path = require('path');

function convertPairToMap(pair) {
  var key = pair[0];
  var value = pair[1];
  var option = {};
  option[key] = value;
  return option;
}

/*
 * TODO can we delete this? It's not being used.
 * Run JSCS for one specific rule, returning
 * only supported errors.
 */
/*
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
//*/

module.exports = {
  convertPairToMap: convertPairToMap
};
