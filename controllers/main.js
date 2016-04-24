/**
 * controllers/main
 *
 */
'use strict';

const path = require('path');
const lodash = require('lodash');
const send = require('koa-send');

const config = require('../services/config');
const actions = require('../actions/index');

module.exports = function(router) {

    let pathToUrl = function(localPath) {
        let env = process.env;
        let url = 'http://' + env.WWW_HOST;

        localPath = path.relative(env.OUT_PATH, localPath);

        url += path.join('/file', localPath);

        return url;
    };

    let shotMW = function *() {
        let timestamp = Date.now();
        let body = this.request.body;
        let query = this.query;

        let cfg = yield config.create(lodash.merge(query, body));
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        let ret = null;
        if(actions[cfg.action]) {
            ret = yield actions[cfg.action](cfg);
        }
        else {
            this.throw(403);
        }

        // check result
        if(!ret) {
            this.throw(500, 'Unknow error');
        }

        // respone image
        if(cfg.dataType === 'image') {
            return yield send(this, ret.image);
        }

        // covert result (local path -> url)
        let result = {
            image: pathToUrl(ret.image),
            metadata: ret.metadata || null,
            // elapsed
            elapsed: Date.now() - timestamp
        };
        if(ret.images) {
            result.images = ret.images.map(pathToUrl);
        }

        this.body = result;
    };

    router.post('/', shotMW);
    router.get('/', shotMW);
};