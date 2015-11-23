/**
 * hlg-html2img
 *
 * client-makeshot
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var through = require('through2');

var tools = require('../lib/tools');
var SocketAdp = require('../lib/SocketAdp');

// init
console.log('Strat client...');
tools.time('Client process');

var id = 'makeshot-001';
var url = '__out/makeshot-001/out.jpg';

var io = net.connect({
    host: 'localhost',
    // host: '172.16.2.198',
    port: 3000
});

var results = [];
var client = new SocketAdp(io);

io.on('connect', function() {
    console.log('Client connected');

    console.log('Start getfile');
    tools.time('Process getfile');
    client.send('getfile', {
        id: id,
        url: url
    });
});

client.on('data', function(e) {
    console.log('ondata', e.type);

    if(e.type === 'file') {
        var outPath = 'getfile_test.png';

        fs.writeFileSync(outPath, e.data, {
            encoding: 'binary'
        });

        console.log('ondata,' + outPath + ', file length:', e.dataLength);
        console.log('----\n');

        tools.timeEnd('Process getfile', true);

        client.send('clean', {
            id: id
        });
    }
    else if(e.type === 'clean_result') {
        console.log('clean_result', e.data.length, e.data.toString());

        io.end();
    }
});
