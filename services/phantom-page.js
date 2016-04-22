/**
 * services/phantom-page
 *
 */
'use strict';

const lodash = require('lodash');
// const phantom = require('phantom');
const PhantomPage = require('phantom/lib/page').default;
// const Promise = require('bluebird');

lodash.assign(PhantomPage.prototype, {
    getCropRects: function(selector, options) {
        return this.evaluate(function(selector, options) {
            return shotTools.getCropRects(selector, options);
        }, selector, options);
    },
    // cropBySelector
    cropBySelector: function(selector, path, options) {
        var self = this;

        return this.getCropRects(selector, {
            maxCount: 1
        })
        .then(rects => {
            return self.crop(rects[0], path, options);
        });
    },
    // crop, support options, eg: quality
    // @TODO: zoomFactor
    crop: function(area, path, options) {
        // selector
        if(typeof area === 'string') {
            return this.cropBySelector(area, path, options);
        }
        if(!area) {
            throw new Error('area params error');
        }

        var rect = {
            top: area.top,
            left: area.left,
            width: area.width,
            height: area.height
        };

        let lastClipRect;

        console.log(111, rect);

        return this.property('clipRect')
        .then(clipRect => {
            lastClipRect = clipRect;

            console.log('xxx', rect);

            return this.property('clipRect', rect);
        })
        .then(() => {
            return this.screenshot(path, options);
        })
        .then(() => {
            return this.property('clipRect', lastClipRect || {});
        });
    },
    screenshot: function(path, options) {
        console.log('rrr', path, options);
        return this.render(path, options);
    }
});


module.exports = PhantomPage;