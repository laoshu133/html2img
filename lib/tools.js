/**
 * lib/tools
 */

module.exports = {
    fill: function(tpl, data) {
        tpl += '';

        for(var k in data) {
            tpl = tpl.replace(new RegExp('\\{'+ k +'\\}', 'g'), data[k]);
        }

        return tpl;
    },
    // 修正内容，以支持 phantomjs
    processHTML: function(html) {
        html = html ? String(html).trim() : '';

        if(!html) {
            return html;
        }

        // // => http://
        var re = /\s(src|background)\s*=\s*(["'])\/\//gi;
        html = html.replace(re, function(a, name, quot) {
            return ' ' + name + '=' + quot + 'http://';
        });

        // css transform, prefix
        re = /([\s;])(transform(?:\-\w+)?)\s*:\s*([^;\}]+)/gi;
        html = html.replace(re, function(a, spliter, key, val) {
            var css = key +':' + val + ';';

            // prefix
            css = '-webkit-' + css + css;

            return spliter + css;
        });

        return html;
    }
};
