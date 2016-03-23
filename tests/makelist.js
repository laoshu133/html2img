/**
 * hlg-html2img
 *
 * makelist
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var path = require('path');
var through = require('through2');

var SocketAdp = require('../lib/SocketAdp');

// init
console.log('Strat client...');

var configs = [
    // 'demos/makelist.json',
    'demos/makelist-taobao.json',
    'demos/makelist.json'
];

var io = net.connect({
    host: 'localhost',
    // host: '192.168.10.134',
    port: 3000
});

var client = new SocketAdp(io);

var lastConfig;
var lastResult;

client.on('data', function(e) {
    lastResult = e.data;

    console.log('\n---'+ e.type +'--'+ e.data.length + '---');

    if(e.type === 'makelist_result') {
        console.log(e.data.toString());

        getFile();
    }
    else {
        // console.log(e.raw.slice(0, 40).toString());
        // console.log(e.data.slice(0, 40));
        console.log('\n');

        makelist();
    }
});

io.on('connect', function() {
    console.log('Client connected');

    makelist();
});

var count = 0;
function makelist() {
    var cfgPath = configs.shift();

    if(!cfgPath) {
        console.log('makelist, No cfg...');
        io.end();

        return;
    }

    console.log('start makelist ['+ (count++) +']');

    var relativePath = path.relative(process.cwd(), __dirname + '/..');
    cfgPath = path.join(relativePath, cfgPath);

    getConfig(cfgPath, function(data) {
        var cfg = JSON.parse(data.toString());

        lastConfig = cfg;
        client.send('makelist', cfg);
    });
}

function getFile() {
    var cfg = lastConfig;
    if(!cfg) {
        console.log('Getfile, No cfg...');
        io.end();

        return;
    }

    var res = JSON.parse(lastResult.toString());

    console.log(cfg.id, res.data.image);
    client.send('getfile', {
        id: cfg.id,
        url: res.data.image
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
