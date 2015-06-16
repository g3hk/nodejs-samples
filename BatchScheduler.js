//samples for node code
var schedule = require('node-schedule');
var jobModel = require('../models/Job');
var batchSmootheningWorker = require('../workers/BatchSmootheningWorker');
var logger = require('../utils/Logger');
var _ = require('underscore');

exports.scheduleAll = function() {

    var smoothenRequest = {};
    jobModel.Job.find({}, {}, {}, function(err, jobData) {
        for (var j = jobData.length - 1; j >= 0; j--) {
            var id = jobData[j].pushNetworkId.toUpperCase();
            smoothenRequest.appId = jobData[j].appId;
            smoothenRequest.pushNetworkId = id;
            smoothenRequest.newOptimalSize = jobData[j].optimizedSize;

            schedule.scheduleJob(jobData[j].scheduledTime, _.partial(function(smoothenRequest) {
                batchSmootheningWorker.smoothenBatches(smoothenRequest, function(err) {
                    if (err) {
                        logger.error('Batch smoothening failed: ' + err);
                    } else {
                        logger.info('Batch smoothening completed successfully');
                        //batchSmootheningWorker.updateBatchStatus(smoothenRequest);
                    }
                });
            }, smoothenRequest));
        }
    });
};
