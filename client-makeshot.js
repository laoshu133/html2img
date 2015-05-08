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

var type = 'makeshot';
var configs = [
    'demos/makeshot.json',
    'demos/makeshot-big.json',
    'demos/makeshot.json'
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

    // setTimeout(function() {
    //     io.end();
    //     io.destroy();
    // }, 10);
});

var results = [];
client.on('data', function(e) {
    tools.timeEnd('Process Config ['+ results.length +']', true);
    results.push(e);

    if(e.type === 'makeshot_result') {
        console.log('ondata, type:', e.type);
        console.log(e.data.toString() + '\n');
    }

    if(e.type === 'file') {
        var outPath = 'getfile_test.png';
        fs.writeFileSync(outPath, e.data, {
            encoding: 'binary'
        });

        console.log('ondata,' + outPath + ', file length:', e.dataLength);
        console.log('----\n');

        io.end();

        // end
        tools.timeEnd('Client process', true);

        return;
    }

    if(configs.length) {
        sendConfig(configs.shift());
    }
    else {
        // getfile
        client.send('getfile', {
            id: '001',
            url: '__out/makeshot-001/out.png'
        });
    }
});


function sendConfig(configPath) {
    console.log('Start Process Config ['+ results.length +']');
    tools.time('Process Config ['+ results.length +']');

    getConfig(configPath, function(config) {
        client.send(type, config);
    });
}

function getConfig(configPath, callback) {
    var rs = fs.createReadStream(configPath);

    var len = 0;
    var data = [];

    rs.pipe(through(function(chunk, enc, cb) {
        len += chunk.length;
        data.push(chunk);

        cb();
    }));

    rs.on('end', function() {
        var config = Buffer.concat(data, len);

        callback(config);
    });
}
