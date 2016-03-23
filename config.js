/**
 * hlg-html2img
 *
 * config
 *
 */

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
        var ret = lodash.merge(ret, this.currConfig, cfg);

        if(!ret.id) {
            ret.id = tools.uuid(ret.action);
        }

        // 旧版，待废弃
        if(!config.action) {
            config.action = cfg.type;
        }

        return ret;
    }
};

config.init();

module.exports = config;
