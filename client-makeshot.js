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

var configs = [
    'demos/makeshot.json',
    'demos/makeshot-big.json'
];

var io = net.connect({
    host: 'localhost',
    // host: '172.16.2.198',
    port: 3000
});

var client = new SocketAdp(io);

io.on('connect', function() {
    console.log('Client connected');

    sendConfig(configs.shift());
});

var results = [];
client.on('data', function(e) {
    tools.timeEnd('Process Config ['+ results.length +']', true);
    results.push(e);

    console.log(e);

    if(configs.length) {
        sendConfig(configs.shift());
    }
    else {
        // end
        tools.timeEnd('Client process', true);
    }
});


function sendConfig(configPath) {
    tools.time('Process Config ['+ results.length +']');

    getConfig(configPath, function(config) {
        client.send('makeshot', config);
    });
}

function getConfig(configPath, cb) {
    var rs = fs.createReadStream(configPath);

    var len = 0;
    var data = [];

    rs.pipe(through(function(chunk) {
        len += chunk.length;
        data.push(chunk);
    }));

    rs.on('end', function() {
        var config = Buffer.concat(data, len);

        cb(config);
    })
}
