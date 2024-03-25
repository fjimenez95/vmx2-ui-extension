import React, { useRef } from 'react';
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";

function AudioPlayer(props) {
    const clickRef = useRef();

    const playPause = () => {
        if(props.currentSong.length) {
            props.setIsPlaying(!props.isPlaying);
        } else {
            props.setIsPlaying(!props.isPlaying);
        }
    }

    const playPlaceholder = () => {
        console.log("No song selected")
    }

    const checkWidth = (e) => {
        let width = clickRef.current.clientWidth;
        const offset = e.nativeEvent.offsetX;

        const divprogress = offset / width * 100;
        props.audioElem.current.currentTime = divprogress / 100 * props.currentSongTime.length;
    }
    
    const skipBack = () => {
        const index = props.filteredVoicemailList.findIndex(x=>x.contactId === props.currentSong.contactId);
        if (index === 0) {
            props.setCurrentSong(props.filteredVoicemailList[props.filteredVoicemailList.length - 1])
        }
        else {
            props.setCurrentSong(props.filteredVoicemailList[index - 1])
        }
        props.audioElem.current.currentTime = 0;
        props.currentSongTime.progress = 0;
    }

    const skiptoNext = () => {
        const index = props.filteredVoicemailList.findIndex(x=>x.contactId === props.currentSong.contactId);

        if (index === props.filteredVoicemailList.length-1) {
            props.setCurrentSong(props.filteredVoicemailList[0])
            props.setSelectedItems([props.filteredVoicemailList[0]])
        }
        else { 
            props.setCurrentSong(props.filteredVoicemailList[index + 1])
            props.setSelectedItems([props.filteredVoicemailList[index + 1]])
        }
        props.audioElem.current.currentTime = 0;
        props.currentSongTime.progress = 0;
  }

    return (
        <div className="audio-player">
             <Container
                footer={ props.currentSong.transcript ?
                    <div>
                        <Header
                        variant="h3"
                        description="Powered by Amazon Transcribe"
                        >
                        Transcript
                        </Header>
                        <div className="transcript-container">
                            <div>{props.currentSong.transcript}</div>
                        </div>
                    </div>
                    :
                    <div>Select a voicemail to see transcript</div>
                }
                header={
                    <Header
                    variant="h2"
                    description={props.currentSong.contactId}
                    >
                    Now playing
                    </Header>
                }
                >
                <div className="audio-player-inside">
                    <div className="controls">
                            <button className='btn-action' id="button-back" onClick={skipBack}></button>
                            {props.isPlaying ? <button className='btn-action' id="button-pause" onClick={playPause}/> : <button className='btn-action'  id="button-play" onClick={props.currentSong.presigned_url === "" ? playPlaceholder : playPause}/>}
                            <button className='btn-action' id="button-next" onClick={skiptoNext}/>        
                    </div>
                    <div className="navigation">
                        <div className="navigationwrapper" onClick={checkWidth} ref={clickRef}>
                            <div className="seekbar" style={{width: `${props.currentSongTime.progress+"%"}`}}></div>
                        </div>
                        <div className="timers">
                            <div>{props.currentSongTime.progress !== 0  ? <div>{props.currentSongTime.progressmmss}</div> : "00:00"}</div>
                            <div>{props.currentSongTime.length !== 0 ? <div id="timers-end">{props.currentSongTime.lengthmmss}</div> : "00:00"}</div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    )
}


export default AudioPlayer





