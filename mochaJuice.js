// this module contains the actual functions that do something
// octokit instance to reuse
const createOcto = require('./octoApp');
const { execFileSync, exec, fork} = require('child_process');

class MochaJuice {
  constructor(installId) {
    this.INSTALLATION_ID = installId;
    this.juicyOcto = createOcto(installId);
  }

  /**
   * 
   * @param {Object} owner The owner of this installation.
   * @param {String} repo The full repository name.
   * @param {String} name The name of the check run to create.
   * @param {String} commitSha The commit sha for which the check run should be created.
   */
  createCheckRun(owner, repo, name, commitSha) {
    console.log('trying to create check_suite');
    this.juicyOcto.checks.create({
      owner,
      repo,
      name,
      head_sha: commitSha
    })
    .then(result => {
      //console.log("Successfully created a check_run for mocha tests.");
    })
    .catch(err => {
        console.error("Failed to create check_run.");
        console.error(err);
    });
  }

  async initiateCheckRun(owner, repo, checkId, commitHash) {
    try {
      // first update the status to 'in_progress'
      await this.juicyOcto.checks.update({
        owner, repo, check_run_id: checkId,
        status: 'in_progress',
        started_at: new Date().toISOString(),
      });

      // run mocha
      let installationAccessToken = await this.juicyOcto.getInstallToken();

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
      let mochaRunner = fork(`${__dirname}/${directory}/mochatimeRunMocha.js`);
      mochaRunner.on('message', m => {
        if (m.mochaResults) {
          // now report the results to github
          this.juicyOcto.checks.update({
            owner, repo, check_run_id: checkId,
            status: 'completed',
            conclusion: m.mochaResults.failed ? 'failure' : 'success',
            completed_at: new Date().toISOString(),
            output: {
              title: 'Mocha results',
              summary: m.mochaResults.summary,
              text: m.mochaResults.text,
            },
          }).catch((error) => {
            console.error("Failure when reporting results.");
            console.error(error);
          });
        }
      });

      mochaRunner.on('exit', exitCode => {
        // mocha is done, delete the repository
        exec('rm -rf ./'+directory, (error, stdout, stderr) => {
          if (error) {
            console.error("error when removing run dir");
            console.error(error.message);
          }
        });
      });
    }
    catch (error) {
      console.error("Failure in initiateCheckrun.");
      console.error(error);
      // report an aborted run
      await this.juicyOcto.checks.update({
        owner, repo, check_run_id: checkId,
        status: 'completed',
        conclusion: 'cancelled',
        completed_at: new Date().toISOString(),
      });
    }
  }
}


module.exports = MochaJuice;
