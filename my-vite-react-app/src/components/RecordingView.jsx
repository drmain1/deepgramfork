import React, { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRecordings } from '../contexts/RecordingsContext';
import {
  Box,
  Button,
  Typography,
  Stack,
  Grid,
  Tabs,
  Tab
} from '@mui/material';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      id={`recording-tabpanel-${index}`}
      aria-labelledby={`recording-tab-${index}`}
      {...other}
      style={value === index ?
        { flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 } :
        { display: 'none' }
      }
    >
      {children}
    </div>
  );
};

function RecordingView({
  patientDetails,
  patientContext,
  selectedLocation,
  selectedProfileId,
  userSettings,
  onClose
}) {
  const { user } = useAuth0();
  const { startPendingRecording, updateRecording, removeRecording } = useRecordings();

  const [isRecording, setIsRecording] = useState(false);
  const [hasStreamedOnce, setHasStreamedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const mediaRecorderRef = useRef(null);
  const webSocketRef = useRef(null);
  const audioStreamRef = useRef(null);

  // Debug logging for location
  console.log("RecordingView - selectedLocation prop:", selectedLocation);
  console.log("RecordingView - patientDetails:", patientDetails);
  console.log("RecordingView - patientContext:", patientContext);

  useEffect(() => {
    setCombinedTranscript(finalTranscript + currentInterimTranscript);
  }, [finalTranscript, currentInterimTranscript]);

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

  const startRecordingProcess = async () => {
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
            type: 'initial_metadata',
            user_id: user.sub,
            profile_id: selectedProfileId
          };
          webSocketRef.current.send(JSON.stringify(initialMetadata));
          console.log('[WebSocket] Sent initial_metadata:', initialMetadata);
        } else {
          console.warn('[WebSocket] Could not send initial_metadata: user_id or profile_id missing.', { userId: user ? user.sub : 'undefined', profileId: selectedProfileId });
        }

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
            setIsRecording(false);
            if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
              console.log("[WebSocket] Closing WebSocket due to MediaRecorder error.");
              webSocketRef.current.close();
            }
          };

          mediaRecorderRef.current.start(1000);
          console.log("[MediaRecorder] MediaRecorder started.");
          setIsRecording(true);
          setHasStreamedOnce(true);
        } else {
          console.error("[WebSocket] Audio stream is not available in onopen. Cannot start MediaRecorder.");
          setError("Audio stream lost. Please try again.");
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
      
      // Embed location data in the transcript content itself as a backup
      let transcriptWithLocation = combinedTranscript;
      if (selectedLocation && selectedLocation.trim()) {
        const locationHeader = `CLINIC LOCATION:\n${selectedLocation.trim()}\n\n---\n\n`;
        transcriptWithLocation = locationHeader + combinedTranscript;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          final_transcript_text: transcriptWithLocation,
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

  const handleClose = () => {
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

    onClose();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const a11yProps = (index) => {
    return {
      id: `recording-tab-${index}`,
      'aria-controls': `recording-tabpanel-${index}`,
    };
  };

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
            <Button variant="contained" color="primary" onClick={startRecordingProcess} sx={{ flexGrow: 1 }}>
              Start Streaming
            </Button>
          )}
          {isRecording && (
            <Button variant="contained" color="warning" onClick={stopRecording} sx={{ flexGrow: 1 }}>
              Pause Streaming
            </Button>
          )}
          {!isRecording && hasStreamedOnce && (
            <Button variant="contained" color="primary" onClick={startRecordingProcess} sx={{ flexGrow: 1 }}>
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

          <Button variant="outlined" onClick={handleClose} sx={{ flexGrow: 1 }}>
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

export default RecordingView; 