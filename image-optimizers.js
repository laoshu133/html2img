/**
 * hlg-html2img
 *
 * image-optimizers
 */

// deps
var fs = require('fs');
var ExecBuffer = require('exec-buffer');

function doOptimize(binPath, args, callback) {
    if(!Array.isArray(args)) {
        args = [];
    }

    var exec = new ExecBuffer();
    args.forEach(function(v, i) {
        if(v === '{src}') {
            args[i] = exec.src();
        }
        else if(v === '{dest}') {
            args[i] = exec.dest();
        }
    });

    fs.readFile(src, function(err, buf) {
        if(err) {
            callback(err);
            return;
        }

        exec.use(binPath, args)
        .run(buf, function(err, buf) {
            if(err || !buf || !buf.length) {
                callback(err);
                return;
            }

            callback(null, buf);
        });
    });
}

// optimizers
var optimizers = {
    png: function(src, callback) {
        var pngquantPath = require('pngquant-bin');

        var args = [
            '-o', '{dest}',
            '{src}'
        ];

        doOptimize(pngquantPath, args, callback);
    },
    jpg: function(src, callback) {
        var jpegtranPath = require('jpegtran-bin').path;

        var args = [
            '-copy', 'none',
            '-optimize',
            '-progressive',
            '-outfile', '{dest}',
            '{src}'
        ];

        doOptimize(jpegtranPath, args, callback);
    }
};

module.exports = optimizers;
