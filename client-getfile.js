/**
 * hlg-html2img
 *
 * client-makeshot
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var async = require('async');
var through = require('through2');

var tools = require('./tools');
var SocketAdp = require('./SocketAdp');

// init
console.log('Strat client...');
tools.time('Client process');

var type = 'getfile';
var urls = [
    '__out/makeshot-001/out.png'
];

var io = net.connect({
    host: 'localhost',
    // host: '172.16.2.198',
    port: 3000
});

var client = new SocketAdp(io);

io.on('connect', function() {
    console.log('Client connected');

    sendConfig(urls.shift());
});

var results = [];
client.on('data', function(e) {
    tools.timeEnd('Process Config ['+ results.length +']', true);
    results.push(e);

    var outPath = 'getfile_test.png';
    console.log('ondata', e.type, outPath);
    console.log('----\n');

    // debug, preview
    var data = e.data;
    fs.writeFileSync(outPath, data, {
        encoding: 'binary'
    });

    if(urls.length) {
        sendConfig(urls.shift());
    }
    else {
        // end
        tools.timeEnd('Client process', true);

        io.end();
    }
});


function sendConfig(url) {
    console.log('Start Process Config ['+ results.length +']');
    tools.time('Process Config ['+ results.length +']');

    getConfig(url, function(config) {
        client.send(type, config);
    });
}

function getConfig(url, callback) {
    callback({
        id: '001',
        url: url
    });
}
