var jscsAutoconfigure = require('../../lib/index');

var inputPath = __dirname + '/../input-data/open-id-connect.js';
var outputFile = './new-jscsrc.json';

jscsAutoconfigure(inputPath, outputFile);
