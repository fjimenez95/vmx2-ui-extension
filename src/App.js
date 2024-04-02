// Version: 2024.03.28
/*
 **********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved                                            *
 *                                                                                                                    *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated      *
 *  documentation files (the "Software"), to deal in the Software without restriction, including without limitation   *
 *  the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and  *
 *  to permit persons to whom the Software is furnished to do so.                                                     *
 *                                                                                                                    *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO  *
 *  THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE    *
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF         *
 *  CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS *
 *  IN THE SOFTWARE.                                                                                                  *
 **********************************************************************************************************************
 */

import { useState, useRef, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import StatusBar from './components/StatusBar';
import VoicemailTable from './components/VoicemailTable';
import AudioPlayer from './components/AudioPlayer';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { withAuthenticator } from '@aws-amplify/ui-react'
import { fetchAuthSession } from 'aws-amplify/auth';

function App({ signOut, user }) {
  const API_URL = process.env.REACT_APP_API_URL
  const [voicemailList, setVoicemailList] = useState([])
  const [filteredVoicemailList, setFilteredVoicemailList] = useState([])
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState({"contactId":"No voicemail selected"});
  const [currentSongTime, setCurrentSongTime] = useState({"progress": 0, "length": 0, "progressmmss": '00:00', "lengthmmss": "00:00"});
  const [onload, setOnload] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [totalUnread, setTotalUnread] = useState("");
  const [filteringText, setFilteringText] = useState("")
  const [visibleDeleteModal, setVisibleDeleteModal] = useState(false);
  const [visibleDeleteLoadingButton, setVisibleDeleteLoadingButton] = useState(false);
  const [currPageIndex, setCurrPageIndex] = useState(1);
  const [splicedList, setSplicedList] = useState([]);
  const [pageCount, setPageCount] = useState(splicedList.length);
  const [countTextVisible, setCountTextVisible] = useState(false);
  const [globalUsername, setGlobalUsername] = useState("")
  const [globalUserId, setGlobalUserId] = useState("")
  const [globalName, setGlobalName] = useState("")
  const audioElem = useRef(0);

  // HANDLES AUDIO ELEMENT AND PLAYER TIME
  const onPlaying = async () => {
    const duration = audioElem.current.duration;
    const ct = audioElem.current.currentTime;
    console.log("AUDIOELEM", audioElem)
    if (duration > 0) {
      var time_duration = new Date(duration * 1000).toISOString().substring(14, 19)
      var time_ct = new Date(ct * 1000).toISOString().substring(14, 19)
    } else {
      var time_duration = "00:00"
      var time_ct = "00:00"
    }
    setCurrentSongTime({"progress": ct / duration * 100, "length": duration, "progressmmss": time_ct, "lengthmmss": time_duration})
  }

  // MAIN API FETCHER
  const fetchData = async (USER_ID) => {
    try {
      const { idToken } = (await fetchAuthSession()).tokens ?? {}; // Get the current session and ID token
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          'action': 'ONLOAD', 
          'userId': USER_ID
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data
    } catch (error) {
      console.error("There was a problem with the fetch operation:", error);
      setOnload(false);
    }
  };

  // MARKS VOICEMAILS UNREAD, TRUE OR FALSE
  const markUnread = async (state, contactId) => {  
    try {
      const { idToken } = (await fetchAuthSession()).tokens ?? {}; // Get the current session and ID token
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          'action': 'READ',
          'username': globalUsername, // From ONLOAD
          'contactId': contactId, // UPDATED IN markUnread
          'unread': state // UPDATED IN markUnread
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return
    } catch (error) {
      console.error("There was a problem with the update unread operation:", error);
    }
  };

  // DELETES VOICEMAILS
  const handleDelete = async (contactId) => {
    setVisibleDeleteLoadingButton(true);
    const { idToken } = (await fetchAuthSession()).tokens ?? {}; // Get the current session and ID token
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          'action': 'DELETE',
          'username': globalUsername, // From ONLOAD
          'contactId': contactId, // UPDATED IN handleDelete
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      await response.json();
      await handleRefresh();
      setVisibleDeleteModal(false);
      setVisibleDeleteLoadingButton(false);
      return
    } catch (error) {
      console.error("There was a problem with the Delete operation:", error);
    }
  };

  // FETCHES VOICEMAIL DATA AND REORDERS LIST BASED ON TIME
  const fetchVoicemails = async () => {
    try {
      var userAttributes = await fetchUserAttributes()
      setGlobalUserId(userAttributes.locale)
      setGlobalUsername(userAttributes.preferred_username)
      setGlobalName(userAttributes.name)
      const voicemailList = await fetchData(userAttributes.locale)
      const newlist = await voicemailList.sort((a, b) => {
        if (a.unread > b.unread) return -1;
        if (a.unread < b.unread) return 1;
        if (a.eventTime > b.eventTime) return -1;
        if (a.eventTime < b.eventTime) return 1;
        return 0;
      })
      setTotalUnread(newlist.filter(item => item.unread === true).length)
      setVoicemailList(newlist)
      setFilteredVoicemailList(newlist)
      var size = 10; 
      var splicing_response = [];
      for (var i=0; i<newlist.length; i+=size) {
        splicing_response.push(newlist.slice(i,i+size));
      }
      console.log(splicing_response);
      setSplicedList(splicing_response)
      setPageCount(splicing_response.length)
      setOnload(false)
      return newlist
    } catch (error) {
      console.log("There was a problem with the fetch operation:", error)
      setOnload(false);
    }
  }

  // HANDLES REFRESH MADE THROUGH REFRESH ICON ON TABLE
  const handleRefresh = async () => {
    try {
      setOnload(true)
      setCurrentSongTime({"progress": 0, "length": 0, "progressmmss": "00:00", "lengthmmss": "00:00"})
      setCurrentSong({"contactId":"No voicemail selected"})
      setIsPlaying(false)
      setSelectedItems([])
      const voicemailList = await fetchVoicemails()
      setFilteringText("")
    } catch (error) {
      console.log("There was a problem with the fetch operation:", error)
      setOnload(false);
    }
  }

  // ONLOAD
  useEffect(() => {
    fetchVoicemails()
  }, []);

  // RUNS WHEN SONG IS PLAYING OR WHEN CURRENT SONG IS SET
  useEffect(() => {
    if (isPlaying) {
      audioElem.current.play();
    }
    else {
      audioElem.current.pause();
    }
  }, [isPlaying, currentSong])

  return (
    <div className="App">
        {/* PAGE HEADER */}
        <Header 
          fullName={globalName}
          signOut={signOut}
          />
        {/* DISPLAYS STATUS OF UNREAD VOICEMAILS */}
        <StatusBar 
          fullName={globalName}
          totalUnread={totalUnread}
          />
        {/* WHERE AUDIO IS LOADED */}
        <audio src={currentSong.presigned_url} ref={audioElem} onTimeUpdate={onPlaying} />
        {/* AUDIO CONTROLS */}
        <AudioPlayer 
          audioElem={audioElem} 
          isPlaying={isPlaying} 
          setIsPlaying={setIsPlaying} 
          currentSong={currentSong} 
          setCurrentSong={setCurrentSong} 
          currentSongTime={currentSongTime}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          filteredVoicemailList={filteredVoicemailList}
          />
        {/* DISPLAYS LIST OF VOICEMAILS */}
        <VoicemailTable 
          voicemailList={voicemailList} 
          onload={onload}
          setIsPlaying={setIsPlaying} 
          isPlaying={isPlaying} 
          handleRefresh={handleRefresh}
          setCurrentSong={setCurrentSong} 
          currentSongTime={currentSongTime}
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
          fetchVoicemails={fetchVoicemails}
          filteringText={filteringText}
          setFilteringText={setFilteringText}
          filteredVoicemailList={filteredVoicemailList}
          setFilteredVoicemailList={setFilteredVoicemailList}
          setVoicemailList={setVoicemailList}
          markUnread={markUnread}
          handleDelete={handleDelete}
          visibleDeleteModal={visibleDeleteModal}
          setVisibleDeleteModal={setVisibleDeleteModal}
          visibleDeleteLoadingButton={visibleDeleteLoadingButton}
          setVisibleDeleteLoadingButton={setVisibleDeleteLoadingButton}
          pageCount={pageCount}
          setPageCount={setPageCount}
          currPageIndex={currPageIndex}
          setCurrPageIndex={setCurrPageIndex}
          splicedList={splicedList}
          setSplicedList={setSplicedList}
          countTextVisible={countTextVisible}
          setCountTextVisible={setCountTextVisible}
          />
    </div>
  );
}

export default withAuthenticator(App);