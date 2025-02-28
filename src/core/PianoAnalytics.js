import Config from '../config';
import Model from './model';
import Configuration from './configuration';
import buildStep from './steps/build.step';
import campaignsStep from './steps/campaigns.step';
import metadataStep from './steps/metadata.step';
import onBeforeBuildStep from './steps/onbefore.build.step';
import onBeforeSendStep from './steps/onbefore.send.step';
import privacyStep from './steps/privacy.step';
import propertiesStep from './steps/properties.step';
import sendStep from './steps/send.step';
import userStep from './steps/user.step';
import visitorStep from './steps/visitor.step';
import {Storage} from '../storage/storage';
import {Privacy} from '../business/privacy';
import {User} from '../business/user';
import {cloneObject} from '../utils/index';
import {preloadTagging} from '../business/preload';

import {AVInsights} from '../business/avinsights';
import PianoAnalyticsQueue from './queue';


function PianoAnalytics(configuration) {
    this._queue = new PianoAnalyticsQueue(this);
    this._sendEvent = _sendEvent;
    this.properties = {};
    this.cfg = new Configuration(cloneObject(configuration) || Config);
    this.setConfiguration = this.cfg.setConfiguration;
    this.setConfigurations = this.cfg.setConfigurations;
    this.getConfiguration = this.cfg.getConfiguration;
    if (BUILD_BROWSER) {
        window._pac = window._pac || {privacy: []};
        const configOverrideObject = window._pac;
        for (const config in configOverrideObject) {
            if (Object.prototype.hasOwnProperty.call(configOverrideObject, config) && config !== 'privacy') {
                this.setConfiguration(config, configOverrideObject[config]);
            }
        }
    }
    this.storage = new Storage(this);
    this.privacy = new Privacy(this);
    this.user = new User(this);
    AVInsights(this);

    if (BUILD_BROWSER) {
        const asyncName = this.getConfiguration('queueVarName');
        window[asyncName] = window[asyncName] || [];
        preloadTagging(this, window[asyncName], true, asyncName);
    }
}

PianoAnalytics.prototype.setProperty = function (property, value, options) {
    if (this.privacy.isPropAllowed(property)) {
        this.properties[property] = {
            value: value,
            options: options || {}
        };
    }
};
PianoAnalytics.prototype.setProperties = function (properties, options) {
    for (const prop in properties) {
        if (Object.prototype.hasOwnProperty.call(properties, prop)) {
            this.setProperty(prop, properties[prop], options);
        }
    }
};
PianoAnalytics.prototype.deleteProperty = function (propertyName) {
    delete this.properties[propertyName];
};

function _sendEvent(events, options) {
    const steps = [
        privacyStep,
        visitorStep,
        userStep,
        campaignsStep,
        metadataStep,
        propertiesStep,
        onBeforeBuildStep,
        buildStep,
        onBeforeSendStep,
        sendStep
    ];
    for (let i = 0; i < events.length; i++) {
        const eventFormatted = {name: '', data: {}};
        if (typeof events[i] === 'string') {
            eventFormatted.name = events[i];
        } else if (typeof events[i].data === 'undefined') {
            eventFormatted.name = events[i].name;
        } else {
            continue;
        }
        events[i] = eventFormatted;
    }
    const data = {events: events, options: options};
    if (steps.length > 0 && typeof steps[0] === 'function') {
        const clonedConfig = new Configuration(this.cfg.cloneData());
        steps[0](this, new Model(this, data, clonedConfig), steps.slice(1));
    }
}

PianoAnalytics.prototype.sendEvent = function (eventName, eventData, options) {
    this._queue.push(['_sendEvent', [{name: eventName, data: eventData}], options]);
};

PianoAnalytics.prototype.sendEvents = function (events, options) {
    this._queue.push(['_sendEvent', events, options]);
};

PianoAnalytics.prototype.getVisitorId = function (callback) {
    let result = null;
    this.storage.getItem(this.getConfiguration('storageVisitor'), (function (storedValue) {
        const value = this.getConfiguration('visitorId') || storedValue;
        if (callback) {
            callback(value);
        } else {
            result = value;
        }
    }).bind(this));
    return result;
};
PianoAnalytics.prototype.setVisitorId = function (value) {
    this.setConfiguration('visitorId', value);
};

PianoAnalytics.prototype.setUser = function (id, category, enableStorage) {
    this.user.setUser(id, category, enableStorage);
};
PianoAnalytics.prototype.getUser = function (callback) {
    this.user.getUser(callback);
};
PianoAnalytics.prototype.deleteUser = function () {
    this.user.deleteUser();
};

PianoAnalytics.prototype.PA = PianoAnalytics;

export default PianoAnalytics;
