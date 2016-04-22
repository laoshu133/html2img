/**
 * config
 *
 */
'use strict';

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const fs = require('fs-extra-promise');

// default config
const defaultConfig = require('../config.default.json');

const config = {
    uuid: 0,
    defaultConfig: defaultConfig,
    getCurrentConfig: function() {
        let configPath = '../config.json';

        if(this.currentConfig) {
            return Promise.resolve(this.currentConfig);
        }

        return fs.existsAsync(configPath)
        .then(exists => {
            return exists ? fs.readFileAsync(configPath) : null;
        })
        .then(configBuf => {
            return JSON.parse(configBuf);
        })
        .then(config => {
            config = lodash.merge({}, this.defaultConfig, config);

            this.currentConfig = config;

            return config;
        });
    },
    create: function(cfg) {
        return this.getCurrentConfig()
        .then(currCfg => {
            return lodash.merge({}, currCfg, cfg);
        })
        .then(cfg => {
            let action = cfg.action || 'shot';

            // id
            if(!cfg.id) {
                cfg.id = [action, Date.now(), ++this.uuid].join('_');
            }

            return cfg;
        });
    },
    processContent: function(cfg) {
        if(cfg.out) {
            return Promise.resolve(cfg);
        }

        let imgExtMap = {
            'jpeg': '.jpg',
            'jpg': '.jpg',
            'png': '.png'
        };

        let imgExt = cfg.imageExtname;
        if(!imgExt) {
            imgExt = imgExtMap[cfg.imageType || 'png'];
        }

        // out config
        let outDir = cfg.id || 'tmp';
        let outName = cfg.name || 'out';
        let cwd = path.relative(__dirname, '.');

        let outPath = process.env.OUT_PATH;
        if(outPath.charAt(0) !== '/') {
            outPath = path.join(cwd, outPath);
        }
        outPath = path.join(outPath, outDir);

        cfg.out = {
            // name: '',
            path: outPath,
            dirname: outDir,
            html: path.join(outPath, outName + '.html'),
            image: path.join(outPath, outName + imgExt)
        };

        // content
        if(cfg.content) {
            let url = path.join(outPath, 'out.html');
            let htmlTplPath = path.join(cwd, 'tpl', cfg.htmlTpl);

            return fs.readFileAsync(htmlTplPath)
            .then(htmlTpl => {
                let content = tools.processHTML(cfg.content);
                let html = tools.fill(htmlTpl, {
                    cwd: path.resolve(cwd),
                    content: content
                });

                return fs.outputFileAsync(url, html);
            })
            .then(() => {
                cfg.url = url;

                return cfg;
            });
        }

        return Promise.resolve(cfg);
    }
};

module.exports = config;
