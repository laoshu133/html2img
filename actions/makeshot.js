/**
 * actions/makeshot
 *
 */
'use strict';

const Promise = require('bluebird');

const logger = require('../services/logger');
const config = require('../services/config');
const phantom = require('../services/phantom');

module.exports = function(cfg) {
    logger.info('Actions.makeshot');

    let page;

    return config.processContent(cfg)
    .then(cfg => {
        return phantom.preparePage(cfg);
    })
    // check wrap count
    .then(phPage => {
        // cache
        page = phPage;

        let dfd = {};
        let interval = 160;
        var start = Date.now();
        let ttl = cfg.wrapFindTimeout;
        let minCount = cfg.wrapMinCount;
        let maxCount = cfg.wrapMaxCount;
        var selector = cfg.wrapSelector;

        if(maxCount < minCount) {
            maxCount = Infinity;
        }

        function check() {
            return page.evaluate(function(selector) {
                var $ = window.jQuery;
                var shotTools = window.shotTools;

                console.log('jQuery:', !!$, !!$ ? $.fn.jquery : null);
                console.log('shotTools', !!shotTools, !!shotTools ? shotTools.version : null);

                return document.querySelectorAll(selector).length;
            }, selector)
            .then(count => {
                if(!count || count <= 0) {
                    let errMsg = 'Wrap element not found: ' + selector;

                    return Promise.reject(new Error(errMsg));
                }

                return Promise.resolve();
            })
            .then(() => {
                dfd.resolve();
            }, (err) => {
                let now = Date.now();
                if(now - start <= ttl) {
                    setTimeout(check, interval);
                    return;
                }

                dfd.reject(err);
            });
        }

        setTimeout(check, interval);

        return new Promise((resolve, reject) => {
            dfd.resolve = resolve;
            dfd.reject = reject;
        });
    })
    .then(() => {
        return page.render('./__out/out.png');
    })
    .then(ret => {
        logger.info('Actions.makeshot.done');

        return ret;
    });

};