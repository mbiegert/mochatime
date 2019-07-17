// this module contains the actual functions that do something
// octokit instance to reuse
const octokit = require('./octoApp');

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

async function initiateCheckRun(owner, repo, checkId) {
  try {
    // first update the status to 'in_progress'
    await octokit.checks.update({
      owner, repo, check_run_id: checkId,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    });
    
    // run mocha
    
  }
  catch (error) {
    console.error("Failure in initiateCheckrun.");
    console.error(error);
  }
  try {
    // report result
    await octokit.checks.update({
      owner, repo, check_run_id: checkId,
      status: 'completed',
      conclusion: 'success',
      completed_at: new Date().toISOString(),
    });
  }
  catch (error) {
    console.error("Failure in initiateCheckrun.");
    console.error(error);
  }
}

module.exports = {
  createCheckRun,
  initiateCheckRun,
}
