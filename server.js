/**
 * hlg-html2img
 *
 * server
 *
 */

// deps
var fs = require('fs');
var net = require('net');
var path = require('path');
var lodash = require('lodash');
var through2 = require('through2');

var tools = require('./tools');
var actions = require('./actions');
var Horseman = require('node-horseman');

// default config
var defaultConfig = require('./config.json');

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
        var config = lodash.merge({}, defaultConfig, stack.config);

        if(!config.id) {
            tools.error('No config.id');

            return cb();
        }

        var action = config.action;
        var actionFn = actions[action];

        if(!actionFn) {
            tools.error('No action defined, action = ', config.action);

            return cb();
        }

        this.status = 'processing';

        actionFn(stack.client, config, cb);

        function cb() {
            stack.client.end();

            self.status = 'ready';
            self.next();
        }
    }
};

var io = net.Server();
io.on('connection', function(client) {
    tools.log('A client connectioned: [', client.remoteAddress, ']');

    client.on('close', function() {
        tools.log('A client disconnected.');
    });

    client.on('data', function(data) {
        data = data.toString();

        var config = null;
        try {
            config = JSON.parse(data);
        }
        catch(ex) {
            tools.error('Config parse error');
        }

        if(!config || !config.id) {
            tools.error('Config and config.id required');

            return;
        }

        queue.add({
            config: config,
            client: client
        });
    });

    // client.on('end', function() { });
});

io.listen(defaultConfig.listenPort);
console.info('Start server :' + defaultConfig.listenPort);

process.on('uncaughtException', function(err) {
    console.error(err);
});

