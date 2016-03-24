/**
 * html2img
 *
 * server
 */
'use strict';

// env
require('dotenv-safe').load();

// deps
var net = require('net');

var queue = require('./lib/queue');
var tools = require('./lib/tools');
var SocketAdp = require('./lib/SocketAdp');

// config
var configUtils = require('./config');

// start
console.log('Start Server...');

// actions
var actions = require('./actions');

// io
var io = net.Server();
var server = new SocketAdp(io);

server.on('data', e => {
    var config = null;
    var client = e.target;

    if(e.data && Buffer.isBuffer(e.data)) {
        var cfg = e.data.toString();

        try {
            config = JSON.parse(cfg);
        }
        catch(ex) {
            tools.error(ex);
            tools.log('Config parse error');
        }
    }

    var action = config ? config.action : null;
    var actionFn = actions[action];

    if(!action || !actionFn) {
        var msg = 'No config.action, or config.action error, config.action=';
        tools.error(new Error(msg + action));

        client.end();
        return;
    }

    // fill config
    config = configUtils.getConfig(config);

    // add to queue
    queue.add({
        client: client,
        config: config,
        handle: () => {
            var cfg = config;
            var replyAction = function(err, data) {
                var clientAdp = new SocketAdp.Client(client);

                clientAdp.on('error', function(ex) {
                    tools.error(ex);
                });

                var action = cfg.action;
                if(err) {
                    action += '_error';

                    clientAdp.send(action, {
                        status: 'error',
                        message: err.message,
                        data: data
                    });

                    return;
                }

                action += '_result';
                clientAdp.send(action, data);
            };

            return actions.invoke(cfg.action, cfg, client)
            .then(result => {
                replyAction(null, result);
            })
            .catch(ex => {
                tools.error(ex, {
                    client_id: client.uid,
                    config: cfg
                });
                // tools.info('Action invoke error, uid=', client.uid);

                replyAction({
                    message: ex.message
                }, null);

                // debug
                if(process.env.NODE_ENV === 'development') {
                    console.error(ex);
                }
            });
        }
    });
})
.on('error', e => {
    tools.error('SocketAdp Error:', e.type);
});

// init actions， 优先启动 phantomjs
actions.init().then(() => {
    var env = process.env;
    var hostname = env.NODE_HOST.replace('*', '').trim();

    io.listen(env.NODE_PORT, hostname || false);

    var msgLabel = 'Server Listening,';
    var msgPort = 'port: ' + env.NODE_PORT;
    var msgHost = hostname ? ', host: ' + hostname : '';

    console.info(msgLabel, msgPort, msgHost);

}, ex => {
    console.error('Server start error', ex);
});

// error catch
process.on('uncaughtException', err => {
    console.error('Server uncaughtException', err);
    throw err;
});

