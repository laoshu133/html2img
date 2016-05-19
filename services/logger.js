/**
 * services/logger
 *
 * 默认输出指控制台，建议基于 pm2 管理日志
 */
'use strict';

const debug = require('debug');
// const lodash = require('lodash');

let prefix = process.env.DEBUG.replace(/\:\*$/, ':');

let logger = {
    log: debug(prefix + 'log'),
    info: debug(prefix + 'info'),
    error: debug(prefix + 'error')
};

// logger.debug -> logger.log
logger.debug = logger.log;

logger.log.log = console.log.bind(console);
logger.info.log = console.info.bind(console);
logger.error.log = console.error.bind(console);

module.exports = logger;
