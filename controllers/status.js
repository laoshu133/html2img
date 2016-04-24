/**
 * controllers/status
 *
 */
'use strict';

const phantomAdp = require('../lib/phantom');
const makeshot = require('../actions/makeshot');

module.exports = function(router) {
    let startTime = Date.now();

    router.get('/status', function *() {
        let phantoms = phantomAdp.phantoms;
        let pages = phantomAdp.pages;

        let data = {
            // app
            startTime: startTime,
            uptime: Date.now() - startTime,

            // shot
            makeshot_counts: makeshot.counts,

            // phantom
            phantom_total: phantoms.length,
            pages_total: pages.length,
            pages_woring: pages.filter(page => {
                return page.working;
            }).length
        };

        this.body = data;
    });
};