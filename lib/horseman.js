/**
 * horseman shim
 *
 * @author xiaomi
 */
'use strict';

// var fs = require('fs');
var path = require('path');
var lodash = require('lodash');
var tools = require('./tools');
var Horseman = require('node-horseman');
var HorsemanPromise = require('node-horseman/lib/HorsemanPromise');

var HorsemanFn = Horseman.prototype;

// pageMaker shim
// var _pageMaker = HorsemanFn.pageMaker;
HorsemanFn.pageMaker = function() {
    var self = this;
    var phantom = this.phantom;

    // phantom promisify
    phantom.createPageAsync = HorsemanPromise.promisify(phantom.createPage);

    // return _pageMaker.apply(this, arguments)
    return phantom.createPageAsync()
    // init page
    .then(page => {
        // cache
        self.page = page;

        // promisify page methods
        page.getAsync = HorsemanPromise.promisify(page.get);
        page.setAsync = HorsemanPromise.promisify(page.set);
        page.renderAsync = HorsemanPromise.promisify(page.render);
        page.injectJsAsync = HorsemanPromise.promisify(page.injectJs);

        // override onResourceReceived
        // not cache resources
        page.onResourceReceived = function(/* res */) {
            // tools.log('ResourceReceived', res.status, res.url);
        };

        // resourceTimeout
        var key = 'settings.resourceTimeout';
        var resourceTimeout = +process.env.RESOURCE_TIMEOUT;
        return page.setAsync(key, resourceTimeout);
    })
    // page onLoadFinished
    .tap(() => {
        var page = self.page;

        // inject jquery, client-tools
        page.onLoadFinished = function() {
            self.waitingForNextPage = false;

            self.ready = self.evaluate(function() {
                return !!window.jQuery;
            })
            .then(hasJquery => {
                if(hasJquery) {
                    return;
                }

                var jqueryUrl = 'jquery/dist/jquery.min.js';
                if(process.env.NODE_ENV === 'development') {
                    jqueryUrl = jqueryUrl.replace('.min', '');
                }

                jqueryUrl = require.resolve(jqueryUrl);

                return page.injectJsAsync(jqueryUrl);
            })
            .then(() => {
                var clientToolsUrl = '../lib/client-tools.js';
                clientToolsUrl = path.resolve(__dirname, clientToolsUrl);

                return page.injectJsAsync(clientToolsUrl);
            })
            .then(() => {
                return self;
            });
        };
    });
};

// override actions
var actions = {
    // screenshot, support options, eg: quality
    // @TODO: zoomFactor
    screenshot(path, options) {
        var self = this;

        return this.ready.then(() => {
            tools.log('Horseman.screenshot()');

            options = lodash.merge({
                // format: 'png',
                quality: 100
            }, options);

            return self.page.renderAsync(path, options);
        });
    },
    // cropBySelector
    cropBySelector: function(selector, path, options) {
        var self = this;

        return this.boundingRectangle(selector)
        .then(area => {
            return self.crop(area, path, options);
        });
    },
    // crop, support options, eg: quality
    // @TODO: zoomFactor
    crop(area, path, options) {
        // selector
        if(typeof area === 'string') {
            return this.cropBySelector(area, path, options);
        }

        var rect = {
            top: area.top,
            left: area.left,
            width: area.width,
            height: area.height
        };

        var self = this;
        var prevClipRect;
        var page = this.page;

        return page.getAsync('clipRect')
        .then(lastRect => {
            prevClipRect = lastRect;

            return page.setAsync('clipRect', rect);
        })
        .then(() => {
            return self.screenshot(path, options);
        })
        .then(() => {
            return page.setAsync('clipRect', prevClipRect);
        });
    }
};

// override
Object.keys(actions).forEach((name) => {
    HorsemanFn[name] = actions[name];

    // Allow chaining actions off HorsemanPromises
    HorsemanPromise.prototype[name] = function() {
        var args = arguments;

        return this.then(val => {
            this.lastVal = val;
            return this[name].apply(this, args);
        });
    };
});


module.exports = Horseman;