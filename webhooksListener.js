
var express = require('express');
var bodyParser = require('body-parser');
var GithubWebHook = require('express-github-webhook');
require('dotenv').config();

var mochaJuice = require('./mochatimeJuice');

// create the github handler
var webhookHandler = GithubWebHook({
    path: '/incoming',
    secret: process.env.GITHUB_WEBHOOK_SECRET,
});

let app = express();
app.use(bodyParser.json());
app.use(webhookHandler);

webhookHandler.on('*', (event, repo, data) => {
    console.log("Received a " + event + " event for the repository " + repo + ".");
});

webhookHandler.on('check_suite', async (repo, data) => {
    //console.log(data);
    if (data.action === "requested" || data.action === "rerequested") {
        try {
            let sha = data.check_suite.head_sha;
            let owner = data.repository.owner.login;
            let result = await mochaJuice.createCheckRun(owner, repo, "Mocha tests", sha);    
            console.log(result);
        }
        catch (error) {
            console.error(error);
        }
    }
    else {
        console.log(data.action);
    }
});



app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
