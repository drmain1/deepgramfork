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

  const mediaRecorderRef = useRef(null);
  const webSocketRef = useRef(null);
  const audioStreamRef = useRef(null);

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
            if (message.startsWith('Final: ')) {
                const text = message.substring('Final: '.length);
                setFinalTranscript(prev => prev + text + ' '); 
                setCurrentInterimTranscript(''); 
            } else if (message.startsWith('Interim: ')) {
                const text = message.substring('Interim: '.length);
                setCurrentInterimTranscript(text);
            } else if (message.startsWith('Error:')) {
                console.error('Received error from server:', message);
                setError(message);
            } else {
                console.log('Received unhandled message from server:', message);
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

  if (!isOpen) { 
    return null;
  }

  return (
    <Box sx={{ p: 3, border: '1px solid grey', borderRadius: 1, boxShadow: 3, maxWidth: '600px', mx: 'auto', my: 2 }}>
      <Stack spacing={2} direction="column">
        <Typography variant="h6" component="h2">Start New Session</Typography>

        <FormControl fullWidth required error={!!(error && error.includes('patient details'))}>
          <InputLabel htmlFor="patient-details">Patient Details / Session Name</InputLabel>
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
