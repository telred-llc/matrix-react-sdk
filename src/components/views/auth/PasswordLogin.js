/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2019 New Vector Ltd.

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
import classNames from 'classnames';
import sdk from '../../../index';
import {_t} from '../../../languageHandler';
import SdkConfig from '../../../SdkConfig';
import {ValidatedServerConfig} from '../../../utils/AutoDiscoveryUtils';

/**
 * A pure UI component which displays a username/password form.
 */
export default class PasswordLogin extends React.Component {
    static propTypes = {
        onSubmit: PropTypes.func.isRequired, // fn(username, password)
        onError: PropTypes.func,
        onForgotPasswordClick: PropTypes.func, // fn()
        initialUsername: PropTypes.string,
        initialPassword: PropTypes.string,
        onUsernameChanged: PropTypes.func,
        onPasswordChanged: PropTypes.func,
        loginIncorrect: PropTypes.bool,
        disableSubmit: PropTypes.bool,
        serverConfig: PropTypes.instanceOf(ValidatedServerConfig).isRequired
    };

    static defaultProps = {
        onError: function () {
        },
        onEditServerDetailsClick: null,
        onUsernameChanged: function () {
        },
        onUsernameBlur: function () {
        },
        onPasswordChanged: function () {
        },
        initialUsername: '',
        initialPassword: '',
        loginIncorrect: false,
        disableSubmit: false
    };

    static LOGIN_FIELD_EMAIL = 'login_field_email';
    static LOGIN_FIELD_MXID = 'login_field_mxid';

    constructor(props) {
        super(props);
        this.state = {
            username: this.props.initialUsername,
            password: this.props.initialPassword,
            loginType: PasswordLogin.LOGIN_FIELD_MXID
        };

        this.onForgotPasswordClick = this.onForgotPasswordClick.bind(this);
        this.onSubmitForm = this.onSubmitForm.bind(this);
        this.onUsernameChanged = this.onUsernameChanged.bind(this);
        this.onUsernameBlur = this.onUsernameBlur.bind(this);
        this.onLoginTypeChange = this.onLoginTypeChange.bind(this);
        this.onPasswordChanged = this.onPasswordChanged.bind(this);
        this.isLoginEmpty = this.isLoginEmpty.bind(this);
    }

    onForgotPasswordClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this.props.onForgotPasswordClick();
    }

    onSubmitForm(ev) {
        ev.preventDefault();

        let username = ''; // XXX: Synapse breaks if you send null here:
        let phoneCountry = null;
        let phoneNumber = null;
        let error;

        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
                username = this.state.username;
                if (!username) {
                    error = _t('The email field must not be blank.');
                }
                break;
            case PasswordLogin.LOGIN_FIELD_MXID:
                username = this.state.username;
                if (!username) {
                    error = _t('The username field must not be blank.');
                }
                break;
        }

        if (error) {
            this.props.onError(error);
            return;
        }

        if (!this.state.password) {
            this.props.onError(_t('The password field must not be blank.'));
            return;
        }

        this.props.onSubmit(
            username,
            phoneCountry,
            phoneNumber,
            this.state.password
        );
    }

    onUsernameChanged(ev) {
        this.setState({username: ev.target.value});
        this.props.onUsernameChanged(ev.target.value);
    }

    onUsernameBlur(ev) {
        this.props.onUsernameBlur(ev.target.value);
    }

    onLoginTypeChange(ev) {
        const loginType = ev.target.value;
        this.props.onError(null); // send a null error to clear any error messages
        this.setState({
            loginType: loginType,
            username: '' // Reset because email and username use the same state
        });
    }

    onPasswordChanged(ev) {
        this.setState({password: ev.target.value});
        this.props.onPasswordChanged(ev.target.value);
    }

    renderLoginField(loginType) {
        const Field = sdk.getComponent('elements.Field');

        const classes = {};

        classes.error =
            this.props.loginIncorrect && !this.state.username;
        return (
            <Field
                className={classNames(classes)}
                id='mx_PasswordLogin_email'
                name='username' // make it a little easier for browser's remember-password
                key='email_input'
                type='text'
                label={_t('Username')}
                placeholder='username'
                value={this.state.username}
                onChange={this.onUsernameChanged}
                onBlur={this.onUsernameBlur}
                autoFocus
            />
        );
    }

    isLoginEmpty() {
        switch (this.state.loginType) {
            case PasswordLogin.LOGIN_FIELD_EMAIL:
            case PasswordLogin.LOGIN_FIELD_MXID:
                return !this.state.username;
        }
    }

    render() {
        const Field = sdk.getComponent('elements.Field');

        let forgotPasswordJsx;

        if (this.props.onForgotPasswordClick) {
            forgotPasswordJsx = (
                <span>
                    {_t(
                        'Not sure of your password? <a>Set a new one</a>',
                        {},
                        {
                            a: sub => (
                                <a
                                    className='mx_Login_forgot'
                                    onClick={this.onForgotPasswordClick}
                                    href='#'
                                >
                                    {sub}
                                </a>
                            )
                        }
                    )}
                </span>
            );
        }

        if (this.props.serverConfig.hsNameIsDifferent) {
            const TextWithTooltip = sdk.getComponent(
                'elements.TextWithTooltip'
            );
        }
        const pwFieldClass = classNames({
            error: this.props.loginIncorrect && !this.isLoginEmpty() // only error password if error isn't top field
        });

        const loginField = this.renderLoginField(this.state.loginType);

        return (
            <div>
                <form onSubmit={this.onSubmitForm}>
                    {loginField}
                    <Field
                        className={pwFieldClass}
                        id='mx_PasswordLogin_password'
                        type='password'
                        name='password'
                        label={_t('Password')}
                        value={this.state.password}
                        onChange={this.onPasswordChanged}
                    />
                    {forgotPasswordJsx}
                    <input
                        className='mx_Login_submit'
                        type='submit'
                        value={_t('Sign in')}
                        disabled={this.props.disableSubmit}
                    />
                </form>
            </div>
        );
    }
}
