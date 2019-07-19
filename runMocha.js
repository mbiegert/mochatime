// run mocha

var Mocha = require('mocha'),
    fs = require('fs'),
    path = require('path');
const {
  EVENT_SUITE_BEGIN,
  EVENT_SUITE_END,
  EVENT_RUN_END,
  EVENT_TEST_FAIL,
  EVENT_TEST_PASS,
  EVENT_TEST_PENDING,
} = Mocha.Runner.constants;

// a MochaReporter based on the JSON reporter
function MochaTimeGithubReporter (runner, options) {
  var summary = '';
  var text = '';
  var currentIndentLevel = '###';

  runner.on(EVENT_SUITE_BEGIN, suite => {
    if (!suite.root) {
      text += currentIndentLevel + ' Suite ';
      text += suite.title + '\n';
      currentIndentLevel += '#';
    }
  });

  runner.on(EVENT_SUITE_END, suite => {
    if (!suite.root) {
      currentIndentLevel = currentIndentLevel.slice(1);
    }
  });

  runner.on(EVENT_TEST_PASS, function(test) {
    text += ':heavy_check_mark: ';
    text += test.title + '\n';
  });

  runner.on(EVENT_TEST_FAIL, function(test) {
    text += ':x: ';
    text += test.title + '\n';
  });

  runner.on(EVENT_TEST_PENDING, function(test) {
    text += ':children_crossing: ';
    text += test.title + '\n';
  });

  runner.once(EVENT_RUN_END, function() {
    summary = 'Mocha tests concluded with '
      + runner.stats.passes + ' passing, '
      + runner.stats.failures + ' failed and '
      + runner.stats.pending + ' pending tests in '
      + runner.stats.duration + 'ms.';

    var obj = {
      summary,
      text,
      failed: runner.stats.failures ? true : false,
    };

    process.send({ mochaResults: obj });
  });
}

// Instantiate a Mocha instance.
var mocha = new Mocha({
    reporter: MochaTimeGithubReporter,
});

var testDir = __dirname + '/test';

// Add each .js file to the mocha instance
fs.readdirSync(testDir).filter(function(file) {
    // Only keep the .js files
    return file.substr(-3) === '.js';
}).forEach(function(file) {
    mocha.addFile(
        path.join(testDir, file)
    );
});


mocha.run(failures => {
  process.exitCode = failures ? 1 : 0;
  process.exit();
});
