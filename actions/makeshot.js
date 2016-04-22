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
                if(!count || count <= minCount) {
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
        var out = cfg.out;
        var imagePath = out.image;
        var images = out.images = [];
        var rExt = /(\.\w+)$/;

        return Promise.mapSeries(rects, (rect, inx) => {
            var path = imagePath;
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
    .then(() => {
        logger.info('Actions.makeshot.done');

        return cfg.out;
    });

};