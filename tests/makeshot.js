/**
 * hlg-html2img
 *
 * client-makeshot
 *
 */

// env
require('dotenv-safe').load();

// deps
var fs = require('fs');
var net = require('net');
var path = require('path');

var SocketAdp = require('../lib/SocketAdp');

var configs = [
    'demos/makeshot.json',
    // 'demos/makeshot-big.json',
    // 'demos/makeshot-wireless.json',
    // 'demos/makeshot-html-test.html'
];

var io = net.connect({
    host: 'localhost',
    // host: '192.168.10.134',
    port: process.env.NODE_PORT
});

// init
console.log('Strat client...');

var client = new SocketAdp(io);

client.on('data', function(e) {
    var ret = JSON.parse(e.data);

    console.log('\n---'+ e.type +'--'+ e.data.length + '---');

    if(ret.status !== 'success') {
        console.error('Got an error!');
        console.error(JSON.stringify(ret));
    }

    if(e.type === 'makeshot_result') {
        console.log(JSON.stringify(ret));

        getFile(ret.data.image);
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

// makeShot
var count = 0;
function makeShot() {
    var cfgPath = configs.shift();

    if(!cfgPath) {
        console.log('Makeshot, No cfg...');
        io.end();

        return;
    }

    console.log('start makeshot ['+ (count++) +']');

    var relativePath = path.relative(process.cwd(), __dirname + '/..');
    cfgPath = path.join(relativePath, cfgPath);

    var cfg = getConfig(cfgPath);
    client.send('makeshot', cfg);
}

function getFile(path) {
    console.log('\n-------Getfile-------\n path=', path);

    client.send('getfile', {
        action: 'getfile',
        path: path
    });
}

function getConfig(configPath) {
    var buf = fs.readFileSync(configPath);
    var config = buf.toString();

    if(/\.html$/i.test(configPath)) {
        config = JSON.stringify({
            action: 'makeshot',
            htmlTpl: 'list_wireless.html',
            content: config
        });
    }

    return config;
}
