var fs = require('fs');
var getJscsErrors = require('../../lib/get-jscs-errors');
var resultPath = __dirname + '/jscs-errors-expected.json';
var expectedResult = fs.readFileSync(resultPath, {encoding: 'utf8'});

var inputPath = __dirname + '/../input-data/open-id-connect.js';
var option = {
  preset: 'google'
};

getJscsErrors(option, inputPath)
  /*
  .sequence()
  .filter(function(error) {
    // Make sure the rule is supported
    return !error.message ||
        error.message.indexOf('Unsupported rule') === -1;
  })
  //*/
  .map(function(errors) {
    var errorsString = JSON.stringify(errors);
    console.log('test passes?');
    console.log(expectedResult === errorsString);
    fs.writeFileSync(resultPath, errorsString);
    return errorsString;
  })
  .pipe(process.stdout);
