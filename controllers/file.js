/**
 * controllers/file
 *
 * @description get file
 *
 */
'use strict';

const send = require('koa-send');

module.exports = function(router, app) {

    let filePrefix = '/file/';
    let fileRoot = process.env.OUT_PATH;

    app.use(function *(next) {
        yield next;

        let uri = this.path;

        if(
            !this.body &&
            this.status === 404 &&
            uri.indexOf(filePrefix) === 0
        ) {
            uri = uri.replace(filePrefix, '');

            yield send(this, uri, {
                maxage: 24 * 60 * 60 * 1000,
                root: fileRoot
            });
        }
    });
};