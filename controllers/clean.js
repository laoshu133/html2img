/**
 * controllers/status
 *
 */
'use strict';

const path = require('path');
const fs = require('fs-extra-promise');

const OUT_PATH = process.env.OUT_PATH;

module.exports = function(router) {
    let resultTimeout = 60 * 60 * 1000;

    router.get('/clean', function *() {
        let body = this.request.body;
        let query = this.query;

        let id = body.id || query.id;

        // 指定 id 删除
        if(id) {
            let dirpath = path.join(OUT_PATH, id);

            yield fs.removeAsync(dirpath);

            this.body = {
                status: 'success',
                id: id
            };

            return;
        }

        // 超时删除
        let now = Date.now();
        let rOutId = /^[a-z]+\_\d+/i;

        let removedIds = [];

        yield fs.readdirAsync(OUT_PATH)
        .filter(dirname => {
            if(!rOutId.test(dirname)) {
                return false;
            }

            let dirpath = path.join(OUT_PATH, dirname);

            return fs.statAsync(dirpath)
            .then(stats => {
                let elapsed = now - stats.mtime.getTime();

                if(
                    stats.isDirectory() &&
                    elapsed > resultTimeout
                ) {
                    return true;
                }

                return false;
            });
        })
        .map(dirname => {
            removedIds.push(dirname);

            let dirpath = path.join(OUT_PATH, dirname);

            return fs.removeAsync(dirpath);
        }, {
            concurrency: 5
        });

        this.body = {
            status: 'success',
            removedIds: removedIds
        };
    });
};