/**
 * hlg-html2img/tools
 */

var fs = require('fs');
var path = require('path');

var tools = {
    getConfig: function(path) {
        var content = '';
        var config = null;

        try {
            content = fs.readFileSync(path);
            config = JSON.parse(content);
        }
        catch(ex) {
            console.log('config read error, ', ex);
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
    timeEnd: function(name) {
        var cache = this.timeCache[name];
        if(!cache) {
            return;
        }

        var now = Date.now();
        var elapsed = now - cache;

        delete this.timeCache[name];

        console.info(name, 'elapsed(ms):', elapsed);
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
        var args = [].slice.call(arguments);
        args.unshift('[HTML2IMG]');

        console.log.apply(console, args);
    },
    error: function() {
        var args = [].slice.call(arguments);
        args.unshift('![HTML2IMG]');

        console.error.apply(console, args);
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
