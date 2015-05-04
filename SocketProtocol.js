/**
 * hlg-html2img
 *
 * SocketProtocol
 *
 */

var util = require('util');
var lodash = require('lodash');
var EventEmitter = require('events').EventEmitter;

var tools = require('./tools');

util.inherits(SocketProtocol, EventEmitter);

function SocketProtocol(io, options) {
    if(!(this instanceof SocketProtocol)) {
        return new SocketProtocol(io, options);
    }

    EventEmitter.call(this, options);

    this.options = options;
    this.io = io;

    this.clients = [];
    this.init();
}

SocketProtocol.uuid = 0;
SocketProtocol.caches = {};

lodash.merge(SocketProtocol.prototype, {
    START_TYPE: 1,
    DATA_TYPE: 2,
    END_TYPE: 3,

    init: function() {
        var self = this;
        var io = this.io;

        io.on('connection', function(client) {
            tools.log('A client connectioned: [', client.remoteAddress, ']');

            self.addClient(client);
        });
    },
    addClient: function(client) {
        var self = this;

        client.uid = ++SocketProtocol.uuid;
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
        var cache = SocketProtocol.caches[client.uid];
        if(!cache) {
            cache = SocketProtocol.caches[client.uid] = {
                // client: client,
                type: 0,
                raw: null,
                rawLength: 0,
                action: '',
                actionLength: 0,
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
        var cache = SocketProtocol.caches[client.uid];
        if(!cache) {
            return;
        }

        var raw = cache.raw;
        var len = cache.rawLength;
        if(len < nextIndex) {
            return;
        }

        var index = cache.index;
        var nextIndex = cache.nextIndex;

        // type
        if(!cache.type) {
            cache.type = raw.readInt16LE(0);
            if(cache.type !== this.START_TYPE) {
                this.fireError('start_type');
                return;
            }

            cache.actionLength = raw.readInt32LE(2);

            index = nextIndex;
            nextIndex += cache.actionLength;
        }

        // action
        if(len >= nextIndex && !cache.action) {
            cache.action = raw.slice(index, nextIndex).toString();

            index = nextIndex;
            nextIndex += 2;
        }

        var isEnd = cache.isEnd;

        // end precheck whitout data
        if(!isEnd && len >= nextIndex) {
            if(raw.readInt16LE(index) === this.END_TYPE) {
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
                type: 0,
                action: '',
                actionLength: 0,
                data: null,
                dataLength: 0,
                index: nextIndex,
                nextIndex: nextIndex + 6,
                isEnd: false
            });

            this.checkData(client);
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


// exports
module.exports = SocketProtocol;
