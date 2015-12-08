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
    getCrop: function(options) {
        return this.horseman.evaluate(function(options) {
            return dsTools.getCrop(options);
        }, options);
    },
    // 压缩图片
    optimizeImage: function(options) {
        var url = options.image;

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
            return self.getCrop({
                selector: selector,
                size: config.size
            });
        })
        // crop
        .then(function(cropData) {
            var outCfg = config.out;

            // ret
            outCfg.outCrop = cropData;

            return horseman.crop(cropData, outCfg.image);
        })
        // fit data
        .then(function() {
            tools.timeEnd('Processers.makeshot');

            return config.out;
        });
    },

    // 关联列表
    makelist: function(config) {
        var self = this;
        var horseman = this.horseman;
        var selector = config.wrapSelector;

        tools.time('Processers.makelist');

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
        // build list html
        .evaluate(function(options) {
            return dsTools.covertList(options);
        }, {
            type: config.listOutType || 'map',
            imageBlank: config.imageBlank,
            selector: selector
        })
        // check links
        .then(function(linksData) {
            if(linksData.status !== 'success') {
                var msg = 'List links error: ' + linksData.message;
                return Promise.reject(new Error(msg));
            }

            config.out.html = linksData.html;
        })
        // get crop
        .then(function() {
            return self.getCrop({
                selector: selector,
                size: config.size
            });
        })
        // crop
        .then(function(cropData) {
            var outCfg = config.out;

            // ret
            outCfg.outCrop = cropData;

            return horseman.crop(cropData, outCfg.image);
        })
        // fit data
        .then(function() {
            tools.timeEnd('Processers.makelist');

            return config.out;
        });
    }
};

module.exports = processers;
