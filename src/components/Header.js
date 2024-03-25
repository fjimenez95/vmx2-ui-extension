import React from 'react';
import Button from "@cloudscape-design/components/button";
import Logo from '../assets/visualvoicemaillogo-white.png';


function Header(props) {

    return (
        <div className='Header'>
            <img src={Logo} height="35px" alt="Visual Voicemail for Amazon Connect" />
            <div className="header-name"><span id="ember-light">Signed in as &nbsp;</span>{props.fullName}</div>
            <Button iconName="close" variant="primary" onClick={props.signOut}>Sign out</Button>
        </div>
    )
}


export default Header