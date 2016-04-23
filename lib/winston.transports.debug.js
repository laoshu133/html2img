/**
 * debug transport for winston
 *
 */
'use strict';

const util = require('util');
const debug = require('debug');
const lodash = require('lodash');
const winston = require('winston');

module.exports = function(prefix) {
    let loggers = {};

    let DebugLogger = function(options) {
        if(!options) {
            options = {};
        }

        this.name = options.name || 'debug-logger';

        this.level = options.level || 'info';
    };

    util.inherits(DebugLogger, winston.Transport);

    DebugLogger.prototype.name = 'debug';

    DebugLogger.prototype.log = function(level, msg, meta, callback) {
        let logger = loggers[level];
        if(!logger) {
            logger = loggers[level] = debug(prefix + level);

            if(level === 'error') {
                logger.log = console.error.bind(console);
            }
        }

        if(!lodash.isEmpty(meta)) {
            logger(msg, meta);
        }
        else {
            logger(msg);
        }

        // this.emit('logged');
        callback(null, true);
    };

    return DebugLogger;
};
