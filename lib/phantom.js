/**
 * lib/phantom
 *
 */
'use strict';

const path = require('path');
const bytes = require('bytes');
const lodash = require('lodash');
const Promise = require('bluebird');
const PhantomPage = require('./phantom-page');
const createPhantom = require('phantom').create;
const pidstat = Promise.promisify(require('pidusage').stat);

const logger = require('../services/logger');


const phantomAdp = {
    phantom: null,
    oldPhantom: null,
    createPhantom: function() {
        logger.info('Phantom.createPhantom');

        return createPhantom([
            // '--proxy=127.0.0.1:8888', // debug
            '--local-to-remote-url-access=true',
            '--ignore-ssl-errors=true',
            '--load-images=true'
        ])
        .then(phantom => {
            logger.info('Phantom.createPhantom.done');

            return phantom;
        });
    },
    getPhantomPromise: null,
    getPhantom: function() {
        // 防止并发创建多个
        if(this.getPhantomPromise) {
            return this.getPhantomPromise;
        }

        let promise = this.getPhantomStat()
        // 检查内存是否超标
        .then(stat => {
            let memLimit = bytes('' + process.env.PHANTOMJS_MEM_LIMIT);

            if(stat.memory > memLimit) {
                let memoryPretty = bytes(stat.memory);

                throw new Error('Phantom.memory.overflow: ' + memoryPretty);
            }
        })
        .then(() => {
            if(this.phantom) {
                return this.phantom;
            }

            return this.createPhantom();
        })
        // setup phantom
        .then(phantom => {
            // first setup
            if(!phantom.pages) {
                // cache
                this.phantom = phantom;

                return this.setupPhantom(phantom);
            }

            return phantom;
        })
        .catch(ex => {
            logger.info('Phantom.check.error', ex.message);
            // logger.error(ex);

            return this.restartPhantom();
        })
        .finally(() => {
            // reset
            if(this.getPhantomPromise) {
                this.getPhantomPromise = null;
            }
        });

        // cache
        this.getPhantomPromise = promise;

        return promise;
    },
    getPhantomStat: Promise.method(function() {
        let ret = {
            pid: 0,
            cpu: 0,
            memory: 0
        };

        let phantom = this.phantom;
        let pid = phantom && phantom.process.pid;

        if(!pid) {
            return ret;
        }

        return pidstat(pid)
        .then(stat => {
            ret.pid = pid;
            ret.cpu = stat.cpu;
            ret.memory = stat.memory;

            logger.info('Phantom.stat', lodash.assign({
                memoryPretty: bytes(ret.memory)
            }, ret));

            return ret;
        });
    }),
    setupPhantom: function(phantom) {
        // process watch
        phantom.process.on('exit', code => {
            logger.info('Phantom.exit, with code:', code);
        });
        phantom.process.on('uncaughtException', ex => {
            logger.info('[Phantom.uncaughtException]', ex.message);
            logger.error(ex);

            phantom.process.exit(1);
        });

        // graceful exit
        phantom.gracefulExit = function() {
            if(this.gracefulExitTTL !== undefined) {
                return;
            }
            this.gracefulExitTTL = 3;

            let self = this;
            let checkDelay = 1600;

            // check
            let check = function() {
                self.gracefulExitTTL -= 1;

                let workingPages = self.pages.filter(page => {
                    return page.working;
                });

                if(
                    workingPages.length <= 0 ||
                    self.gracefulExitTTL <= 0
                ) {
                    phantomAdp.exitPhantom(self);

                    return;
                }

                setTimeout(check, checkDelay);
            };

            // delay check
            process.nextTick(check);
        };

        // createPage, ignore Proxy
        // phantomjs-node/src/phantom.js#96
        phantom.createPage = function() {
            return this.execute('phantom', 'createPage')
            .then(response => {
                return new PhantomPage(this, response.pageId);
            });
        };

        // pages
        phantom.pagesCount = 0;
        phantom.pages = [];

        return phantom;
    },
    restartPhantomCount: 0,
    restartPhantom: function() {

        logger.info('Phantom.retsart');

        // 防止频繁重启
        let maxRestartCount = 100;

        if(++this.restartPhantomCount > maxRestartCount) {
            throw new Error('Too many times to restart');
        }

        return Promise.resolve()
        // 如果已经有待废弃 phantom 强制重启
        .then(() => {
            if(this.oldPhantom) {
                this.exitPhantom(this.oldPhantom);

                this.oldPhantom = null;
            }
        })
        .catch(ex => {
            logger.info('Phantom.exit.error', ex.message);
            logger.error(ex);
        })
        // 如果已经有 phantom 实例
        // 将其列为待废弃，并尝试优雅退出旧进程
        .then(() => {
            if(this.phantom) {
                this.oldPhantom = this.phantom;

                this.oldPhantom.gracefulExit();
            }

            this.getPhantomPromise = null;
            this.phantom = null;
        })
        // up
        .then(() => {
            return this.getPhantom();
        })
        .tap(() => {
            logger.info('Phantom.retsart.done');
        });
    },
    exitPhantom: function(phantom) {
        try{
            if(!phantom.exited) {
                phantom.exit();
            }

            phantom.exited = true;
        }
        catch(ex) {
            logger.info('Phantom.exit.error', ex.message);
            logger.error(ex);
        }
    },

    // pages
    createPage: function() {
        logger.info('Phantom.createPage');

        return this.getPhantom()
        .then(phantom => {
            // 计数器先增加，优化并发
            phantom.pagesCount += 1;

            return phantom.createPage();
        })
        .then(page => {
            // cache
            page.phantom.pages.push(page);

            return this.setupPage(page);
        })
        .tap(() => {
            logger.info('Phantom.createPage.done');
        });
    },
    setupPage: function(page) {
        return Promise.resolve()
        // setup
        .then(() => {
            // 单个 page 最多使用次数，防止内存泄漏
            page.ttl = +process.env.PHANTOMJS_PAGE_TTL || 10;
            page.working = false;

            // override open & close
            page._open = page.open;
            page._close = page.close;
            page.open = function(url) {
                page.working = true;
                page.ttl -= 1;

                logger.info('Phantom.page.open', url);

                return page._open.call(page, url)
                .then(status => {
                    logger.info('Phantom.page.open.done');

                    return status;
                });
            };
            page.close = Promise.method(() => {
                // reset
                page.working = false;

                // idle
                let idleUrl = 'about:blank';
                let idleContent = '<html><body></body></html>';

                // 优先复用页面
                if(page.ttl > 0) {
                    logger.info('Phantom.page.release');

                    // release page mem
                    return page.setContent(idleContent, idleUrl);
                }
                // 页面超过最大使用次数
                else {
                    let phantom = page.phantom;

                    if(phantom) {
                        lodash.remove(phantom.pages, item => {
                            return item === page;
                        });

                        phantom.pagesCount -= 1;
                    }

                    // log
                    logger.info('Phantom.page.died');

                    return page._close();
                }
            });
        })
        // debug
        .then(() => {
            // page.console
            return page.property('onConsoleMessage', function(/*msg, lineNum, sourceId*/) {
                // console.log('Page.console', arguments[0]);
            })
            // page.onLoadFinished
            // .then(() => {
            //     return page.property('onLoadFinished', function() {
            //         console.log('page.onLoadFinished');
            //     });
            // })
            // // page.request.error
            // .then(() => {
            //     return page.property('onResourceError', function(errorData) {
            //         console.error('Page.request.error:', errorData.errorCode, errorData.url);
            //         console.error('Page.request.error.desc:', errorData.errorString);
            //     });
            // })
            // // page.request
            // .then(() => {
            //     return page.property('onResourceReceived', function(response) {
            //         if(response.stage !== 'start') {
            //             return;
            //         }

            //         console.log('Page.request', JSON.stringify({
            //             url: response.url,
            //             stage: response.stage,
            //             status: response.status,
            //             headers: response.headers
            //         }, null, 2));
            //     });
            // })
            ;
        })
        .then(() => {
            return page;
        });
    },
    getPage: function() {
        logger.info('Phantom.getPage');

        return this.getPhantom()
        .then(phantom => {
            let pagesCount = phantom.pagesCount;
            let pagesCountLimit = +process.env.PHANTOMJS_PAGE_SIZE || 4;

            // page 总数小于设定值时直接创建
            if(pagesCount < pagesCountLimit) {
                return this.createPage();
            }

            // 检查是否有 page 可用， 10s 超时
            let dfd = {
                delay: 160,
                timeout: 10 * 1000,
                start: Date.now()
            };

            let check = () => {
                let idlePages = phantom.pages.filter(page => {
                    return !page.working;
                });

                if(idlePages[0]) {
                    dfd.resolve(idlePages[0]);
                    return;
                }

                let elapsed = Date.now() - dfd.start;
                if(elapsed > dfd.timeout) {
                    let errMsg = 'Phantom.getPage.timeout';

                    dfd.reject(new Error(errMsg));
                    return;
                }

                setTimeout(check, dfd.delay);
            };

            // delay check
            process.nextTick(check);

            return new Promise((resolve, reject) => {
                dfd.resolve = resolve;
                dfd.reject = reject;
            });
        })
        .tap(() => {
            logger.info('Phantom.getPage.done');
        });
    },
    preparePage: function(cfg) {
        let page;

        return this.getPage()
        .then(phPage => {
            page = phPage;

            if(!cfg.url) {
                throw new Error('url not provided');
            }

            return page.open(cfg.url);
        })
        .then(status => {
            if(status !== 'success') {
                throw new Error('Page open failed, status:' + status);
            }

            return page;
        })
        // request headers
        .tap(page => {
            let headers = cfg.requestHeaders;

            if(headers) {
                return page.property('customHeaders', headers);
            }
        })
        // viewport
        .tap(page => {
            let viewport = cfg.viewport;

            if(viewport) {
                return page.property('viewportSize', {
                    height: viewport[1] || 1200,
                    width: viewport[0] || 1920
                });
            }
        })
        // inject jquery
        .tap(page => {
            // jQuery
            let jqueryUrl = 'jquery/dist/jquery.min.js';
            if(process.env.NODE_ENV === 'development') {
                jqueryUrl = jqueryUrl.replace('.min', '');
            }

            return page.evaluate(function() {
                return !!window.jQuery;
            })
            .then(hasJQuery => {
                if(!hasJQuery) {
                    jqueryUrl = require.resolve(jqueryUrl);

                    return page.injectJs(jqueryUrl);
                }
            });
        })
        // inject shot tools
        .tap(page => {
            let clientToolsUrl = '../static/shot-tools.js';
            clientToolsUrl = path.resolve(__dirname, clientToolsUrl);

            return page.injectJs(clientToolsUrl);
        })
        // inject shot tools
        .tap(page => {
            if(cfg.includeJs) {
                return page.includeJs(cfg.includeJs);
            }
        });
    }
};


module.exports = phantomAdp;