"use strict";
/**
 * Creating floating Panel-nodes which can be shown and hidden.
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module panel
 * @class Panel
 * @since 0.0.1
*/

require('js-ext');
require('polyfill');
require('./css/dialog.css');

var NAME = '[dialog]: ',
    MESSAGE_LEVELS = {
        'message': 1,
        'warning': 2,
        'error': 3
    },
    MESSAGE_HASHES = {
        'message': 'messages',
        'warning': 'warnings',
        'error': 'errors'
    },
    MESSAGE_HASHES_NR = {
        1: 'messages',
        2: 'warnings',
        3: 'errors'
    },
    FOLLOWUP_DELAY = 200,
    createHashMap = require('js-ext/extra/hashmap.js').createMap;

module.exports = function (window) {

    var DOCUMENT = window.document,
        Classes = require('js-ext/extra/classes.js'),
        UTILS = require('utils'),
        messages = require('messages'),
        later = UTILS.later,
        async = UTILS.async,
        dialog, Dialog, Event, exportObject;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

/*jshint boss:true */
    if (Dialog=window._ITSAmodules.Dialog) {
/*jshint boss:false */
        return Dialog; // Dialog was already created
    }

    require('panel')(window);
    Event = require('event');

    Dialog = Classes.createClass(function() {
        var instance = this;
        instance.model = {
            draggable: true
        };
        instance.currentMessageLevel = 0;
        instance.messages = [];
        instance.warnings = [];
        instance.errors = [];
        instance.createContainer();
        instance.setupListeners();
    }, {
        createContainer: function() {
            var instance = this,
                model = instance.model;
            model.callback = function(buttonNode) {
                var containerNode = DOCUMENT.createElement('div'),
                    contentNode = instance.panel.getElement('>div[is="content"]'),
                    messagePromise = model.messagePromise;
                containerNode = contentNode.cloneNode(true);
                // now append a copy of the buttonNode:
                containerNode.append(buttonNode.getOuterHTML());
                messagePromise.fulfill(containerNode);
                // we can safely remove the newly created container-node: the vdom holds it for 1 minute
                containerNode.remove();
            };
            instance.panel = DOCUMENT.createPanel(model);
        },
        processMessage: function(e) {
            var instance = this,
                messagePromise = e.messagePromise,
                type = e.type,
                level = MESSAGE_LEVELS[type],
                list = instance[MESSAGE_HASHES[type]];
            list[list.length] = messagePromise;
            messagePromise.finally(
                function() {
                    list.remove(messagePromise);
                    // handle the next message (if there)
                    instance.handleMessage(true);
                }
            );
            (level>instance.currentMessageLevel) && instance.handleMessage(!instance.isWaiting(), level);
        },
        setupListeners: function() {
            var instance = this;
            Event.after(['*:message', '*:warning', '*:error'], instance.processMessage.bind(instance));
        },
        isWaiting: function() {
            return (this.currentMessageLevel===0);
        },
        handleMessage: function(delay, level) {
            var instance = this,
                model = instance.model,
                messagePromise;
            if (!level) {
                // search level
                if (instance.errors.length>0) {
                    level = 3;
                }
                else if (instance.warnings.length>0) {
                    level = 2;
                }
                else if (instance.messages.length>0) {
                    level = 1;
                }
            }
            if (!level || (instance[MESSAGE_HASHES_NR[level]].length===0)) {
                // DO NOT make messagePromise null: it sould be there as return value
                // of the last message
                instance.currentMessageLevel = 0;
                model.header = null;
                model.content = '';
                model.footer = null;
                model.validate = null;
                model.visible = false;
                return;
            }
            instance.currentMessageLevel = level;
            // now process the highest message
            messagePromise = instance[MESSAGE_HASHES_NR[level]][0];
            if (delay) {
                model.visible = false;
                later(instance.showMessage.bind(instance, messagePromise), FOLLOWUP_DELAY);
            }
            else {
                async(instance.showMessage.bind(instance, messagePromise));
            }
        },
        showMessage: function(messagePromise) {
            var model = this.model;
            model.messagePromise = messagePromise;
            model.header = messagePromise.header;
            model.content = messagePromise.content;
            model.footer = messagePromise.footer;
            model.validate = messagePromise.validate;
            model.visible = true;
        }
    });

    // instantiate Dialog and make it operational:
    dialog = new Dialog();

    exportObject = {
        Dialog: Dialog,
        getNumber: function(message, defaultValue, min, max, floated, options) {
            options || (options = {});
            options.defaultValue = defaultValue;
            options.validate = function(e) {
                var buttonNode = e.button,
                    panelNode = buttonNode.inside('[plugin-panel="true"]'),
                    inputNode = panelNode.getElement('input'),
                    value = inputNode.getValue(),
                    validatesNumber = value.validateNumber(),
                    numberWithinRange = true,
                    number, validates;
                if (validatesNumber && (min || max)) {
                    number = parseInt(value, 10);
                    if (typeof min==='number') {
                        numberWithinRange = (number>=min);
                    }
                    if ((typeof max==='number') && numberWithinRange) {
                        numberWithinRange = (number<=max);
                    }
                }
                validates = validatesNumber && numberWithinRange;
                if (!validates) {
                    inputNode.focus();
                }
                return validates;
            };
            return messages.prompt(message, options);
        }
    };

    window._ITSAmodules.Dialog = exportObject;

    return exportObject;
};