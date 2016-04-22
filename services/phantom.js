/**
 * services/phantom
 *
 */
'use strict';

const path = require('path');

require('./phantom-page');
const phantom = require('phantom');

const Promise = require('bluebird');
const logger = require('./logger');


const phantomAdp = {
    instances: [],
    create: function() {
        return phantom.create([
            // '--proxy=127.0.0.1:8888', // debug
            '--local-to-remote-url-access=true',
            '--ignore-ssl-errors=true'
        ]);
    },
    initPool: function() {
        let instances = this.instances;
        let promise = Promise.resolve(instances);

        if(instances.length) {
            return promise;
        }

        let count = +process.env.PHANTOMJS_POOL || 1;
        if(count === 'AUTO') {
            count = require('os').cpus().length;
        }

        for(let i=count; i>0; --i) {
            promise = promise.then(this.create)
            .then(ph => {
                ph.id = instances.length;
                ph.pageCount = 0;

                instances.push(ph);

                logger.info('Init phantomjs instance:', ph.id);

                return instances;
            });
        }

        return promise;
    },
    getUseablePage: function() {
        let page;

        return this.initPool()
        .then(instances => {
            let ph;

            instances.every(instance => {
                let pageCount = instance.pageCount || 0;

                if(!ph || pageCount < ph.pageCount) {
                    ph = instance;
                }

                if(pageCount <= 0) {
                    return false;
                }

                return true;
            });

            // page count
            ph.pageCount += 1;

            logger.info('Phantom.createPage');

            return ph.createPage();
        })
        .tap(phPage => {
            // cache
            page = phPage;

            // page.console
            return page.property('onConsoleMessage', function(msg /*, lineNum, sourceId*/) {
                console.log('Page.console', msg);
            });
        })
        // page.request
        .tap(() => {
            // return page.property('onResourceRequested', function(requestData) {
            //     console.log('Page.request', requestData.url);
            //     // console.log('Page.request.detail', JSON.stringify(requestData));
            // });
        })
        .then(() => {
            logger.info('Phantom.createPage.done');

            return page;
        });
    },
    preparePage: function(cfg) {
        let page;

        return this.getUseablePage()
        .then(phPage => {
            page = phPage;

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