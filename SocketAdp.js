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
    HEAD_TYPE: 1,
    BODY_TYPE: 2,
    FOOT_TYPE: 3,

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
        var uid = SocketAdp.getClientId(client);
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
        var uid = SocketAdp.getClientId(client);
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

        // head length
        if(!cache.typeLength) {
            var headCode = raw.readInt16LE(0);
            if(headCode !== this.HEAD_TYPE) {
                this.fireError(client, 'head_type_error');
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
        if(!isEnd && len >= nextIndex) {
            if(raw.readInt16LE(index) === this.FOOT_TYPE) {
                isEnd = true;
            }
            else {
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

            // next tick
            lodash.merge(cache, {
                type: '',
                typeLength: 0,
                data: null,
                dataLength: 0,
                index: nextIndex,
                nextIndex: nextIndex + 6,
                isEnd: false
            });

            this.checkData(client);
        }
    },
    // client silde
    send: function(type, data) {
        if(typeof data !== 'string' && !Buffer.isBuffer(data)) {
            data = JSON.stringify(data);
        }

        if(typeof data === 'string') {
            data = new Buffer(data);
        }

        var bufLen = 2 + 4 + type.length; // head

        if(data !== null) {
            bufLen += 2 + 4 + data.length; // body
        }

        bufLen += 2; // foot

        var buf = new Buffer(bufLen);

        var index = 0;

        // head
        buf.writeInt16LE(this.HEAD_TYPE, index);
        index += 2;

        buf.writeInt32LE(type.length, index);
        index += 4;

        buf.write(type, index);
        index += type.length;

        // body
        if(data !== null) {
            buf.writeInt16LE(this.BODY_TYPE, index);
            index += 2;

            buf.writeInt32LE(data.length, index);
            index += 4;

            buf.write(data.toString(), index);
            index += data.length;
        }

        // foot
        buf.writeInt16LE(this.FOOT_TYPE, index);

        // do write
        this.io.write(buf);
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
SocketAdp.uuid = 0;
SocketAdp.caches = {};
SocketAdp.getClientId = function(client) {
    var uid = client.uid;

    if(!uid) {
        uid = client.uid = ++SocketAdp.uuid;
    }

    return uid;
};

// exports
module.exports = SocketAdp;
