var fs = require('fs');
var getJscsErrors = require('../../lib/get-jscs-errors');
var resultPath = __dirname + '/jscs-errors-expected.json';
var expectedResult = fs.readFileSync(resultPath, {encoding: 'utf8'});

var inputPath = __dirname + '/../input-data/open-id-connect.js';
var option = {
  preset: 'google'
};

getJscsErrors(option, inputPath)
  .map(function(errors) {
    var errorsString = JSON.stringify(errors);
    var result = 'Test passes? ' + (expectedResult === errorsString) + '\r\n';
    return result;
  })
  .pipe(process.stdout);
