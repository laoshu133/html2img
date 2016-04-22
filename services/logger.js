/**
 * services/logger
 *
 */
'use strict';

let winston = require('winston');

let logger;

if(process.env.NODE_ENV === 'development') {
    let prefix = process.env.DEBUG.replace(/\:\*$/, ':');
    let DebugTransport = require('../lib/winston.transports.debug')(prefix);

    logger = new winston.Logger({
        level: 'debug',
        colorize: true,
        transports: [
            new DebugTransport()
        ]
    });
}
else {
    logger = new (winston.Logger)({
        transports: [
            new winston.transports.File({
                name: 'info-file',
                filename: 'logs/info.log',
                level: 'info'
            }),
            new winston.transports.File({
                name: 'error-file',
                filename: 'logs/error.log',
                level: 'error'
            })
        ]
    });
}

module.exports = logger;
