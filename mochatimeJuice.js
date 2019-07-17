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
async function createCheckRun (owner, repo, name, commitSha) {
  return await octokit.checks.create({
    owner,
    repo,
    name,
    head_sha: commitSha
  });
}

module.exports = {
  createCheckRun,
}