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
var through = require('through2');

var tools = require('./tools');

var configPath = 'demos/hello.json';

// init
var client = net.connect({
    host: 'localhost',
    port: 3000
});

/*-- data test --*/
var action = 'makeshot';
var data = '{"id":"id-01", "bar":"foo"}';
var totalLen =  2 + 4 + action.length + 2 + 4 + data.length + 2;

var index = 0;
var buf = new Buffer(totalLen);

// type
buf.writeInt16LE(1, index);
index += 2;

// action length
buf.writeInt32LE(action.length, index);
index += 4;

// action
buf.write(action, index);
index += action.length;

// data
buf.writeInt16LE(2, index);
index += 2;

buf.writeInt32LE(data.length, index);
index += 4;

buf.write(data, index);
index += data.length;

// end
buf.writeInt16LE(3, index);
// index += 2;

client.write(buf);
/*-- data test end --*/

/*-- end test whitout data --*/
var action = 'end_test';
var totalLen =  2 + 4 + action.length + 2;

var index = 0;
var buf = new Buffer(totalLen);

// type
buf.writeInt16LE(1, index);
index += 2;

// action length
buf.writeInt32LE(action.length, index);
index += 4;

// action
buf.write(action, index);
index += action.length;

// end
buf.writeInt16LE(3, index);
// index += 2;

client.write(buf);

/*-- end test whitout data end --*/
