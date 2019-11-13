/*
Copyright 2015, 2016 OpenMarket Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

/*
 * Usage:
 * Modal.createTrackedDialog('An Identifier', 'some detail', ErrorDialog, {
 *   title: "some text", (default: "Error")
 *   description: "some more text",
 *   button: "Button Text",
 *   onFinished: someFunction,
 *   focus: true|false (default: true)
 * });
 */

import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import dis from '../../../dispatcher';
import { _t } from '../../../languageHandler';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Modal from '../../../Modal';

export default createReactClass({
    displayName: 'ErrorDialog',
    propTypes: {
        title: PropTypes.string,
        description: PropTypes.oneOfType([
            PropTypes.element,
            PropTypes.string,
        ]),
        button: PropTypes.string,
        focus: PropTypes.bool,
        onFinished: PropTypes.func.isRequired,
        // Check if the room is empty
        isEmptyRoom: PropTypes.bool,
        roomId: PropTypes.string
    },

    _leaveEmptyRoom() {
        MatrixClientPeg.get().leave(this.props.roomId).done(function() {
            dis.dispatch({ action: 'view_next_room' });
        }, function(error) {
            console.error("Failed to reject invite: %s", error);

            const msg = error.message ? error.message : JSON.stringify(error);
            const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createTrackedDialog('Failed to reject invite', '', ErrorDialog, {
                title: _t("Failed to reject invite"),
                description: msg,
            });
        })
    },

    _onFinished() {
        if (this.props.isEmptyRoom) {
            this._leaveEmptyRoom()
        }
        this.props.onFinished()
    },

    getDefaultProps: function() {
        return {
            focus: true,
            title: null,
            description: null,
            button: null,
        };
    },

    render: function() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className="mx_ErrorDialog" onFinished={this.props.onFinished}
                    title={this.props.title || _t('Error')}
                    contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    { this.props.description || _t('An error has occurred.') }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this._onFinished} autoFocus={this.props.focus}>
                        { this.props.button || _t('OK') }
                    </button>
                </div>
            </BaseDialog>
        );
    },
});
