/**
 * hlg-html2img
 *
 * actions
 */

// deps
var fs = require('fs');
var path = require('path');
var lodash = require('lodash');
var Horseman = require('node-horseman');

var tools = require('./tools');

// default config
var defaultConfig = require('./config.json');

// init Horseman(phantomjs)
console.log('Start Horseman...');

tools.time('Load Horseman(phantomjs)');
var horseman = new Horseman(defaultConfig.horsemanConfig);
tools.timeEnd('Load Horseman(phantomjs)');

var actions = {
    hello: function(client, config, callback) {
        var data = new Buffer('Hello~');

        client.write(data, callback);
    },
    // 取文件
    getfile: function(client, config, callback) {
        if(!fs.existsSync(config.url)) {
            return callback();
        }

        var rs = fs.createReadStream(config.url);

        rs.pipe(client);
        rs.on('end', callback);
    },
    // 缩略图
    makeshot: function(client, config, callback) {
        makeShot(config, function(ret) {
            var outCfg = config.out;
            var retFilePath = path.join(outCfg.path, outCfg.name + '.json');

            fs.writeFile(retFilePath, JSON.stringify(ret), function(err) {
                if(err) {
                    tools.error('Write file err: ', err);

                    callback();
                    return;
                }

                var rs = fs.createReadStream(retFilePath);

                rs.pipe(client);
                rs.on('end', callback);
            });
        });
    },
    // 新关联列表（待完善）
    makelist: function() {
        tools.log('makelist...');
    }
};

/**
 * 处理配置
 * content -> url
 *
 */
function processConfig(config) {
    // out config
    var outCfg = getOutConfig(config);
    tools.mkDeepDir(outCfg.path);

    config.out = outCfg;

    if(config.content) {
        var htmlTplPath = path.join('tpl', config.htmlTpl);
        var htmlTpl = fs.readFileSync(htmlTplPath);

        var html = htmlTpl.toString().replace('{content}', config.content);
        var inPath = path.join(outCfg.path, 'in.html');

        fs.writeFileSync(inPath, html);

        config.url = inPath;
    }

    return config;
}

// outConfig
function getOutConfig(config) {
    var dirname = config.id;
    // dirname = dirname.replace(/\\\/:\*\?"<>\|/g, '');

    var outCfg = {
        count: 0,
        name: 'out',
        dirname: dirname,
        path: path.join(config.outPath, dirname),
        createImgFilename: function() {
            var name = this.count++;

            name += '.png';
            return name;
        }
    };

    return outCfg;
}

/**
 * makeShot
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
    config = processConfig(config);

    var outCfg = config.out;

    // setup
    var viewport = config.viewport || [];
    var width = viewport[0] || 1024;
    var height = viewport[1] || 800;

    horseman.viewport(width, height);

    // headers
    if(config.headers) {
        horseman.headers(config.headers);
    }

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
    // var originImgPath = path.join(outCfg.path, outCfg.name + '_origin.png');
    // tools.time('Origin Main shot');
    // horseman.crop(config.wrapSelector, originImgPath);
    // tools.timeEnd('Origin Main shot');

    // 处理数据
    ret.data = lodash.merge({
        id: config.id,
        outName: outCfg.name,
        outFile: outCfg.path + '/' + outCfg.name + '.png',
        outCrop: config.wrapSelector,
        content: ''
    }, processShot(config, outCfg));

    // 正文截图
    tools.time('Main shot');

    var wrapOutPath = path.join(outCfg.path, outCfg.name + '.png');
    horseman.crop(ret.data.outCrop, wrapOutPath);

    tools.timeEnd('Main shot');

    // all process timestamp end
    tools.timeEnd('All Shot process');

    ret.message = 'done';
    callback(ret);
}

// 预处理（代码，区域截图），待完善
function processShot(config, outCfg) {
    var action  = config.action;

    var ret = {};

    if(processers[action]) {
        ret = processers[action](config, outCfg);
    }

    return ret;
}


/**
 * processers
 *
 * 截图预处理
 *
 */
var processers = {
    // 标准截图
    makeshot: function(config, outCfg) {
        // restore
        // horseman.zoom(1);

        // 比例缩放，裁剪
        var outCrop;
        var size = config.size;
        if(size && size.width) {
            outCrop = horseman.evaluate(function(wrapSelector, size) {
                var $ = window.jQuery;
                var wrapElem = $(wrapSelector);

                wrapElem.css('transform', 'none');

                var wrapWidth = wrapElem.width();
                var wrapHeight = wrapElem.height();

                var heightRatio = size.height / wrapHeight;
                var widthRatio = size.width / wrapWidth;
                var ratio = widthRatio;

                // 短边裁剪
                if(widthRatio < heightRatio) {
                    ratio = heightRatio;
                }

                wrapElem.css('transform', 'scale('+ ratio +')');

                var rect = wrapElem[0].getBoundingClientRect();

                // 默认左上角开始裁剪
                var outCrop = {
                    height: size.height,
                    width: size.width,
                    left: rect.left,
                    top: rect.top
                };

                // 居中裁剪
                // outCrop.left += (rect.width - size.width) / 2;
                // outCrop.top += (rect.height - size.height) / 2;

                // debug
                // outCrop.html = document.documentElement.outerHTML;

                return outCrop;
            }, config.wrapSelector, size);
        }

        return {
            outCrop: outCrop
        };
    },
    // 新关联列表（待完善）
    makelist: function() {
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
};


// clean horseman
process.on('exit', function(err) {
    if(horseman) {
        horseman.close();
    }
});

// error catch
process.on('uncaughtException', function(err) {
    process.exit();
});

module.exports = actions;
