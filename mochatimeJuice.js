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
    runner.run()
    .on('end', function () {
      let results = this.testResults;

      // mocha is done, delete the repository
      exec('rm -rf ./'+directory, (error, stdout, stderr) => {
        if (error) {
          console.error("error when removing run dir");
          console.error(error.message);
        }
      });
      // now report the results to github
      try {
        // report result
        octokit.checks.update({
          owner, repo, check_run_id: checkId,
          status: 'completed',
          conclusion: results.failed?'failure':'success',
          completed_at: new Date().toISOString(),
          output: {
            title: 'Mocha results',
            summary: results.summary,
            text: results.text,
          },
        });
      }
      catch (error) {
        console.error("Failure when reporting results.");
        console.error(error);
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


module.exports = {
  createCheckRun,
  initiateCheckRun,
}
