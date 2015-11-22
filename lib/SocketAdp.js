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

util.inherits(SocketAdp, EventEmitter);

// base
SocketAdp._uuid = 0;
SocketAdp.caches = {};
SocketAdp.uuid = function(target) {
    if(target && target.uid) {
        return target.uid;
    }

    return ++SocketAdp._uuid;
};

SocketAdp.fn = {
    HEAD_CODE: 1,
    BODY_CODE: 2,

    // send
    send: function(type, data) {
        var io = this.io;
        if(!io.writable) {
            this.fireError(io, 'io_not_writable');
            return;
        }

        // head
        var headLen = 2 + 4 + type.length;
        var head = new Buffer(headLen);

        head.writeInt16LE(this.HEAD_CODE, 0);
        head.writeInt32LE(type.length, 2);
        head.write(type, 2 + 4);

        // body
        var dataLen = 0;
        var bodyLen = 2 + 4;
        var body = new Buffer(2 + 4);

        if(typeof data !== 'string' && !Buffer.isBuffer(data)) {
            data = JSON.stringify(data);
        }

        if(typeof data === 'string') {
            data = new Buffer(data);
        }

        if(Buffer.isBuffer(data)) {
            dataLen = data.length;
            bodyLen += dataLen;

            body = Buffer.concat([body, data], bodyLen);
        }

        body.writeInt16LE(this.BODY_CODE, 0);
        body.writeInt32LE(dataLen, 2);

        // write
        var totalLen = headLen + bodyLen;
        var buf = Buffer.concat([head, body], totalLen);

        this._send(buf);
    },
    _send: function(buf) {
        var io = this.io;

        if(!io.write(buf)) {
            io.once('drain', function() {
                io.resume();
            });

            io.pause();
        }
    },
    fireError: function(client, type) {
        client.end();

        this.emit('error', {
            client: client,
            type: type
        });
    }
};

lodash.merge(SocketAdp.prototype, SocketAdp.fn, {
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

        client.once('error', function(e) {
            self.fireError(client, 'client_error');
        });

        client.on('data', function(buf) {
            self.pushData(client, buf);
        });
    },
    pushData: function(client, buf) {
        var uid = client.uid;
        // console.log('pushData', client.uid, buf.slice(0, 40).toString());
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

        if(!buf.length) {
            return;
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

        if(len < nextIndex) {
            return;
        }
        // console.log('cc-2', len < nextIndex, len, index, nextIndex);

        // head length
        if(!cache.typeLength) {
            var headCode = raw.readInt16LE(0);
            if(headCode !== this.HEAD_CODE) {
                this.fireError(client, 'head_code_error');
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
            nextIndex += 6;
        }

        // data length
        if(len >= nextIndex && !cache.dataLength) {
            cache.dataLength = raw.readInt32LE(index + 2);

            index = nextIndex;
            nextIndex += cache.dataLength;
        }

        // data
        if(len >= nextIndex && !cache.data) {
            cache.data = raw.slice(index, nextIndex);

            index = nextIndex;
        }

        // end
        if(len >= nextIndex) {
            cache.isEnd = true;
        }

        // store
        cache.index = index;
        cache.nextIndex = nextIndex;

        // one tick
        if(cache.isEnd) {
            // clean
            delete SocketAdp.caches[uid];
            raw = null;

            // evt
            this.emit('data', cache);

            // next tick
            if(len > nextIndex) {
                raw = cache.raw.slice(nextIndex);

                this.pushData(client, raw);
            }
        }
    }
});


// Client
function Client(io, options) {
    if(!(this instanceof SocketAdp.Client)) {
        return new SocketAdp.Client(io, options);
    }

    EventEmitter.call(this, options);

    this.options = options;
    this.io = io;
}

util.inherits(Client, EventEmitter);

lodash.merge(Client.prototype, SocketAdp.fn);


// exports
SocketAdp.Server = SocketAdp;
SocketAdp.Client = Client;

module.exports = SocketAdp;
