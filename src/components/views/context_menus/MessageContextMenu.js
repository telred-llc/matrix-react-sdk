/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import createReactClass from 'create-react-class';
import {EventStatus} from 'matrix-js-sdk';

import MatrixClientPeg from '../../../MatrixClientPeg';
import dis from '../../../dispatcher';
import sdk from '../../../index';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import Resend from '../../../Resend';
import SettingsStore from '../../../settings/SettingsStore';
import { isUrlPermitted } from '../../../HtmlUtils';
import { isContentActionable } from '../../../utils/EventUtils';
import DMRoomMap from '../../../utils/DMRoomMap';

function canCancel(eventStatus) {
    return eventStatus === EventStatus.QUEUED || eventStatus === EventStatus.NOT_SENT;
}

module.exports = createReactClass({
    displayName: 'MessageContextMenu',

    propTypes: {
        /* the MatrixEvent associated with the context menu */
        mxEvent: PropTypes.object.isRequired,

        /* an optional EventTileOps implementation that can be used to unhide preview widgets */
        eventTileOps: PropTypes.object,

        /* an optional function to be called when the user clicks collapse thread, if not provided hide button */
        collapseReplyThread: PropTypes.func,

        /* callback called when the menu is dismissed */
        onFinished: PropTypes.func
    },

    getInitialState: function() {
        return {
            canRedact: false,
            canPin: false
        };
    },
    _isDirectMessageRoom: function(roomId) {
        const dmRooms = DMRoomMap.shared().getUserIdForRoomId(roomId);
        return Boolean(dmRooms);
    },
    _isAuthorOfMessage: function() {
        const cli = MatrixClientPeg.get();
        return this.props.mxEvent.sender.userId === cli.credentials.userId;
    },

    componentWillMount: function() {
        MatrixClientPeg.get().on('RoomMember.powerLevel', this._checkPermissions);
        this._checkPermissions();
    },

    componentWillUnmount: function() {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener('RoomMember.powerLevel', this._checkPermissions);
        }
    },

    _checkPermissions: function() {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());

        const canRedact = room.currentState.maySendRedactionForEvent(
            this.props.mxEvent,
            cli.credentials.userId
        );
        let canPin = room.currentState.mayClientSendStateEvent('m.room.pinned_events', cli);

        // HACK: Intentionally say we can't pin if the user doesn't want to use the functionality
        if (!SettingsStore.isFeatureEnabled('feature_pinning')) canPin = false;

        this.setState({ canRedact, canPin });
    },

    _isPinned: function() {
        const room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());
        const pinnedEvent = room.currentState.getStateEvents('m.room.pinned_events', '');
        if (!pinnedEvent) return false;
        return pinnedEvent.getContent().pinned.includes(this.props.mxEvent.getId());
    },

    onResendClick: function() {
        Resend.resend(this.props.mxEvent);
        this.closeMenu();
    },

    onResendEditClick: function() {
        Resend.resend(this.props.mxEvent.replacingEvent());
        this.closeMenu();
    },

    onResendRedactionClick: function() {
        Resend.resend(this.props.mxEvent.localRedactionEvent());
        this.closeMenu();
    },

    onResendReactionsClick: function() {
        for (const reaction of this._getUnsentReactions()) {
            Resend.resend(reaction);
        }
        this.closeMenu();
    },

    e2eInfoClicked: function() {
        this.props.e2eInfoCallback();
        this.closeMenu();
    },

    onReportEventClick: function() {
        const ReportEventDialog = sdk.getComponent("dialogs.ReportEventDialog");
        Modal.createTrackedDialog('Report Event', '', ReportEventDialog, {
            mxEvent: this.props.mxEvent,
        }, 'mx_Dialog_reportEvent');
        this.closeMenu();
    },

    onViewSourceClick: function() {
        const ViewSource = sdk.getComponent('structures.ViewSource');
        Modal.createTrackedDialog(
            'View Event Source',
            '',
            ViewSource,
            {
                roomId: this.props.mxEvent.getRoomId(),
                eventId: this.props.mxEvent.getId(),
                content: this.props.mxEvent.event
            },
            'mx_Dialog_viewsource'
        );
        this.closeMenu();
    },

    onViewClearSourceClick: function() {
        const ViewSource = sdk.getComponent('structures.ViewSource');
        Modal.createTrackedDialog(
            'View Clear Event Source',
            '',
            ViewSource,
            {
                roomId: this.props.mxEvent.getRoomId(),
                eventId: this.props.mxEvent.getId(),
                // FIXME: _clearEvent is private
                content: this.props.mxEvent._clearEvent
            },
            'mx_Dialog_viewsource'
        );
        this.closeMenu();
    },

    onRedactClick: function() {
        const ConfirmRedactDialog = sdk.getComponent('dialogs.ConfirmRedactDialog');
        Modal.createTrackedDialog(
            'Confirm Redact Dialog',
            '',
            ConfirmRedactDialog,
            {
                onFinished: async proceed => {
                    if (!proceed) return;

                    const cli = MatrixClientPeg.get();
                    try {
                        await cli.redactEvent(
                            this.props.mxEvent.getRoomId(),
                            this.props.mxEvent.getId()
                        );
                    } catch (e) {
                        const code = e.errcode || e.statusCode;
                        // only show the dialog if failing for something other than a network error
                        // (e.g. no errcode or statusCode) as in that case the redactions end up in the
                        // detached queue and we show the room status bar to allow retry
                        if (typeof code !== 'undefined') {
                            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
                            // display error message stating you couldn't delete this.
                            Modal.createTrackedDialog(
                                'You cannot delete this message',
                                '',
                                ErrorDialog,
                                {
                                    title: _t('Error'),
                                    description: _t('You cannot delete this message. (%(code)s)', {
                                        code
                                    })
                                }
                            );
                        }
                    }
                }
            },
            'mx_Dialog_confirmredact'
        );
        this.closeMenu();
    },

    onCancelSendClick: function() {
        const mxEvent = this.props.mxEvent;
        const editEvent = mxEvent.replacingEvent();
        const redactEvent = mxEvent.localRedactionEvent();
        const pendingReactions = this._getPendingReactions();

        if (editEvent && canCancel(editEvent.status)) {
            Resend.removeFromQueue(editEvent);
        }
        if (redactEvent && canCancel(redactEvent.status)) {
            Resend.removeFromQueue(redactEvent);
        }
        if (pendingReactions.length) {
            for (const reaction of pendingReactions) {
                Resend.removeFromQueue(reaction);
            }
        }
        if (canCancel(mxEvent.status)) {
            Resend.removeFromQueue(this.props.mxEvent);
        }
        this.closeMenu();
    },

    onForwardClick: function() {
        dis.dispatch({
            action: 'forward_event',
            event: this.props.mxEvent
        });
        this.closeMenu();
    },

    onCopyClick: function(e) {
        const { mxEvent } = this.props;

        const text = mxEvent._replacingEvent
            ? mxEvent._replacingEvent._clearEvent.content.body.slice(3)
            : (mxEvent._clearEvent.content) ? mxEvent._clearEvent.content.body : mxEvent.event.content.body;

        var textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('Copy');
        textArea.remove();

        const target = e.target;
        target.style.color = '#33b37f';
        target.textContent = 'Copied!';
        setTimeout(() => {
            target.style.color = 'black';
            target.textContent = 'Copy';
            this.closeMenu();
        }, 500);
    },

    onPinClick: function() {
        MatrixClientPeg.get()
            .getStateEvent(this.props.mxEvent.getRoomId(), 'm.room.pinned_events', '')
            .catch(e => {
                // Intercept the Event Not Found error and fall through the promise chain with no event.
                if (e.errcode === 'M_NOT_FOUND') return null;
                throw e;
            })
            .then(event => {
                const eventIds = (event ? event.pinned : []) || [];
                if (!eventIds.includes(this.props.mxEvent.getId())) {
                    // Not pinned - add
                    eventIds.push(this.props.mxEvent.getId());
                } else {
                    // Pinned - remove
                    eventIds.splice(eventIds.indexOf(this.props.mxEvent.getId()), 1);
                }

                const cli = MatrixClientPeg.get();
                cli.sendStateEvent(
                    this.props.mxEvent.getRoomId(),
                    'm.room.pinned_events',
                    { pinned: eventIds },
                    ''
                );
            });
        this.closeMenu();
    },

    closeMenu: function() {
        if (this.props.onFinished) this.props.onFinished();
    },

    onUnhidePreviewClick: function() {
        if (this.props.eventTileOps) {
            this.props.eventTileOps.unhideWidget();
        }
        this.closeMenu();
    },

    onQuoteClick: function() {
        dis.dispatch({
            action: 'quote',
            event: this.props.mxEvent
        });
        this.closeMenu();
    },

    onPermalinkClick: function(e: Event) {
        e.preventDefault();
        const ShareDialog = sdk.getComponent('dialogs.ShareDialog');
        Modal.createTrackedDialog('share room message dialog', '', ShareDialog, {
            target: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator
        });
        this.closeMenu();
    },

    onCollapseReplyThreadClick: function() {
        this.props.collapseReplyThread();
        this.closeMenu();
    },

    _getReactions(filter) {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const eventId = this.props.mxEvent.getId();
        return room.getPendingEvents().filter(e => {
            const relation = e.getRelation();
            return (
                relation &&
                relation.rel_type === 'm.annotation' &&
                relation.event_id === eventId &&
                filter(e)
            );
        });
    },

    _getPendingReactions() {
        return this._getReactions(e => canCancel(e.status));
    },

    _getUnsentReactions() {
        return this._getReactions(e => e.status === EventStatus.NOT_SENT);
    },

    render: function() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');

        const cli = MatrixClientPeg.get();
        const me = cli.getUserId();
        const mxEvent = this.props.mxEvent;

        const eventStatus = mxEvent.status;
        const editStatus = mxEvent.replacingEvent() && mxEvent.replacingEvent().status;
        const redactStatus = mxEvent.localRedactionEvent() && mxEvent.localRedactionEvent().status;
        const unsentReactionsCount = this._getUnsentReactions().length;
        const pendingReactionsCount = this._getPendingReactions().length;
        const allowCancel =
            canCancel(mxEvent.status) ||
            canCancel(editStatus) ||
            canCancel(redactStatus) ||
            pendingReactionsCount !== 0;
        let resendButton;
        let resendEditButton;
        let resendReactionsButton;
        let resendRedactionButton;
        let redactButton;
        let cancelButton;
        let forwardButton;
        let copyButton;
        let pinButton;
        let viewClearSourceButton;
        let unhidePreviewButton;
        let externalURLButton;
        let quoteButton;
        let collapseReplyThread;

        // status is SENT before remote-echo, null after
        const isSent = !eventStatus || eventStatus === EventStatus.SENT;
        if (!mxEvent.isRedacted()) {
            if (eventStatus === EventStatus.NOT_SENT) {
                resendButton = (
                    <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onResendClick}>
                        { _t('Resend') }
                    </AccessibleButton>
                );
            }

            if (editStatus === EventStatus.NOT_SENT) {
                resendEditButton = (
                    <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onResendEditClick}>
                        { _t('Resend edit') }
                    </AccessibleButton>
                );
            }

            if (unsentReactionsCount !== 0) {
                resendReactionsButton = (
                    <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onResendReactionsClick}>
                        { _t('Resend %(unsentCount)s reaction(s)', {unsentCount: unsentReactionsCount}) }
                    </AccessibleButton>
                );
            }
        }

        if (redactStatus === EventStatus.NOT_SENT) {
            resendRedactionButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onResendRedactionClick}>
                    { _t('Resend removal') }
                </AccessibleButton>
            );
        }

        if (isSent && this.state.canRedact) {
            redactButton =
                this._isDirectMessageRoom(this.props.mxEvent.event.room_id) &&
                !this._isAuthorOfMessage() ? null : (
                    <div className="mx_MessageContextMenu_field" onClick={this.onRedactClick}>
                        {_t('Remove')}
                    </div>
                );
        }

        if (allowCancel) {
            cancelButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onCancelSendClick}>
                    { _t('Cancel Sending') }
                </AccessibleButton>
            );
        }

        if (isContentActionable(mxEvent)) {
            forwardButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onForwardClick}>
                    { _t('Forward Message') }
                </AccessibleButton>
            );
            if (this.state.canPin) {
                pinButton = (
                    <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onPinClick}>
                        { this._isPinned() ? _t('Unpin Message') : _t('Pin Message') }
                    </AccessibleButton>
                );
            }
        }

        const shoudldHaveCopyButton = mxEvent => {
            if (mxEvent._clearEvent.content) {
                return mxEvent._clearEvent.content.msgtype === 'm.text'
            }

            if (mxEvent.event.content) {
                return mxEvent.event.content.msgtype === 'm.text'
            }

            return false;
        }

        if (shoudldHaveCopyButton(mxEvent)) {
            copyButton = (
                <div className="mx_MessageContextMenu_field" onClick={this.onCopyClick}>
                    {'Copy'}
                </div>
            );
        }

        const viewSourceButton = (
            <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onViewSourceClick}>
                { _t('View Source') }
            </AccessibleButton>
        );

        if (mxEvent.getType() !== mxEvent.getWireType()) {
            viewClearSourceButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onViewClearSourceClick}>
                    { _t('View Decrypted Source') }
                </AccessibleButton>
            );
        }

        if (this.props.eventTileOps) {
            if (this.props.eventTileOps.isWidgetHidden()) {
                unhidePreviewButton = (
                    <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onUnhidePreviewClick}>
                        { _t('Unhide Preview') }
                    </AccessibleButton>
                );
            }
        }

        let permalink;
        if (this.props.permalinkCreator) {
            permalink = this.props.permalinkCreator.forEvent(this.props.mxEvent.getId());
        }
        // XXX: if we use room ID, we should also include a server where the event can be found (other than in the domain of the event ID)
        const permalinkButton = (
            <AccessibleButton className="mx_MessageContextMenu_field">
                <a href={permalink} target="_blank" rel="noopener" onClick={this.onPermalinkClick} tabIndex={-1}>
                    { mxEvent.isRedacted() || mxEvent.getType() !== 'm.room.message'
                        ? _t('Share Permalink') : _t('Share Message') }
                </a>
            </AccessibleButton>
        );

        if (this.props.eventTileOps && this.props.eventTileOps.getInnerText) {
            quoteButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onQuoteClick}>
                    { _t('Quote') }
                </AccessibleButton>
            );
        }

        // Bridges can provide a 'external_url' to link back to the source.
        if (
            typeof mxEvent.event.content.external_url === 'string' &&
            isUrlPermitted(mxEvent.event.content.external_url)
        ) {
            externalURLButton = (
                <AccessibleButton className="mx_MessageContextMenu_field">
                    <a
                        href={mxEvent.event.content.external_url}
                        target="_blank"
                        rel="noopener"
                        onClick={this.closeMenu}
                        tabIndex={-1}
                    >
                        { _t('Source URL') }
                    </a>
                </AccessibleButton>
          );
        }

        if (this.props.collapseReplyThread) {
            collapseReplyThread = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onCollapseReplyThreadClick}>
                    { _t('Collapse Reply Thread') }
                </AccessibleButton>
            );
        }

        let e2eInfo;
        if (this.props.e2eInfoCallback) {
            e2eInfo = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.e2eInfoClicked}>
                    { _t('End-to-end encryption information') }
                </AccessibleButton>
            );
        }

        let reportEventButton;
        if (mxEvent.getSender() !== me) {
            reportEventButton = (
                <AccessibleButton className="mx_MessageContextMenu_field" onClick={this.onReportEventClick}>
                    { _t('Report Content') }
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_MessageContextMenu">
                { resendButton }
                { resendEditButton }
                { resendReactionsButton }
                { resendRedactionButton }
                { redactButton }
                { cancelButton }
                { forwardButton }
                { pinButton }
                { viewSourceButton }
                { viewClearSourceButton }
                { unhidePreviewButton }
                { permalinkButton }
                { quoteButton }
                { externalURLButton }
                { collapseReplyThread }
                { e2eInfo }
                { reportEventButton }
                { copyButton }
            </div>
        );
    }
});
