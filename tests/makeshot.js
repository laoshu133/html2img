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

var tools = require('../lib/tools');
var SocketAdp = require('../lib/SocketAdp');

var configs = [
    'demos/makeshot.json',
    // 'demos/makeshot-big.json',
    'demos/makeshot-wireless.json',
    'demos/makeshot-html-test.html',
    'demos/makeshot-danchaofan.json'
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
    var dataLen = e.data.length;
    var data = e.data;

    tools.log('Client.ondata', e.type);

    console.log('\n---'+ e.type +'--'+ dataLen +'--'+ tools.formatFilesize(dataLen) +'--');

    // error handle
    if(/error/.test(e.type)) {
        console.error('Got an error!');
        console.error(data.toString());

        makeShot();
        return;
    }

    // result handle
    if(e.type === 'makeshot_result') {
        data = JSON.parse(data);
        console.log(JSON.stringify(data));

        getFile(data.image);
    }
    else if(e.type === 'getfile_result'){
        // console.log(e.raw.slice(0, 40).toString());
        // console.log(e.data.slice(0, 40));
        console.log('\n');

        // test write file
        var testOutPath = path.join(process.env.OUT_PATH, 'out.png');
        fs.writeFileSync(testOutPath, e.data, {
            encoding: 'binary'
        });

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

    console.log('start makeshot - '+ (++count));
    tools.log('Client.makeshot');

    var relativePath = path.relative(process.cwd(), __dirname + '/..');
    cfgPath = path.join(relativePath, cfgPath);

    var cfg = getConfig(cfgPath);
    client.send('makeshot', cfg);
}

function getFile(path) {
    console.log('\n-------Getfile-------\n path=', path);
    tools.log('Client.getfile');

    client.send('getfile', {
        action: 'getfile',
        keepFiles: true,
        path: path
    });
}

function getConfig(configPath) {
    var buf = fs.readFileSync(configPath);
    var config = buf.toString();

    if(/\.html$/i.test(configPath)) {
        config = JSON.stringify({
            action: 'makeshot',
            htmlTpl: 'hlg_wireless.html',
            content: config
        });
    }

    return config;
}
