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
        console.log('Start Load Horseman(phantomjs)...');
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

                tools.time('Actions.init.setting');
                page.get('settings', function(err, settings) {
                    settings = lodash.merge(settings, customSettings);

                    page.set('settings', settings, function() {
                        tools.timeEnd('Actions.init.setting');
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

        var cwd = process.cwd();
        var imgExt = config.imageExtname;

        // out config
        var outDir = config.id || 'tmp';
        var outName = config.name || 'out';
        var outPath = path.join(config.outPath, outDir);

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
        // config
        this.processConfig(config);

        processers.makeshot(config)
        .then(function(res) {
            if(!config.optimizeImage) {
                return res;
            }

            return processers.optimizeImage({
                image: res.image
            })
            .then(function(newImage) {
                res.old_image = res.image;
                res.image = newImage;

                return res;
            });
        })
        .then(function(res) {
            callback(null, 'makeshot_result', res);
        })
        .catch(function(err) {
            callback(err);
        });
    },
    // 新关联列表（待完善）
    makelist: function() {
        tools.log('makelist...');
    }
};


// Horseman shim
(function() {
    // var HorsemanPromise = require('node-horseman/lib/HorsemanPromise');
    // var _pageMaker = Horseman.prototype.pageMaker;

    // Horseman.prototype.pageMaker = function() {
    //     var self = this;
    //     var cwd = process.cwd();
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
