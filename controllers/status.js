/**
 * controllers/status
 *
 */
'use strict';

const path = require('path');
const bytes = require('bytes');
const Promise = require('bluebird');
const fs = require('fs-extra-promise');
const pidstat = Promise.promisify(require('pidusage').stat);

const STATUS_PATH = process.env.STATUS_PATH;

module.exports = function(router) {
    let prettyDate = function(date) {
        let rSingleNum = /\b(\d)\b/g;

        return [
            date.getFullYear() + '/',
            date.getMonth() + 1 + '/',
            date.getDate() + ' ',
            date.getHours() + ':',
            date.getMinutes() + ':',
            date.getSeconds()
        ]
        .join('')
        .replace(rSingleNum, '0$1');
    };
    let prettyMs = function(ms) {
        return prettyDate(new Date(ms));
    };

    let selfStartTime = Date.now();

    router.get('/status', function *() {
        let rStatusFilename = /^\d+\.json$/;

        let status = {
            startTime: selfStartTime,
            startTimePretty: prettyMs(selfStartTime),
            uptime: Date.now() - selfStartTime,
            totalMemory: bytes(0),
            totalShots: 0,
            workersCount: 0,
            workers: [],
        };

        // check dir exists
        let appInited = yield fs.existsAsync(STATUS_PATH);
        if(!appInited) {
            this.body = status;

            return;
        }

        yield fs.readdirAsync(STATUS_PATH)
        .filter(filename => {
            return rStatusFilename.test(filename);
        })
        .map(filename => {
            let filepath = path.join(STATUS_PATH, filename);

            return fs.readJSONAsync(filepath)
            .then(status => {
                // tmp
                status.filename = filename;

                return status;
            });
        })
        // 过滤已关闭进程
        .filter(status => {
            if(!status.pid) {
                return false;
            }

            return pidstat(status.pid)
            .then(() => {
                return true;
            })
            .catch(() => {
                // 删除已废弃进程 status
                let filepath = path.join(STATUS_PATH, status.filename);
                fs.removeAsync(filepath);

                return false;
            });
        })
        .then(allStatus => {
            let totalShots = 0;
            let totalMemory = 0;
            let startTime = selfStartTime;

            allStatus.forEach(status => {
                if(status.startTime < startTime) {
                    startTime = status.startTime;
                }

                // totalShots
                totalShots += status.shotCounts.total;

                let memory = status.phantomStat.memory;

                // pretty mem
                status.phantomStat.memoryPretty = bytes(memory);

                // total mem
                totalMemory += memory;

                // clean
                delete status.filename;
            });

            // startTime & Pretty
            status.startTime = startTime;
            status.startTimePretty = prettyMs(startTime);

            // uptime
            status.uptime = Date.now() - startTime;

            // totalShots
            status.totalShots = totalShots;

            // totalMemory
            status.totalMemory = bytes(totalMemory);

            // workers
            status.workersCount = allStatus.length;
            status.workers = allStatus;
        });

        this.body = status;
    });
};