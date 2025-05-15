import React, { useState, useRef, useEffect } from 'react';
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
  CircularProgress // For loading/recording indication if needed
} from '@mui/material';

const AudioRecorder = ({ isOpen, onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState('');
  const [recordingMode, setRecordingMode] = useState('transcribing');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');

  const mediaRecorderRef = useRef(null);
  const webSocketRef = useRef(null);
  const audioStreamRef = useRef(null);

  useEffect(() => {
    // Reset state when the panel is opened for a new session
    if (isOpen) {
      setPatientDetails('');
      setError(null);
      setFinalTranscript('');
      setCurrentInterimTranscript('');
      setCombinedTranscript('');
      setSessionId(null); // Reset session ID
      setIsSessionSaved(false); // Reset save status
      setSaveStatusMessage(''); // Clear save status message
      // setIsRecording(false); // Typically already false, ensure if necessary
    }
  }, [isOpen]);

  useEffect(() => {
    setCombinedTranscript(finalTranscript + currentInterimTranscript);
  }, [finalTranscript, currentInterimTranscript]);

  useEffect(() => {
    return () => {
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        webSocketRef.current.close();
        console.log('WebSocket closed on component unmount');
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setFinalTranscript('');
    setCurrentInterimTranscript('');
    setCombinedTranscript('');

    if (!patientDetails.trim()) {
      setError('Please enter patient details or a session name.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      webSocketRef.current = new WebSocket('ws://localhost:8000/stream');
      webSocketRef.current.onopen = () => {
        console.log('WebSocket connected to ws://localhost:8000/stream');
        setError(null); 
      };
      webSocketRef.current.onmessage = (event) => {
        const message = event.data;
        if (typeof message === 'string') {
            try {
                const parsedMessage = JSON.parse(message);
                if (parsedMessage.type === 'session_init') {
                    console.log('Received session_init:', parsedMessage);
                    setSessionId(parsedMessage.session_id);
                    setIsSessionSaved(false); // Ensure save status is reset for new session
                    setSaveStatusMessage(''); // Clear previous save messages
                } else if (parsedMessage.type === 'error') {
                    console.error('Received error from server via JSON:', parsedMessage.message);
                    setError(parsedMessage.message);
                } else if (parsedMessage.type === 'status') {
                    // Could be used for other status messages if needed
                    console.log('Received status from server:', parsedMessage.message);
                }
            } catch (e) {
                // Handle non-JSON messages (like old direct transcript messages)
                if (message.startsWith('Final: ')) {
                    const text = message.substring('Final: '.length);
                    setFinalTranscript(prev => prev + text + ' '); 
                    setCurrentInterimTranscript(''); 
                } else if (message.startsWith('Interim: ')) {
                    const text = message.substring('Interim: '.length);
                    setCurrentInterimTranscript(text);
                } else if (message.startsWith('Error:')) { // Legacy error handling
                    console.error('Received error from server (string):', message);
                    setError(message);
                } else {
                    console.log('Received unhandled string message from server:', message);
                }
            }
        }
      };
      webSocketRef.current.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error. Ensure the backend server is running and accessible.');
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      };
      webSocketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.reason, `Code: ${event.code}`);
        if (event.wasClean === false) {
        }
        if (isRecording) {
            setIsRecording(false); 
        }
        // Don't automatically clear sessionId here, allow saving after disconnect
      };

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
          webSocketRef.current.send(event.data);
        } else if (event.data.size > 0) {
          console.warn('Audio data available but WebSocket is not open. State:', webSocketRef.current?.readyState);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        if (webSocketRef.current && (webSocketRef.current.readyState === WebSocket.OPEN || webSocketRef.current.readyState === WebSocket.CONNECTING)) {
          webSocketRef.current.close();
          console.log('WebSocket closed on recording stop.');
        }
      };
      mediaRecorderRef.current.start(1000); 
      setIsRecording(true);
    } catch (err) { 
      console.error('Error accessing microphone or starting recording:', err);
      setError(`Error starting recording: ${err.message}. Please ensure microphone permission is granted.`);
      if (webSocketRef.current) {
        webSocketRef.current.close(); 
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); 
    }
    setIsRecording(false);
  };

  const handleSaveSession = async () => {
    if (!sessionId || !combinedTranscript.trim()) {
      setSaveStatusMessage('Error: Session ID or transcript is missing. Cannot save.');
      return;
    }
    if (isSessionSaved) {
        setSaveStatusMessage('This session has already been saved.');
        return;
    }

    setSaveStatusMessage('Saving session data...');
    setIsSessionSaved(false); // Indicate save is in progress/attempted

    try {
      const response = await fetch('/api/v1/save_session_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          final_transcript_text: combinedTranscript,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveStatusMessage(`Session saved! Notes: ${result.notes_s3_path || 'N/A'}, Audio: ${result.audio_s3_path || 'N/A'}`);
        setIsSessionSaved(true);
      } else {
        setSaveStatusMessage(`Error saving session: ${result.detail || response.statusText}`);
        setIsSessionSaved(false); // Allow retry if save failed
      }
    } catch (err) {
      console.error('Failed to save session:', err);
      setSaveStatusMessage(`Failed to save session: ${err.message}`);
      setIsSessionSaved(false); // Allow retry
    }
  };

  if (!isOpen) { 
    return null;
  }

  return (
    <Box sx={{ p: 3, border: '1px solid grey', borderRadius: 1, boxShadow: 3, maxWidth: '600px', mx: 'auto', my: 2 }}>
      <Stack spacing={2} direction="column">
        <Typography variant="h6" component="h2">Start New Session</Typography>

        <FormControl fullWidth required error={!!(error && error.includes('patient details'))}>
          <TextField 
            id="patient-details" 
            label="Patient Details / Session Name" 
            placeholder="e.g., Goldilocks" 
            value={patientDetails} 
            onChange={(e) => setPatientDetails(e.target.value)}
            disabled={isRecording}
            fullWidth
            variant="outlined"
          />
        </FormControl>

        <FormControl fullWidth disabled={isRecording}>
          <InputLabel id="recording-mode-label">Mode</InputLabel>
          <Select 
            labelId="recording-mode-label"
            id="recording-mode" 
            value={recordingMode} 
            label="Mode"
            onChange={(e) => setRecordingMode(e.target.value)}
          >
            <MenuItem value="transcribing">Transcribing</MenuItem>
            <MenuItem value="dictating">Dictating</MenuItem>
          </Select>
        </FormControl>

        {error && <Typography color="error">{error}</Typography>}

        {!isRecording ? (
          <Stack direction="row" spacing={2}>
            <Button variant="contained" color="primary" onClick={startRecording} sx={{ flexGrow: 1 }}>
              Start Recording
            </Button>
            {onClose && (
              <Button variant="outlined" onClick={onClose} sx={{ flexGrow: 1 }}>
                Cancel
              </Button>
            )}
          </Stack>
        ) : (
          <Button variant="contained" color="error" onClick={stopRecording} fullWidth>
            Stop Recording
          </Button>
        )}

        {/* Save Session Button - Appears after recording stops and if not already saved */} 
        {!isRecording && sessionId && combinedTranscript.trim() && (
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={handleSaveSession} 
            disabled={isSessionSaved || saveStatusMessage === 'Saving session data...'}
            fullWidth
            sx={{ mt: 1 }}
          >
            {isSessionSaved ? 'Session Saved' : (saveStatusMessage === 'Saving session data...' ? 'Saving...' : 'Save Session to S3')}
          </Button>
        )}

        {saveStatusMessage && (
          <Typography sx={{ mt: 1, fontStyle: 'italic', color: error && saveStatusMessage.toLowerCase().includes('error') ? 'error.main' : 'text.secondary' }}>
            {saveStatusMessage}
          </Typography>
        )}

        {isRecording && (
          <Typography sx={{ mt: 1, fontStyle: 'italic' }}>Live transcription will appear below...</Typography>
        )}
        <TextField 
          label="Live Transcription"
          placeholder="Live transcription..."
          value={combinedTranscript} 
          InputProps={{ readOnly: true }}
          multiline
          rows={4}
          fullWidth
          variant="outlined"
          sx={{ mt: 1 }}
        />
      </Stack>
    </Box>
  );
};

export default AudioRecorder;
