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
import {_t} from '../../../languageHandler';
import RoomListStore from "../../../stores/RoomListStore";
import classNames from "classnames";
import dis from "../../../dispatcher";

export default React.createClass({

    displayName: 'ForwardMessageDialog',
    propTypes: {
        onFinished: PropTypes.func.isRequired,
        forwardingEvent: PropTypes.object.isRequired,
    },

    getInitialState: function () {
        return {
            roomList: [],
            searchFilter: []
        };
    },

    async componentDidMount() {
        const room = await RoomListStore.getRoomLists();
        const listResult = [];
        for (const key of Object.keys(room)) {
            if (room[key].length > 0) {
                room[key].forEach(e => {
                    e.sent = false;
                    listResult.push(e);
                });
            }
        }
        this.setState({ roomList: listResult, searchFilter: listResult });
    },



    onCancel: function () {
        this.props.onFinished(false);
    },

    onFilterChange: function(alias) {
        if (String(alias).trim().length > 0) {
            const lcFilter = String(alias).trim().toLowerCase();
            this.setState({ searchFilter: this._applySearchFilter(this.state.roomList, lcFilter) });
        } else {
            this.setState({ searchFilter: this.state.roomList});
        }
    },

    _applySearchFilter: function(list, filter) {
        if (filter === "") return list;
        const lcFilter = filter.toLowerCase();
        // case insensitive if room name includes filter,
        // or if starts with `#` and one of room's aliases starts with filter
        return list.filter((room) => (room.name && room.name.toLowerCase().includes(lcFilter)) ||
            (filter[0] === '#' && room.getAliases().some((alias) => alias.toLowerCase().startsWith(lcFilter))));
    },

    onForwardClick: function(e) {
        console.log(e);
        const roomElementId = e.roomId;
        const newRoomList = this.state.roomList.map(item => {
            console.log(item.roomId);
            if (item.roomId == roomElementId) item.sent = true;
            return item;
        });
        console.log("New Room List: ");
        console.log(newRoomList);
        this.setState({roomList: newRoomList});
        dis.dispatch({
            action: 'send_event',
            room_id: roomElementId,
            event: this.props.forwardingEvent,
        });
    },

    render: function () {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const SearchBox = sdk.getComponent('structures.SearchBox');
        const RoomAvatar = sdk.getComponent('avatars.RoomAvatar');

        const avatarClasses = classNames({
            'mx_RoomTile_avatar': true,
        });
        const roomAvatar = [];

        this.state.searchFilter.forEach(item => {
            const button = item.sent ? <button disabled={true} style={{color: "black"}}>Sent</button> :
                <button style={{color: "red"}} onClick={ this.onForwardClick.bind(this, item) }>Send</button>;
            roomAvatar.push(
                <div key={item.roomId} style={{inline: true}}>
                    <span className={avatarClasses}>
                        <RoomAvatar room={item} width={50} height={50} />
                    </span>
                    <span><b> {item.name} </b></span>
                    {button}
                </div>
            );
        });

        return (
            <BaseDialog
                className={'mx_RoomDirectory_dialog'}
                hasCancel={true}
                onFinished={this.props.onFinished}
                title={_t("Forward Message")}
            >
                <div style={{padding: ' 0px 20px 20px' }}>

                        <SearchBox className="mx_textinput_icon mx_textinput_search"
                                       placeholder={ _t('Filter room names') }
                                       onSearch={ this.onFilterChange } style={{border: '1px solid black' }} />

                        <div>
                            {roomAvatar}
                        </div>

                </div>
            </BaseDialog>
        );
    },
});
