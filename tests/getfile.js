/**
 * hlg-html2img
 *
 * client-makeshot
 *
 */

// deps
var fs = require('fs');
var net = require('net');

var SocketAdp = require('../lib/SocketAdp');

// init
console.log('Strat client...');

var id = 'makeshot-001';
var url = '__out/makeshot-001/out.jpg';

var io = net.connect({
    host: 'localhost',
    // host: '172.16.2.198',
    port: 3000
});

var client = new SocketAdp(io);

io.on('connect', function() {
    console.log('Client connected');

    console.log('Start getfile');
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

        client.send('clean', {
            id: id
        });
    }
    else if(e.type === 'clean_result') {
        console.log('clean_result', e.data.length, e.data.toString());

        io.end();
    }
});
