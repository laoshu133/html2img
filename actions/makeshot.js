/**
 * actions/makeshot
 *
 */

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

const shotCounts = Object.defineProperties({}, {
    success: {
        enumerable: true,
        writable: true,
        value: 0
    },
    error: {
        enumerable: true,
        writable: true,
        value: 0
    },
    total: {
        enumerable: true,
        get() {
            return this.success + this.error;
        }
    }
});

const makeshot = (cfg, hooks) => {
    const startTimestamp = Date.now();
    const traceInfo = (type, metadata) => {
        const msg = `Makeshot.${type}`;
        const elapsed = Date.now() - startTimestamp;
        const lastMs = traceInfo.lastMs || 0;

        traceInfo.lastMs = elapsed;

        return logger.info(msg, lodash.assign({
            shot_id: cfg.id,
            shot_url: cfg.url,
            selector: cfg.wrapSelector,
            last_elasped: elapsed - lastMs,
            elapsed: elapsed
        }, metadata));
    };

    let page;

    // hooks
    hooks = lodash.assign({
        beforeCheck: lodash.noop,
        beforeOptimize: lodash.noop,
        beforeShot: lodash.noop,
        afterShot: lodash.noop
    }, hooks);

    // process config
    return Promise.try(() => {
        traceInfo('start');

        return config.processContent(cfg);
    })
    .then(cfg => {
        if(!cfg.url) {
            throw new Error('url not provided');
        }

        traceInfo('phantomAdp.preparePage');

        return phantomAdp.preparePage(cfg);
    })
    // cache page, update status
    .tap(phPage => {
        traceInfo('phantomAdp.preparePage.done');

        page = phPage;
    })
    // hooks.beforeCheck
    .tap(() => {
        return hooks.beforeCheck(page, cfg);
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

        traceInfo('page.check');

        return new Promise((resolve, reject) => {
            dfd.resolve = resolve;
            dfd.reject = reject;
        });
    })
    // hooks.beforeShot
    .tap(() => {
        traceInfo('page.check.done');

        return hooks.beforeShot(page, cfg);
    })

    // get croper rects
    .then(() => {
        traceInfo('page.getCropRects');

        let selector = cfg.wrapSelector;

        return page.getCropRects(selector, {
            maxCount: cfg.wrapMaxCount
        });
    })
    // 给渲染一个喘息的机会，体谅下 phantomjs 的渲染性能
    .delay(+cfg.renderDelay || 0)
    // map rect & crop (Series)
    .then(rects => {
        traceInfo('page.getCropRects.done');

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
                path = path.replace(rExt, '-' + (inx + 1) + '$1');
            }

            images[inx] = path;
            crops[inx] = lodash.pick(rect, cropProps);

            // rect is empty
            if(rect.width <= 0 || rect.height <= 0) {
                return fs.copyAsync(BLANK_IMAGE, path);
            }

            traceInfo(`page.crop-${inx}`);

            return page.crop(rect, path, {
                quality: cfg.imageQuality,
                format: cfg.imageType,
                size: cfg.imageSize
            })
            .then(ret => {
                traceInfo(`page.crop-${inx}.done`);

                return ret;
            });
        });
    })

    // clean & status
    .finally(() => {
        // clean
        if(page) {
            return page.close();
        }
    })

    // hooks.beforeOptimize
    .tap(() => {
        traceInfo('image.optimize');

        return hooks.beforeOptimize(cfg);
    })

    // hooks.afterShot
    .tap(() => {
        traceInfo('image.optimize.done');

        return hooks.afterShot(cfg);
    })

    // update status
    // clear timeout shots
    .tap(() => {
        makeshot.syncStatusLazy();

        makeshot.clearTimeoutShotsLazy();
    })

    // result & count
    .then(() => {
        shotCounts.success += 1;

        traceInfo('done');

        return cfg.out;
    })

    .catch(err => {
        shotCounts.error += 1;

        traceInfo('error', {
            stack: err.stack || err.message
        });

        throw err;
    });
};

// Extend makeshot
Object.assign(makeshot, {
    shotCounts,

    syncStatus() {
        const filename = process.pid + '.json';
        const statusPath = path.join(process.env.STATUS_PATH, filename);

        return phantomAdp.getStatus()
        .then(statusData => {
            const status = lodash.assign({
                shotCounts: shotCounts
            }, statusData);

            return status;
        })
        .then(status => {
            return fs.outputJSONAsync(statusPath, status);
        });
    },
    syncStatusLazy: lodash.throttle(() => {
        makeshot.syncStatus()
        .then(() => {
            logger.info('Makeshot.syncStatus', {
                message: JSON.stringify(shotCounts)
            });
        })
        .catch(err => {
            logger.info('Makeshot.syncStatus.error', {
                message: err.message,
                stack: err.stack
            });
        });
    }, 16 * 1000),

    removeShot(id) {
        const dirPath = path.join(OUT_PATH, id);

        return fs.removeAsync(dirPath);
    },
    clearTimeoutShots() {
        const IO_MAX = 4;
        const now = Date.now();
        const rOutId = /^[a-z]+/i;

        return Promise.try(() => {
            return fs.readdirAsync(OUT_PATH);
        })
        .filter(dirname => {
            return rOutId.test(dirname);
        })
        .map(dirname => {
            const dirPath = path.join(OUT_PATH, dirname);
            const ret = {
                dirname,
                dirPath
            };

            return fs.statAsync(dirPath)
            .then(stats => {
                const ms = +stats.mtime;

                ret.isDirectory = stats.isDirectory();
                ret.elapsed = now - ms;

                return ret;
            })
            // Ignore stats error
            .catch(() => {
                return ret;
            });
        }, {
            concurrency: IO_MAX
        })
        .filter(({ isDirectory, elapsed }) => {
            return isDirectory && elapsed > SHOT_TIMEOUT;
        })
        .map(({ dirname, dirPath }) => {
            return fs.removeAsync(dirPath)
            .then(() => {
                return dirname;
            });
        }, {
            concurrency: IO_MAX
        });
    },
    clearTimeoutShotsLazy() {
        const clearInterval = 200;
        const totalShotCount = shotCounts.total;

        if(totalShotCount % clearInterval !== 0) {
            return;
        }

        makeshot.clearTimeoutShots()
        .then(removedIds => {
            if(!removedIds.length) {
                return;
            }

            logger.info('Makeshot.clearTimeoutShots', {
                removedIds
            });
        })
        .catch(err => {
            logger.info('Makeshot.clearTimeoutShots.error', {
                message: err.message,
                stack: err.stack
            });
        });
    }
});

module.exports = makeshot;
