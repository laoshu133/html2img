/**
 * logger
 */

var winston = require('winston');

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: 'info',
            name: 'info-log',
            filename: 'logs/info.log'
        }),
        new winston.transports.File({
            level: 'error',
            name: 'error-log',
            filename: 'logs/error.log'
        })
    ]
});


module.exports = logger;