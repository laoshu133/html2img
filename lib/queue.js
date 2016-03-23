/**
 * queue
 *
 * single-task
 *
 */
'use strict';

var queue = {
    tasks: [],
    status: 'ready',
    add: function(task) {
        this.tasks.push(task);

        this.next();
    },
    next: function() {
        var self = this;
        var tasks = this.tasks;

        if(this.status !== 'ready' || !tasks.length) {
            return;
        }

        var task = tasks.shift();

        this.status = 'processing';

        task.handle(task.client, task.config, task)
        .then(() => {
            // async next
            process.nextTick(() => {
                self.status = 'ready';
                self.next();
            });
        });
    }
};

module.exports = queue;