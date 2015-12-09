/**
 * hlg-html2img/tools
 */

var fs = require('fs');
var path = require('path');
var debugFactor = require('debug');
// var autoprefixer = require('autoprefixer');

// debug
var debugPrefix = 'html2img';
var debugLog = debugFactor(debugPrefix);
var debugInfo = debugFactor(debugPrefix);
var debugError = debugFactor(debugPrefix);
debugLog.log = console.log.bind(console);
debugInfo.log = console.info.bind(console);
debugError.log = console.error.bind(console);

var slice = [].slice;

var tools = {
    fill: function(tpl, data) {
        tpl += '';

        for(var k in data) {
            tpl = tpl.replace(new RegExp('\\{'+ k +'\\}', 'g'), data[k]);
        }

        return tpl;
    },
    // 修正内容，以支持 phantomjs
    processHTML: function(html) {
        html = html ? String(html).trim() : '';

        if(!html) {
            return html;
        }

        // // => http://
        var re = /\s(src|background)\s*=\s*(["'])\/\//gi;
        html = html.replace(re, function(a, name, quot) {
            return ' ' + name + '=' + quot + 'http://';
        });

        // css transform, prefix
        re = /([\s;])transform\s*:\s*([^;\}]+);/gi;
        html = html.replace(re, function(a, spliter, val) {
            var css = '-webkit-transform:' + val + ';';
            css += 'transform:' + val + ';';

            return spliter + css;
        });

        return html;
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

        delete this.timeCache[name];

        var now = Date.now();
        var elapsed = now - cache;
        var msg = 'elapsed: ' + elapsed + 'ms';

        if(forceLog) {
            console.info(name, msg);

            return;
        }

        this.info(name, msg);
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
        var msg = slice.call(arguments).join(' ');

        debugLog(msg);
    },
    info: function() {
        var msg = slice.call(arguments).join(' ');

        debugInfo(msg);
    },
    error: function() {
        var msg = slice.call(arguments).join(' ');

        debugError(msg);
    },
    // events
    fireEvent: function(config, type) {
        var callback = config ? config['on' + type] : null;

        if(typeof callback !== 'function') {
            return;
        }

        var args = slice.call(arguments, 2);

        return callback.apply(null, args);
    }
};

module.exports = tools;
