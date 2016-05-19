/**
 * lib/phantom-page
 *
 */
'use strict';

const lodash = require('lodash');
const Promise = require('bluebird');

const PhantomPage = require('phantom/lib/page').default;

lodash.assign(PhantomPage.prototype, {
    setClipRect: function(clipRect) {
        // node-phantom bug
        // 为 null 时报错
        clipRect = lodash.assign({
            left: 0,
            top: 0
        }, clipRect);

        return this.property('clipRect', clipRect);
    },
    // crops rects
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

        return this.property('clipRect')
        .then(clipRect => {
            lastClipRect = clipRect;

            // @TODO: Attempted to assign to readonly property
            return this.setClipRect(rect);
        })
        .then(() => {
            return this.screenshot(path, options);
        })
        .then(() => {
            return this.setClipRect(lastClipRect);
        });
    },
    /**
     * 截屏
     *
     * @param  {Number} options.quality 图像质量
     * @param  {Number} options.format 裁剪类型
     * @param  {Object} options.size 裁剪类型
     *
     * @param {Number} options.width 目标图片宽度
     * @param {Number} options.height 目标图片高度
     * @param {Number} options.size 裁剪类型
     * 10 - 长边适应，圆点中心，不足补白
     * 11 - 长边适应，圆点左上，不足补白
     * 20 - 短边适应，圆点中心
     * 21 - 短边适应，圆点左上
     */
    screenshot: function(path, options) {
        if(!options) {
            options = {};
        }

        let renderOptions = {};
        if(options.format) {
            renderOptions.format = options.format.toLowerCase();

            // jpg -> jpeg
            if(renderOptions.format === 'jpg') {
                renderOptions.format = 'jpeg';
            }
        }
        if(+options.quality > 0) {
            renderOptions.quality = +options.quality;
        }

        let size = options ? options.size : null;
        if(
            !size ||
            (!size.width && !size.height)
        ) {
            return this.render(path, renderOptions);
        }

        let lastClipRect;

        return Promise.resolve()
        .then(() => {
            return this.property('clipRect');
        })
        .then(clipRect => {
            lastClipRect = clipRect || {};

            return clipRect || page.property('viewportSize');
        })
        // 修正属性
        .tap(rect => {
            if(!rect.left) {
                rect.left = 0;
            }
            if(!rect.top) {
                rect.top = 0;
            }

            let rectRatio = rect.width / rect.height;
            if(!size.height) {
                size.height = Math.round(size.width / rectRatio);
            }
            else if(!size.width) {
                size.width = Math.round(size.height * rectRatio);
            }
        })
        // 选边
        .then(rect => {
            let type = size.type || 10;
            let height = size.height;
            let width = size.width;
            let sizeRatio = width / height;
            let zoom = width / rect.width;

            if(
                // 长边
                (type < 20 && sizeRatio > 1) ||
                // 短边
                (type >= 20 && sizeRatio < 1)
            ) {
                zoom = height / rect.height;
            }

            let rectWidth = rect.width * zoom;
            let rectHeight = rect.height * zoom;

            // 默认左上角开始裁剪
            let cropRect = {
                left: rect.left * zoom,
                top: rect.top * zoom,
                height: height,
                width: width
            };

            // 居中裁剪
            if(type % 10 === 0) {
                cropRect.left += (rectWidth - width) / 2;
                cropRect.top += (rectHeight - height) / 2;
            }

            return {
                cropRect: cropRect,
                zoom: zoom
            };
        })
        // 重设缩放
        .tap(data => {
            return this.property('zoomFactor', data.zoom);
        })
        // 重设裁剪区域
        .tap(data => {
            return this.setClipRect(data.cropRect);
        })
        // render
        .tap(() => {
            return this.render(path, renderOptions);
        })
        // restore zoom
        .tap(() => {
            return this.property('zoomFactor', 1);
        })
        // restore clipRect
        .tap(() => {
            return this.setClipRect(lastClipRect);
        });
    }
});


module.exports = PhantomPage;