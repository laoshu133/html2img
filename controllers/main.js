/**
 * controllers/main
 *
 */
'use strict';

const lodash = require('lodash');

const config = require('../services/config');
const actions = require('../actions/index');

module.exports = function(router) {

    let shotMW = function *() {
        let query = this.query;
        let body = this.request.body;

        let cfg = yield config.create(lodash.merge(query, body));

        let result = null;

        if(actions[cfg.action]) {
            result = yield actions[cfg.action](cfg);
        }
        else {
            this.throw(403);
        }

        this.body = result;
    };

    router.post('/', shotMW);
    router.get('/', shotMW);
};