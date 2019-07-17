// use octokit
const { App } = require('@octokit/app');
const Octokit = require('@octokit/rest')
  .plugin(require('@octokit/plugin-throttling'))
  .plugin(require('@octokit/plugin-retry'));

// authenticate
const app = new App({ id: process.env.GITHUB_APP_IDENTIFIER, privateKey: process.env.GITHUB_PRIVATE_KEY })
const octokit = new Octokit({
  async auth () {
    const installationAccessToken = await app.getInstallationAccessToken({ 
      installationId: process.env.GITHUB_INSTALLATION_ID 
    });
    return `token ${installationAccessToken}`;
  },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      octokit.log.warn(`Request quota exhausted for request ${options.method} ${options.url}`)
  
      if (options.request.retryCount === 0) { // only retries once
        console.log(`Retrying after ${retryAfter} seconds!`)
        return true
      }
    },
    onAbuseLimit: (retryAfter, options) => {
      // does not retry, only logs a warning
      octokit.log.warn(`Abuse detected for request ${options.method} ${options.url}`)
    }
  }
});

// make the app instance available
module.exports = octokit;
