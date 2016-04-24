/**
 * controllers
 *
 */
'use strict';

let Router = require('koa-router');

let ctrls = [
    require('./main'),
    require('./file'),
    require('./status')
];

module.exports = function (app) {

    let router = app.router = new Router();

    ctrls.forEach(ctrlFactory => {
        ctrlFactory(router, app);
    });

    // allowedMethods
    // app.use(router.allowedMethods());

    return router.routes();
};