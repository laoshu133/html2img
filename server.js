/**
 * hlg-html2img
 *
 * server
 *
 */
'use strict';

// env
require('dotenv-safe').load();

// deps
var net = require('net');

var tools = require('./lib/tools');
var actions = require('./actions');
var SocketAdp = require('./lib/SocketAdp');

// config
var configUtils = require('./config');

// start
console.log('Start Server...');

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
        var cfg = stack.config;

        var actionFn = actions[cfg.action];
        if(!actionFn) {
            return cb();
        }

        this.status = 'processing';
        actionFn.call(actions, client, cfg, cb);

        function cb(err, type, result) {
            if(!err) {
                var clientAdp = new SocketAdp.Client(client);

                clientAdp.on('error', function(e) {
                    tools.error('SocketAdp Error:', e.type);
                });

                clientAdp.send(type || 'result', result);
            }
            else {
                tools.error('id:',  cfg.id, ', uid:', client.uid, err);
                // throw err;

                client.end();
            }

            // 异步处理，规避粘包
            process.nextTick(function() {
                self.status = 'ready';
                self.next();
            });
        }
    }
};

var io = net.Server();
var server = new SocketAdp(io);

server.on('data', function(e) {
    var config = null;
    var client = e.target;

    if(e.data && Buffer.isBuffer(e.data)) {
        var cfg = e.data.toString();

        try {
            config = JSON.parse(cfg);
        }
        catch(ex) {
            tools.error('Config parse error');
        }
    }

    var action = config ? config.action : null;
    var actionFn = actions[action];

    if(!action || !actionFn) {
        var msg = 'No config.action, or config.action error, config.action=';
        tools.error(msg, action);

        client.end();
        return;
    }

    // fill config
    config = configUtils.getConfig(config);

    queue.add({
        client: client,
        config: config
    });
})
.on('error', function(e) {
    tools.error('SocketAdp Error:', e.type);
});

// init actions， 优先启动 phantomjs
actions.init().then(function() {
    var env = process.env;
    var hostname = env.NODE_HOST.replace('*', '').trim();

    io.listen(env.NODE_PORT, hostname || false);

    var msgLabel = 'Server Listening,';
    var msgPort = 'port: ' + env.NODE_PORT;
    var msgHost = hostname ? ', host: ' + hostname : '';

    console.info(msgLabel, msgPort, msgHost);

}, function(ex) {
    console.error('Server start error', ex);
});

// error catch
process.on('uncaughtException', function(err) {
    console.error('Server uncaughtException', err);
    throw err;
});

