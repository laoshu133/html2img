/**
 * html2img
 *
 * config
 *
 */
'use strict';

var fs = require('fs');
var lodash = require('lodash');
var tools = require('./lib/tools');

// default config
var defaultConfig = require('./config.default.json');

var config = {
    defaultConfig: defaultConfig,
    currConfig: null,
    init: function() {
        var cfg = {};

        lodash.merge(cfg, this.defaultConfig);

        var cfgPath = './config.json';
        if(fs.existsSync(cfgPath)) {
            lodash.merge(cfg, require(cfgPath));
        }

        this.currConfig = cfg;
    },
    getConfig: function(cfg) {
        cfg = lodash.merge({}, this.currConfig, cfg);

        if(!cfg.id) {
            cfg.id = tools.uuid(cfg.action);
        }

        // 旧版，待废弃
        if(!cfg.action) {
            cfg.action = cfg.type;
        }

        return cfg;
    }
};

config.init();

module.exports = config;
