/**
 * hlg-html2img
 *
 * actions
 */

// deps
var fs = require('fs');
var path = require('path');
var async = require('async');
var rimraf = require('rimraf');
var lodash = require('lodash');
var Horseman = require('node-horseman');
var ExecBuffer = require('exec-buffer');
var pngquantPath = require('pngquant-bin');

var tools = require('./tools');

// default config
var defaultConfig = require('./config.json');

var horseman = null;
var actions = {
    // init
    init: function() {
        if(horseman) {
            return;
        }

        var horsemanConfig = defaultConfig.horsemanConfig;

        // init Horseman(phantomjs)
        tools.time('Load Horseman(phantomjs)');
        horseman = new Horseman(horsemanConfig);
        tools.timeEnd('Load Horseman(phantomjs)');

        // page, phantomjs page
        var page = horseman.page;

        // clean fix, not store request
        page.onResourceReceived = function(res) {
            // tools.log('ResourceReceived', res.status, res.url);
        };

        // custom settings
        if(horsemanConfig.resourceTimeout) {
            var customSettings = {
                resourceTimeout: horsemanConfig.resourceTimeout
            };

            page.get('settings', function(err, settings) {
                settings = lodash.merge(settings, customSettings);

                page.set('settings', settings, function() {
                    tools.log('write custom settings');
                });
            });
        }
    },
    // 清理目录
    clean: function(client, config, callback) {
        var outCfg = getOutConfig(config);

        rimraf(outCfg.path, function(err) {
            if(err) {
                callback(err, 'clean_result',  '0');

                return;
            }

            callback(null, 'clean_result', '1');
        });
    },
    // 取文件
    getfile: function(client, config, callback) {
        if(!fs.existsSync(config.url)) {
            return callback(new Error('File do not exists'));
        }

        fs.readFile(config.url, function(err, buf) {
            if(err) {
                callback(err);
                return;
            }

            callback(null, 'file', buf);
        });
    },
    // 缩略图
    makeshot: function(client, config, callback) {
        tools.time('All shot process');

        makeShot(config, function(ret) {
            if(!config.optimizeImage) {
                tools.timeEnd('All shot process');

                callback(null, 'makeshot_result', ret);
                return;
            }

            // recommend client slide optimizeImage
            var outFile = ret.data.outFile;
            var outFileOpt = path.join(path.dirname(outFile), 'out_opt.png');

            async.waterfall([
                function optPng(cb) {
                    optimizePng(outFile, cb);
                },
                function writeFile(buf, cb) {
                    fs.writeFile(outFileOpt, buf, cb);
                }
            ], function done(err) {
                tools.timeEnd('Make_shot');

                if(err) {
                    callback(err);
                    return;
                }

                ret.data.outFile = outFileOpt;
                callback(null, 'makeshot_result', ret);
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
    // tools.time('All Shot process');

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
    if(config.horsemanHeaders) {
        horseman.headers(config.horsemanHeaders);
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
    // tools.timeEnd('All Shot process');

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
            /**
             * 裁剪类型
             * 10 - 长边裁剪，圆点中心，不足补白
             * 11 - 长边裁剪，圆点左上，不足补白
             * 12 - 长边裁剪，圆点左上，不足不处理
             * 20 - 短边裁剪，圆点中心，不足不处理
             * 21 - 短边裁剪，圆点左上，不足不处理
             */
            outCrop = horseman.evaluate(function(wrapSelector, size) {
                var $ = window.jQuery;
                var type = ~~size.type || 10;
                var wrapElem = $(wrapSelector);

                wrapElem.css('transform', 'none');

                var wrapWidth = wrapElem.width();
                var wrapHeight = wrapElem.height();

                var heightRatio = size.height / wrapHeight;
                var widthRatio = size.width / wrapWidth;
                var ratio = widthRatio;

                // 选边
                if(
                    // 长边裁剪
                    (type < 20 && widthRatio > heightRatio) ||
                    // 短边裁剪
                    (type >= 20 && widthRatio < heightRatio)
                ) {
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
                if(type % 10 === 0) {
                    outCrop.left += (rect.width - size.width) / 2;
                    outCrop.top += (rect.height - size.height) / 2;
                }

                // 长边裁剪，减去补白
                if(type === 12) {
                    if(size.height > rect.height) {
                        outCrop.height = rect.height;
                    }
                    else if(size.width > rect.width) {
                        outCrop.width = rect.width;
                    }
                }

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

// optimizePng
function optimizePng(src, callback) {
    fs.readFile(src, function(err, buf) {
        if(err) {
            callback(err);
            return;
        }

        var exec = new ExecBuffer();
        var args = ['-o', exec.dest(), exec.src()];

        exec.use(pngquantPath, args)
        .run(buf, function(err, buf) {
            if(err || !buf || !buf.length) {
                callback(err);
                return;
            }

            callback(null, buf);
        });
    });
}


// clean horseman
process.on('exit', function() {
    if(horseman) {
        horseman.close();
    }
});

// error catch
process.on('uncaughtException', function(err) {
    if(horseman) {
        horseman.close();
    }

    console.error('actions uncaughtException', err);
});

module.exports = actions;
