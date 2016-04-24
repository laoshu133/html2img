/**
 * html2img
 *
 * tests/makelist
 *
 */
'use strict';

// env
require('dotenv-safe').load({
    // sample: '../.env.example',
    // path: '../.env'
});

// deps
const Promise = require('bluebird');
const fs = require('fs-extra-promise');
const request = require('request-promise');

const logger = require('../services/logger');

let configs = [
    'demos/makelist.json',
    'demos/makelist-taobao.json',
    'demos/makelist.json'
];

let startTime = Date.now();

// Promise.map(configs, (cfgPath, inx) => { // 并行
Promise.mapSeries(configs, (cfgPath, inx) => { // 串行
    logger.info('Client.makelist', inx);

    return fs.readFileAsync(cfgPath)
    .then(buf => {
        if(/\.json$/.test(cfgPath)) {
            return JSON.parse(buf);
        }

        // tmp test
        let cfg = {
            action: 'makelist',
            htmlTpl: 'hlg_wireless.html',
            imageType: 'jpg',
            imageQuality: 80,
            content: buf.toString()
        };

        return cfg;
    })
    .then(cfg => {
        let shotUrl = 'http://localhost:';
        shotUrl += process.env.PORT;

        logger.info('Client.makelist.request');

        return request({
            method: 'POST',
            uri: shotUrl,
            json: true,
            body: cfg
        });
    })
    .then(res => {
        logger.info('Client.makelist.request.done', inx, res);
        logger.info('-----');
    });
})
.then(() => {
    let elapsed = Date.now() - startTime;

    console.info('\n---Client.makelist.complete--'+ elapsed +'--\n');
});

