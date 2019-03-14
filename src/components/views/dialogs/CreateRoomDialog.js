/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

import React from 'react';
import PropTypes from 'prop-types';
import sdk from '../../../index';
import SdkConfig from '../../../SdkConfig';
import {_t} from '../../../languageHandler';
import MatrixClientPeg from "../../../MatrixClientPeg";

export default React.createClass({
    displayName: 'CreateRoomDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
    },
    getInitialState: function () {
        return {
            joinRule: "invite",
            guestAccess: "can_join",
            history: "shared",
            encrypted: false,
        };
    },
    componentWillMount: function () {
        const config = SdkConfig.get();
        // Dialog shows inverse of m.federate (noFederate) strict false check to skip undefined check (default = true)
        this.defaultNoFederate = config.default_federate === false;
    },

    onOk: function () {
        let guestAccessState = {
                guest_access: this.state.guestAccess
        };
        let joinRuleState = {
                join_rule: this.state.joinRule
        }
        this.props.onFinished(true, this.refs.textinput.value, guestAccessState, joinRuleState,);
    },

    onCancel: function () {
        this.props.onFinished(false);
    },
    _onRoomAccessRadioToggle(ev) {
        //                         join_rule
        //                      INVITE  |  PUBLIC
        //        ----------------------+----------------
        // guest  CAN_JOIN   | inv_only | pub_with_guest
        // access ----------------------+----------------
        //        FORBIDDEN  | inv_only | pub_no_guest
        //        ----------------------+----------------

        // we always set guests can_join here as it makes no sense to have
        // an invite-only room that guests can't join.  If you explicitly
        // invite them, you clearly want them to join, whether they're a
        // guest or not.  In practice, guest_access should probably have
        // been implemented as part of the join_rules enum.
        let joinRule = "invite";
        let guestAccess = "can_join";

        switch (ev.target.value) {
            case "invite_only":
                // no change - use defaults above
                break;
            case "public_no_guests":
                joinRule = "public";
                guestAccess = "forbidden";
                break;
            case "public_with_guests":
                joinRule = "public";
                guestAccess = "can_join";
                break;
        }

        this.setState({joinRule: joinRule, guestAccess: guestAccess});


    },
    _renderRoomAccess() {
        const joinRule = this.state.joinRule;
        const guestAccess = this.state.guestAccess;
        return (
            <div>

                <label>
                    <input type="radio" name="roomVis" value="invite_only"
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule !== "public"}
                           />
                    {_t('Only people who have been invited')}
                </label>
                <label>
                    <input type="radio" name="roomVis" value="public_no_guests"
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule === "public" && guestAccess !== "can_join"}
                    />
                    {_t('Anyone who knows the room\'s link, apart from guests')}
                </label>
                <label>
                    <input type="radio" name="roomVis" value="public_with_guests"
                           onChange={this._onRoomAccessRadioToggle}
                           checked={joinRule === "public" && guestAccess === "can_join"}
                    />
                    {_t("Anyone who knows the room's link, including guests")}
                </label>
            </div>
        );
    },

    render: function () {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        return (
            <BaseDialog className="mx_CreateRoomDialog" onFinished={this.props.onFinished}
                        title={_t('Create Room')}
            >
                <form onSubmit={this.onOk}>
                    <div className="mx_Dialog_content">
                        <div className="mx_CreateRoomDialog_label">
                            <label htmlFor="textinput"> {_t('Room name (optional)')} </label>
                        </div>
                        <div className="mx_CreateRoomDialog_input_container">
                            <input id="textinput" ref="textinput" className="mx_CreateRoomDialog_input"
                                   autoFocus={true}/>
                        </div>
                        <br/>

                        <details className="mx_CreateRoomDialog_details">
                            <summary className="mx_CreateRoomDialog_details_summary">{_t('Advanced options')}</summary>
                            <div className="mx_SettingsTab mx_SecurityRoomSettingsTab">
                                <span className='mx_SettingsTab_subheading'>{_t("Who can access this room?")}</span>
                                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                                    {this._renderRoomAccess()}
                                </div>
                            </div>

                        </details>
                    </div>
                </form>
                <DialogButtons primaryButton={_t('Create Room')}
                               onPrimaryButtonClick={this.onOk}
                               onCancel={this.onCancel}/>
            </BaseDialog>
        );
    },
});
