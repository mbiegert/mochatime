// this module contains the actual functions that do something
// octokit instance to reuse
const octokit = require('./octoApp');
const { execFileSync, exec } = require('child_process');

/**
 * 
 * @param {Object} octokit 
 * @param {String} repo The full repository name.
 * @param {String} name The name of the check run to create.
 * @param {String} commitSha The commit sha for which the check run should be created.
 */
function createCheckRun(owner, repo, name, commitSha) {
  octokit.checks.create({
    owner,
    repo,
    name,
    head_sha: commitSha
  })
  .then(result => {
    console.log("Successfully created a check_run for mocha tests.");
  })
  .catch(err => {
      console.error("Failed to create check_run.");
      console.error(err);
  });
}

async function initiateCheckRun(owner, repo, checkId, commitHash) {
  try {
    // first update the status to 'in_progress'
    await octokit.checks.update({
      owner, repo, check_run_id: checkId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });

    // run mocha
    let installationAccessToken = await octokit.appInstance.getInstallationAccessToken({
      installationId: process.env.GITHUB_INSTALLATION_ID,
    });
    // create a temporary directory for this run
    let directory = "run" + checkId;
    execFileSync('./prepareDir.sh', {
      stdio: 'ignore',
      env: {
        TOKEN: installationAccessToken,
        OWNER: owner,
        REPO: repo,
        DIRECTORY: directory,
        REF: commitHash,
      }
    });

    // run mocha
    let runner = require('./' + directory + '/mochatimeRunMocha');
    // run mocha, see
    // https://github.com/mochajs/mocha/blob/8cae7a34f0b6eafeb16567beb8852b827cc5956b/lib/runner.js#L47-L57
    // for possible events
    runner.run((failed) => {
      // mocha is done, delete the repository and report end of checkSuite
      // delete the directory again
      exec('rm -rf ./'+directory, (error, stdout, stderr) => {
        if (error) {
          console.error("error when removing run dir");
          console.error(error.message);
        }
      });
    })
    .on('test end', function(test) {
      //console.log('Test done: '+test.title);
    })
    .on('pass', function(test) {
      //console.log('Test passed');
      //console.log(test);
    })
    .on('fail', function(test, err) {
      console.log('Test fail');
      //console.log(test);
      //console.log(err);
      // sneakily add the error message to the test object
      test.XXErrorMessage = err.message;
    })
    .on('suite end', function(suite) {
      //console.log('Suite ended.');
      //console.log(suite);
      if (suite.root) {
        dispatchMochaResults(suite, owner, repo, checkId);
      }
    });
  }
  catch (error) {
    console.error("Failure in initiateCheckrun.");
    console.error(error);
    // report an aborted run
    await octokit.checks.update({
      owner, repo, check_run_id: checkId,
      status: 'completed',
      conclusion: 'cancelled',
      completed_at: new Date().toISOString(),
    });
  }
}

function dispatchMochaResults(rootSuite, owner, repo, checkId) {
  let numPassed = 0;
  let numFailed = 0;
  let text = '';
  let currentIndentLevel = '###';
  if (!rootSuite.root) {
    // whoops, we don't want that
    return;
  }

  console.log("Will start wrapping up.");

  // first define some output generating functions
  function handleSuite(suite) {
    if (!suite.root) {
      text += currentIndentLevel + ' Test suite ' + suite.title + '\n';
      currentIndentLevel += '#';
    }

    // TODO: tell if checksuite passed/failed

    // handle each test
    suite.tests.forEach(handleTest);

    // handle subsequent suites
    suite.suites.forEach(handleSuite);

    if (!suite.root) {
      currentIndentLevel = currentIndentLevel.slice(1);
    }
  }

  function handleTest(test) {
    if (test.state === 'passed') {
      text += ':heavy_check_mark: ';
    }
    else if (test.state === 'failed') {
      text += ':x: ';
    }
    else {
      text += ':children_crossing: ';
    }
    text += test.title + '\n';

    if (test.state === 'failed') {
      numFailed++;
    }
    else if (test.state === 'passed') {
      numPassed++;
    }
  }

  handleSuite(rootSuite);

  console.log("About to send.");

  let summary = 'Mocha tests concluded with '
    + numPassed + ' passing and '
    + numFailed + ' failed tests.';

  // now report the results to github
  try {
    // report result
    text += '\n' + new Date().toLocaleTimeString();
    console.log(text);
    octokit.checks.update({
      owner, repo, check_run_id: checkId,
      status: 'completed',
      conclusion: numFailed?'failure':'success',
      completed_at: new Date().toISOString(),
      output: {
        title: 'Mocha results',
        summary,
        text,
      },
    });
  }
  catch (error) {
    console.error("Failure when reporting results.");
    console.error(error);
  }

}

module.exports = {
  createCheckRun,
  initiateCheckRun,
}
