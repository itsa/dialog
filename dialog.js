"use strict";
/**
 * Defines a dialog-panel to display messages.
 * Every message that fulfills will get the dialog-content as well as the pressed button as return.
 *
 *
 * <i>Copyright (c) 2014 ITSA - https://github.com/itsa</i>
 * New BSD License - http://choosealicense.com/licenses/bsd-3-clause/
 *
 *
 * @module dialog
 * @class Dialog
 * @since 0.0.1
*/

require('js-ext');
require('polyfill');
require('./css/dialog.css');

var NAME = '[dialog]: ',
    MESSAGE_LEVELS = {
        'message': 1,
        'warn': 2,
        'error': 3
    },
    MESSAGE_HASHES = {
        'message': 'messages',
        'warn': 'warnings',
        'error': 'errors'
    },
    MESSAGE_HASHES_NR = {
        1: 'messages',
        2: 'warnings',
        3: 'errors'
    },
    FOLLOWUP_DELAY = 150,
    createHashMap = require('js-ext/extra/hashmap.js').createMap;

module.exports = function (window) {

    var DOCUMENT = window.document,
        Classes = require('js-ext/extra/classes.js'),
        UTILS = require('utils'),
        later = UTILS.later,
        async = UTILS.async,
        dialog, Dialog, Event;

    window._ITSAmodules || Object.protectedProp(window, '_ITSAmodules', createHashMap());

/*jshint boss:true */
    if (Dialog=window._ITSAmodules.Dialog) {
/*jshint boss:false */
        return Dialog; // Dialog was already created
    }

    require('panel')(window);
    Event = require('itsa-event');

    /**
     * Model that is passed through to the Panel.
     *
     * @property model
     * @default {
            draggable: true
       }
     * @type Object
     * @since 0.0.1
     */

    /**
     * Internal property that tells what message-level is currently active.
     *
     * @property _currentMessageLevel
     * @default 0
     * @type Number
     * @private
     * @since 0.0.1
     */

    /**
     * Internal hash all queued message with level=1 (*:message)
     *
     * @property messages
     * @default []
     * @type Array
     * @since 0.0.1
     */

    /**
     * Internal hash all queued message with level=2 (*:warn)
     *
     * @property warnings
     * @default []
     * @type Array
     * @since 0.0.1
     */

    /**
     * Internal hash all queued message with level=3 (*:error)
     *
     * @property errors
     * @default []
     * @type Array
     * @since 0.0.1
     */
    Dialog = Classes.createClass(function() {
        var instance = this;
        instance.model = {
            draggable: true
        };
        instance._currentMessageLevel = 0;
        instance.messages = [];
        instance.warnings = [];
        instance.errors = [];
        instance.createContainer();
        instance.setupListeners();
    }, {

       /**
         * Creates a Panel-instance that will be used to display the messages.
         * Sets instance.model as panel's model and defines model.callback
         * which fulfills the message when a button on the dialog is pressed,
         *
         * @method createContainer
         * @since 0.0.1
         */
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

       /**
         * Processes messages that are emitted by `messages`-module and add them in the queue.
         *
         * @method queueMessage
         * @param e {Object} the eventobject
         * @since 0.0.1
         */
        queueMessage: function(e) {
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
            (level>instance._currentMessageLevel) && instance.handleMessage(!instance.isWaiting(), level);
        },

       /**
         * Defines subscribers to the events: *:message, *:warn and *:error.
         *
         * @method setupListeners
         * @since 0.0.1
         */
        setupListeners: function() {
            var instance = this;
            Event.after(['*:message', '*:warn', '*:error'], instance.queueMessage.bind(instance));
        },

       /**
         * Tells whether `dialog` is waitin g for new messages and is currently iddle.
         *
         * @method isWaiting
         * @return {Boolean} whether `dialog` is waitin g for new messages
         * @since 0.0.1
         */
        isWaiting: function() {
            return (this._currentMessageLevel===0);
        },

       /**
         * Retrieves the next message from the queue and calls showMessage() if it finds one.
         *
         * @method handleMessage
         * @param [delay] {Boolean} if there should be a delay between the previous dialog and the new one
         * @param [level] {Number} to force handling a specific level
         * @since 0.0.1
         */
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
                instance._currentMessageLevel = 0;
                model.header = null;
                model.content = '';
                model.footer = null;
                model.validate = null;
                model.visible = false;
                return;
            }
            instance._currentMessageLevel = level;
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

       /**
         * Shows the specified message-promise.
         *
         * @method showMessage
         * @param messagePromise {Promise} the message to be shown.
         * @since 0.0.1
         */
        showMessage: function(messagePromise) {
            var model = this.model;
            window.scrollTo(0, 0);
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

    window._ITSAmodules.Dialog = Dialog;

    return Dialog;
};