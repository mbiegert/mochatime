#!/bin/bash

# save the path to the runMocha.js script
runScript="$(pwd)/runMocha.js"


# this script first clones a repository and then execute `npm test` there
git clone "https://x-access-token:$TOKEN@github.com/$OWNER/$REPO.git" "$DIRECTORY" >/dev/null
cd "$DIRECTORY"

git pull >/dev/null
git checkout "$REF" >/dev/null

# install the npm modules
npm --scripts-prepend-node-path=true ci

# copy the run script into the directory
cp "$runScript" "./mochatimeRunMocha.js"
