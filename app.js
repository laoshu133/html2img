/**
 * hlg-html2img
 *
 *
 */

// deps
var fs = require('fs');
var path = require('path');
var lodash = require('lodash');

var tools = require('./tools');
var Horseman = require('node-horseman');

// all process timestamp start
tools.time('All process');

// config
var args = process.argv.slice(2);
var configPath = args[0];

var config = null;
if(configPath && fs.existsSync(configPath)) {
    config = tools.getConfig(configPath);
}

if(!config) {
    console.error('Config path load error: ', configPath);

    return;
}

var defaultConfig = tools.getConfig('./config.json');
config = lodash.merge({}, defaultConfig, config);

// 输出配置
var outCount = 0;
var outFileName = 'out';
var outDirName = path.basename(config.url)
    .replace(/\\\/:\*\?"<>\|/g, '');
var outPath = path.join(config.outPath, config.name, outDirName);

var getOutImgFileName = function() {
    var name = outCount++;

    name += '.png';
    return name;
};

tools.mkDeepDir(outPath);


// init
console.log('Start Horseman...');

tools.time('Load Horseman(phantomjs)');
var horseman = new Horseman(config.horsemanConfig);
tools.timeEnd('Load Horseman(phantomjs)');

// setup
if(config.viewport) {
    var width = config.viewport[0] || 1024;
    var height = config.viewport[1] || 800;

    horseman.viewport(width, height);
}

// tools.fireEvent(config, 'init', horseman);
tools.time('Horseman open');
horseman.open(config.url);
tools.timeEnd('Horseman open');

if(!horseman.count(config.wrapSelector)) {
    console.error('Wrap element not found: ', config.wrapSelector);

    horseman.close();
    return;
}

// 截原图
var originImgPath = path.join(outPath, outFileName + '_origin.png');

tools.time('Origin shot');
horseman.crop(config.wrapSelector, originImgPath);
tools.timeEnd('Origin shot');


// 预处理（代码，区域截图），待完善
var replacePlaces = horseman
var replacePlaceCount = horseman.count(config.replaceSelector);
if(replacePlaceCount > 0) {
    var outHTML = '';
    var replacePlaces = [];

    tools.time('Replace shot');
    for(var tmpName,i=0; i<replacePlaceCount; i++) {
        tmpName = getOutImgFileName();

        replacePlaces[i] = {
            filename: tmpName,
            fullPath: path.join(outPath, tmpName),
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

    var outHTMLPath = path.join(outPath, outFileName + '.html');
    fs.writeFileSync(outHTMLPath, outHTML);
}

// 正文截图
tools.time('Wrap shot');

var wrapOutPath = path.join(outPath, outFileName + '.png');
horseman.crop(config.wrapSelector, wrapOutPath);

tools.timeEnd('Wrap shot');


// destroy
horseman.close();

// all process timestamp end
tools.timeEnd('All process');
