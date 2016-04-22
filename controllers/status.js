/**
 * controllers/status
 *
 */
'use strict';

const logger = require('../services/logger');

module.exports = function(router) {
    router.get('/status', function *() {
        logger.info('2222', 'status');

        this.body = 'status';
    });
};