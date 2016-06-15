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

// debug.formatArgs
// 非 TTY 输出时，格式化时间为当地时间
if(!process.stdout.isTTY) {
    let rSingleNum = /\b(\d)\b/g;
    debug.formatArgs = function() {
        let args = arguments;
        let name = this.namespace;

        let now = new Date();
        let timeStr = [
            now.getFullYear() + '/',
            now.getMonth() + 1 + '/',
            now.getDate() + ' ',
            now.getHours() + ':',
            now.getMinutes() + ':',
            now.getSeconds()
        ]
        .join('')
        .replace(rSingleNum, '0$1');

        args[0] = timeStr +' '+ name +' '+ args[0];

        return args;
    };
}

module.exports = logger;
