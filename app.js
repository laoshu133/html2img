/**
 * html2img
 *
 * app
 */
'use strict';

// env
require('dotenv-safe').load();

// Controllers
let controllerFactory = require('./controllers/index');

// koa
let koa = require('koa');
let onerror = require('koa-onerror');
let favicon = require('koa-favicon');
var bodyParser = require('koa-bodyparser');

// init app, whit proxy
let app = koa();
app.proxy = true;

// request body
app.use(bodyParser());

// Controllers
app.use(controllerFactory(app));

// favicon
// maxAge, 1 month
app.use(favicon('./static/favicon.ico', {
    maxAge: 30 * 24 * 60 * 60 * 1000
}));

// 404
app.use(function *(){
    // redirect to onerror
    this.throw(404);
});


// Error handle
onerror(app, {
    json: function(err) {
        let data = err.data || {};
        let statusCode = err.status;

        // Boom error
        if(err.output) {
            statusCode = err.output.statusCode;
        }

        data.status = statusCode || 500;
        if(!data.message) {
            data.message = err.message;
        }

        if(app.env === 'development') {
            data.stack = err.stack.split('\n');
        }

        this.status = data.status;
        this.body = data;
    }
});


// start up
let port = process.env.NODE_PORT || 3007;

app.listen(port);
console.log('Server listening:', port);

// exports
module.exports = app;