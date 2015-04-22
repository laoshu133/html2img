/**
 * hlg-html2img
 *
 * client
 *
 */

// deps
var net = require('net');
var tools = require('./tools');

// configs
var configs = [
    require('./demos/thumb.json'),
    require('./demos/thumb_whit_replace.json'),

    // repeat test
    require('./demos/thumb_whit_replace.json'),
    require('./demos/thumb.json'),
];

// count
var counts = {
    count: 0,
    cfg: null
};

// init
var client = net.connect({
    host: 'localhost',
    port: 3000
});

client.on('connect', function() {
    console.log('Strat shot...');

    tools.time('All shots');

    sendConfig();
});

client.on('data', function(data) {
    data = data.toString();

    var ret = null;
    try{
        ret = JSON.parse(data);
    }
    catch(ex) {
        console.error('Data parse error:', ex);
    }

    if(!ret) {
        console.error('No result');

        client.end();
        return;
    }

    console.log('----Shot Success----');
    console.log(ret.message);

    sendConfig();
});

// funs
function sendConfig() {
    // Count
    if(counts.count > 0) {
        tools.timeEnd('Start Shot['+ counts.count +']');

        // pipe
        console.log(' ');
    }

    if(!configs.length) {
        client.end();

        tools.timeEnd('All shots');

        return;
    }

    var cfg = configs.shift();
    var cfgJSON = JSON.stringify(cfg);

    // Count
    counts.count += 1;
    tools.time('Start Shot['+ counts.count +']');

    client.write(cfgJSON);
}