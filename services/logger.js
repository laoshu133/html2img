/**
 * services/logger
 */
'use strict';

const debug = require('debug');
// const lodash = require('lodash');

let prefix = process.env.DEBUG.replace(':*', ':');

let log = debug(prefix + 'info');
let logError = debug(prefix + 'error');

logError.log = console.error.bind(console);

let logger = {
    log: log,
    info: log,
    error: logError
};

module.exports = logger;
