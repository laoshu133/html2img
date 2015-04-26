/**
 * hlg-html2img
 *
 * client-test
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var async = require('async');
var through2 = require('through2');

var tools = require('./tools');

var configPath = 'demos/hello.json';

// init
var client = net.connect({
    host: 'localhost',
    port: 3000
});

async.waterfall([
    function connect(cb) {
        client.on('connect', function() {
            console.log('Strat client...');

            cb();
        });
    },
    function sendConfig(cb) {
        var rs = fs.createReadStream(configPath);

        var len = 0;
        var data = [];

        rs.on('data', function(chunk) {
            data.push(chunk);
        });

        rs.on('end', function() {
            var buf = Buffer.concat(data, len);

            client.write(buf);

            cb();
        });
    },
    function initOnData(cb) {
        client.pipe(through2(function(data) {
            cb(null, data.toString());
        }));
    }
], function(err, ret) {
    console.log('Client process done, ', ret);
});





return;



// configs
var configs = [
    require('./demos/thumb.json'),
    require('./demos/thumb_whit_replace.json'),

    // repeat test
    require('./demos/thumb_whit_replace.json'),
    require('./demos/thumb.json'),
];

// count
var counts = {
    count: 0,
    cfg: null
};

// init
var client = net.connect({
    // allowHalfOpen: true,
    host: 'localhost',
    port: 3000
});


client.on('connect', function() {
    console.log('Strat client...');

    // tools.time('All shots');

    // sendConfig();

    var readStream = fs.createReadStream('demos/hello.json');

    readStream.pipe(client);
    return;

    readStream.on('data', function(chunk) {
        client.write(chunk);
    });

    readStream.on('end', function() {
        console.log('data send finished');
    });
});

client.on('data', function(data) {
    console.log('data', data);
    // data = data.toString();

    // var ret = null;
    // try{
    //     ret = JSON.parse(data);
    // }
    // catch(ex) {
    //     console.error('Data parse error:', ex);
    // }

    // if(!ret) {
    //     console.error('No result');

    //     client.end();
    //     return;
    // }

    // console.log('----Shot Success----');
    // console.log(ret.message);


    // sendConfig();
});

// funs
function sendConfig() {
    // Count
    if(counts.count > 0) {
        tools.timeEnd('Start Shot['+ counts.count +']');

        // pipe
        console.log(' ');
    }

    if(!configs.length) {
        client.end();

        tools.timeEnd('All shots');

        return;
    }

    var cfg = configs.shift();
    var cfgJSON = JSON.stringify(cfg);

    // Count
    counts.count += 1;
    tools.time('Start Shot['+ counts.count +']');

    client.write(cfgJSON);
}