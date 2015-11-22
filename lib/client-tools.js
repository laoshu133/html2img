/**
 * page-tools
 *
 */

(function(global, $) {
    var tools = {
        /**
         * 裁剪类型
         * 10 - 长边裁剪，圆点中心，不足补白
         * 11 - 长边裁剪，圆点左上，不足补白
         * 12 - 长边裁剪，圆点左上，不足不处理
         * 20 - 短边裁剪，圆点中心，不足不处理
         * 21 - 短边裁剪，圆点左上，不足不处理
         */
        getCrop: function(options) {
            var size = options.size;
            var type = ~~size.type || 10;
            var wrapElem = $(options.selector);

            wrapElem.css('transform', 'none');

            var wrapWidth = wrapElem.width();
            var wrapHeight = wrapElem.height();
            var wrapWHRatio = wrapWidth / wrapHeight;

            // padding, height/width
            if(!size.height) {
                size.height = size.width / wrapWHRatio;
            }
            else if(!size.width) {
                size.width = size.height * wrapWHRatio;
            }

            var heightRatio = size.height / wrapHeight;
            var widthRatio = size.width / wrapWidth;
            var scale = widthRatio;

            // 选边
            if(
                // 长边裁剪
                (type < 20 && widthRatio > heightRatio) ||
                // 短边裁剪
                (type >= 20 && widthRatio < heightRatio)
            ) {
                scale = heightRatio;
            }

            wrapElem.css('transform', 'scale('+ scale +')');

            var rect = wrapElem[0].getBoundingClientRect();

            // 默认左上角开始裁剪
            var outCrop = {
                height: size.height,
                width: size.width,
                left: rect.left,
                top: rect.top
            };

            // 居中裁剪
            if(type % 10 === 0) {
                outCrop.left += (rect.width - size.width) / 2;
                outCrop.top += (rect.height - size.height) / 2;
            }

            // 长边裁剪，减去补白
            if(type === 12) {
                if(size.height > rect.height) {
                    outCrop.height = rect.height;
                }
                else if(size.width > rect.width) {
                    outCrop.width = rect.width;
                }
            }

            // debug
            // outCrop.html = document.documentElement.outerHTML;

            return outCrop;
        }
    };

    global.dsTools = tools;
})(this, jQuery);
