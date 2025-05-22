import React, { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRecordings } from '../contexts/RecordingsContext'; // Already here, good.
import { useUserSettings } from '../contexts/UserSettingsContext';
import { generatePdfFromText } from './pdfUtils'; // Added for PDF generation
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  ToggleButton,
  ToggleButtonGroup,
  Switch,
  FormControlLabel
} from '@mui/material';

const AudioRecorder = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  // Get more from useRecordings for transcript display
  const {
    recordings, // Added to get selected recording's name
    startPendingRecording,
    updateRecording,
    removeRecording,
    selectedRecordingId,
    selectRecording, // To allow closing the transcript view
    originalTranscriptContent,
    polishedTranscriptContent,
    isLoadingSelectedTranscript,
    selectedTranscriptError
  } = useRecordings();
  const { userSettings, settingsLoading } = useUserSettings();

  const [currentView, setCurrentView] = useState('setup');
  const [isRecording, setIsRecording] = useState(false);
  const [hasStreamedOnce, setHasStreamedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [encounterType, setEncounterType] = useState('in-person');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0); // This is for the recorder's internal setup/note tabs
  const [isMultilingual, setIsMultilingual] = useState(false);
  
  // New state for transcript display tabs
  const [transcriptDisplayTab, setTranscriptDisplayTab] = useState(0);
  const [editablePolishedNote, setEditablePolishedNote] = useState('');
  const [isEditingPolishedNote, setIsEditingPolishedNote] = useState(false);

  const mediaRecorderRef = useRef(null);
  const webSocketRef = useRef(null);
  const audioStreamRef = useRef(null);
  const prevSelectedRecordingIdRef = useRef();
  const prevPolishedContentRef = useRef();
  const sourcePolishedContentRef = useRef(); // Ref to track the source of editablePolishedNote
 
  useEffect(() => {
    setCurrentView('setup');
    setPatientDetails('');
    setPatientContext('');
    setEncounterType('in-person');
    setSelectedLocation('');
    setSelectedProfileId('');
    setError(null);
    setFinalTranscript('');
    setCurrentInterimTranscript('');
    setCombinedTranscript('');
    setSessionId(null);
    setIsSessionSaved(false);
    setSaveStatusMessage('');
    setIsRecording(false);
    setHasStreamedOnce(false);
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Previous WebSocket connection exists. State:", webSocketRef.current.readyState, ". Closing it before resume.");
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log("[MediaRecorder] Previous MediaRecorder exists and is recording. Stopping it before resume.");
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      console.log("[Stream] Previous audio stream exists. Stopping its tracks before resume.");
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    setCombinedTranscript(finalTranscript + currentInterimTranscript);
  }, [finalTranscript, currentInterimTranscript]);

  useEffect(() => {
    if (!settingsLoading && userSettings.transcriptionProfiles) {
      const filteredProfiles = userSettings.transcriptionProfiles.filter(
        profile => profile.name !== 'Default/General summary'
      );

      if (filteredProfiles.length > 0) {
        const currentProfileStillExistsInFiltered = filteredProfiles.some(p => p.id === selectedProfileId);
        if (!selectedProfileId || !currentProfileStillExistsInFiltered) {
          const defaultProfile = filteredProfiles.find(p => p.isDefault) || filteredProfiles[0];
          if (defaultProfile) {
            setSelectedProfileId(defaultProfile.id);
          }
        }
      } else {
        setSelectedProfileId('');
      }
    }

    if (!settingsLoading && userSettings.officeInformation && userSettings.officeInformation.length > 0) {
      if (selectedLocation === '' && !userSettings.officeInformation.includes(selectedLocation) && userSettings.officeInformation[0]) {
        setSelectedLocation(userSettings.officeInformation[0]);
      }
    } else if (!settingsLoading && (!userSettings.officeInformation || userSettings.officeInformation.length === 0)){
      setSelectedLocation('');
    }
  }, [userSettings, settingsLoading]);

  useEffect(() => {
    return () => {
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] Closing due to component unmount or panel close.");
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        console.log("[MediaRecorder] Stopping due to component unmount or panel close.");
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      }
      if (audioStreamRef.current) {
        console.log("[Stream] Stopping audio stream tracks due to component unmount or panel close.");
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    };
  }, []);

