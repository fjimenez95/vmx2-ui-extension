import React from 'react';

function StatusBar(props) {

    return (
        <div className='statusBar'>
            <p id="status-line">Hi, <span className="bold-text">{props.fullName}</span>. You currently have <span className="bold-text">{props.totalUnread}</span> unread {(props.totalUnread === 1) ? "voicemail" : "voicemails"}.</p>
        </div>
    )
}

export default StatusBar