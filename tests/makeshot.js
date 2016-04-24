/**
 * html2img
 *
 * tests/makeshot
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
    'demos/makeshot.json',
    // 'demos/makeshot-big.json',
    // 'demos/makeshot-wireless.json',
    // 'demos/makeshot-html-test.html',
    // 'demos/makeshot-danchaofan.json'
];

let startTime = Date.now();

// Promise.map(configs, (cfgPath, inx) => { // 并行
Promise.mapSeries(configs, (cfgPath, inx) => { // 串行
    logger.info('Client.makeshot', inx);

    return fs.readFileAsync(cfgPath)
    .then(buf => {
        if(/\.json$/.test(cfgPath)) {
            return JSON.parse(buf);
        }

        // tmp test
        let cfg = {
            action: 'makeshot',
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

        logger.info('Client.makeshot.request');

        return request({
            method: 'POST',
            uri: shotUrl,
            json: true,
            body: cfg
        });
    })
    .then(res => {
        logger.info('Client.makeshot.request.done', inx, res);
        logger.info('-----');
    });
})
.then(() => {
    let elapsed = Date.now() - startTime;

    console.info('\n---Client.makeshot.complete--'+ elapsed +'--\n');
});
