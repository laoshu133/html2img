/**
 * actions/makeshot
 *
 */
'use strict';

const Promise = require('bluebird');

const phantom = require('../lib/phantom');
const logger = require('../services/logger');
const config = require('../services/config');

module.exports = function(cfg) {
    logger.info('Actions.makeshot');

    let page;

    return config.processContent(cfg)
    .then(cfg => {
        if(!cfg.url) {
            throw new Error('url not provided');
        }

        return phantom.preparePage(cfg);
    })
    // cache page
    .tap(phPage => {
        page = phPage;
    })
    // check wrap count
    .then(() => {
        let dfd = {};
        let interval = 160;
        let start = Date.now();
        let ttl = cfg.wrapFindTimeout;
        let selector = cfg.wrapSelector;
        let minCount = cfg.wrapMinCount;

        function check() {
            return page.evaluate(function(selector) {
                // var $ = window.jQuery;
                // var shotTools = window.shotTools;
                // console.log('jQuery:', !!$ ? $.fn.jquery : null);
                // console.log('shotTools', !!shotTools ? shotTools.version : null);

                return document.querySelectorAll(selector).length;
            }, selector)
            .then(count => {
                if(!count || count < minCount) {
                    let errMsg = 'Wrap element not found: ' + selector;

                    return Promise.reject(new Error(errMsg));
                }

                return Promise.resolve();
            })
            .then(() => {
                dfd.resolve();
            }, err => {
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
        let selector = cfg.wrapSelector;

        return page.getCropRects(selector, {
            maxCount: cfg.wrapMaxCount
        });
    })
    .then(rects => {
        let out = cfg.out;
        let imagePath = out.image;
        let images = out.images = [];
        let rExt = /(\.\w+)$/;

        return Promise.mapSeries(rects, (rect, inx) => {
            let path = imagePath;
            if(inx > 0) {
                path = path.replace(rExt, '-'+ (inx+1) +'$1');
            }

            images[inx] = path;

            return page.crop(rect, path, {
                quality: cfg.imageQuality,
                zoomFactor: 0.5
            });
        });
    })
    // clean
    .tap(() => {
        return page.release();
    })
    // result
    .then(() => {
        logger.info('Actions.makeshot.done');

        return cfg.out;
    });

};