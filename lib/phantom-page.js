/**
 * lib/phantom-page
 *
 */
'use strict';

const lodash = require('lodash');
// const Promise = require('bluebird');
const PhantomPage = require('phantom/lib/page').default;

lodash.assign(PhantomPage.prototype, {
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

            return this.property('clipRect', rect);
        })
        .then(() => {
            return this.screenshot(path, options);
        })
        .then(() => {
            return this.property('clipRect', lastClipRect || {});
        });
    },
    /**
     * 截屏
     *
     * @param  {Number} options.quality 图像质量
     * @param  {Number} options.type 裁剪类型
     * 10 - 长边裁剪，圆点中心，不足补白
     * 11 - 长边裁剪，圆点左上，不足补白
     * 12 - 长边裁剪，圆点左上，不足不处理
     * 20 - 短边裁剪，圆点中心，不足不处理
     * 21 - 短边裁剪，圆点左上，不足不处理
     */
    screenshot: function(path, options) {
        let renderOptions = {
            format: options.format,
            quality: options.quality
        };

        // @TODO options.size
        return this.render(path, renderOptions);

        let size = options.size;
        if(
            !size ||
            !size.type ||
            (!size.width && !size.height)
        ) {
            return this.render(path, renderOptions);
        }

        return Promise.resolve()
        .then(() => {
            return this.property('clipRect');
        })
        .then(clipRect => {
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
        })
        // 选边
        .then(rect => {
            let type = size.type;
            let heightRatio = size.height / rect.height;
            let widthRatio = size.width / rect.width;
            let zoom = widthRatio;

            if(
                // 长边裁剪
                (type < 20 && widthRatio > heightRatio) ||
                // 短边裁剪
                (type >= 20 && widthRatio < heightRatio)
            ) {
                zoom = heightRatio;
            }

            // 默认左上角开始裁剪
            let cropRect = {
                height: size.height,
                width: size.width,
                left: rect.left,
                top: rect.top
            };

            // 居中裁剪
            if(type % 10 === 0) {
                cropRect.left += (rect.width - size.width) / 2;
                cropRect.top += (rect.height - size.height) / 2;
            }

            // 长边裁剪，减去补白
            if(type === 12) {
                if(size.height > rect.height) {
                    cropRect.height = rect.height;
                }
                else if(size.width > rect.width) {
                    cropRect.width = rect.width;
                }
            }

            return {
                cropRect: cropRect,
                zoom: zoom
            };
        })
        // 缩放
        .tap(data => {
            return this.property('zoomFactor', data.zoom);
        })
        // 重设裁剪区域
        .tap(data => {
            return this.property('clipRect', data.cropRect);
        })
        .tap(() => {
            return this.render(path, renderOptions);
        });
    }
});


module.exports = PhantomPage;