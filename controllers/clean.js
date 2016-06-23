/**
 * controllers/status
 *
 */
'use strict';

const makeshot = require('../actions/makeshot');

module.exports = function(router) {
    router.get('/clean', function *() {
        let body = this.request.body;
        let query = this.query;

        let id = body.id || query.id;

        // 指定 id 删除
        if(id) {
            yield makeshot.removeShot(id);

            this.body = {
                status: 'success',
                id: id
            };

            return;
        }

        // 超时删除
        let removedIds = yield makeshot.clearTimeoutShots();

        this.body = {
            status: 'success',
            removedIds: removedIds
        };
    });
};