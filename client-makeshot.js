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

var tools = require('./lib/tools');
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
    // host: '192.168.10.134',
    port: 3000
});

var client = new SocketAdp(io);

var lastConfig;
var lastResult;

client.on('data', function(e) {
    lastResult = e.data;

    console.log('\n---'+ e.type +'--'+ e.data.length + '---');

    if(e.type === 'makeshot_result') {
        console.log(e.data.toString());

        getFile();
    }
    else {
        // console.log(e.raw.slice(0, 40).toString());
        // console.log(e.data.slice(0, 40));
        console.log('\n');

        makeShot();
    }
});

io.on('connect', function() {
    console.log('Client connected');

    makeShot();
});

var count = 0;
function makeShot() {
    var cfgPath = configs.shift();

    if(!cfgPath) {
        console.log('Makeshot, No cfg...');
        io.end();

        return;
    }

    console.log('start makeshot ['+ (count++) +']');

    getConfig(cfgPath, function(data) {
        var cfg = JSON.parse(data.toString());

        lastConfig = cfg;
        client.send('makeshot', cfg);
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
