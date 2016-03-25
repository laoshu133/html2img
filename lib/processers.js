/**
 * processers
 *
 * 截图预处理
 *
 */
'use strict';

var path = require('path');
var lodash = require('lodash');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var tools = require('./tools');
var imageOptimizers = require('./image-optimizers');

var processers = {
    horseman: null,
    init: function(options) {
        lodash.merge(this, options);

        if(!this.horseman) {
            tools.error(new Error('No horseman instance'));

            process.exit(1);
        }
    },
    // prepare
    prepare: function(config) {
        var horseman = this.horseman;

        return Promise.resolve()
        // headers
        .then(() => {
            var headers = config.requestHeaders;

            if(headers) {
                return horseman.headers(headers);
            }
        })
        // viewport
        .then(() => {
            var viewport = config.viewport;

            if(viewport) {
                var width = viewport[0] || 1920;
                var height = viewport[1] || 1680;

                return horseman.viewport(width, height);
            }
        })
        .then(() => {
            return horseman;
        });
    },
    // 裁剪区域
    getCrops: function(selector, options) {
        return this.horseman.evaluate(function(selector, options) {
            return shotTools.getCrops(selector, options);
        }, selector, options);
    },

    // 截图
    crop: function(cropData, path, options) {
        var horseman = this.horseman;

        return Promise.resolve()
        // debug
        // .then(() => {
        //     var testPath = '__out/page-'+ Date.now() +'.png';

        //     return horseman.screenshot(testPath);
        // })
        .then(() => {
            return horseman.crop(cropData, path, options);
        });
    },

    // 缩略图
    makeshot: function(config) {
        var self = this;
        var horseman = this.horseman;
        var selector = config.wrapSelector;

        tools.log('Processers.makeshot');

        return this.prepare(config)
        // open url
        .then(() => {
            return horseman.open(config.url);
        })
        // check wrapSelector
        .then(() => {
            var start = Date.now();
            var timeout = config.wrapFindTimeout;
            var errMsg = 'Wrap element not found: ' + selector;

            return new Promise((resolve, reject) => {
                check();

                function check() {
                    horseman.count(selector)
                    .then(count => {
                        if(count > 0) {
                            return resolve(count);
                        }

                        var elapsed = Date.now() - start;
                        if(elapsed > timeout) {
                            return reject(new Error(errMsg));
                        }

                        setTimeout(check, 96);
                    });
                }
            });
        })
        // get crops
        .then(() => {
            return self.getCrops(selector, {
                size: config.size
            });
        })
        // crop
        .then(crops => {
            var rExt = /(\.\w+)/;
            var out = config.out;
            var imagePath = out.image;
            var images = out.images = [];

            var promise = Promise.resolve();

            crops.forEach((cropData, inx) => {
                var path = imagePath;
                if(inx > 0) {
                    path = path.replace(rExt, '-'+ (inx+1) +'$1');
                }

                images[inx] = path;

                promise = promise.then(() => {
                    tools.log('Processers.makeshot.crop:', inx);

                    return self.crop(cropData, path, {
                        quality: config.imageQuality
                    });
                });
            });

            return promise;
        })
        // fit data
        .then(() => {
            tools.log('Processers.makeshot.done');

            return config.out;
        });
    },

    // 关联列表
    makelist: function(config) {
        var self = this;
        var horseman = this.horseman;
        var selector = config.wrapSelector;

        tools.log('Processers.makelist.done');

        return this.prepare(config)
        // open url
        .then(() => {
            return horseman.open(config.url);
        })
        // check wrapSelector
        .then(() => {
            return horseman.count(selector);
        })
        .then(count => {
            if(!count) {
                var msg = 'Wrap element not found: ' + selector;

                throw new Error(msg);
            }
        })
        // build list html
        .then(() => {
            return horseman.evaluate(function(options) {
                return shotTools.covertList(options);
            }, {
                type: config.listOutType || 'map',
                imageBlank: config.imageBlank,
                selector: selector
            });
        })
        // check links
        .then(linksData => {
            if(linksData.status !== 'success') {
                var msg = 'List links error: ' + linksData.message;
                return Promise.reject(new Error(msg));
            }

            config.out.html = linksData.html;
        })
        // get crop
        .then(() => {
            return self.getCrops(selector, {
                size: config.size
            });
        })
        // crop
        .then(crops => {
            var outCfg = config.out;

            // ret
            // outCfg.outCrop = crops[0];

            return self.crop(crops[0], outCfg.image, {
                quality: config.imageQuality
            });
        })
        // fit data
        .then(() => {
            tools.log('Processers.makelist.done');

            return config.out;
        });
    },

    // 压缩图片
    optimizeImage: function(options) {
        var url = options.image;

        tools.log('Processers.optimizeImage');

        var ext = path.extname(url).slice(1);
        var imageOptimizer = imageOptimizers[ext];

        if(!imageOptimizer) {
            return Promise.resolve(url);
        }

        // promisify
        imageOptimizer = Promise.promisify(imageOptimizer);

        return imageOptimizer(url)
        .then(buf => {
            // new url
            url = url.slice(0, -ext.length);
            url += 'min.' + ext;

            return fs.writeFileAsync(url, buf);
        })
        .then(() => {
            tools.log('Processers.optimizeImage.done');

            return url;
        });
    }
};

module.exports = processers;
