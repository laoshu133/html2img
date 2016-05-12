/**
 * actions/preview
 *
 */
'use strict';

const lodash = require('lodash');
const Promise = require('bluebird');

const makeshot = require('./makeshot');

function preview(cfg) {
    return makeshot(cfg, {
        beforeShot: function(page) {
            return Promise.resolve()
            // get html
            .then(() => {
                return page.property('content');
            })
            // fit data
            .then(html => {
                let metadata = lodash.assign({
                    html: html
                }, cfg.out.metadata);

                cfg.out.metadata = metadata;
            });
        }
    });
};

module.exports = preview;