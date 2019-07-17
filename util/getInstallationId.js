// run this script to get the installation id, adjust the parameters to
// the get request as necessary

const { App } = require("@octokit/app");
const { request } = require("@octokit/request");
require('dotenv').config({ path: process.cwd() + '/../.env' });

const APP_ID = process.env.GITHUB_APP_IDENTIFIER;
const PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY;

const app = new App({ id: APP_ID, privateKey: PRIVATE_KEY });
const jwt = app.getSignedJsonWebToken();

// Example of using authenticated app to GET an individual installation
// https://developer.github.com/v3/apps/#find-repository-installation
//request("GET /repos/:owner/:repo/installation", {
request("GET /app/installations", {
  owner: "mbiegert",
  repo: "mochatime",
  headers: {
    authorization: `Bearer ${jwt}`,
    accept: "application/vnd.github.machine-man-preview+json"
  }
}).then((data) => {
  // contains the installation id necessary to authenticate as an installation
  const installationId = data.id;
  console.log(data);
}).catch((err) => {
  console.error(err);
});
