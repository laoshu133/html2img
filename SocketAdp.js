/**
 * hlg-html2img
 *
 * SocketAdp
 *
 */

var util = require('util');
var lodash = require('lodash');
var EventEmitter = require('events').EventEmitter;

var tools = require('./tools');

util.inherits(SocketAdp, EventEmitter);

function SocketAdp(io, options) {
    if(!(this instanceof SocketAdp)) {
        return new SocketAdp(io, options);
    }

    EventEmitter.call(this, options);

    this.options = options;
    this.io = io;

    this.clients = [];
    this.init();
}

lodash.merge(SocketAdp.prototype, {
    HEAD_CODE: 1,
    BODY_CODE: 2,
    FOOT_CODE: 3,

    init: function() {
        var self = this;
        var io = this.io;

        // server
        io.on('connection', function(client) {
            tools.log('A client connectioned: [', client.remoteAddress, ']');

            self.addClient(client);
        });

        // client
        this.addClient(io);
    },
    addClient: function(client) {
        var self = this;

        client.uid = SocketAdp.uuid(client);
        this.clients.push(client);

        client.once('close', function() {
            tools.log('A client disconnected.');

            lodash.remove(self.clients, client);
        });

        client.on('data', function(buf) {
            self.pushData(client, buf);
        });
    },
    pushData: function(client, buf) {
        var uid = client.uid;
        var cache = SocketAdp.caches[uid];
        if(!cache) {
            cache = SocketAdp.caches[uid] = {
                target: client,
                raw: null,
                rawLength: 0,
                type: '',
                typeLength: 0,
                data: null,
                dataLength: 0,
                nextIndex: 6,
                index: 0,
                inBody: false,
                isEnd: false
            };
        }

        cache.rawLength += buf.length;
        if(cache.raw) {
            cache.raw = Buffer.concat([cache.raw, buf], cache.rawLength);
        }
        else {
            cache.raw = buf;
        }

        this.checkData(client);
    },
    checkData: function(client) {
        var uid = client.uid;
        var cache = SocketAdp.caches[uid];
        if(!cache) {
            return;
        }

        var raw = cache.raw;
        var index = cache.index;
        var len = cache.rawLength;
        var nextIndex = cache.nextIndex;

        console.log(len, index, nextIndex);
        if(len < nextIndex) {
            return;
        }

        // head length
        if(!cache.typeLength) {
            var headCode = raw.readInt16LE(0);
            if(headCode !== this.HEAD_CODE) {
                this.fireError(client, 'head_CODE_error');
                return;
            }

            cache.typeLength = raw.readInt32LE(2);

            index = nextIndex;
            nextIndex += cache.typeLength;
        }

        // head
        if(len >= nextIndex && !cache.type) {
            cache.type = raw.slice(index, nextIndex).toString();

            index = nextIndex;
            nextIndex += 2;
        }

        var isEnd = cache.isEnd;

        // precheck end whitout body
        if(!isEnd && len >= nextIndex && !cache.inBody) {
            if(raw.readInt16LE(index) === this.FOOT_CODE) {
                isEnd = true;
            }
            else {
                cache.inBody = true;

                index = nextIndex;
                nextIndex += 4;
            }
        }

        // data length
        if(!isEnd && len >= nextIndex && !cache.dataLength) {
            cache.dataLength = raw.readInt32LE(index);

            index = nextIndex;
            nextIndex += cache.dataLength;
        }

        // data
        if(!isEnd && len >= nextIndex && !cache.data) {
            cache.data = raw.slice(index, nextIndex);

            index = nextIndex;
            nextIndex += 2;
        }

        // end
        if(!isEnd && len >= nextIndex) {
            isEnd = true;
        }

        // store
        cache.isEnd = isEnd;
        cache.index = index;
        cache.nextIndex = nextIndex;

        // evt
        if(isEnd) {
            this.emit('data', cache);
            // console.log(len, index, nextIndex);
            // next tick
            lodash.merge(cache, {
                type: '',
                typeLength: 0,
                data: null,
                dataLength: 0,
                index: nextIndex,
                nextIndex: nextIndex + 6,
                inBody: false,
                isEnd: false
            });

            this.checkData(client);
        }
    },
    // client silde
    send: function(type, data) {
        // head
        var headLen = 2 + 4 + type.length;
        var head = new Buffer(headLen);

        head.writeInt16LE(this.HEAD_CODE, 0);
        head.writeInt32LE(type.length, 2);
        head.write(type, 2 + 4);

        // body
        var bodyLen = 0;
        var body = null;

        if(typeof data !== 'string' && !Buffer.isBuffer(data)) {
            data = JSON.stringify(data);
        }

        if(typeof data === 'string') {
            data = new Buffer(data);
        }

        if(Buffer.isBuffer(data)) {
            bodyLen = 2 + 4 + data.length;
            // body = new Buffer(bodyLen);
            body = Buffer.concat([new Buffer(2 + 4), data], bodyLen);

            body.writeInt16LE(this.BODY_CODE, 0);
            body.writeInt32LE(data.length, 2);

            // body.write(data.toString(), 2 + 4);
        }

        // foot
        var footLen = 2;
        var foot = new Buffer(footLen);
        foot.writeInt16LE(this.FOOT_CODE, 0);

        // write
        var totalLen = headLen + bodyLen + footLen;
        var buf = Buffer.concat([head, body, foot], totalLen);

        // this.io.write(buf);
        this._send(buf);
    },
    _send: function(buf) {
        var io = this.io;

        if(!io.write(buf)) {
            // io.once('drain', function() {
            //     io.resume();
            // });

            // io.pause();
        }
    },
    fireError: function(client, type) {
        client.end();

        this.emit('error', {
            client: client,
            type: type
        });
    }
});

// base
SocketAdp._uuid = 0;
SocketAdp.caches = {};
SocketAdp.uuid = function(target) {
    if(target && target.uid) {
        return target.uid;
    }

    return ++SocketAdp._uuid;
};

// exports
module.exports = SocketAdp;
