/**
 * controllers/main
 *
 */
'use strict';

const path = require('path');
const lodash = require('lodash');
const send = require('koa-send');
const fs = require('fs-extra-promise');

const config = require('../services/config');
const actions = require('../actions/index');

module.exports = function(router) {

    let readmeTpl = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Readme - html2img</title></head><body><pre>{{content}}</pre></body></html>';

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

        // Guide
        if(this.method === 'GET' && lodash.isEmpty(query)) {
            let readmePath = __dirname + '/../README.md';
            let readme = yield fs.readFileAsync(readmePath);

            readme = readmeTpl.replace('{{content}}', readme.toString());

            this.body = readme;

            return;
        }

        // parse config
        let cfg = yield config.create(lodash.merge(query, body));
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        let ret = null;
        if(actions[cfg.action]) {
            ret = yield actions[cfg.action](cfg);
        }
        else {
            this.throw(400, 'No action defined: ' + cfg.action);
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
            id: cfg.id,
            image: pathToUrl(ret.image),
            images: lodash.map(ret.images, pathToUrl),
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