/**
 * hlg-html2img
 *
 * actions
 */

// deps
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');
var lodash = require('lodash');
var Horseman = require('node-horseman');

var tools = require('./lib/tools');
var processers = require('./lib/processers');

// config
var config = require('./config').getConfig();

var horseman = null;
var actions = {
    // init
    init: function() {
        if(horseman) {
            return horseman.ready;
        }

        var horsemanConfig = config.horsemanConfig;

        // init Horseman(phantomjs)
        tools.time('Actions.init');

        horseman = new Horseman(horsemanConfig);

        // processers
        processers.init({
            horseman: horseman
        });

        // error
        horseman.on('error', function(msg, trace) {
            tools.error('Horseman Error:', msg, trace);

            process.exit(1);
        });

        return horseman.ready.then(function() {
            var slice = Array.prototype.slice;

            // page, phantomjs page
            var page = horseman.page;

            // clean fix, not store request
            page.onResourceReceived = function(res) {
                // tools.log('ResourceReceived', res.status, res.url);
            };

            // debug
            page.onConsoleMessage = function() {
                var args = slice.call(arguments);
                args.unshift('Actions.page.console');

                tools.log.apply(tools, args);
            };

            // custom settings
            var resourceTimeout = horsemanConfig.resourceTimeout;
            if(resourceTimeout) {
                var customSettings = {
                    resourceTimeout: resourceTimeout
                };

                // tools.time('Actions.init.setting');
                page.get('settings', function(err, settings) {
                    settings = lodash.merge(settings, customSettings);

                    page.set('settings', settings, function() {
                        // tools.timeEnd('Actions.init.setting');
                        tools.timeEnd('Actions.init');
                    });
                });
            }
        });
    },
    // config
    processConfig: function(config) {
        if(config.out) {
            return config;
        }

        var cwd = __dirname;
        var imgExt = config.imageExtname;

        // out config
        var outDir = config.id || 'tmp';
        var outName = config.name || 'out';
        var outPath = path.join(config.outPath, outDir);
        if(outPath.slice(0, 1) !== '/') {
            outPath = path.join(cwd, outPath);
        }

        // mkdir
        tools.mkDeepDir(outPath);

        config.out = {
            name: '',
            path: outPath,
            dirname: outDir,
            html: path.join(outPath, outName + '.html'),
            image: path.join(outPath, outName + imgExt)
        };

        // content
        if(config.content && !config.url) {
            var inPath = path.join(outPath, 'in.html');
            var htmlTplPath = path.join(cwd, 'tpl', config.htmlTpl);
            var htmlTpl = fs.readFileSync(htmlTplPath);

            var html = tools.fill(htmlTpl, {
                content: config.content,
                cwd: cwd
            });

            fs.writeFileSync(inPath, html);

            config.url = inPath;
        }

        return config;
    },
    // 清理目录
    clean: function(client, config, callback) {
        // config
        this.processConfig(config);

        tools.time('Actions.clean');

        var url = config.path || config.out.path;
        var type = 'clean_result';

        tools.log('Actions.clean', url);

        if(!fs.existsSync(url)) {
            var msg = 'No such file or directory, ' + url;
            var err = new Error(msg);

            return callback(err, type, -1);
        }

        rimraf(url, function(err) {
            var code = 0;
            if(err) {
                code = -2;
            }

            tools.timeEnd('Actions.clean');

            callback(err, type, code);
        });
    },
    // 取文件
    getfile: function(client, config, callback) {
        // config
        this.processConfig(config);

        tools.time('Actions.getfile');

        var url = config.url;
        if(!url) {
            url = config.out.image;
        }

        if(!fs.existsSync(url)) {
            var msg = 'No such file or directory, ' + url;
            return callback(new Error(msg));
        }

        fs.readFile(url, function(err, buf) {
            if(err) {
                callback(err);
                return;
            }

            tools.timeEnd('Actions.getfile');

            callback(null, 'file', buf);
        });
    },
    // 压缩图片
    optimizeImage: function(ret, config) {
        if(!config || !config.optimizeImage) {
            return ret;
        }

        return processers.optimizeImage({
            image: ret.image
        })
        .then(function(newImage) {
            ret.old_image = ret.image;
            ret.image = newImage;

            return ret;
        });
    },
    // 缩略图
    makeshot: function(client, config, callback) {
        var self = this;

        // config
        this.processConfig(config);

        processers.makeshot(config)
        // optimizeImage
        .then(function(res) {
            return self.optimizeImage(res, config);
        })
        // fit data
        .then(function(res) {
            var data = {
                status: 'success',
                message: '',
                data: res
            };

            // 兼容旧接口
            res.outFile = res.image;

            callback(null, 'makeshot_result', data);
        })
        .catch(function(err) {
            callback(err);
        });
    },
    // 新关联列表（待完善）
    makelist: function(client, config, callback) {
        var self = this;

        // config
        this.processConfig(config);

        processers.makelist(config)
        // optimizeImage
        .then(function(res) {
            return self.optimizeImage(res, config);
        })
        // fit data
        .then(function(res) {
            var data = {
                status: 'success',
                message: '',
                data: res
            };

            callback(null, 'makelist_result', data);
        })
        .catch(function(err) {
            callback(err);
        });
    }
};


// Horseman shim
(function() {
    // var HorsemanPromise = require('node-horseman/lib/HorsemanPromise');
    // var _pageMaker = Horseman.prototype.pageMaker;

    // Horseman.prototype.pageMaker = function() {
    //     var self = this;
    //     var cwd = __dirname;
    //     var options = this.options;
    //     var scripts = options.clientScripts;

    //     console.log('xxx000', typeof _pageMaker);

    //     return _pageMaker.apply(this, arguments)
    //     .then(function() {
    //         if(!scripts || !scripts.length) {
    //             return;
    //         }

    //         var page = self.page;
    //         var _onLoadFinished = page.onLoadFinished;

    //         page.onLoadFinished = function() {
    //             console.log('xxx', typeof _onLoadFinished);
    //             _onLoadFinished.apply(this, arguments);

    //             self.ready.then(function() {
    //                 var dfs = scripts.map(function(js) {
    //                     var p = path.join(cwd, js);

    //                     return new HorsemanPromise(function(resolve) {
    //                         page.injectJs(p, function(err) {
    //                             if(err) {
    //                                 tools.error(err);
    //                             }

    //                             resolve();
    //                         });
    //                     });
    //                 });

    //                 var promise = HorsemanPromise.all(dfs);

    //                 self.ready = promise;
    //             });
    //         };
    //     });
    // };
})();


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

    console.error('Actions uncaughtException', err);
    throw err;
});


actions.init();

module.exports = actions;
