/**
 * hlg-html2img
 *
 * server
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var lodash = require('lodash');

var tools = require('./tools');
var actions = require('./actions');
var SocketAdp = require('./SocketAdp');

// default config
var defaultConfig = require('./config.json');

// start
console.log('Start Server...');

// init actions， 优先启动 phantomjs
actions.init();

// queue
var queue = {
    stacks: [],
    status: 'ready',
    add: function(stack) {
        this.stacks.push(stack);

        this.next();
    },
    next: function() {
        var self = this;
        var stacks = this.stacks;

        if(this.status !== 'ready' || !stacks.length) {
            return;
        }

        var stack = stacks.shift();
        var client = stack.client;
        var config = lodash.merge({}, defaultConfig, stack.config);

        var actionFn = actions[config.action];
        if(!actionFn) {
            return cb();
        }

        this.status = 'processing';
        actionFn(client, config, cb);

        function cb(err, type, result) {
            if(!err) {
                var clientAdp = new SocketAdp.Client(client);

                clientAdp.on('error', function(e) {
                    tools.error('SocketAdp Error:', e.type);
                });

                type = type || 'result';
                clientAdp.send(type, result);
            }
            else {
                tools.error('id:', client.uid, err);

                client.end();
            }

            self.status = 'ready';
            self.next();
        }
    }
};

var io = net.Server();
var server = new SocketAdp(io);

server.on('data', function(e) {
    var config = null;
    var client = e.target;

    tools.log('ondata, type:', e.type);

    if(e.data && Buffer.isBuffer(e.data)) {
        config = e.data.toString();

        try {
            config = JSON.parse(config);
        }
        catch(ex) {
            tools.error('Config parse error');
        }
    }

    if(!config || !config.id) {
        tools.error('Config and config.id required');

        client.end();
        return;
    }

    if(!config.action) {
        config.action = e.type;
    }

    var action = config.action;
    var actionFn = actions[action];

    if(!actionFn) {
        tools.error('No action defined, action =', config.action);

        client.end();
        return;
    }

    queue.add({
        client: client,
        config: config
    });
})
.on('error', function(e) {
    tools.error('SocketAdp Error:', e.type);
});


io.listen(defaultConfig.listenPort);
console.info('Server Listening :' + defaultConfig.listenPort);

process.on('uncaughtException', function(err) {
    console.error(err);
});

