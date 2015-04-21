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
    console.error('config path load error: ', configPath);

    process.exit();
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

// 截全图
var fullImgPath = path.join(outPath, getOutImgFileName());

tools.time('Full shot');
horseman.screenshot(fullImgPath);
tools.timeEnd('Full shot');

// 预处理（代码，区域截图）
var replacePlaces = horseman
var replacePlaceCount = horseman.count(config.replaceSelector);
if(replacePlaceCount > 0) {
    var outHTML = '';
    var replacePlaces = [];

    tools.time('Replace shot');
    for(var tmpPath,i=0; i<replacePlaceCount; i++) {
        replacePlaces[i] = {
            filename: getOutImgFileName()
        };

        tmpPath = path.join(outPath, replacePlaces[i].filename);
        horseman.crop(config.replaceSelector, tmpPath);
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
if(horseman.count(config.wrapSelector) > 0) {
    tools.time('Wrap shot');

    var wrapOutPath = path.join(outPath, outFileName + '.png');
    horseman.crop(config.wrapSelector, wrapOutPath);

    tools.timeEnd('Wrap shot');
}

// destroy
horseman.close();

// all process timestamp end
tools.timeEnd('All process');
