/**
 * hlg-html2img
 *
 * client-getfile
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var async = require('async');
var through2 = require('through2');

var tools = require('./tools');

tools.time('Client process');

// config
var config = {
    id: 'getfile-001',
    action: 'getfile',
    url: '__out/makeshot-001/out.png'
};

// init
var client = net.connect({
    host: 'localhost',
    port: 3000
});

async.waterfall([
    function connect(cb) {
        client.on('connect', function() {
            tools.log('Strat client...');

            cb();
        });
    },
    function sendConfig(cb) {
        var data = JSON.stringify(config);

        client.write(data);

        cb();
    },
    function receiveData(cb) {
        var data = [];

        client.pipe(through2(function(chunk, enc, next) {
            data.push(chunk);

            next();
        }, function() {
            var buf = Buffer.concat(data);

            cb(null, buf);
        }));
    }
], function(err, ret) {
    // ret = ret.toString();

    tools.log('Client process done, ', ret);

    tools.timeEnd('Client process');

    // test
    fs.writeFile('xxx.png', ret);
});
