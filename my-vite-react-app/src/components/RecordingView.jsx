import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useRecordings } from '../contexts/RecordingsContext';
import PreviousFindingsEnhanced from './PreviousFindingsEnhanced';
import useTranscriptionSessionStore from '../stores/transcriptionSessionStore';
import usePatientsStore from '../stores/patientsStore';
import { useTranscriptionWebSocket } from '../hooks/useTranscriptionWebSocket';
import { useAudioRecording } from '../hooks/useAudioRecording';
import { 
  buildSaveSessionPayload, 
  saveSessionToBackend, 
  saveDraftToBackend 
} from '../utils/sessionSaveUtils';
import { 
  RECORDING_STATUS, 
  WS_MESSAGE_TYPES, 
  WS_CLOSE_CODES,
  ERROR_MESSAGES,
  WS_INIT_DELAY,
  LOCATION_LEAVE_OUT
} from '../constants/recordingConstants';
import {
  Box,
  Button,
  Typography,
  Stack,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';


function RecordingView({
  userSettings,
  onClose,
  resumeData
}) {
  // Get all state from Zustand store
  const {
    patientDetails,
    patientContext,
    selectedLocation,
    selectedProfileId,
    isMultilingual,
    targetLanguage,
    selectedPatientId,
    isDictationMode,
    dateOfService,
    evaluationType,
    initialEvaluationId,
    previousEvaluationId,
    previousFindings,
    includePreviousFindingsInPrompt,
    showPreviousFindingsSidebar,
    setShowPreviousFindingsSidebar,
    recordingStartTime
  } = useTranscriptionSessionStore();
  
  // Get the patient object from the patients store
  const { getPatientById } = usePatientsStore();
  const selectedPatient = selectedPatientId ? getPatientById(selectedPatientId) : null;
  const { user, getToken } = useAuth();
  const { startPendingRecording, updateRecording, removeRecording, fetchUserRecordings, selectRecording } = useRecordings();

  const [hasStreamedOnce, setHasStreamedOnce] = useState(!!resumeData);
  const [finalTranscript, setFinalTranscript] = useState(resumeData?.savedTranscript || '');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [sessionId, setSessionId] = useState(resumeData?.sessionId || null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [currentProfileId, setCurrentProfileId] = useState(resumeData?.profileId || selectedProfileId);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [error, setError] = useState(null);

  // Use resumeData patient details if available
  const effectivePatientDetails = resumeData?.patientDetails || patientDetails;
  
  // Debug logging for draft resume
  useEffect(() => {
    if (resumeData) {
      console.log('[RecordingView] Resume data loaded:', {
        sessionId: resumeData.sessionId,
        patientDetails: resumeData.patientDetails,
        effectivePatientDetails,
        storePatientDetails: patientDetails,
        savedTranscriptLength: resumeData.savedTranscript?.length || 0,
        profileId: resumeData.profileId
      });
    }
  }, [resumeData, effectivePatientDetails, patientDetails]);
  
  // Debug: Log when showCloseConfirmation changes
  useEffect(() => {
    console.log('showCloseConfirmation changed to:', showCloseConfirmation);
  }, [showCloseConfirmation]);

  // Use custom hooks
  const { 
    connect: connectWebSocket, 
    disconnect: disconnectWebSocket, 
    sendMessage, 
    isConnected: isWebSocketConnected,
    error: wsError 
  } = useTranscriptionWebSocket();
  
  const { 
    startRecording: startAudioRecording, 
    stopRecording: stopAudioRecording, 
    cleanup: cleanupAudio,
    isRecording,
    error: audioError 
  } = useAudioRecording();

  // Compute combined transcript instead of storing it
  const combinedTranscript = useMemo(() => 
    finalTranscript + currentInterimTranscript, 
    [finalTranscript, currentInterimTranscript]
  );

  // Combine errors from different sources
  useEffect(() => {
    setError(wsError || audioError || null);
  }, [wsError, audioError]);



  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
      cleanupAudio();
    };
  }, [disconnectWebSocket, cleanupAudio]);

  const handleWebSocketMessage = (message) => {
    if (message.type === WS_MESSAGE_TYPES.SESSION_INIT) {
      const backendSessionId = message.session_id;
      
      if (!resumeData || !resumeData.sessionId) {
        setSessionId(backendSessionId);
        startPendingRecording(backendSessionId, effectivePatientDetails || 'New Session');
      }
      setError('');
    } else if (message.type === WS_MESSAGE_TYPES.TRANSCRIPT) {
      if (message.is_final) {
        setFinalTranscript(prev => (prev ? prev + ' ' : '') + message.text);
        setCurrentInterimTranscript('');
      } else {
        setCurrentInterimTranscript(message.text);
      }
    } else if (message.type === WS_MESSAGE_TYPES.TRANSLATION) {
      const translationText = `[${message.language?.toUpperCase() || 'TRANSLATION'}] ${message.text}`;
      if (message.is_final) {
        setFinalTranscript(prev => (prev ? prev + '\n' : '') + translationText);
        setCurrentInterimTranscript('');
      } else {
        setCurrentInterimTranscript(translationText);
      }
    } else if (message.type === WS_MESSAGE_TYPES.ERROR) {
      setError(`Streaming error: ${message.message}`);
    } else if (message.type === WS_MESSAGE_TYPES.STATUS) {
      if (message.message.includes('GCS') || message.message.includes('Vertex')) {
        setSaveStatusMessage(prev => prev ? `${prev}\n${message.message}` : message.message);
      }
    } else if (message.type === 'legacy') {
      // Handle legacy plain text messages
      handleLegacyMessage(message.text);
    }
  };

  const handleLegacyMessage = (text) => {
    if (text.startsWith('Interim: ')) {
      setCurrentInterimTranscript(text.substring('Interim: '.length));
    } else if (text.startsWith('Final: ')) {
      setFinalTranscript(prev => (prev ? prev + ' ' : '') + text.substring('Final: '.length));
      setCurrentInterimTranscript('');
    } else if (text.startsWith('SessionID: ')) {
      const id = text.substring('SessionID: '.length);
      console.log('Setting sessionId from WebSocket:', id);
      setSessionId(id);
      setError('');
    } else if (text.startsWith('Error: ')) {
      setError(`Streaming error: ${text.substring('Error: '.length)}`);
    }
  };

  const startRecordingProcess = async () => {
    console.log('[RecordingView] Starting recording process...');
    setError(null);
    if (!hasStreamedOnce || !sessionId) {
      setFinalTranscript('');
      setCurrentInterimTranscript('');
      setIsSessionSaved(false);
      setSaveStatusMessage('');
    }

    try {
      // Get the access token for WebSocket authentication
      const accessToken = await getToken();
      console.log('[RecordingView] Got access token');
      
      // Choose the correct WebSocket endpoint based on multilingual setting
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const wsProtocol = API_BASE_URL.startsWith('https') ? 'wss' : 'ws';
      const wsBaseUrl = isMultilingual 
        ? `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/stream/multilingual`
        : `${wsProtocol}://${API_BASE_URL.replace(/^https?:\/\//, '')}/stream`;
      
      console.log('[RecordingView] Connecting to WebSocket:', wsBaseUrl);

      await connectWebSocket(wsBaseUrl, {
        accessToken,
        onOpen: handleWebSocketOpen,
        onMessage: handleWebSocketMessage,
        onError: (error) => {
          console.error('[RecordingView] WebSocket error:', error);
          stopAudioRecording();
        },
        onClose: (event) => {
          console.log('[RecordingView] WebSocket closed:', event.code, event.reason);
          if (isRecording && event.code !== WS_CLOSE_CODES.NORMAL) {
            setError(ERROR_MESSAGES.WS_CLOSED_UNEXPECTED);
          }
          stopAudioRecording();
        }
      });
      
      console.log('[RecordingView] WebSocket connected successfully');
    } catch (err) {
      console.error('[RecordingView] Error in startRecordingProcess:', err);
      setError(`Error starting stream: ${err.message}. ${ERROR_MESSAGES.MICROPHONE_ACCESS}`);
    }
  };

  const handleWebSocketOpen = () => {
    // Send initial metadata
    if (user && (user.uid || user.sub) && currentProfileId) {
      const initialMetadata = {
        type: 'initial_metadata',
        user_id: user.uid || user.sub,
        profile_id: currentProfileId,
        is_multilingual: isMultilingual,
        target_language: targetLanguage,
        session_id: resumeData?.sessionId || undefined,
        date_of_service: (isDictationMode && dateOfService && dateOfService.trim()) ? dateOfService : undefined
      };
      
      // Debug logging for dictation mode
      if (isDictationMode) {
        console.log('[DICTATION DEBUG] Sending WebSocket metadata:', {
          isDictationMode,
          dateOfService,
          trimmedDate: dateOfService?.trim(),
          willSendDate: !!(isDictationMode && dateOfService && dateOfService.trim())
        });
      }
      
      const sent = sendMessage(initialMetadata);
      
      if (!sent) {
        setError(ERROR_MESSAGES.INITIAL_METADATA_SEND);
        return;
      }
    }

    // Start audio recording after a small delay
    setTimeout(async () => {
      const started = await startAudioRecording(
        (audioData) => {
          // Send audio data through WebSocket
          sendMessage(audioData);
        },
        () => {
          // On recording stop, send EOS
          sendMessage({ type: 'eos' });
        }
      );
      
      if (started) {
        setHasStreamedOnce(true);
      } else {
        setError(ERROR_MESSAGES.AUDIO_STREAM_LOST);
        disconnectWebSocket();
      }
    }, WS_INIT_DELAY);
  };

  const stopRecording = () => {
    stopAudioRecording();
    disconnectWebSocket(WS_CLOSE_CODES.NORMAL, WS_CLOSE_CODES.USER_PAUSE);
  };

  const handleSaveSession = async () => {
    // Validation
    if (isRecording) {
      setError(ERROR_MESSAGES.RECORDING_ACTIVE);
      return;
    }
    if (!sessionId) {
      setError(ERROR_MESSAGES.NO_SESSION_ID);
      setSaveStatusMessage('Error: Session ID missing.');
      return;
    }
    if (!combinedTranscript.trim()) {
      setError(ERROR_MESSAGES.NO_TRANSCRIPT);
      setSaveStatusMessage('No transcript content to save.');
      return;
    }
    if (!user || (!user.uid && !user.sub)) {
      setError(ERROR_MESSAGES.NO_USER_AUTH);
      setSaveStatusMessage('Error: User authentication issue.');
      return;
    }

    // Update status to 'processing' immediately
    updateRecording(sessionId, { 
      status: RECORDING_STATUS.PROCESSING, 
      name: `${effectivePatientDetails || 'New Note'}` 
    });

    setSaveStatusMessage('Generating and saving notes...');
    setIsSessionSaved(false);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const accessToken = await getToken();
      
      const payload = buildSaveSessionPayload({
        sessionId,
        transcript: combinedTranscript,
        location: selectedLocation,
        patientDetails: effectivePatientDetails,
        patientContext,
        selectedPatient,
        userSettings,
        currentProfileId,
        user,
        isDictationMode,
        dateOfService,
        evaluationType,
        initialEvaluationId,
        previousEvaluationId,
        includePreviousFindingsInPrompt,
        previousFindings,
        recordingStartTime
      });
      
      // Debug logging for recording time
      console.log('[RECORDING TIME DEBUG] Saving with:', {
        recordingStartTime,
        recordingStartTimeISO: recordingStartTime ? new Date(recordingStartTime).toISOString() : null,
        recordingStartTimeLocal: recordingStartTime ? new Date(recordingStartTime).toLocaleString() : null,
        payloadRecordingTime: payload.recording_start_time
      });
      
      // Debug logging for dictation mode
      if (isDictationMode) {
        console.log('[DICTATION DEBUG] Saving with payload:', {
          isDictationMode,
          dateOfService,
          date_of_service_in_payload: payload.date_of_service,
          willSendDate: !!(isDictationMode && dateOfService && dateOfService.trim())
        });
      }
      
      const result = await saveSessionToBackend(payload, accessToken, API_BASE_URL);
      
      console.log('[SAVE SUCCESS] Result from backend:', result);
      console.log('[SAVE SUCCESS] Session saved with ID:', sessionId);
      if (isDictationMode) {
        console.log('[SAVE SUCCESS] Dictation mode save completed for date:', dateOfService);
      }
      
      setSaveStatusMessage('Notes generated and saved!');
      setIsSessionSaved(true);
      
      const savedName = effectivePatientDetails || `Session ${sessionId}`;
      const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === currentProfileId);
      const encounterType = activeProfile ? activeProfile.name : patientContext || 'General';
      
      updateRecording(sessionId, {
        status: RECORDING_STATUS.PROCESSING,
        name: savedName,
        gcsPathTranscript: result.saved_paths?.original_transcript,
        gcsPathPolished: result.saved_paths?.polished_transcript,
        gcsPathAudio: result.saved_paths?.audio,
        context: patientContext,
        location: selectedLocation === LOCATION_LEAVE_OUT ? '' : selectedLocation,
        encounterType: encounterType
      });
      
      if (resumeData && selectRecording) {
        selectRecording(null);
      }
      
      if (fetchUserRecordings) {
        fetchUserRecordings();
      }
    } catch (error) {
      console.error('[SAVE ERROR] Full error details:', error);
      console.error('[SAVE ERROR] Error message:', error.message);
      console.error('[SAVE ERROR] Session ID:', sessionId);
      console.error('[SAVE ERROR] Transcript length:', combinedTranscript?.length || 0);
      console.error('[SAVE ERROR] isDictationMode:', isDictationMode);
      console.error('[SAVE ERROR] dateOfService:', dateOfService);
      
      setSaveStatusMessage(`Error saving notes: ${error.message}`);
      updateRecording(sessionId, { 
        status: RECORDING_STATUS.FAILED, 
        name: `Failed: ${effectivePatientDetails || 'New Note'}`,
        error: error.message 
      });
    }
  };

  const handleCloseSession = () => {
    console.log('handleCloseSession called', {
      sessionId,
      isSessionSaved,
      hasTranscript: !!combinedTranscript.trim(),
      transcriptLength: combinedTranscript.length
    });
    
    // If there's unsaved content, show confirmation dialog
    if (sessionId && !isSessionSaved && combinedTranscript.trim()) {
      console.log('Setting showCloseConfirmation to true');
      setShowCloseConfirmation(true);
    } else {
      // No unsaved content, close immediately
      console.log('No unsaved content, closing immediately');
      if (isRecording) {
        stopRecording();
      }
      onClose();
    }
  };

  const handleConfirmClose = async (saveAsDraft) => {
    if (isRecording) {
      stopRecording();
    }
    
    if (saveAsDraft && sessionId) {
      updateRecording(sessionId, { 
        status: RECORDING_STATUS.DRAFT,
        transcript: combinedTranscript,
        name: `Draft: ${effectivePatientDetails || 'Untitled Session'}`,
        profileId: currentProfileId,
        lastUpdated: new Date().toISOString()
      });
      
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const accessToken = await getToken();
        
        await saveDraftToBackend({
          sessionId,
          transcript: combinedTranscript,
          patientDetails: effectivePatientDetails,
          currentProfileId,
          user,
          isDictationMode,
          dateOfService,
          recordingStartTime,
          accessToken,
          apiBaseUrl: API_BASE_URL
        });
        
        setTimeout(() => {
          fetchUserRecordings();
        }, 500);
      } catch (error) {
        // Error already logged in saveDraftToBackend
      }
    } else if (sessionId && !isSessionSaved) {
      removeRecording(sessionId);
    }
    
    setShowCloseConfirmation(false);
    onClose();
  };


  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-semibold text-gray-900">Recording Session</h1>
            <p className="text-lg text-gray-500 mt-2">
              {effectivePatientDetails || 'New Session'} {sessionId && `(${sessionId})`}
              {resumeData && <span className="text-blue-600 ml-2">[Resumed Draft]</span>}
              {isDictationMode && dateOfService && (
                <span className="text-purple-600 ml-2">
                  [Dictation Mode - Service Date: {(() => {
                    // Parse YYYY-MM-DD format to avoid timezone issues
                    const [year, month, day] = dateOfService.split('-').map(Number);
                    return new Date(year, month - 1, day).toLocaleDateString();
                  })()}]
                </span>
              )}
            </p>
            {currentProfileId && userSettings.transcriptionProfiles && (
              <p className="text-sm text-gray-600 mt-1">
                Profile: {userSettings.transcriptionProfiles.find(p => p.id === currentProfileId)?.name || 'Unknown'}
              </p>
            )}
          </div>
          <Box display="flex" gap={2}>
            {evaluationType === 're_evaluation' && previousFindings && (
              <Button
                variant="outlined"
                onClick={() => setShowPreviousFindingsSidebar(!showPreviousFindingsSidebar)}
                startIcon={showPreviousFindingsSidebar ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              >
                {showPreviousFindingsSidebar ? 'Hide' : 'Show'} Previous Findings
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={handleCloseSession}
              sx={{ minWidth: '120px' }}
            >
              Close Session
            </Button>
          </Box>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <Grid container spacing={3}>
            {/* Left Column - Controls */}
            <Grid item xs={12} md={4}>
              <Box className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <Typography variant="h6" className="mb-4">Recording Controls</Typography>
                
                <Stack spacing={2}>
                  {!isRecording ? (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={startRecordingProcess}
                      disabled={!effectivePatientDetails?.trim()}
                      size="large"
                      fullWidth
                    >
                      {hasStreamedOnce ? 'Resume Recording' : 'Start Recording'}
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={stopRecording}
                      size="large"
                      fullWidth
                    >
                      Pause Recording
                    </Button>
                  )}

                  <Button
                    variant="outlined"
                    onClick={handleSaveSession}
                    disabled={isRecording || !combinedTranscript.trim() || isSessionSaved}
                    size="large"
                    fullWidth
                  >
                    {isSessionSaved ? 'Notes Saved' : 'Generate & Save Notes'}
                  </Button>
                </Stack>

                {error && (
                  <Box className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                    <Typography color="error" variant="body2">
                      {error}
                    </Typography>
                  </Box>
                )}

                {saveStatusMessage && (
                  <Box className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                    <Typography variant="body2" style={{ whiteSpace: 'pre-line' }}>
                      {saveStatusMessage}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Right Column - Transcript */}
            <Grid item xs={12} md={8}>
              <Box className="bg-white rounded-lg shadow-sm border border-gray-200" sx={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6">
                    Live Transcript {isRecording && <span className="text-red-500">● Recording</span>}
                  </Typography>
                  
                  {/* Profile Selection Dropdown */}
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel id="profile-select-label">Transcription Profile</InputLabel>
                    <Select
                      labelId="profile-select-label"
                      id="profile-select"
                      value={currentProfileId || ''}
                      label="Transcription Profile"
                      onChange={(e) => setCurrentProfileId(e.target.value)}
                      disabled={isRecording}
                    >
                      {userSettings.transcriptionProfiles?.map((profile) => (
                        <MenuItem key={profile.id} value={profile.id}>
                          {profile.name}
                          {profile.isDefault && <Chip label="Default" size="small" sx={{ ml: 1 }} />}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                
                <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                  <Box 
                    sx={{ 
                      minHeight: '400px',
                      p: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      backgroundColor: '#fafafa',
                      fontFamily: 'monospace',
                      fontSize: '14px',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      overflowY: 'auto'
                    }}
                  >
                    {combinedTranscript || 'Transcript will appear here as you speak...'}
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </div>
      </div>

      {/* Debug: Show dialog state */}
      {showCloseConfirmation && (
        <div style={{ 
          position: 'fixed', 
          top: 10, 
          right: 10, 
          background: 'red', 
          color: 'white', 
          padding: '10px',
          zIndex: 9999 
        }}>
          Dialog should be visible!
        </div>
      )}

      {/* Close Confirmation Dialog */}
      <Dialog
        open={showCloseConfirmation}
        onClose={() => setShowCloseConfirmation(false)}
        aria-labelledby="close-confirmation-dialog-title"
        aria-describedby="close-confirmation-dialog-description"
        sx={{ zIndex: 9999 }}
        disablePortal={false}
      >
        <DialogTitle id="close-confirmation-dialog-title">
          Unsaved Recording
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="close-confirmation-dialog-description">
            You have an unsaved recording session with transcript content. 
            Would you like to save it as a draft to continue later, or discard it?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCloseConfirmation(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={() => handleConfirmClose(false)} color="error">
            Discard
          </Button>
          <Button onClick={() => handleConfirmClose(true)} color="primary" variant="contained">
            Save as Draft
          </Button>
        </DialogActions>
      </Dialog>

      {/* Previous Findings Panel */}
      {evaluationType === 're_evaluation' && previousFindings && (
        <PreviousFindingsEnhanced 
          findings={previousFindings} 
          onClose={() => setShowPreviousFindingsSidebar(false)}
          isOpen={showPreviousFindingsSidebar}
          patientName={effectivePatientDetails}
        />
      )}
    </main>
  );
}

export default RecordingView;