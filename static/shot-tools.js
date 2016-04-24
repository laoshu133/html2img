/**
 * page-tools
 *
 */

(function(global, $) {
    var tools = {
        version: '0.0.2',
        init: function() {
            // this.initTaobaoCSSShim();
        },
        getCropRects: function(selector, options) {
            var maxCount = options && options.maxCount;
            if(!maxCount || maxCount <= 0) {
                maxCount = Infinity;
            }

            var rects = [];

            $(selector).each(function(i, elem) {
                if(!elem || !elem.getBoundingClientRect) {
                    return;
                }

                var rect = elem.getBoundingClientRect();
                if(!rect || !rect.width || !rect.height) {
                    return;
                }

                rects.push(rect);

                if(rects.length >= maxCount) {
                    return false;
                }
            });

            return rects;
        },
        initTaobaoCSSShim: function() {
            // taobao css
            var tbStyle = $('#J_Taobao_css')[0];
            if(tbStyle) {
                tbStyle.innerHTML = this.getTaobaoCSS();
            }
        },

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
        getCrop: function(wrapElem, options) {
            var size = options && options.size;
            var outCrop = {
                height: 0,
                width: 0,
                left: 0,
                top: 0
            };

            wrapElem = $(wrapElem);
            if(!wrapElem.length) {
                return outCrop;
            }

            wrapElem.css('transform', 'none');

            var rect;
            var wrapWidth = wrapElem.width();
            var wrapHeight = wrapElem.height();
            var wrapWHRatio = wrapWidth / wrapHeight;

            if(!size || !size.type) {
                rect = wrapElem[0].getBoundingClientRect();

                outCrop.height = wrapHeight;
                outCrop.width = wrapWidth;
                outCrop.left = rect.left;
                outCrop.top = rect.top;

                return outCrop;
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
            outCrop.height = size.height;
            outCrop.width = size.width;
            outCrop.left = rect.left;
            outCrop.top = rect.top;

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
        getCrops: function(selector, options) {
            var self = this;
            var crops = [];

            $(selector).each(function(i, elem) {
                var crop = self.getCrop(elem, options);

                crops.push(crop);
            });

            return crops;
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
                imageBlank: options.imageBlank,
                className: className,
                wrapElem: wrapElem,
                wrapRect: wrapRect,
                links: links
            });

            return $.extend(ret, tmpRet);
        },
        listCovertors: {
            map: function(options) {
                var tpl = '<div class="{className}"><div><img usemap="#{mapName}" src="{imgUrl}" width="{imgWidth}" height="{imgHeight}" border="0" style="vertical-align:top"></div><map name="{mapName}" id="{mapName}">{linkList}</map></div>';
                var itemTpl = '<area shape="RECT" coords="{coords}" type="anchor" target="{target}" href="{href}">';

                var listHTML = '';
                options.links.forEach(function(link) {
                    var coords = [
                        link.left,
                        link.top,
                        link.right,
                        link.bottom
                    ]
                    .join(',');

                    listHTML += fill(itemTpl, {
                        target: link.target,
                        href: link.href,
                        coords: coords
                    });
                });

                var wrapRect = options.wrapRect;
                var mapName = 'list_map_' + Date.now();

                return {
                    html: fill(tpl, {
                        className: options.className,
                        imgHeight: wrapRect.height,
                        imgWidth: wrapRect.width,
                        linkList: listHTML,
                        mapName: mapName
                    })
                };
            },
            taobao: function(options) {
                var tpl = '<div class="{className}" style="line-height:1;height:{imgHeight}px"><table background="{imgUrl}" height="{imgHeight}" width="{imgWidth}" cellspacing="0" cellpadding="0" border="0"><tr><td valign="top" style="vertical-align:top"><div class="{absClassName}" style="left:auto;top:auto">{linkList}</div></td></tr></table></div>';
                var itemTpl = '<div class="{absClassName}" style="display:inline;background:none;border:0;width:{width}px;left:{left}px;top:{top}px"><a href="{href}" target="{target}" style="display:inline-block;vertical-align:top"><img src="{imgBlank}" height="{height}" width="{width}" valign="top"></a></div>';

                var listHTML = '';
                var imageBlank = options.imageBlank;
                var absClassName = this.getTaobaoAbsClass();

                options.links.forEach(function(link) {
                    link.imgBlank = imageBlank;
                    link.absClassName = absClassName;

                    listHTML += fill(itemTpl, link);
                });

                var wrapRect = options.wrapRect;

                return {
                    html: fill(tpl, {
                        absClassName: absClassName,
                        className: options.className,
                        imgHeight: wrapRect.height,
                        imgWidth: wrapRect.width,
                        linkList: listHTML
                    })
                };
            }
        },
        // getTaobaoCSS
        getTaobaoCSS: (function() {
            var tbCssRules = [
                '.most-footer,.footer-more-trigger,.sn-simple-logo{ position: absolute;}',
                'div,ul,dl,p,span,a,img{ background-image: none !important;}',
                '.ke-anchor{display:none}',
                'p{ margin: 1.12em 0;}'
            ];

            return function(selectorPrefix) {
                if(!selectorPrefix) {
                    selectorPrefix = '';
                }

                if(selectorPrefix && !/\s$/.test(selectorPrefix)) {
                    selectorPrefix += ' ';
                }

                var ret = '';
                var rselector = /^[^{]+/;

                $.each(tbCssRules, function(i, css) {
                    var selectors = '';

                    css = css.replace(rselector, function(a) {
                        selectors = a;

                        return '';
                    });

                    if(!selectors) {
                        return;
                    }

                    selectors = selectors.split(',');
                    $.each(selectors, function(i, selector) {
                        ret += selectorPrefix;
                        ret += selector + ',\n';
                    });

                    ret = ret.replace(/,\n$/, '');
                    ret += css;
                });

                return ret;
            };
        })(),
        getTaobaoAbsClass: function(shopType) {
            // var className = 'most-footer footer-more-trigger sn-simple-logo';
            var className = 'most-footer sn-simple-logo';

            if(shopType === 'B') {
                // ...
            }

            return className;
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

    tools.init();

    global.shotTools = tools;
})(this, jQuery);
