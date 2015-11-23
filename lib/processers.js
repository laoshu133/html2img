/**
 * processers
 *
 * 截图预处理
 *
 */
var fs = require('fs');
var path = require('path');
var lodash = require('lodash');

var tools = require('./tools');
var imageOptimizers = require('./image-optimizers');

var processers = {
    horseman: null,
    init: function(options) {
        lodash.merge(this, options);

        if(!this.horseman) {
            tools.error('Horseman Error:', msg, trace);

            process.exit(1);
        }
    },
    // prepare
    prepare: function(config) {
        var horseman = this.horseman;

        // viewport
        var viewport = config.viewport || [];
        var width = viewport[0] || 1024;
        var height = viewport[1] || 800;

        return horseman.viewport(width, height)
        .then(function() {
            // headers
            var headers = config.horsemanHeaders;

            if(headers) {
                return horseman.headers(headers);
            }
        });
    },
    // 裁剪区域
    getCrop: function(config) {
        var cropOptions = {
            selector: config.wrapSelector,
            size: config.size || {}
        };

        return this.horseman.evaluate(function(options) {
            return dsTools.getCrop(options);
        }, cropOptions);
    },
    // 缩略图
    makeshot: function(config) {
        var self = this;
        var horseman = this.horseman;
        var selector = config.wrapSelector;

        tools.time('Processers.makeshot');

        return this.prepare(config)
        // open url
        .open(config.url)
        // return;
        // check wrapSelector
        .count(selector).then(function(count) {
            if(!count) {
                var msg = 'Wrap element not found: ' + selector;
                return Promise.reject(new Error(msg));
            }
        })
        // get crop
        .then(function() {
            return self.getCrop(config);
        })
        // crop
        .then(function(outCrop) {
            var outCfg = config.out;
            return horseman.crop(outCrop, outCfg.image);
        })
        // fit data
        .then(function() {
            tools.timeEnd('Processers.makeshot');

            return config.out;
        });
    },
    // 压缩图片
    optimizeImage: function(config) {
        var url = config.image;

        tools.time('Processers.optimizeImage');

        return new Promise(function(resolve, reject) {
            var ext = path.extname(url).slice(1);
            var imageOptimizer = imageOptimizers[ext];

            if(!imageOptimizer) {
                resolve(url);

                return;
            }

            imageOptimizer(url, function(err, buf) {
                if(err) {
                    return reject(err);
                }

                var newUrl = url.slice(0, -ext.length);
                newUrl += 'min.' + ext;

                fs.writeFileSync(newUrl, buf);

                tools.timeEnd('Processers.optimizeImage');

                resolve(newUrl);
            });
        });
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

module.exports = processers;
