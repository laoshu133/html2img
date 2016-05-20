/**
 * lib/phantom
 *
 */
'use strict';

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const createPhantom = require('phantom').create;

const logger = require('../services/logger');

require('./phantom-page');

const phantomAdp = {
    phantoms: [],
    pages: [],
    pagesTotal: 0,
    create: function() {
        return createPhantom([
            // '--proxy=127.0.0.1:8888', // debug
            '--local-to-remote-url-access=true',
            '--ignore-ssl-errors=true'
        ]);
    },
    initPool: function() {
        if(this.initPoolPromise) {
            return this.initPoolPromise;
        }

        let count = +process.env.PHANTOMJS_POOL || 1;
        if(count === 'AUTO') {
            count = require('os').cpus().length;
        }

        let promise = Promise.map(lodash.range(count), () => {
            return this.create();
        })
        // setup phantom
        .map((phantom, inx) => {
            phantom.id = inx;
            phantom.pageCount = 0;

            logger.info('Init phantom:', phantom.id);

            return phantom;
        })
        .then(phantoms => {
            this.phantoms = phantoms;

            return phantoms;
        });

        // cache
        this.initPoolPromise = promise;

        return promise;
    },
    createPage: function() {
        let pages = this.pages;

        // 缓存页面数量
        // 并发情况下可能同时创建多个页面实例
        this.pagesTotal += 1;

        return this.initPool()
        .then(phantoms => {
            let phantom;

            lodash.forEach(phantoms, ph => {
                if(
                    !phantom ||
                    phantom.pageCount < ph.pageCount
                ) {
                    phantom = ph;
                }
            });

            return phantom;
        })
        .then(phantom => {
            logger.info('Phantom.createPage');

            return phantom.createPage();
        })
        // cache & update phantom
        .then(page => {
            logger.info('Phantom.createPage.done', page.target);

            if(page.phantom) {
                page.phantom.pageCount += 1;
            }

            pages.push(page);

            return page;
        })
        // setup page
        .tap(page => {
            // setup
            page.working = false;
            page.maxWorkCount = 8;
            page.workCount = 0;

            page._open = page.open;
            page.open = function() {
                page.working = true;
                page.workCount += 1;

                logger.info('Phantom.page.open', page.target);

                return page._open.apply(page, arguments)
                .then(status => {
                    logger.info('Phantom.page.open.done', page.target);

                    return status;
                });
            };
            page.release = Promise.method(function() {
                // reset
                page.working = false;

                // 单个 page 最多使用 maxCount 次，防止内存泄漏
                if(page.workCount >= page.maxWorkCount) {
                    phantomAdp.pagesTotal -= 1;

                    lodash.remove(pages, item => {
                        return item === page;
                    });

                    // reset phantom pageCount
                    if(page.phantom) {
                        page.phantom.pageCount -= 1;
                    }

                    // async
                    // @TODO: Cannot find close method to execute on..
                    page.close();

                    // log
                    logger.info('Phantom.page.dead', page.target);
                }
                // 释放 page
                else {
                    logger.info('Phantom.page.release', page.target);

                    // release page mem
                    page._open('about:blank');
                }
            });
        })
        // page debug info
        .tap(page => {
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
        });
    },
    getUseablePage: function() {
        let poolSize = process.env.PHANTOMJS_POOL_SIZE;
        let pages = this.pages;

        return this.initPool()
        .then(phantoms => {
            let maxPageCount = poolSize * phantoms.length;

            // page 总数小于设定值时直接创建
            if(phantomAdp.pagesTotal < maxPageCount) {
                return this.createPage();
            }

            // 检查是否有 page 可用， 10s 超时
            let dfd = {
                timeout: 10 * 1000,
                start: Date.now()
            };
            let check = function() {
                let idlePages = pages.filter(page => {
                    return !page.working;
                });

                if(idlePages[0]) {
                    dfd.resolve(idlePages[0]);
                    return;
                }

                let elapsed = Date.now() - dfd.start;
                if(elapsed > dfd.timeout) {
                    let errMsg = 'Phantom.getUseablePage.timeout';

                    dfd.reject(new Error(errMsg));
                    return;
                }

                setTimeout(check, 160);
            };

            // delay check
            process.nextTick(check);

            return new Promise((resolve, reject) => {
                dfd.resolve = resolve;
                dfd.reject = reject;
            });
        });
    },
    preparePage: function(cfg) {
        let page;

        return this.getUseablePage()
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
            var jqueryUrl = 'jquery/dist/jquery.min.js';
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
            var clientToolsUrl = '../static/shot-tools.js';
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