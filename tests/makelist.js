/**
 * hlg-html2img
 *
 * makelist
 *
 */

// env
require('dotenv-safe').load();

// deps
var fs = require('fs');
var net = require('net');
var path = require('path');

var tools = require('../lib/tools');
var SocketAdp = require('../lib/SocketAdp');

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

// init
console.log('Strat client...');

var client = new SocketAdp(io);

client.on('data', function(e) {
    var ret = JSON.parse(e.data);

    console.log('\n---'+ e.type +'--'+ ret.length +'--'+ tools.formatFilesize(ret.length) +'--');

    if(ret.status !== 'success') {
        console.error('Got an error!');
        console.error(JSON.stringify(ret));
    }

    tools.log('Client.ondata', e.type);

    if(e.type === 'makelist_result') {
        console.log(JSON.stringify(ret));

        getFile();
    }
    else {
        console.log('\n');

        makelist();
    }
});

io.on('connect', function() {
    console.log('Client connected');

    makelist();
});

// makelist
var count = 0;
function makelist() {
    var cfgPath = configs.shift();

    if(!cfgPath) {
        console.log('makelist, No cfg...');
        io.end();

        return;
    }

    console.log('start makelist - '+ (count++));
    tools.log('Client.makelist');

    var relativePath = path.relative(process.cwd(), __dirname + '/..');
    cfgPath = path.join(relativePath, cfgPath);

    var cfg = getConfig(cfgPath);
    client.send('makelist', cfg);
}

function getFile() {
    console.log('\n-------Getfile-------\n path=', path);
    tools.log('Client.getfile');

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
