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

var uuid = 0;
var tools = {
    uuid: function(prefix) {
        return [prefix || 'shot', Date.now(), ++uuid].join('_');
    },
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
        re = /([\s;])(transform(?:\-\w+)?)\s*:\s*([^;\}]+)/gi;
        html = html.replace(re, function(a, spliter, key, val) {
            var css = key +':' + val + ';';

            // prefix
            css = '-webkit-' + css + css;

            return spliter + css;
        });

        return html;
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
    }
};

module.exports = tools;
