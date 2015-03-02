var fs = require("fs");
var gulp = require("gulp");
var jscs = require("./jscs-runner");
var highland = require("highland");

var jscsrc = {
	"preset": "google"
};

var customJscsrc = {};

var presets = [
  "airbnb",
  "crockford",
  "google",
  "grunt",
  "jquery",
  "mdcs",
  "wikimedia",
  "yandex"
];

var lowestErrorCount = Infinity;
highland(presets).map(function(preset) {
  return {
    preset: preset
  }
})
.flatMap(function(option) {
  console.log("option");
  console.log(option);
  return gulp.src("index.js")
      .pipe(jscs(option))
      .pipe(highland.pipeline(function(s) {
        return s
        .errors(function(err, push) {
          console.log("err2a");
          console.log(err);
          push(null, err);
        })
        .map(function(file) {
          return {
            preset: option.preset,
            errors: file.jscs.errors
          }
        })
        .flatFilter(function(errorsByPreset) {
          return highland(errorsByPreset.errors)
          .uniqBy(function(a, b) {
            return a.rule === b.rule
          })
          .collect()
          .map(function(errors) {
            var errorCount = errors.length;
            console.log("errorCount");
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
          console.log("err2b");
          console.log(err);
          push(null, err);
        });
      }))
      .errors(function(err, push) {
        console.log("err2c");
        console.log(err);
        push(null, err);
      });
})
.errors(function(err, push) {
  console.log("err first line");
  console.log(err);
  push(null, err);
})
/*
.group("preset")
.flatMap(highland.pairs)
.map(function(pair) {
  return {
    preset: pair[0],
    length: pair[1].length
  }
})
//*/
.last()
.flatMap(function (data) {
  var presetJson = JSON.parse(fs.readFileSync(
      "./node_modules/jscs/presets/" + data.preset + ".json",
      {encoding: "utf8"}));
  customJscsrc.preset = data.preset;
  return highland(data.errors).group("rule")
  .flatMap(highland.pairs)
  .map(function(pair) {
    return {
      preset: data.preset,
      presetJson: presetJson,
      rule: pair[0],
      errors: pair[1],
      errorCount: pair[1].length
    }
  });
})
.filter(function(data) {
  var rule = data.rule;
  if (rule === 'validQuoteMarks') {
    customJscsrc.validateQuoteMarks = {"mark": "\"", "escape": true};
  }
  return rule.indexOf("require") > -1 || rule.indexOf("disallow") > -1;
})
.flatMap(function(data) {
  var rule = data.rule;
  /*
  console.log("data");
  console.log(data);
  //*/

  var alternateRule = rule.replace("require", "DISALLOW")
    .replace("disallow", "REQUIRE")
    .replace("DISALLOW", "disallow")
    .replace("REQUIRE", "require");

  var alternateOption = {
    preset: data.preset,
  };

  var ruleValue = data.presetJson[rule];
  alternateOption[alternateRule] = ruleValue;

  /*
  if (ruleValue === true || ruleValue === false) {
    alternateOption[alternateRule] = ruleValue;
  } else {
    alternateOption[alternateRule] = ruleValue;
  }
  //*/

  console.log("rule");
  console.log(rule);

  console.log("alternateOption");
  console.log(alternateOption);

  return gulp.src("index.js")
      .pipe(jscs(alternateOption))
      .pipe(highland.pipeline(function(s) {
        return s
        .errors(function(err, push) {
          console.log("err2a");
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
                error.message.indexOf("Unsupported rule") > -1;
          }).length === 0;
        })
        .filter(function(errors) {
          /*
          console.log("errors");
          console.log(errors);
          //*/
          console.log('data.errorCount');
          console.log(data.errorCount);
          // Filter to only include alternate rules that reduce
          // the error count.
          var alternateErrors = errors.filter(function(error) {
            return error.rule === alternateRule;
          });
          console.log("alternateErrors.length");
          console.log(alternateErrors.length);
          return alternateErrors.length < data.errorCount;
        })
        .map(function(errors) {
          console.log("good alternateOption");
          console.log(alternateOption);
          return highland([alternateOption]);
        })
        .errors(function(err, push) {
          console.log("err2b");
          console.log(err);
          push(null, err);
        });
      }))
      .errors(function(err, push) {
        console.log("err2c");
        console.log(err);
        push(null, err);
      });
})
.map(function(data) {
  console.log("final data");
  console.log(data);
  console.log('customJscsrc');
  console.log(customJscsrc);
  return "";
  //return data.toString();
  //return JSON.stringify(data);
})
.pipe(process.stdout);

/*
gulp.src("index.js")
    .pipe(jscs(jscsrc))
    .pipe(highland.pipeline(function(s) {
      return s
      .errors(function(err, push) {
        console.log("err");
        console.log(err);
        push(null, err);
      })
      .flatMap(function(file) {
        console.log("errors");
        console.log(file.jscs.errors);
        return highland([JSON.stringify(file.jscs)]);
      });
    }))
    .pipe(process.stdout);
    //*

/*
var Checker = require("jscs");

console.log(String(Checker));

var checker = new Checker();
checker.registerDefaultRules();

hep = 1


var errors = checker.checkPath("./index.js");
console.log("errors");
console.log(JSON.stringify(errors));
var errorList = errors.getErrorList();

errorList.forEach(function (err) {
  console.log(errors.explainError(err, true));
});
//*/
