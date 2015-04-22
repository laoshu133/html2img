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

var tools = require('./tools');
var Horseman = require('node-horseman');

// default config
var defaultConfig = require('./config.json');

// init Horseman(phantomjs)
console.log('Start Horseman...');

tools.time('Load Horseman(phantomjs)');
var horseman = new Horseman(defaultConfig.horsemanConfig);
tools.timeEnd('Load Horseman(phantomjs)');


// init server
var io = net.Server(function(socket) {
    socket.on('close', function() {
        tools.log('A io disconnected.');
    });

    socket.on('data', function(data) {
        data = data.toString();

        var config = null;
        try {
            config = JSON.parse(data);
        }
        catch(ex) {
            tools.log('Config parse error:', ex);
        }

        if(!config || !config.name) {
            sendResult({
                message: 'Invalid config',
                status: 'error',
                data: null
            });

            return;
        }

        makeShot(config, function(ret) {
            sendResult(ret);
        });
    });

    function sendResult(ret) {
        socket.write(JSON.stringify(ret) + '\n');
    }
});

io.on('connection', function(socket) {
    tools.log('A io connectioned.');
});

io.listen(defaultConfig.listenPort);
console.info('Start server :' + defaultConfig.listenPort);


// error catch
process.on('exit', function(err) {
    if(horseman) {
        horseman.close();
    }
});

process.on('uncaughtException', function(err) {
    console.error(err);
});


/**
 * html2img main
 * @param  {Object} config
 * @return {Object}
 */
function makeShot(config, callback) {
    // all process timestamp start
    tools.time('All Shot process');

    // result
    var ret = {
        status: 'success',
        message: '',
        data: null
    };

    // config
    config = lodash.merge({}, defaultConfig, config);

    // out config
    var outCfg = getOutConfig(config);

    tools.mkDeepDir(outCfg.path);

    // setup
    var viewport = config.viewport || [];
    var width = viewport[0] || 1024;
    var height = viewport[1] || 800;

    horseman.viewport(width, height);

    // open url
    tools.time('Horseman open');
    horseman.open(config.url);
    tools.timeEnd('Horseman open');

    // check wrapSelector
    if(!horseman.count(config.wrapSelector)) {
        ret.message = 'Wrap element not found: ', config.wrapSelector;
        ret.status = 'error';

        callback(ret);
        return;
    }

    // 截原图
    var originImgPath = path.join(outCfg.path, outCfg.name + '_origin.png');

    tools.time('Origin Main shot');
    horseman.crop(config.wrapSelector, originImgPath);
    tools.timeEnd('Origin Main shot');

    // 处理数据
    ret.data = processShot(config, outCfg);
    ret.data.outName = outCfg.name;

    // 正文截图
    tools.time('Main shot');

    var wrapOutPath = path.join(outCfg.path, outCfg.name + '.png');
    horseman.crop(config.wrapSelector, wrapOutPath);

    tools.timeEnd('Main shot');

    // all process timestamp end
    tools.timeEnd('All Shot process');

    ret.message = 'done';
    callback(ret);
}

// outConfig
function getOutConfig(config) {
    var dirname = path.basename(config.url)
            .replace(/\\\/:\*\?"<>\|/g, '');

    var outCfg = {
        count: 0,
        name: 'out',
        dirname: dirname,
        path: path.join(config.outPath, config.name, dirname),
        createImgFilename: function() {
            var name = this.count++;

            name += '.png';
            return name;
        }
    };

    return outCfg;
}

// 预处理（代码，区域截图），待完善
function processShot(config, outCfg) {
    var outHTML = '';
    var replacePlaces = [];
    var replacePlaceCount = horseman.count(config.replaceSelector);

    if(replacePlaceCount > 0) {
        tools.time('Replace shot');
        for(var tmpName,i=0; i<replacePlaceCount; i++) {
            tmpName = outCfg.createImgFilename();

            replacePlaces[i] = {
                filename: tmpName,
                fullPath: path.join(outCfg.path, tmpName),
                selector: config.replaceSelector + ':eq('+ i +')'
            };

            horseman.crop(replacePlaces[i].selector, replacePlaces[i].fullPath);
        }
        tools.timeEnd('Replace shot');

        // 处理代码，替换占位符
        tools.time('Code process');
        outHTML = horseman.evaluate(function(wrapSelector, replaceSelector, replacePlaces) {
            var $ = window.jQuery;
            var elems = $(replaceSelector);

            elems.each(function(i) {
                var item = replacePlaces[i];

                $(this).html('{{'+ item.filename +'}}');
            });

            // 返回处理后代码
            var wrapElem = $(wrapSelector || 'body');
            var html = wrapElem.html();

            if(!html) {
                html = document.body.innerHTML;
            }

            return html;

        }, config.wrapSelector, config.replaceSelector, replacePlaces);
        tools.timeEnd('Code process');

        var outHTMLPath = path.join(outCfg.path, outCfg.name + '.html');
        fs.writeFileSync(outHTMLPath, outHTML);
    }

    return {
        replacePlaces: replacePlaces,
        content: outHTML
    };
}
