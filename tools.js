/**
 * hlg-html2img/tools
 */

var fs = require('fs');
var path = require('path');
var debugFactor = require('debug');

// debug
var debugPrefix = 'html2img';
var debugLog = debugFactor(debugPrefix);
var debugInfo = debugFactor(debugPrefix);
var debugError = debugFactor(debugPrefix);
debugLog.log = console.log.bind(console);
debugInfo.info = console.info.bind(console);
debugError.error = console.error.bind(console);

var tools = {
    getConfig: function(path) {
        var content = '';
        var config = null;

        try {
            content = fs.readFileSync(path);
            config = JSON.parse(content);
        }
        catch(ex) {
            this.error('config read error, ', ex);
        }

        return config;
    },
    // 计时
    timeCache: {},
    time: function(name) {
        var cache = this.timeCache[name];
        if(cache) {
            return;
        }

        var now = Date.now();
        this.timeCache[name] = now;
    },
    timeEnd: function(name, forceLog) {
        var cache = this.timeCache[name];
        if(!cache) {
            return;
        }

        var now = Date.now();
        var elapsed = now - cache;

        delete this.timeCache[name];

        if(forceLog) {
            console.log(name, 'elapsed(ms):', elapsed);

            return;
        }
    },
    // fs
    mkDeepDir: function(destPath) {
        var tmpPath = '';
        var destPaths = [];
        var paths = destPath.replace(/\\+/g, '/').split('/');

        // ext. /var/tmp
        if(paths[0] === '') {
            paths[0] = '/';
        }

        while(paths.length) {
            destPaths.push(paths.shift());

            tmpPath = destPaths.join('/');

            if(!fs.existsSync(tmpPath)) {
                fs.mkdirSync(tmpPath);
            }
        }
    },
    // log
    log: function() {
        debugLog.apply(null, arguments);
    },
    info: function() {
        debugInfo.apply(null, arguments);
    },
    error: function() {
        debugError.apply(null, arguments);
    },
    // events
    fireEvent: function(config, type) {
        var callback = config ? config['on' + type] : null;

        if(typeof callback !== 'function') {
            return;
        }

        var args = [].call(arguments, 2);

        return callback.apply(null, args);
    }
};

module.exports = tools;
