/**
 * actions/makeshot
 *
 */
'use strict';

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const fs = require('fs-extra-promise');

const phantomAdp = require('../lib/phantom-adp');
const logger = require('../services/logger');
const config = require('../services/config');

const OUT_PATH = process.env.OUT_PATH;
const SHOT_TIMEOUT = process.env.SHOT_TIMEOUT || 60 * 60 * 1000;
const BLANK_IMAGE = path.resolve(__dirname, '../static/blank.png');

function makeshot(cfg, hooks) {
    logger.info('Actions.makeshot[' + cfg.action + ']');

    let page;

    // hooks
    hooks = lodash.assign({
        beforeCheck: lodash.noop,
        beforeOptimize: lodash.noop,
        beforeShot: lodash.noop,
        afterShot: lodash.noop
    }, hooks);

    // update status
    return makeshot.syncStatus()
    // process config
    .then(() => {
        return config.processContent(cfg);
    })
    .then(cfg => {
        if(!cfg.url) {
            throw new Error('url not provided');
        }

        return phantomAdp.preparePage(cfg);
    })
    // cache page, update status
    .tap(phPage => {
        page = phPage;
    })
    // hooks.beforeCheck
    .tap(() => {
        return hooks.beforeCheck(page, cfg);
    })
    // update status
    .tap(makeshot.syncStatus)
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
                var $ = window.jQuery;
                // Wait page loaded
                var loaded = document.readyState === 'complete';

                // var shotTools = window.shotTools;
                // console.log('jQuery:', !!$ ? $.fn.jquery : null);
                // console.log('shotTools', !!shotTools ? shotTools.version : null);

                return loaded && $(selector).length;
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
    // hooks.beforeShot
    .tap(() => {
        return hooks.beforeShot(page, cfg);
    })
    // update status
    .tap(() => {
        return makeshot.syncStatus();
    })
    // get croper rects
    .then(() => {
        let selector = cfg.wrapSelector;

        return page.getCropRects(selector, {
            maxCount: cfg.wrapMaxCount
        });
    })
    // 给渲染一个喘息的机会，体谅下 phantomjs 的渲染性能
    .delay(+cfg.renderDelay || 0)
    // map rect & crop (Series)
    .then(rects => {
        let rExt = /(\.\w+)$/;
        let cropProps = ['width', 'height', 'left', 'top'];

        let out = cfg.out;
        let imagePath = out.image;
        let images = out.images = [];

        // metadata
        let metadata = out.metadata;
        if(!metadata) {
            metadata = out.metadata = {};
        }

        // crops
        let crops = metadata.crops = [];

        return Promise.each(rects, (rect, inx) => {
            let path = imagePath;
            if(inx > 0) {
                path = path.replace(rExt, '-'+ (inx+1) +'$1');
            }

            images[inx] = path;
            crops[inx] = lodash.pick(rect, cropProps);

            // rect is empty
            if(rect.width <=0 || rect.height <= 0) {
                return fs.copyAsync(BLANK_IMAGE, path);
            }

            return page.crop(rect, path, {
                quality: cfg.imageQuality,
                format: cfg.imageType,
                size: cfg.imageSize
            });
        });
    })
    // hooks.beforeOptimize
    .tap(() => {
        return hooks.beforeOptimize(page, cfg);
    })
    // hooks.afterShot
    .tap(() => {
        return hooks.afterShot(cfg);
    })
    // update status
    .tap(makeshot.syncStatus)

    // // debug
    // .tap(() => {
    //     return page.screenshot('./__out.png');
    // })

    // result & count
    .then(() => {
        logger.info('Actions.makeshot['+ cfg.action +'].done');

        makeshot.shotCounts.total += 1;
        makeshot.shotCounts.success += 1;

        return cfg.out;
    })
    .catch(ex => {
        makeshot.shotCounts.total += 1;
        makeshot.shotCounts.error += 1;

        return Promise.reject(ex);
    })

    // update status
    .tap(makeshot.syncStatus)
    // clear timeout shots
    // 满足条件时清除已超时截图
    .tap(() => {
        let clearInterval = 200;
        let totalShotCount = makeshot.shotCounts.total;

        if(
            !SHOT_TIMEOUT ||
            SHOT_TIMEOUT < 0 ||
            totalShotCount % clearInterval !== 0
        ) {
            return;
        }

        makeshot.clearTimeoutShots()
        .then(removedIds => {
            logger.info('Actions.makeshot.clearTimeoutShots', removedIds);
        })
        .catch(ex => {
            logger.info('Actions.makeshot.clearTimeoutShots.error');
            logger.error(ex);
        });
    })

    // clean & status
    .finally(() => {
        // clean
        if(page) {
            return page.close();
        }
    });
};

// status counts
makeshot.shotCounts = {
    total: 0,
    success: 0,
    error: 0
};

// sync status
makeshot.syncStatus = function() {
    let filename = process.pid + '.json';
    let statusPath = path.join(process.env.STATUS_PATH, filename);

    return phantomAdp.getStatus()
    .then(statusData => {
        let status = lodash.assign({
            shotCounts: makeshot.shotCounts
        }, statusData);

        return status;
    })
    .then(status => {
        return fs.outputJSONAsync(statusPath, status);
    });
};

// 删除截图
makeshot.removeShot = function(id) {
    let dirPath = path.join(OUT_PATH, id);

    return fs.removeAsync(dirPath);
};

// clearTimeoutShots
// 删除已超时截图，默认 1 小时超时
makeshot.clearTimeoutShots = function() {
    let now = Date.now();
    let rOutId = /^[a-z]+\_\d+/i;

    return fs.readdirAsync(OUT_PATH)
    .filter(dirname => {
        if(!rOutId.test(dirname)) {
            return false;
        }

        let dirPath = path.join(OUT_PATH, dirname);

        return fs.statAsync(dirPath)
        .then(stats => {
            let elapsed = now - stats.mtime.getTime();

            if(
                stats.isDirectory() &&
                elapsed > SHOT_TIMEOUT
            ) {
                return true;
            }

            return false;
        });
    })
    .map(dirname => {
        return makeshot.removeShot(dirname)
        .then(() => {
            return dirname;
        });
    }, {
        concurrency: 5
    });
};

module.exports = makeshot;