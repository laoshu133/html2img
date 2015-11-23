/**
 * hlg-html2img
 *
 * client-test
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var through = require('through2');

var tools = require('../lib/tools');

var configPath = '../demos/hello.json';

// init
var client = net.connect({
    host: 'localhost',
    port: 3000
});

/*-- data test --*/
var type = 'makeshot';
var data = '{"id":"id-01", "content":"foo"}';
var totalLen =  2 + 4 + type.length + 2 + 4 + data.length + 2;

var index = 0;
var buf = new Buffer(totalLen);

// head
buf.writeInt16LE(1, index);
index += 2;

buf.writeInt32LE(type.length, index);
index += 4;

buf.write(type, index);
index += type.length;

// body
buf.writeInt16LE(2, index);
index += 2;

buf.writeInt32LE(data.length, index);
index += 4;

buf.write(data, index);
index += data.length;

// foot
buf.writeInt16LE(3, index);
// index += 2;

client.write(buf);
/*-- data test end --*/


/*-- end test whitout body --*/
var type = 'end_test';
var totalLen =  2 + 4 + type.length + 2;

var index = 0;
var buf = new Buffer(totalLen);

// head
buf.writeInt16LE(1, index);
index += 2;

buf.writeInt32LE(type.length, index);
index += 4;

buf.write(type, index);
index += type.length;

// foot
buf.writeInt16LE(3, index);
// index += 2;

client.write(buf);

/*-- end test whitout data end --*/
