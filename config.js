/**
 * hlg-html2img
 *
 * config
 *
 */

var fs = require('fs');
var lodash = require('lodash');

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
        var ret = {};

        return lodash.merge(ret, this.currConfig, cfg);
    }
};

config.init();

module.exports = config;
