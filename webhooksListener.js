
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

var MochaJuice = require('./mochaJuice');

const installIdsFileName = `${__dirname}/installs.ids`;

/**
 * Helper functions
 */
function signData(secret, data) {
	return 'sha1=' + crypto.createHmac('sha1', secret).update(data).digest('hex');
}

function verifySignature(secret, data, signature) {
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(signData(secret, data)));
}

function loadInstallations() {
    // read the file containing lines with installation id
    var instanceMap = {};
    if (fs.existsSync(installIdsFileName)) {
        fs.readFileSync(installIdsFileName, 'utf-8')
        .split('\n')
        .filter(Boolean)
        .forEach(str => {
            const installation = parseInt(str, 10);
            if (installation) {
                instanceMap[installation] = new MochaJuice(installation);
            }
        });
    }
    return instanceMap;
}

function saveInstallations(mJInstances) {
    const toSave = Object.keys(mJInstances).join('\n') + '\n';

    // write to file
    fs.writeFileSync(installIdsFileName, toSave);
}

// a mapping of installations to MochaJuice instances
var installations = loadInstallations();

let app = express();
app.use(bodyParser.json());

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

// process and dispatch incoming events
app.post('/incoming', (req, res, next) => {
    // now handle incoming events
    let event = req.event;
    let repoName = req.body.repository && req.body.repository.name;
    let data = req.body;

    //console.log("Received a " + event + " event for the repository " + repoName + ".");

    // select the correct mochaJuice instance
    if (!data.installation || !data.installation.id) {
        console.error(`No installation given for event ${event} in ${repoName}.`);
        return res.status(400).send('Sorry, no installation id was given, we do not handle this here.');
    }
    const mochaJuice = installations[data.installation.id];
    // integration_installation is deprecated and will be removed in the future, but as of July 2019 is still send
    if (!mochaJuice && event !== 'installation' && event !== 'integration_installation') {
        console.error(`Installation ${data.installation.id} unknown???`);
        return res.status(500).send('Unrecoverable error occured, installation unknown.');
    }

    switch (event) {
        /**
         * INSTALLATION event
         */
        case 'installation':
        const installId = parseInt(data.installation ? data.installation.id : '0');
        if (!installId) {
            console.error('No install id in installation even.');
            return res.status(400).send('Installation id not provided.');
        }
        // somebody installed this app, but only allow
        // mbiegert, ethjunio, skaan as owner
        if (data.action === "created") {
            const accountName = data.installation.account.login;
            if (accountName !== 'mbiegert'
                    && accountName !== 'skaan'
                    && accountName !== 'ethjunio'
                    && accountName !== 'deeperior') {
                console.log(`${accountName} tried to install this app, phew.`);
                return res.status(403).status('Sorry, you are not allowed to install this app.');    
            }
            installations[installId] = new MochaJuice(installId);
            res.status(201).send('Mochatime app successfully installed.');
            saveInstallations(installations);
            return true;
        }
        else if (data.action === "deleted") {
            delete installations[installId];
            res.status(200).send('Mochatime app successfully removed.');
            saveInstallations(installations);
            return true;
        }
        else {
            // NoOp
            return res.sendStatus(204);
        }

        /**
         * CHECK_SUITE event
         */
        case 'check_suite':
        if (data.action === "requested" || data.action === "rerequested") {
            // ask github to create a new check_run
            let owner = data.repository.owner.login;
            let sha = data.check_suite.head_sha;
            mochaJuice.createCheckRun(owner, repoName, "Mocha tests", sha);
            // don't wait for the api call, but return success
            return res.status(201);
        }
        else if (data.action === "completed") {
            return res.status(202).send("No action taken.");
        }
        else {
            console.log('check_suite event with action ' + data.action);
            return res.status(202).send("No action taken.");
        }

        /**
         * CHECK_RUN event
         */
        case 'check_run':
        //console.log(data);
        // check that we are actually responsible for this check run
        if (data.check_run.app.id.toString() !== process.env.GITHUB_APP_IDENTIFIER) {
            return res.status(202).send("No action taken, not responsible.");
        }
        if (data.action === "created") {
            // the check run was created and we can start testing, yei
            // start testing
            let owner = data.repository.owner.login;
            let checkId = data.check_run.id;
            let commitHash = data.check_run.head_sha;
            mochaJuice.initiateCheckRun(owner, repoName, checkId, commitHash);
            return res.status(201).send("Running a check.");
        }
        else if (data.action === "rerequested") {
            // ask github to create a new check_run
            let owner = data.repository.owner.login;
            let sha = data.check_run.head_sha;
            mochaJuice.createCheckRun(owner, repoName, "Mocha tests", sha);
            // don't wait for the api call, but return success
            return res.status(201);
        }
        else if (data.action === "completed") {
            return res.status(202).send("No action taken.");
        }
        else {
            console.log('check_run event with action ' + data.action);
            return res.status(202).send("No action taken.");
        }
        /**
         * Send a noop in case of any other event
         */
        default:
        return res.sendStatus(204);
    }
});

// handle errors for incoming webhooks
app.post('/incoming', (error, req, res, next) => {
    console.error(error);
    res.status(500).send("Server error occured, view log.");
});


const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log(`MochaTime app listening on port ${port}!`);
});
