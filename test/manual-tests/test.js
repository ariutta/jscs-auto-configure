var jscsAutoconfigure = require('../../lib/index');

var inputPath = '../OpenIDConnect/index.js';
var outputFile = './new-jscsrc.json';

jscsAutoconfigure(inputPath, outputFile);
