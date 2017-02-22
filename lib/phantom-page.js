/**
 * lib/phantom-page
 *
 */
'use strict';

const lodash = require('lodash');
const Promise = require('bluebird');

const _PhantomPage = require('phantom/lib/page').default;

const logger = require('../services/logger');

class PhantomPage extends _PhantomPage {
    constructor(phantom, id) {
        super(phantom, id);

        // 单个 page 最多使用次数，防止内存泄漏
        this.ttl = +process.env.PHANTOMJS_PAGE_TTL || 10;
        this.working = false;
    }

    open(url) {
        this.working = true;
        this.ttl -= 1;

        logger.info('Phantom.page.open', { url });

        return super.open(url)
        .then(status => {
            logger.info('Phantom.page.open.done');

            return status;
        });
    }

    close() {
        // 优先复用页面
        if(this.ttl > 0) {
            logger.info('Phantom.page.release');

            // reset
            this.working = false;

            // release page mem
            let idleUrl = 'about:blank';
            let idleContent = '<html><body></body></html>';

            return this.setContent(idleContent, idleUrl);
        }
        // 页面超过最大使用次数
        // 防止并发时多次 close
        else if(!this.destroyed) {
            this.destroyed = true;

            logger.info('Phantom.page.died');

            return super.close();
        }

        // 同一个 page 关闭多次时记录
        logger.error('Phantom.page.close.many_times');

        return Promise.resolve(true);
    }

    setClipRect(clipRect) {
        // node-phantom bug
        // 为 null 时报错
        clipRect = lodash.assign({
            left: 0,
            top: 0
        }, clipRect);

        return this.property('clipRect', clipRect);
    }

    // crops rects
    getCropRects(selector, options) {
        return this.evaluate(function(selector, options) {
            return window.shotTools.getCropRects(selector, options);
        }, selector, options);
    }

    // cropBySelector
    cropBySelector(selector, path, options) {
        return this.getCropRects(selector, {
            maxCount: 1
        })
        .then(rects => {
            return this.crop(rects[0], path, options);
        });
    }

    // crop, support options, eg: quality
    // @TODO: zoomFactor
    crop(area, path, options) {
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
    }

    /**
     * 截屏
     *
     * @param  {Number} options.quality 图像质量
     * @param  {Number} options.format 图像类型
     * @param  {Object} options.size 裁剪数据
     *
     * @param {Number} size.width 目标图片宽度
     * @param {Number} size.height 目标图片高度
     * @param {Number} size.type 裁剪类型
     * 10 - 长边适应，圆点中心，不足补白
     * 11 - 长边适应，圆点左上，不足补白
     * 20 - 短边适应，圆点中心
     * 21 - 短边适应，圆点左上
     */
    screenshot(path, options) {
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

            return clipRect || this.property('viewportSize');
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
                (type < 20 && sizeRatio < 1) ||
                // 短边
                (type >= 20 && sizeRatio > 1)
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
}

module.exports = PhantomPage;
