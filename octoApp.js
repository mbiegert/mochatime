const { App } = require('@octokit/app');
const Octokit = require('@octokit/rest')
  .plugin(require('@octokit/plugin-throttling'))
  .plugin(require('@octokit/plugin-retry'))
  .plugin(installTokenPlugin);

var app = new App({ id: process.env.GITHUB_APP_IDENTIFIER, privateKey: process.env.GITHUB_PRIVATE_KEY });

// offer a method to get installation tokens for this install
// careful, this is an async function that returns a promise!
function installTokenPlugin (octokit) {
  octokit.getInstallToken = () => {
    return app.getInstallationAccessToken({
      installationId: octokit.INSTALLATION_ID,
    });
  };
}

// make the app instance available
module.exports = (installId) => {

  // initialize the API wrapper
  const octokit = new Octokit({
    async auth () {
      const installationAccessToken = await app.getInstallationAccessToken({ 
        installationId: installId,
      });
      return `token ${installationAccessToken}`;
    },
    throttle: {
      onRateLimit: (retryAfter, options) => {
        console.warn(`Request quota exhausted for request ${options.method} ${options.url}`);

        if (options.request.retryCount === 0) { // only retries once
          console.log(`Retrying after ${retryAfter} seconds!`)
          return true;
        }
      },
      onAbuseLimit: (retryAfter, options) => {
        // does not retry, only logs a warning
        console.warn(`Abuse detected for request ${options.method} ${options.url}`);
      }
    }
  });
  octokit.INSTALLATION_ID = installId;
  return octokit;
};
