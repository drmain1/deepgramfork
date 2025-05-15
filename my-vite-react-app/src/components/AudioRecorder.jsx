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
  CircularProgress,
  Grid
} from '@mui/material';

const AudioRecorder = ({ isOpen, onClose }) => {
  const [currentView, setCurrentView] = useState('setup');
  const [isRecording, setIsRecording] = useState(false);
  const [hasStreamedOnce, setHasStreamedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [encounterType, setEncounterType] = useState('in-person');
  const [llmTemplate, setLlmTemplate] = useState('general-summary');
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
    if (isOpen) {
      setCurrentView('setup');
      setPatientDetails('');
      setPatientContext('');
      setEncounterType('in-person');
      setLlmTemplate('general-summary');
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
    }
  }, [isOpen]);

  useEffect(() => {
    setCombinedTranscript(finalTranscript + currentInterimTranscript);
  }, [finalTranscript, currentInterimTranscript]);

  useEffect(() => {
    return () => {
      if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
        console.log('WebSocket closing due to component unmount or panel close');
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
    };
  }, []);

  const _startRecordingProcess = async () => {
    setError(null);
    if (!hasStreamedOnce || !sessionId) {
      setFinalTranscript('');
      setCurrentInterimTranscript('');
      setCombinedTranscript('');
      setIsSessionSaved(false);
      setSaveStatusMessage('');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
        webSocketRef.current.close();
        webSocketRef.current = null;
        console.log("Previous WebSocket connection closed before resuming.");
      }

      webSocketRef.current = new WebSocket('ws://localhost:8000/stream');
      webSocketRef.current.onopen = () => {
        console.log('WebSocket connected to ws://localhost:8000/stream');
        setError(null);
        const sessionSetupData = {
          type: 'session_config',
          patient_name: patientDetails,
          patient_context: patientContext,
          encounter_type: encounterType,
          llm_template: llmTemplate,
          session_id: sessionId
        };
        console.log('Would send session_config data (if backend supported):', sessionSetupData);
      };
      webSocketRef.current.onmessage = (event) => {
        let message = event.data;
        if (typeof message === 'string') {
          // Remove BOM if present (character U+FEFF)
          if (message.startsWith('\uFEFF')) {
            message = message.substring(1);
          }

          try {
            // First, try to parse as JSON
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'session_init') {
              console.log('Received session_init (JSON):', parsedMessage);
              // Set session ID if not set or if it's a resume and backend sends a new one
              setSessionId(parsedMessage.session_id);
              setError(''); // Clear previous errors on new session/resume
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
            // If JSON.parse fails, assume it's one of our plain text messages
            if (message.startsWith('Interim: ')) {
              const transcript = message.substring('Interim: '.length);
              setCurrentInterimTranscript(transcript); 
            } else if (message.startsWith('Final: ')) {
              const transcript = message.substring('Final: '.length);
              setFinalTranscript(prev => (prev ? prev + ' ' : '') + transcript);
              setCurrentInterimTranscript(''); 
            } else if (message.startsWith('SessionID: ')) { // Legacy plain text session ID
              const id = message.substring('SessionID: '.length);
              setSessionId(id);
              console.log('Session ID received (plain text):', id);
              setError('');
            } else if (message.startsWith('Error: ')) { // Plain text error
              const errorMessage = message.substring('Error: '.length);
              console.error('Error from backend (plain text):', errorMessage);
              setError(`Streaming error: ${errorMessage}`);
            } else if (message.startsWith('Status: ')) { // Plain text status
              const statusMessage = message.substring('Status: '.length);
              console.log('Status from backend (plain text):', statusMessage);
            } else if (message.startsWith("WebSocket connection established with Session ID:")) { // Legacy session init
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
        console.error('WebSocket error:', event);
        setError('WebSocket connection error. Ensure the backend server is running.');
        setIsRecording(false);
      };
      webSocketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.reason, `Code: ${event.code}`);
        if (isRecording && event.code !== 1000) {
          setError(prevError => prevError || 'WebSocket connection closed unexpectedly.');
        }
        setIsRecording(false);
      };

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0 && webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
          webSocketRef.current.send(event.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        console.log('MediaRecorder stopped.');
      };

      mediaRecorderRef.current.start(500);
      setIsRecording(true);
      if (!hasStreamedOnce) setHasStreamedOnce(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(`Error starting recording: ${err.message}. Please check microphone permissions.`);
      setIsRecording(false);
      if (webSocketRef.current) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    console.log('stopRecording (Pause Streaming) called');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      console.log('Microphone stream closed on pause.');
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

    setSaveStatusMessage('Generating and saving notes...');
    setIsSessionSaved(false);

    try {
      const response = await fetch('http://localhost:8000/save_session_s3', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          final_transcript_text: combinedTranscript,
          patient_context: patientContext,
          encounter_type: encounterType,
          llm_template: llmTemplate
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSaveStatusMessage(`Notes generated and saved!\nNotes: ${result.notes_s3_path || 'N/A'}\nAudio: ${result.audio_s3_path || 'N/A'}`);
        setIsSessionSaved(true);
      } else {
        setSaveStatusMessage(`Error saving session: ${result.detail || response.statusText}`);
        setError(`Error saving session: ${result.detail || response.statusText}`);
        setIsSessionSaved(false);
      }
    } catch (err) {
      console.error('Failed to save session:', err);
      setSaveStatusMessage(`Failed to save session: ${err.message}`);
      setError(`Failed to save session: ${err.message}`);
      setIsSessionSaved(false);
    }
  };

  const handleStartEncounter = () => {
    if (!patientDetails.trim()) {
      setError('Please enter patient details or a session name.');
      return;
    }
    setError(null);
    setCurrentView('recording');
  };

  const handleCancelAndClose = () => {
    if (isRecording) {
      stopRecording();
    }
    if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
      webSocketRef.current.close();
      webSocketRef.current = null;
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  if (currentView === 'setup') {
    return (
      <Box sx={{ p: 3, border: '1px solid #ccc', borderRadius: 2, boxShadow: 3, maxWidth: '700px', mx: 'auto', my: 2, backgroundColor: 'white' }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 3 }}>
          Setup New Encounter
        </Typography>
        <Stack spacing={2.5} direction="column">
          <FormControl fullWidth required error={!!(error && error.includes('patient details'))}>
            <TextField
              id="patient-details"
              label="Patient Name / Session Title"
              placeholder="e.g., John Doe - Annual Checkup"
              value={patientDetails}
              onChange={(e) => setPatientDetails(e.target.value)}
              variant="outlined"
            />
          </FormControl>

          <FormControl fullWidth>
            <TextField
              id="patient-context"
              label="Patient Context (Optional)"
              placeholder="e.g., 45 y/o male, history of hypertension, presenting with cough..."
              value={patientContext}
              onChange={(e) => setPatientContext(e.target.value)}
              multiline
              rows={3}
              variant="outlined"
            />
          </FormControl>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="encounter-type-label">Encounter Type</InputLabel>
                <Select
                  labelId="encounter-type-label"
                  id="encounter-type"
                  value={encounterType}
                  label="Encounter Type"
                  onChange={(e) => setEncounterType(e.target.value)}
                >
                  <MenuItem value="in-person">In-Person Visit</MenuItem>
                  <MenuItem value="telehealth">Telehealth Consultation</MenuItem>
                  <MenuItem value="phone-call">Phone Call</MenuItem>
                  <MenuItem value="virtual-scribe">Virtual Scribe</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="llm-template-label">LLM Polishing Template</InputLabel>
                <Select
                  labelId="llm-template-label"
                  id="llm-template"
                  value={llmTemplate}
                  label="LLM Polishing Template"
                  onChange={(e) => setLlmTemplate(e.target.value)}
                >
                  <MenuItem value="general-summary">General Summary</MenuItem>
                  <MenuItem value="soap-note">SOAP Note</MenuItem>
                  <MenuItem value="progress-note">Progress Note</MenuItem>
                  <MenuItem value="consult-note">Consultation Note</MenuItem>
                  <MenuItem value="none">None (Raw Transcript)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {error && <Typography color="error" sx={{ mt: 1, textAlign: 'center' }}>{error}</Typography>}

          <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={onClose} sx={{ flexGrow: 1 }}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleStartEncounter} sx={{ flexGrow: 1 }}>
              Start Encounter
            </Button>
          </Stack>
        </Stack>
      </Box>
    );
  } else if (currentView === 'recording') {
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: 'calc(100vh - 120px)', // Example height, adjust as needed based on header/other elements
        p: 3, 
        border: '1px solid #ccc', 
        borderRadius: 2, 
        boxShadow: 3, 
        maxWidth: '900px', 
        width: '100%', 
        mx: 'auto', 
        my: 2, 
        backgroundColor: 'white' 
      }}>
        <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center', mb: 1, flexShrink: 0 }}>
          Encounter: {patientDetails || "Live Session"}
        </Typography>
        
        {isRecording && (
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 1, flexShrink: 0 }}>
            <CircularProgress size={20} color="error" />
            <Typography color="error.main" variant="subtitle1">Streaming Live...</Typography>
          </Stack>
        )}
        {!isRecording && hasStreamedOnce && (
          <Typography color="text.secondary" variant="subtitle1" sx={{ textAlign: 'center', mb:1, flexShrink: 0}}>
            Streaming Paused
          </Typography>
        )}

        <Box 
          sx={{ 
            flexGrow: 1, 
            overflowY: 'auto', 
            p: 2, 
            mb: 2, 
            backgroundColor: '#f9f9f9', 
            borderRadius: 1,
            border: '1px solid #eee',
            minHeight: '200px', // Ensure a minimum height
            whiteSpace: 'pre-wrap', // To respect newlines from the transcript string
            wordBreak: 'break-word'
          }}
        >
          {combinedTranscript || (isRecording ? "Listening..." : (hasStreamedOnce ? "Paused. Resume streaming or generate notes." : "Start streaming to see live transcription."))}
        </Box>

        {error && !error.toLowerCase().includes('saving') && <Typography color="error" sx={{ mb: 2, textAlign: 'center', flexShrink: 0 }}>{error}</Typography>}
        
        <Stack spacing={2} sx={{ mt: 'auto', flexShrink: 0 }}> {/* Controls at the bottom */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
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

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
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

        {saveStatusMessage && (
          <Typography sx={{ mt: 2, fontStyle: 'italic', color: (error && (saveStatusMessage.toLowerCase().includes('error') || saveStatusMessage.toLowerCase().includes('failed'))) ? 'error.main' : 'text.secondary', whiteSpace: 'pre-line', textAlign: 'center', flexShrink: 0 }}>
            {saveStatusMessage}
          </Typography>
        )}
      </Box>
    );
  }

  return null; // Should not reach here if isOpen is true
};

export default AudioRecorder;
