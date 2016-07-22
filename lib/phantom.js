/**
 * lib/phantom
 *
 */
'use strict';

const lodash = require('lodash');
const Promise = require('bluebird');

const _Phantom = require('phantom/lib/phantom').default;

const PhantomPage = require('./phantom-page');
const logger = require('../services/logger');

class Phantom extends _Phantom {
    constructor(args) {
        super(args);

        // props
        this.pagesCount = 0;
        this.pages = [];

        // process watch
        this.process.on('exit', code => {
            logger.info('Phantom.exit, with code:', code);
        });

        this.process.on('uncaughtException', ex => {
            logger.info('[Phantom.uncaughtException]', ex.message);
            logger.error(ex);

            this.process.exit(1);
        });
    }

    // createPage, ignore Proxy
    // phantomjs-node/src/phantom.js#96
    createPage() {
        logger.info('Phantom.createPage');

        this.pagesCount += 1;

        return Promise.try(() => {
            return this.execute('phantom', 'createPage');
        })
        .then(response => {
            let page = new PhantomPage(this, response.pageId);

            // reset pagesCount
            page.on('onClosing', () => {
                this.pagesCount -= 1;

                lodash.remove(this.pages, item => {
                    return page === item;
                });
            });

            this.pages.push(page);

            return page;
        })
        .tap(() => {
            logger.info('Phantom.createPage.done');
        });
    }

    exit() {
        if(this.destroyed) {
            return Promise.resolve(true);
        }

        this.destroyed = true;

        return super.exit();
    }

    // graceful exit
    gracefulExit() {
        if(this.gracefulExitPromise) {
            return this.gracefulExitPromise;
        }

        var dfd = {
            ttl: 3,
            checkDelay: 1500
        };

        var check = () => {
            let workingPages = this.pages.filter(page => {
                return page.working;
            });

            dfd.ttl -= 1;

            if(
                workingPages.length <= 0 ||
                dfd.ttl <= 0
            ) {
                this.gracefulExitPromise = null;

                dfd.resolve(this.exit());
                return;
            }

            setTimeout(check, dfd.checkDelay);
        };

        // delay check
        process.nextTick(check);

        this.gracefulExitPromise = new Promise(resolve => {
            dfd.resolve = resolve;
        });

        return this.gracefulExitPromise;
    };
}

module.exports = Phantom;
