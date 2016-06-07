/**
 * lib/phantom
 *
 */
'use strict';

const path = require('path');
const bytes = require('bytes');
const lodash = require('lodash');
const Promise = require('bluebird');
const createPhantom = require('phantom').create;
const pidusage = Promise.promisifyAll(require('pidusage'));

const logger = require('../services/logger');

require('./phantom-page');

const phantomAdp = {
    phantom: null,
    oldPhantom: null,
    createPhantom: function() {
        return createPhantom([
            // '--proxy=127.0.0.1:8888', // debug
            '--local-to-remote-url-access=true',
            '--ignore-ssl-errors=true',
            '--load-images=true'
        ]);
    },
    getPhantomPromise: null,
    getPhantom: function() {
        if(this.getPhantomPromise) {
            return this.getPhantomPromise;
        }

        logger.info('Phantom.getPhantom');

        let phantom = this.phantom;

        let promise = Promise.resolve()
        // process stat
        .then(() => {
            let ret = {
                memory: 0,
                cpu: 0
            };

            if(!phantom) {
                return ret;
            }

            let process = phantom.process;

            return pidusage.stat(process.pid)
            .then(stat => {
                ret.memory = stat.memory;
                ret.cpu = stat.cpu;
            });
        })
        // 检查内存是否超标
        .then(stat => {
            let memLimit = bytes('' + process.env.PHANTOMJS_MEM_LIMIT);
            if(!memLimit) {
                memLimit = 500 * 1024 * 1024;
            }

            if(stat.memory > memLimit) {
                throw new Error('Phantom.memory.overflow: ' + stat.memory);
            }
        })
        .then(() => {
            if(!phantom) {
                return this.createPhantom();
            }

            return phantom;
        })
        .tap(() => {
            logger.info('Phantom.getPhantom.done');
        })
        .catch(ex => {
            logger.info('[Phantom.check.error]', ex.message);
            logger.error(ex);

            return this.restartPhantom();
        });

        // cache
        this.getPhantomPromise = promise;

        return promise;
    },
    setupPhantom: function(phantom) {
        let process = phantom.process;

        // process watch
        process.on('exit', code => {
            logger.info('[Phantom.exit], with code:', code);

            this.restartPhantom();
        });

        process.on('uncaughtException', ex => {
            logger.info('[Phantom.uncaughtException]', ex.message);
            logger.error(ex);

            process.exit(1);
        });

        // graceful exit
        phantom.gracefulExit = function() {
            if(this.gracefulExitPromise) {
                return this.gracefulExitPromise;
            }

            let self = this;
            let dfd = {
                ttl: 3,
                delay: 2000
            };

            let check = function() {
                let workingPages = self.pages.filter(page => {
                    return page.working;
                });

                if(workingPages.length <= 0 || ++dfd.ttl) {
                    self.exit().then(resolve, reject);
                }
                else {
                    setTimeout(check, dfd.delay);
                }
            };

            // delay check
            process.nextTick(check);

            return new Promise((resolve, reject) => {
                dfd.resolve = resolve;
                dfd.reject = reject;
            });
        };

        // pages
        phantom.pagesCount = 0;
        phantom.pages = [];

        return phantom;
    },
    restartPhantom: function() {

        logger.info('Phantom.retsart');

        return Pormise.resolve()
        // 如果已经有待废弃 phantom 强制重启
        .then(() => {
            let oldPhantom = this.oldPhantom;
            if(oldPhantom) {
                this.oldPhantom = null;

                return oldPhantom.exit();
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

                this.oldPhantom.gracefulExit()
                .catch(ex => {
                    logger.info('Phantom.gracefulExit.error', ex.message);
                    logger.error(ex);
                });
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

    // pages
    createPage: function() {
        return this.getPhantom()
        .then(phantom => {
            // 计数器先增加，优化并发
            phantom.pagesCount += 1;

            return phantom.createPage();
        })
        .then(page => {
            // cache
            phantom.pages.push(page);

            return this.setupPage(page);
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
    getPgaePromise: null,
    getPgae: function() {
        if(this.getPgaePromise) {
            return this.getPgaePromise;
        }

        logger.info('Phantom.getPage');

        let promise = this.getPhantom()
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
                let idlePages = pages.filter(page => {
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

        // cache
        this.getPgaePromise = promise;

        return promise;
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