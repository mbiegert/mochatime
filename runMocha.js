// run mocha
var Mocha = require('mocha'),
    fs = require('fs'),
    path = require('path');

// Instantiate a Mocha instance.
var mocha = new Mocha({
    reporter: function () {},
});

var testDir = __dirname + '/test';

// Add each .js file to the mocha instance
fs.readdirSync(testDir).filter(function(file) {
    // Only keep the .js files
    return file.substr(-3) === '.js';
}).forEach(function(file) {
    mocha.addFile(
        path.join(testDir, file)
    );
});


module.exports = mocha
