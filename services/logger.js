/**
 * services/logger
 */
'use strict';

const winston = require('winston');
const DebugTransportFactory = require('../lib/winston.transports.debug');

let logger;

if(process.env.NODE_ENV === 'development') {
    let prefix = process.env.DEBUG.replace(':*', ':');
    let DebugTransport = DebugTransportFactory(prefix);

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
                filename: process.env.LOGS_PATH + '/info.log',
                level: 'info'
            }),
            new winston.transports.File({
                name: 'error-file',
                filename: process.env.LOGS_PATH + '/error.log',
                level: 'error'
            })
        ]
    });
}

module.exports = logger;
