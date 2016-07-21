/**
 * lib/phantom-adp
 *
 */
'use strict';

const path = require('path');
const bytes = require('bytes');
const lodash = require('lodash');
const Promise = require('bluebird');
const Phantom = require('./phantom');
const pidstat = Promise.promisify(require('pidusage').stat);

const logger = require('../services/logger');

const phantomAdp = {
    phantom: null,
    oldPhantom: null,
    createPhantom: function() {
        logger.info('Phantom.createPhantom');

        return Promise.resolve(new Phantom([
            // '--proxy=127.0.0.1:8888', // debug
            '--local-to-remote-url-access=true',
            '--ignore-ssl-errors=true',
            '--load-images=true'
        ]))
        .tap(() => {
            logger.info('Phantom.createPhantom.done');
        });
    },
    getPhantomPromise: null,
    getPhantom: function() {
        // 防止并发创建多个
        if(this.getPhantomPromise) {
            return this.getPhantomPromise;
        }

        this.getPhantomPromise = this.getPhantomStat()
        // 检查内存是否超标
        // Phantomjs 内存泄漏规避
        // https://github.com/ariya/phantomjs/issues/12903
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
        .catch(ex => {
            let message = ex.message;

            logger.info('Phantom.check.error', message);

            // 如果是因为内存超标，重启当前进程
            if(message.indexOf('memory.overflow') > -1) {
                return this.restartPhantom();
            }

            throw ex;
        })
        .finally(() => {
            // reset
            this.getPhantomPromise = null;
        });

        return this.getPhantomPromise;
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

            // logger.info('Phantom.stat', lodash.assign({
            //     memoryPretty: bytes(ret.memory)
            // }, ret));

            return ret;
        });
    }),

    // restartPhantom
    phantomRestartCount: 0,
    restartPhantom: function() {
        logger.info('Phantom.retsart');

        // // 防止频繁重启
        // let maxRestartCount = 50;

        // // 手动退出进程，让 pm2 接手重启 node 进程
        // if(++this.phantomRestartCount > maxRestartCount) {
        //     logger.info('Phantom.retsart.error_restart_times_limit');
        //     logger.error(new Error('Too many times to restart'));

        //     process.exit(1);
        // }

        return Promise.try(() => {
            var oldPhantom = this.oldPhantom;

            // 如果已经有待废弃 phantom 强制重启
            if(oldPhantom) {
                this.oldPhantom = null;

                return oldPhantom.exit();
            }
        })
        // 如果已经有 phantom 实例
        // 将其列为待废弃，并尝试优雅退出旧进程
        .then(() => {
            if(this.phantom) {
                this.oldPhantom = this.phantom;

                this.oldPhantom.gracefulExit();
            }

            // reset
            this.getPhantomPromise = null;
            this.phantom = null;

            // ignore Bluebird warning
            // gracefulExit created a promise, but not return it
            return null;
        })
        // up
        .then(() => {
            return this.getPhantom();
        })
        .tap(() => {
            logger.info('Phantom.retsart.done');
        });
    },

    // page
    preparePage: function(cfg) {
        return this.getPage()
        // check config
        .then(page => {
            if(!cfg.url) {
                throw new Error('url not provided');
            }

            return page;
        })
        // request headers
        .tap(page => {
            let headers = cfg.requestHeaders;

            // reset headers
            if(lodash.isEmpty(headers)) {
                headers = {};
            }

            let promise = page.property('customHeaders', headers);

            // userAgent use page.settings
            let userAgent = headers['User-Agent'] || headers['user-agent'];
            if(userAgent) {
                promise = promise.then(() => {
                    return page.setting('userAgent', userAgent);
                });
            }

            return promise;
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
        // open url
        .tap(page => {
            return page.open(cfg.url)
            .then(status => {
                if(status !== 'success') {
                    throw new Error('Page open failed, status:' + status);
                }
            });
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
        // inject extend js
        .tap(page => {
            if(cfg.includeJs) {
                return page.includeJs(cfg.includeJs);
            }
        });
    },
    getPage: function() {
        logger.info('Phantom.getPage');

        return this.getPhantom()
        .then(phantom => {
            let pagesCountLimit = +process.env.PHANTOMJS_PAGE_SIZE || 4;

            // 检查是否有 page 可用， 10s 超时
            let dfd = {
                delay: 160,
                timeout: 10 * 1000,
                start: Date.now()
            };

            let check = () => {
                let pagesCount = phantom.pagesCount;

                // page 总数小于设定值时直接创建
                if(pagesCount < pagesCountLimit) {
                    dfd.resolve(phantom.createPage());
                    return;
                }

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
        .tap(page => {
            logger.info('Phantom.getPage.done');

            if(!page.inited) {
                page.inited = true;

                return this.setupPage(page);
            }
        });
    },
    setupPage: function(page) {
        return Promise.resolve(page)
        // resourceTimeout
        .tap(() => {
            let resourceTimeout = process.env.RESOURCE_TIMEOUT;

            return page.setting('resourceTimeout', +resourceTimeout || 5000);
        })
        // debug
        .tap(() => {
            // page.console
            return page.property('onConsoleMessage', function(/*msg, lineNum, sourceId*/) {
                // console.log('Page.console', arguments[0]);
            })
            // page.onResourceTimeout
            .then(() => {
                return page.property('onResourceTimeout', function() {
                    // Do nothing
                });
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
        });
    },

    // status
    startTime: Date.now(),
    getStatus: function() {
        let status = {
            pid: process.pid,
            startTime: this.startTime,
            pageCounts: {
                working: 0,
                total: 0
            },
            phantomRestartCount: this.phantomRestartCount,
            phantomStat: {
                pid: 0,
                cpu: 0,
                memory: 0
            }
        };

        if(!this.phantom) {
            return Promise.resolve(status);
        }

        return this.getPhantomStat()
        .then(stat => {
            lodash.assign(status.phantomStat, stat);
        })
        .then(() => {
            let phantom = this.phantom;
            let pages = phantom ? phantom.pages : null;

            if(!pages || !pages.length) {
                return;
            }

            let workingPages = pages.filter(page => {
                return page.working;
            });

            lodash.assign(status.pageCounts, {
                working: workingPages.length,
                total: phantom.pagesCount
            });
        })
        .then(() => {
            return status;
        });
    }
};

module.exports = phantomAdp;