useEffect(() => {
    const hasIdChanged = selectedRecordingId !== prevSelectedRecordingIdRef.current;

    if (hasIdChanged) {
        // If selectedRecordingId has changed (new ID, or became null/non-null)
        setIsEditingPolishedNote(false); // Always stop editing if ID changes
        const newInitialContent = selectedRecordingId ? (polishedTranscriptContent || "") : "";
        setEditablePolishedNote(newInitialContent);
        sourcePolishedContentRef.current = newInitialContent;
    } else {
        // ID has NOT changed.
        // If we are editing, user's input should be preserved. Don't sync from polishedTranscriptContent.
        if (isEditingPolishedNote) {
            // Do nothing to editablePolishedNote
        } else {
            // Not editing, and ID is the same.
            // Sync from polishedTranscriptContent if it has changed for the current selectedRecordingId.
            if (selectedRecordingId) { // Current ID still selected
                const currentSourceContent = polishedTranscriptContent || "";
                // Only update if the local editable copy differs from the source content.
                // This check is important if editablePolishedNote was somehow stale.
                if (editablePolishedNote !== currentSourceContent) {
                    setEditablePolishedNote(currentSourceContent);
                    sourcePolishedContentRef.current = currentSourceContent;
                }
            } else {
                // No ID selected (and ID hasn't changed, meaning it was already null)
                // Ensure editablePolishedNote is clear if it isn't already.
                if (editablePolishedNote !== "") {
                    setEditablePolishedNote("");
                    sourcePolishedContentRef.current = undefined;
                }
            }
        }
    }

    // Always update the ref for the previously selected ID for the next render.
    prevSelectedRecordingIdRef.current = selectedRecordingId;

}, [selectedRecordingId, polishedTranscriptContent, isEditingPolishedNote]);

  const _startRecordingProcess = async () => {
    setError(null);
    if (!hasStreamedOnce || !sessionId) {
      setFinalTranscript('');
      setCurrentInterimTranscript('');
      setCombinedTranscript('');
      setIsSessionSaved(false);
      setSaveStatusMessage('');

      let newSessionId = Date.now().toString();
      setSessionId(newSessionId);
      startPendingRecording(newSessionId, patientDetails || 'New Session');
    }

    const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === selectedProfileId);
    const llmPrompt = activeProfile ? activeProfile.llmPrompt : 'Summarize the following clinical encounter:';
    const profileName = activeProfile ? activeProfile.name : 'General Summary';

    const encounterDetails = {
      patient_name: patientDetails,
      context: patientContext,
      llm_template_name: profileName,
      llm_prompt: llmPrompt,
      location: selectedLocation,
      user_id: user.sub,
      session_id: sessionId || newSessionId,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
        console.log("[WebSocket] Previous WebSocket connection exists. State:", webSocketRef.current.readyState, ". Closing it before resume.");
        webSocketRef.current.close();
        webSocketRef.current = null;
      }

      console.log("[WebSocket] Attempting to connect to ws://localhost:8000/stream for resume/start...");
      webSocketRef.current = new WebSocket('ws://localhost:8000/stream');

      webSocketRef.current.onopen = () => {
        console.log('[WebSocket] Connection OPENED successfully.');
        setError(null);

        // Send initial metadata for profile selection before anything else
        if (user && user.sub && selectedProfileId) {
          const initialMetadata = {
            type: 'initial_metadata', // Backend expects this type to identify the purpose
            user_id: user.sub,
            profile_id: selectedProfileId
          };
          webSocketRef.current.send(JSON.stringify(initialMetadata));
          console.log('[WebSocket] Sent initial_metadata:', initialMetadata);
        } else {
          console.warn('[WebSocket] Could not send initial_metadata: user_id or profile_id missing.', { userId: user ? user.sub : 'undefined', profileId: selectedProfileId });
          // Potentially send an error to the backend or handle this state, 
          // as backend might be expecting this for setting up Deepgram options.
        }

        const sessionSetupData = {
          type: 'session_config',
          patient_name: patientDetails,
          patient_context: patientContext,
          llm_template: profileName,
          llm_prompt: llmPrompt,
          location: selectedLocation,
          session_id: sessionId
        };
        console.log('Would send session_config data (if backend supported):', sessionSetupData);

        if (audioStreamRef.current) {
          mediaRecorderRef.current = new MediaRecorder(audioStreamRef.current, { mimeType: 'audio/webm' });

          mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0 && webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              webSocketRef.current.send(event.data);
            }
          };

          mediaRecorderRef.current.onstop = () => {
            console.log("[MediaRecorder] MediaRecorder stopped.");
            if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              console.log("[WebSocket] Sending EOS due to MediaRecorder stop.");
              webSocketRef.current.send(JSON.stringify({ type: 'eos' }));
            }
          };

          mediaRecorderRef.current.onerror = (event) => {
            console.error('[MediaRecorder] MediaRecorder error:', event.error);
            setError(`MediaRecorder error: ${event.error.name}. Please ensure microphone access and try again.`);
            console.log("[StateChange] Setting isRecording to FALSE due to MediaRecorder error.");
            setIsRecording(false);
            if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              console.log("[WebSocket] Closing WebSocket due to MediaRecorder error.");
              webSocketRef.current.close();
            }
          };

          mediaRecorderRef.current.start(1000);
          console.log("[MediaRecorder] MediaRecorder started.");
          console.log("[StateChange] Setting isRecording to TRUE (in WebSocket onopen).");
          setIsRecording(true);
          setHasStreamedOnce(true);
        } else {
          console.error("[WebSocket] Audio stream is not available in onopen. Cannot start MediaRecorder.");
          setError("Audio stream lost. Please try again.");
          console.log("[StateChange] Setting isRecording to FALSE (audio stream lost in onopen).");
          setIsRecording(false);
        }
      };

      webSocketRef.current.onmessage = (event) => {
        let message = event.data;
        if (typeof message === 'string') {
          if (message.startsWith('\uFEFF')) {
            message = message.substring(1);
          }

          try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'session_init') {
              console.log('Received session_init (JSON):', parsedMessage);
              setSessionId(parsedMessage.session_id);
              setError('');
            } else if (parsedMessage.type === 'transcript') {
              if (parsedMessage.is_final) {
                setFinalTranscript(prev => (prev ? prev + ' ' : '') + parsedMessage.text);
                setCurrentInterimTranscript('');
              } else {
                setCurrentInterimTranscript(parsedMessage.text);
              }
            } else if (parsedMessage.type === 'error') {
              console.error('Received error from server (JSON):', parsedMessage.message);
              setError(`Streaming error: ${parsedMessage.message}`);
            } else if (parsedMessage.type === 'status') {
              console.log('Received status from server (JSON):', parsedMessage.message);
              if (parsedMessage.message.includes('S3') || parsedMessage.message.includes('Bedrock')) {
                setSaveStatusMessage(prev => prev ? `${prev}\n${parsedMessage.message}` : parsedMessage.message);
              }
            } else {
              console.warn('Received unknown JSON message type:', parsedMessage);
            }
          } catch (e) {
            if (message.startsWith('Interim: ')) {
              const transcript = message.substring('Interim: '.length);
              setCurrentInterimTranscript(transcript);
            } else if (message.startsWith('Final: ')) {
              const transcript = message.substring('Final: '.length);
              setFinalTranscript(prev => (prev ? prev + ' ' : '') + transcript);
              setCurrentInterimTranscript('');
            } else if (message.startsWith('SessionID: ')) {
              const id = message.substring('SessionID: '.length);
              setSessionId(id);
              console.log('Session ID received (plain text):', id);
              setError('');
            } else if (message.startsWith('Error: ')) {
              const errorMessage = message.substring('Error: '.length);
              console.error('Error from backend (plain text):', errorMessage);
              setError(`Streaming error: ${errorMessage}`);
            } else if (message.startsWith('Status: ')) {
              const statusMessage = message.substring('Status: '.length);
              console.log('Status from backend (plain text):', statusMessage);
            } else if (message.startsWith("WebSocket connection established with Session ID:")) {
                const parts = message.split(': ');
                if (parts.length > 1) {
                    const id = parts[parts.length -1].trim();
                    setSessionId(id);
                    console.log('Session ID received (legacy format):', id);
                    setError('');
                }
            } else {
              console.warn('Received unhandled string message from WebSocket (after failing JSON parse):', message);
            }
          }
        } else {
          console.warn('Received non-string message from WebSocket:', message);
        }
      };

      webSocketRef.current.onerror = (event) => {
        console.error('[WebSocket] WebSocket ERROR:', event);
        setError('WebSocket connection error. Please check your connection or the server and try again.');
        console.log("[StateChange] Setting isRecording to FALSE (in WebSocket onerror).");
        setIsRecording(false);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          console.log("[MediaRecorder] Stopping MediaRecorder due to WebSocket error.");
          mediaRecorderRef.current.stop();
        }
      };

      webSocketRef.current.onclose = (event) => {
        console.log(`[WebSocket] WebSocket connection CLOSED. Code: ${event.code}, Reason: '${event.reason}', Clean: ${event.wasClean}`);
        if (isRecording) {
          console.warn("[WebSocket] Connection closed unexpectedly while 'isRecording' was true.");
          setError("Live connection lost. You might need to resume or restart.");
          console.log("[StateChange] Setting isRecording to FALSE (in WebSocket onclose, was recording).");
          setIsRecording(false);
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          console.log("[MediaRecorder] WebSocket closed, ensuring MediaRecorder is stopped.");
          mediaRecorderRef.current.stop();
        }
      };

    } catch (err) {
      console.error('[Stream] Error starting recording process (getUserMedia or other setup):', err);
      setError(`Error starting stream: ${err.message}. Please ensure microphone access.`);
      console.log("[StateChange] Setting isRecording to FALSE (error in _startRecordingProcess catch block).");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    console.log("[Action] stopRecording (Pause) called.");
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("[MediaRecorder] Calling MediaRecorder.stop().");
      mediaRecorderRef.current.stop();
    } else {
      console.log("[MediaRecorder] MediaRecorder not recording or not initialized.");
    }

    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      console.log("[WebSocket] Closing WebSocket connection explicitly from stopRecording.");
      webSocketRef.current.close(1000, "User paused recording");
      webSocketRef.current = null;
    } else {
      console.log("[WebSocket] WebSocket not open or not initialized when stopRecording called.");
    }

    if (audioStreamRef.current) {
      console.log("[Stream] Stopping audio stream tracks.");
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    console.log("[StateChange] Setting isRecording to FALSE (at end of stopRecording).");
    setIsRecording(false);
  };

  const handleSaveSession = async () => {
    if (isRecording) {
      setError('Please pause or stop streaming before generating notes.');
      return;
    }
    if (!sessionId) {
      setError('Session ID is missing. Cannot save.');
      setSaveStatusMessage('Error: Session ID missing.');
      return;
    }
    if (!combinedTranscript.trim()) {
      setError('No transcript to save.');
      setSaveStatusMessage('No transcript content to save.');
      return;
    }

    if (!user || !user.sub) {
      setError('User not authenticated or user ID is missing. Cannot save session.');
      setSaveStatusMessage('Error: User authentication issue.');
      return;
    }

    setSaveStatusMessage('Generating and saving notes...');
    setIsSessionSaved(false);

    updateRecording(sessionId, { status: 'saving', name: `Saving: ${patientDetails || 'New Note'}...` });

    try {
      const url = '/api/v1/save_session_data';
      console.log("Attempting to save session with URL:", url, "and payload:", JSON.stringify({
        session_id: sessionId,
        final_transcript_text: combinedTranscript,
        patient_context: patientContext,
        location: selectedLocation,
        user_id: user.sub
      }));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          final_transcript_text: combinedTranscript,
          patient_context: patientContext,
          location: selectedLocation,
          user_id: user.sub
        }),
      });

      let result = {};
      try {
        result = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse server response as JSON:', jsonError);
        if (response.ok) {
          throw new Error(`Successfully saved but failed to parse response: ${response.statusText || 'Unknown parse error'}`);
        }
      }

      if (response.ok) {
        setSaveStatusMessage(`Notes generated and saved!\nNotes: ${result.notes_s3_path || 'N/A'}\nAudio: ${result.audio_s3_path || 'N/A'}`);
        setIsSessionSaved(true);
        const savedName = patientDetails
          ? `Note: ${patientDetails.substring(0,20)}${patientDetails.length > 20 ? '...' : ''} (${new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10)})`
          : `Note ${new Date(Date.now() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16).replace('T', ' ')}`;
        updateRecording(sessionId, {
          status: 'saved',
          name: savedName,
          date: new Date().toISOString(),
          s3PathAudio: result.audio_s3_path,
          s3PathTranscript: result.original_transcript_s3_path,
          s3PathPolished: result.notes_s3_path,
          patientContext: patientContext,
          location: selectedLocation,
          error: null
        });
      } else {
        const errorDetail = (result && result.detail) || response.statusText || 'Unknown server error';
        setSaveStatusMessage(`Error saving session: ${errorDetail}`);
        setError(`Error saving session: ${errorDetail}`);
        setIsSessionSaved(false);
        updateRecording(sessionId, { status: 'failed', name: `Failed: ${patientDetails || 'New Note'}`, error: errorDetail });
      }
    } catch (err) {
      console.error('Failed to save session:', err);
      const errorMessage = err.message || 'Failed to process save request.';
      setSaveStatusMessage(`Failed to save session: ${errorMessage}`);
      setError(`Failed to save session: ${errorMessage}`);
      setIsSessionSaved(false);
      updateRecording(sessionId, { status: 'failed', name: `Failed: ${patientDetails || 'New Note'}`, error: errorMessage });
    }
  };

  const handleStartEncounter = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    setSessionId(newSessionId);
    startPendingRecording(newSessionId);
    setCurrentView('recording');
    setError(null);
    setHasStreamedOnce(false);
  };

  const handleCancelAndClose = () => {
    if (webSocketRef.current) {
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);

    if (sessionId && !isSessionSaved) {
      removeRecording(sessionId);
    }

    setCurrentView('setup');
    setPatientDetails('');
    setPatientContext('');
    setEncounterType('in-person');
    setSelectedLocation('');
    setSelectedProfileId('');
    setError(null);
    setFinalTranscript('');
    setCurrentInterimTranscript('');
    setCombinedTranscript('');
    setSessionId(null);
    setIsSessionSaved(false);
    setSaveStatusMessage('');
    setIsRecording(false);
    setHasStreamedOnce(false);
  };

  const a11yProps = (index) => {
    return {
      id: `simple-tab-${index}`,
      'aria-controls': `simple-tabpanel-${index}`,
    };
  };

  const handleTranscriptDisplayTabChange = (event, newValue) => {
    setTranscriptDisplayTab(newValue);
  };

  // Define TabPanel here, before its first potential use
  const TabPanel = (props) => {
    const { children, value, index, ...other } = props;
    return (
      <div
        role="tabpanel"
        id={`simple-tabpanel-${index}`}
        aria-labelledby={`simple-tab-${index}`}
        {...other}
        style={value === index ?
          { flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 } :
          { display: 'none' }
        }
      >
        {children /* Always render children; visibility controlled by parent div's style */}
      </div>
    );
  };
  
  // If a recording is selected from the sidebar, show the transcript viewer UI
  if (selectedRecordingId) {
    const selectedRec = recordings.find(r => r.id === selectedRecordingId);
    const title = selectedRec ? `Details: ${selectedRec.name}` : "Recording Details"; // Use recording name if available

    return (
      <Box sx={{ p: 2, height: 'calc(100vh - 16px)', display: 'flex', flexDirection: 'column', width: '100%' }}> {/* Adjust height as needed */}
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1, flexShrink: 0}}>
          <Typography variant="h5" gutterBottom sx={{mb:0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {title}
          </Typography>
          <Button onClick={() => selectRecording(null)} variant="outlined" size="small">
            Back to Recorder
          </Button>
        </Box>

        {isLoadingSelectedTranscript && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading transcripts...</Typography>
          </Box>
        )}
        {!isLoadingSelectedTranscript && selectedTranscriptError && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, flexDirection: 'column', p:2 }}>
            <Typography color="error" variant="h6" gutterBottom>Error loading transcripts:</Typography>
            <Typography color="error" sx={{mt:1, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{selectedTranscriptError}</Typography>
          </Box>
        )}
        {!isLoadingSelectedTranscript && !selectedTranscriptError && (
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius:1, minHeight: 0 /* Flex parent fix */ }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, backgroundColor: 'background.default' }}>
              <Tabs value={transcriptDisplayTab} onChange={handleTranscriptDisplayTabChange} aria-label="transcript content tabs" variant="fullWidth">
                <Tab label="Original Transcript" id="transcript-display-tab-0" aria-controls="transcript-display-tabpanel-0" />
                <Tab label="Polished Note" id="transcript-display-tab-1" aria-controls="transcript-display-tabpanel-1" />
              </Tabs>
            </Box>
            {/* Re-using the existing TabPanel definition but ensuring it's correctly styled for this context */}
            <TabPanel value={transcriptDisplayTab} index={0}>
              {/* Removed intermediate Box. The Box component="pre" is now a direct child of TabPanel's internal scrolling Box. */}
              <Box component="pre" sx={{ p: 1.5, flexGrow: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '1.1rem', lineHeight: 1.6, backgroundColor: 'grey.50', margin:0, color: 'text.primary' }}>
                {originalTranscriptContent || "Original transcript not available or empty."}
              </Box>
            </TabPanel>
            <TabPanel value={transcriptDisplayTab} index={1}>
              <TextField
                multiline
                fullWidth
                variant="outlined"
                value={editablePolishedNote}
                onChange={(e) => setEditablePolishedNote(e.target.value)}
                InputProps={{
                  readOnly: !isEditingPolishedNote,
                }}
                placeholder={
                  (polishedTranscriptContent === null || polishedTranscriptContent === "") && editablePolishedNote === ""
                  ? "Polished note not available or empty."
                  : "Edit polished note..."
                }
                sx={{
                  flexGrow: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    padding: 0,
                    '& textarea.MuiOutlinedInput-input': {
                      padding: '12px', // Approx theme.spacing(1.5)
                      height: '100% !important',
                      boxSizing: 'border-box',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'text.primary',
                      backgroundColor: 'grey.50',
                    },
                    '& textarea.MuiOutlinedInput-input::placeholder': {
                      color: 'text.secondary',
                      opacity: 1,
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      lineHeight: 1.6,
                    }
                  }
                }}
              />
              <Box sx={{ p: 1, mt: 1, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                {isEditingPolishedNote ? (
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                      // Call updateRecording to persist changes
                      // This assumes updateRecording can handle a 'polishedTranscript' field.
                      // Adjust the payload { polishedTranscript: editablePolishedNote } as needed
                      // based on your RecordingsContext and backend implementation.
                      if (selectedRecordingId && typeof updateRecording === 'function') {
                        updateRecording(selectedRecordingId, { polishedTranscript: editablePolishedNote });
                      }
                      setIsEditingPolishedNote(false);
                    }}
                  >
                    Save Changes
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={() => setIsEditingPolishedNote(true)}
                    disabled={isLoadingSelectedTranscript} // Disable if still loading
                  >
                    Edit Note
                  </Button>
                )}
                {(polishedTranscriptContent || editablePolishedNote) && !isEditingPolishedNote && (
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => generatePdfFromText(editablePolishedNote, `polished-note-${selectedRecordingId || 'current'}.pdf`, selectedLocation)}
                    disabled={isLoadingSelectedTranscript}
                  >
                    Save as PDF
                  </Button>
                )}
              </Box>
            </TabPanel>
          </Box>
        )}
      </Box>
    );
  }

  // Original AudioRecorder UI starts here if no recording is selected for detailed view
  // The TabPanel definition has been moved up.

  const handleTabChange = (event, newValue) => { // This is for the recorder's internal tabs
    setActiveTab(newValue);
  };

  // Authenticating / Settings Loading check
  if (authLoading || settingsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading user data...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 3, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>Welcome to Dictation App</Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>
          Please log in to start recording new encounters or view your existing notes.
        </Typography>
      </Box>
    );
  }

  if (currentView === 'setup') {
    return (
      <Box sx={{
        p: 3,
        width: '100%'
      }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'left', mb: 4, fontWeight: 'medium' }}>
          Encounter
        </Typography>
        <Stack
          spacing={3}
          direction="column"
          sx={{ maxWidth: '800px', mx: 'auto' }}
        >
          <Typography variant="overline" display="block" gutterBottom sx={{ color: 'text.secondary', mt: 1 }}>
            CONTEXT
          </Typography>
          <FormControl fullWidth required error={!!(error && error.includes('patient details'))}>
            <TextField
              id="patient-details"
              label="Patient Name / Session Title"
              placeholder="e.g., John Doe - Annual Checkup"
              value={patientDetails}
              onChange={(e) => setPatientDetails(e.target.value)}
              variant="standard"
              fullWidth
              required
              error={!!error && !patientDetails.trim()}
              helperText={!!error && !patientDetails.trim() ? 'Please enter patient details' : ''}
            />
          </FormControl>

          <FormControl fullWidth>
            <TextField
              id="patient-context"
              placeholder="Add patient context (optional)"
              value={patientContext}
              onChange={(e) => setPatientContext(e.target.value)}
              multiline
              rows={3}
              variant="standard"
            />
          </FormControl>

          <Typography variant="overline" display="block" gutterBottom sx={{ color: 'text.secondary', mt: 3 }}>
            SETTINGS
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={12}>
              <FormControl fullWidth variant="standard">
                <InputLabel id="location-select-label">Location</InputLabel>
                <Select
                  labelId="location-select-label"
                  id="location-select"
                  value={selectedLocation}
                  label="Location"
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  disabled={settingsLoading || (!userSettings.officeInformation && !settingsLoading)}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {settingsLoading && !userSettings.officeInformation ? (
                    <MenuItem value="" disabled>Loading locations...</MenuItem>
                  ) : (
                    userSettings.officeInformation && userSettings.officeInformation.map((loc, index) => (
                      <MenuItem key={index} value={loc}>
                        {loc}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth variant="standard">
                <InputLabel id="profile-select-label">Transcription Profile</InputLabel>
                <Select
                  labelId="profile-select-label"
                  id="profile-select"
                  value={selectedProfileId}
                  label="Transcription Profile"
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  disabled={settingsLoading || (!userSettings.transcriptionProfiles && !settingsLoading)}
                >
                  {settingsLoading && !userSettings.transcriptionProfiles ? (
                    <MenuItem value="" disabled>Loading profiles...</MenuItem>
                  ) : (
                    userSettings.transcriptionProfiles &&
                    userSettings.transcriptionProfiles
                      .filter(profile => profile.name !== 'Default/General summary')
                      .map((profile) => (
                        <MenuItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </MenuItem>
                      ))
                  )}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={<Switch checked={isMultilingual} onChange={(e) => setIsMultilingual(e.target.checked)} />}
                label="Enable Multilingual Support"
                sx={{ mt: 1, mb: 0.5, width: '100%', justifyContent: 'flex-start'}}
              />
            </Grid>

            <Grid item xs={12} sx={{ mt: 0.5, mb: 2 }}>
            </Grid>
          </Grid>

          {error && <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>{error}</Typography>}

          <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
            <Button variant="contained" color="primary" onClick={handleStartEncounter} sx={{ px: 5, py: 1.5, minWidth: '200px', fontSize: '1rem' }} fullWidth>
              Start Encounter
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  } else if (currentView === 'recording') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          bgcolor: 'background.paper',
          borderRadius: 2,
          boxShadow: 3,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2, borderBottom: 0, borderColor: 'divider', flexShrink: 0 }}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid item>
              <Typography variant="h6">Encounter: {patientDetails || 'N/A'}</Typography>
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ borderBottom: 0, borderColor: 'divider', flexShrink: 0 }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="encounter content tabs" centered>
            <Tab label="Transcript" {...a11yProps(0)} />
            <Tab label="Note" {...a11yProps(1)} />
          </Tabs>
        </Box>

        <Stack spacing={1} sx={{ p: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
            {!isRecording && !hasStreamedOnce && (
              <Button variant="contained" color="primary" onClick={_startRecordingProcess} sx={{ flexGrow: 1 }}>
                Start Streaming
              </Button>
            )}
            {isRecording && (
              <Button variant="contained" color="warning" onClick={stopRecording} sx={{ flexGrow: 1 }}>
                Pause Streaming
              </Button>
            )}
            {!isRecording && hasStreamedOnce && (
              <Button variant="contained" color="primary" onClick={_startRecordingProcess} sx={{ flexGrow: 1 }}>
                Resume Streaming
              </Button>
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="center">
            <Button
              variant="contained"
              color="secondary"
              onClick={handleSaveSession}
              disabled={isRecording || !sessionId || !combinedTranscript.trim() || isSessionSaved || saveStatusMessage.includes('Generating...')}
              sx={{ flexGrow: 1 }}
            >
              {isSessionSaved ? 'Notes Generated' : (saveStatusMessage.includes('Generating...') ? 'Generating Notes...' : 'Generate Note & Save')}
            </Button>

            <Button variant="outlined" onClick={handleCancelAndClose} sx={{ flexGrow: 1 }}>
              Close Session
            </Button>
          </Stack>
        </Stack>

        {error && !error.toLowerCase().includes('saving') && (
          <Typography color="error" sx={{ mt: 1, mb: 1, textAlign: 'center', flexShrink: 0 }}>
            {error}
          </Typography>
        )}

        <TabPanel value={activeTab} index={0} sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
          <Box sx={{ p: 2, minHeight: '150px', '& p': { m: 0 } }}>
            <Typography variant="body1" component="div" style={{ whiteSpace: 'pre-wrap' }}>
              {combinedTranscript || (isRecording ? 'Listening...' : 'Start speaking or resume to see transcript...')}
            </Typography>
          </Box>
        </TabPanel>

        <TabPanel value={activeTab} index={1} sx={{ flexGrow: 1, overflowY: 'auto', p: 0 }}>
          <Box
            sx={{
              p: 2,
              minHeight: '150px',
              '& p': { m: 0 }
            }}
          >
            <Typography variant="body1" color="text.secondary">
              {isSessionSaved && saveStatusMessage.startsWith('Notes generated')
                ? saveStatusMessage
                : 'Polished note will appear here once generated after saving the session.'}
            </Typography>
          </Box>
        </TabPanel>

        {saveStatusMessage && (
          <Typography sx={{ p: 1, fontStyle: 'italic', color: (error && (saveStatusMessage.toLowerCase().includes('error') || saveStatusMessage.toLowerCase().includes('failed'))) ? 'error.main' : 'text.secondary', whiteSpace: 'pre-line', textAlign: 'center', flexShrink: 0 }}>
            {saveStatusMessage}
          </Typography>
        )}
      </Box>
    );
  }

  return null;
};

export default AudioRecorder;
