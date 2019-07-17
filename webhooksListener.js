
var express = require('express');
var bodyParser = require('body-parser');
const crypto = require('crypto');
require('dotenv').config();

var mochaJuice = require('./mochatimeJuice');

/**
 * Helper functions
 */
function signData(secret, data) {
	return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
}

function verifySignature(secret, data, signature) {
	return crypto.timingSafeEqual(signature, signData(secret, data));
}

let app = express();
app.use(bodyParser.json());
//app.use(webhookHandler);
// this middleware checks incoming github api webhooks for their validity
app.post('/incoming', (req, res, next) => {
    // for simplicity we don't use the error handler here, but return an
    // appropriate response directly
    const id = req.header('X-Github-Delivery');
    if (!id) {
        return res.status(400).send("Malformed request, no delivery id found.");
    }
    let event = req.header('X-Github-Event');
    if (!event) {
        return res.status(400).send("Malformed request, no event name found.");
    }
    let signature = req.header('X-Hub-Signature');
    if (!verifySignature(process.env.GITHUB_WEBHOOK_SECRET, JSON.stringify(req.body), signature)) {
        return res.status(400).send("Malformed request, failed to verify signature.");
    }

    // make event name directly accessible to following middleware
    req.event = event;
    return next();
});

app.post('/incoming', (req, res, next) => {
    // now handle incoming events
    let event = req.event;
    let repoName = req.body.repository && req.body.repository.name;
    let data = req.body;

    console.log("Received a " + event + " event for the repository " + repoName + ".");

    switch (event) {
        /**
         * CHECK_SUITE event
         */
        case 'check_suite':
        if (data.action === "requested" || data.action === "rerequested") {
            // ask github to create a new check_run
            let owner = data.repository.owner.login;
            let sha = data.check_suite.head_sha;
            mochaJuice.createCheckRun(owner, repo, "Mocha tests", sha);
            // don't wait for the api call, but return success
            return res.status(201);
        }
        else {
            console.log(data.action);
            return res.status(202).send("No action taken.");
        }
        /**
         * CHECK_RUN event
         */
        case 'check_run':
        console.log(data);
        // check that we are actually responsible for this check run
        if (data.app.id.toString() !== process.env.GITHUB_APP_IDENTIFIER) {
            return res.status(202).send("No action taken, not responsible.");
        }
        if (data.action === "created") {
            // the check run was created and we can start testing, yei
            // start testing
            return //something
        }
        else if (data.action === "rerequested") {
            // ask github to create a new check_run
            let owner = data.repository.owner.login;
            let sha = data.check_suite.head_sha;
            mochaJuice.createCheckRun(owner, repo, "Mocha tests", sha);
            // don't wait for the api call, but return success
            return res.status(201);
        }
        else {
            console.log(data.action);
            return res.status(202).send("No action taken.");
        }
    }
});

// handle errors for incoming webhooks
app.post('/incoming', (error, req, res, next) => {
    console.log(error);
    res.status(500).send("Server error occured, view log.");
});


app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
