/**
 * controllers/status
 *
 */
'use strict';

const path = require('path');
const fs = require('fs-extra-promise');

const makeshot = require('../actions/makeshot');

const OUT_PATH = process.env.OUT_PATH;

module.exports = function(router) {
    router.get('/clean', function *() {
        let body = this.request.body;
        let query = this.query;

        let id = body.id || query.id;

        // 指定 id 删除
        if(id) {
            let dirPath = path.join(OUT_PATH, id);

            yield fs.removeAsync(dirPath);

            this.body = {
                status: 'success',
                id: id
            };

            return;
        }

        // 超时删除
        let removedIds = yield makeshot.cleanTimeoutShots();

        this.body = {
            status: 'success',
            removedIds: removedIds
        };
    });
};