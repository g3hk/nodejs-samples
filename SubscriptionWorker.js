var subscriptionModel = require('../models/Subscription');
var randomUtil = require('../utils/RandomUtil');
var logger = require('../utils/Logger');
var topicModel = require('../models/Topic');
var applicationModel = require('../models/Application');
var data = require('../data');
var batchWorker = require('../workers/BatchWorker');

// For Synchronous
exports.subscribeDevice = function(message, callback) {

    var deviceSubscription = new subscriptionModel.Subscription();
    deviceSubscription.appId = message.app.appId;
    deviceSubscription.pushnotificationId = message.pushNotificationId;
    deviceSubscription.pushNetworkId = message.pushNetwork.pushNtwrkId;
    deviceSubscription.status = message.status;
    if (message.status.toLowerCase() !== 'active') {
        callback('Status should be active for subscription');
    }
    for (var i = message.topics.length - 1; i >= 0; i--) {
        deviceSubscription.topicIds.indexOf(message.topics[i].topicId) > -1 ? '' : deviceSubscription.topicIds.push(message.topics[i].topicId);
    }
    deviceSubscription.validate(function(err) {
        if (err) {
            logger.error(err);
            callback(err);
        } else {
            checkPushNetworkId(deviceSubscription, '', callback);
        }
    });
};

function checkPushNotifiationId(deviceSubscription, id, callback) {

    subscriptionModel.Subscription.find({
        $and: [ {
            appId: deviceSubscription.appId
        }, {
            pushnotificationId: deviceSubscription.pushnotificationId
        } ]
    }, function(err, data) {
        if (err) {
            logger.error(err);
            callback(err);
        } else if ((data.length > 0) && (id === null || id.length <= 0)) {
            callback('Device already registered');
        } else if ((data.length <= 0) && (id.length > 0)) {
            callback('Device not found');
        } else {
            checkTopicId(deviceSubscription, id, callback);
        }
    });
}

function checkShortSubscriptionCode(deviceSubscription, id, callback) {
    subscriptionModel.Subscription.find({
        subscriptionShortcode: deviceSubscription.subscriptionShortcode
    }, function(err, data) {
        if (err) {
            logger.error(err);
            callback(err);
        } else if (data.length <= 0) {
            callback('Device not found with the specified SubscriptionShortCode');
        } else {
            checkSubscriptionId(deviceSubscription, id, callback);
        }
    });
}

function checkSubscriptionId(deviceSubscription, id, callback) {
    subscriptionModel.Subscription.find({
        _id: id
    }, function(err, data) {
        if (err) {
            logger.error(err);
            callback(err);
        } else if (data.length <= 0) {
            callback('Device not found with the specified SubscriptionId');
        } else {
            checkPushNetworkId(deviceSubscription, id, callback);
        }
    });
}

function checkTopicId(deviceSubscription, id, callback) {

    topicModel.Topic.find({
        $and: [ {
            $or: [ {
                "topics.topicId": {
                    $in: deviceSubscription.topicIds
                }
            }, {
                "topics.subtopics.topicId": {
                    $in: deviceSubscription.topicIds
                }
            } ]
        }, {
            'appId': deviceSubscription.appId
        } ]
    }, function(err, data) {
        if (err) {
            logger.error(err);
            callback(err);
        } else if (data.length <= 0) {
            callback('TopicsId not present in the hub');
        } else {
            if (id === null || id.length <= 0) {
                deviceSubscription.subscriptionShortcode = GetId();
                deviceSubscription.save(function(errors, data) {
                    if (errors) {
                       logger.error(errors);
                    }
                    callback(errors, data);
                });
            } else {
                subscriptionModel.Subscription.update({
                    '_id': id
                }, {
                    $set: {
                        'topicIds': deviceSubscription.topicIds
                    }
                }, function(err, updated) {
                    callback(err, updated);
                });
            }
        }
    });
}

function checkPushNetworkId(deviceSubscription, id, callback) {
    var bool = false;
    for (var k = 0; k < data.pushNetworks.length; k++) {
        if (data.pushNetworks[k].networkcode.toLowerCase() === deviceSubscription.pushNetworkId.toLowerCase()) {
            bool = true;
        }
    }
    if (bool === true) {
        checkAppId(deviceSubscription, id, callback);
    } else {
        callback('Currently we are not supporting this network');
    }
}

function checkAppId(deviceSubscription, id, callback) {

    applicationModel.Application.find({
        'application.appId': deviceSubscription.appId
    }, function(err, appdata) {
        var error;
        if (err) {
            logger.error(err);
            error = {
                message: err
            };
            callback(error);
        } else if (appdata.length <= 0) {
           logger.error(err);
            callback('AppId not present in the hub');
        } else {
            checkPushNotifiationId(deviceSubscription, id, callback);
        }
    });
}

function GetId() {
    var randomid = randomUtil.getRandomCode(5);
    var id = idCheck(randomid, function(idData) {
        if (idData !== null) {
            GetId();
        }
    });
    return id;
}

function idCheck(randomId, callbackCheck) {

    subscriptionModel.Subscription.findOne({
        subscriptionShortcode: randomId
    }, function(err, idData) {
        if (err) {
            logger.error(err);
        } else {
            callbackCheck(idData);
        }
    });
    return randomId;
}

exports.reviseSubscription = function(id, subscription, callback) {

    var deviceSubscription = new subscriptionModel.Subscription();
    deviceSubscription.appId = subscription.app.appId;
    deviceSubscription.pushnotificationId = subscription.pushNotificationId;
    deviceSubscription.pushNetworkId = subscription.pushNetwork.pushNtwrkId;
    deviceSubscription.status = subscription.status;
    deviceSubscription.subscriptionShortcode = subscription.shortSubscriptionId;
    if (subscription.status.toLowerCase() !== 'active') {
        callback('Status should be active for revise subscription');
    }
    for (var i = subscription.topics.length - 1; i >= 0; i--) {
        deviceSubscription.topicIds.indexOf(subscription.topics[i].topicId) > -1 ? '' : deviceSubscription.topicIds.push(subscription.topics[i].topicId);
    }

    deviceSubscription.validate(function(err) {
        if (err) {
            callback(err);
        } else {
            checkShortSubscriptionCode(deviceSubscription, id, callback);
        }
    });
};

exports.searchSubscribDetails = function(request, callback) {

    var deviceSubscriptionInfo = subscriptionModel.Subscription;
    var pushNotificationIdValue = request.pushNotificationId;
    var subscriptionIdValue = request.subscriptionId;
    var shortSubscriptionIdValue = request.shortSubscriptionId;
    var condition = [];
    if (pushNotificationIdValue !== '') {
        condition[0] = {
            pushnotificationId: pushNotificationIdValue
        };
    }
    if (shortSubscriptionIdValue !== '') {
        condition[condition.length] = {
            subscriptionShortcode: shortSubscriptionIdValue
        };
    }
    if (subscriptionIdValue && subscriptionIdValue.length == 24) {
        condition[condition.length] = {
            _id: subscriptionIdValue
        };
    }

    deviceSubscriptionInfo.find({
        $and: condition
    }, function(err, subscription) {
        callback(err, subscription);
    });
};
