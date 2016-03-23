/**
 * logger
 */

var winston = require('winston');

var logger;
if(process.env.NODE_ENV === 'development') {
    logger = new winston.Logger({
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
}
else {
    logger = new winston.Logger({
        level: 'debug',
        colorize: true,
        transports: [
            new winston.transports.Console()
        ]
    });
}


module.exports = logger;