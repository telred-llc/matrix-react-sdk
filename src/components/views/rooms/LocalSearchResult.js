/*
Copyright 2015 OpenMarket Ltd

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

'use strict';

const React = require('react');
import PropTypes from 'prop-types';
import MatrixClientPeg from '../../../MatrixClientPeg';
const sdk = require('../../../index');

module.exports = React.createClass({
    displayName: 'LocalSearchResult',

    propTypes: {
        // a matrix-js-sdk SearchResult containing the details of this result
        searchResult: PropTypes.array.isRequired,
        allRoom: PropTypes.bool,

        // a list of strings to be highlighted in the results
        // searchHighlights: PropTypes.array,

        // href for the highlights in this result
        // resultLink: PropTypes.string,

        onHeightChanged: PropTypes.func
    },

    render: function() {
        // const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const EventTile = sdk.getComponent('rooms.EventTile');
        const result = this.props.searchResult;
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        // const mxEv = result.context.getEvent();
        const ret = [];
        // ret.push([
        //     <li>
        //         <h2>Room: abc</h2>
        //     </li>
        // ]);
        const RoomSeparator = props => <h2>Room: {props.children}</h2>;

        function isNewRoom(prevRoom, currentRoom) {
            if (!prevRoom) return true;
            if (currentRoom !== prevRoom) return true;
        }

        // const timeline = result.context.getTimeline();
        for (let j = 0; j < result.length; j++) {
            const ev = result[j];
            // in case searching all rooms, needs grouping messages belong to one room
            if (this.props.allRoom) {
                const prevRoom = result[j - 1] && result[j - 1].event.room_id;
                const currentRoom = result[j].event.room_id;
                if (isNewRoom(prevRoom, currentRoom)) {
                    let room = MatrixClientPeg.get().getRoom(currentRoom);
                    ret.push(
                        <RoomSeparator key={room && room.name}>
                            {room && room.name}
                        </RoomSeparator>
                    );
                }
            }

            const ts = ev.event.origin_server_ts;
            ret.push([<DateSeparator key={ts + '-search'} ts={ts} />]);
            // if (EventTile.haveTileForEvent(ev)) {
            const resultLink = '#/room/' + ev.event.room_id + '/' + ev.getId();
            ret.push(
                <EventTile
                    key={'id-' + '+' + j}
                    mxEvent={ev}
                    // highlights={highlights}
                    permalinkCreator={this.props.permalinkCreator}
                    highlightLink={resultLink}
                    onHeightChanged={this.props.onHeightChanged}
                />
            );
            // }
        }
        return <div>{ret}</div>;
    }
});
