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
var through2 = require('through2');

var tools = require('./tools');

var configPath = 'demos/makeshot.json';

tools.time('Client process');

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
    ret = ret.toString();

    console.log('Client process done, ', ret);

    tools.timeEnd('Client process', true);
});
