/**
 * actions/makelist
 *
 */
'use strict';

const Promise = require('bluebird');

const makeshot = require('./makeshot');

function makelist(cfg) {
    return makeshot(cfg, {
        beforeShot: function(page) {
            return Promise.resolve()
            // build list html
            .then(() => {
                let selector = cfg.wrapSelector;

                return page.evaluate(function(options) {
                    return shotTools.covertTaobaoList(options);
                }, {
                    type: cfg.listOutType || 'map',
                    imageBlank: cfg.imageBlank,
                    selector: selector
                });
            })
            // check links
            .then(linksData => {
                if(linksData.status !== 'success') {
                    var msg = 'List links error: ' + linksData.message;
                    return Promise.reject(new Error(msg));
                }

                cfg.out.metadata = linksData;
            });
        }
    });
};

module.exports = makelist;