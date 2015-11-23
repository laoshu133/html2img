/**
 * page-tools
 *
 */

(function(global, $) {
    var tools = {
        /**
         * 缩放/裁剪
         *
         * @param  {String} options.selector 目标元素
         * @param  {Number} options.type 裁剪类型
         * 10 - 长边裁剪，圆点中心，不足补白
         * 11 - 长边裁剪，圆点左上，不足补白
         * 12 - 长边裁剪，圆点左上，不足不处理
         * 20 - 短边裁剪，圆点中心，不足不处理
         * 21 - 短边裁剪，圆点左上，不足不处理
         */
        getCrop: function(options) {
            var size = options.size;
            var wrapElem = $(options.selector);

            wrapElem.css('transform', 'none');

            var rect;
            var wrapWidth = wrapElem.width();
            var wrapHeight = wrapElem.height();
            var wrapWHRatio = wrapWidth / wrapHeight;

            if(!size || !size.type) {
                rect = wrapElem[0].getBoundingClientRect();

                return {
                    height: wrapHeight,
                    width: wrapWidth,
                    left: rect.left,
                    top: rect.top
                };
            }

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

            var type = ~~size.type || 10;
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

            rect = wrapElem[0].getBoundingClientRect();

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
        },
        /**
         * 转换关联列表
         *
         * @param  {String} options.selector 目标元素
         * @param  {Number} options.type 目标类型
         * map - map
         * table - table
         * taobao - 淘宝特定 class
         */
        covertList: function(options) {
            var type = options.type || 'map';
            var covertor = this.listCovertors[type];
            var links = [];
            var ret = {
                status: 'success',
                message: '',
                links: links,
                html: ''
            };

            if(!covertor) {
                ret.status = 'no_covertor';
                ret.message = 'No covertor: ' + type;

                return ret;
            }

            // get links
            var wrapElem = $(options.selector);
            var wrapRect = wrapElem[0].getBoundingClientRect();

            $('a', wrapElem).each(function(i, elem) {
                var linkRect = elem.getBoundingClientRect();
                var link = {
                    index: i,
                    width: linkRect.width,
                    height: linkRect.height,
                    top: linkRect.top - wrapRect.top,
                    left: linkRect.left - wrapRect.left,
                    right: linkRect.right - wrapRect.left,
                    bottom: linkRect.bottom - wrapRect.top,
                    target: elem.getAttribute('target') || '',
                    href: elem.getAttribute('href') || ''
                };

                links[i] = link;
            });

            var className = $.trim(wrapElem.children().prop('className'));
            className += className ? ' ' : '';
            className += 'list_fited';

            var tmpRet = covertor.call(this, {
                wrapElem: wrapElem,
                wrapRect: wrapRect,
                className: className,
                links: links
            });

            return $.extend(ret, tmpRet);
        },
        listCovertors: {
            map: function(options) {
                var tpl = '<div class="{className}"><div><img usemap="#{mapName}" src="{imgUrl}" width="{imgWidth}" height="imgHeight" border="0" style="vertical-align:top"></div><map name="{mapName}" id="{mapName}">{linkList}</map></div>';
                var areaTpl = '<area shape="RECT" coords="{coords}" type="anchor" target="{target}" href="{href}">';

                var listHTML = '';
                options.links.forEach(function(link) {
                    var coords = [
                        link.left,
                        link.top,
                        link.right,
                        link.bottom
                    ]
                    .join(',');

                    listHTML += fill(areaTpl, {
                        target: link.target,
                        href: link.href,
                        coords: coords
                    });
                });

                var wrapRect = options.wrapRect;
                var mapName = 'list_fited_' + Date.now();

                return {
                    html: fill(tpl, {
                        className: options.className,
                        imgHeight: wrapRect.height,
                        imgWidth: wrapRect.width,
                        linkList: listHTML,
                        mapName: mapName
                    })
                };
            }
        }
    };

    // funs
    function fill(tpl, data) {
        tpl += '';

        for(var k in data) {
            tpl = tpl.replace(new RegExp('\\{'+ k +'\\}', 'g'), data[k]);
        }

        return tpl;
    }

    global.dsTools = tools;
})(this, jQuery);
