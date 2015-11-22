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

var tools = require('./lib/tools');
var actions = require('./actions');
var SocketAdp = require('./lib/SocketAdp');

// config
var config = require('./config').getConfig();

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
        var cfg = lodash.merge({}, config, stack.config);

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

// init actions， 优先启动 phantomjs
actions.init().then(function() {
    io.listen(config.listenPort, config.listenHost);

    var msgLabel = 'Server Listening,';
    var msgPort = 'port: ' + config.listenPort;
    var msgHost = config.listenHost ? ', host: ' + config.listenHost : '';

    console.info(msgLabel, msgPort, msgHost);

}, function(ex) {
    console.error('Server start error', ex);
});

// error catch
process.on('uncaughtException', function(err) {
    console.error('Aerver uncaughtException', err);
    throw err;
});

