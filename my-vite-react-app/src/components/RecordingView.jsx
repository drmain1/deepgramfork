import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useRecordings } from '../contexts/RecordingsContext';
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


function RecordingView({
  patientDetails,
  patientContext,
  selectedLocation,
  selectedProfileId,
  isMultilingual,
  targetLanguage,
  userSettings,
  onClose,
  resumeData
}) {
  const { user, getToken } = useAuth();
  const { startPendingRecording, updateRecording, removeRecording, fetchUserRecordings, selectRecording } = useRecordings();

  const [isRecording, setIsRecording] = useState(false);
  const [hasStreamedOnce, setHasStreamedOnce] = useState(!!resumeData);
  const [error, setError] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState(resumeData?.savedTranscript || '');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState(resumeData?.savedTranscript || '');
  const [sessionId, setSessionId] = useState(resumeData?.sessionId || null);
  const [isSessionSaved, setIsSessionSaved] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [currentProfileId, setCurrentProfileId] = useState(resumeData?.profileId || selectedProfileId);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);

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

  // Handle resuming a draft session
  useEffect(() => {
    if (resumeData && resumeData.sessionId) {
      // Don't update the status when resuming - keep it as draft until actually saved
      // This prevents the race condition where draft status gets overwritten
      console.log('[RecordingView] Resuming draft session:', resumeData.sessionId);
    }
  }, [resumeData]);

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

      // Don't create a session ID here - wait for the backend to provide one
      console.log("[RecordingView] Starting new recording session...");
    }

    const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === currentProfileId);
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

      // Get the access token for WebSocket authentication
      const accessToken = await getToken();
      
      // Choose the correct WebSocket endpoint based on multilingual setting
      const wsEndpoint = isMultilingual 
        ? `ws://localhost:8000/stream/multilingual?token=${encodeURIComponent(accessToken)}`  // Speechmatics for multilingual
        : `ws://localhost:8000/stream?token=${encodeURIComponent(accessToken)}`;              // Deepgram for monolingual medical

      console.log(`[WebSocket] Attempting to connect to ${wsEndpoint} for ${isMultilingual ? 'multilingual (Speechmatics)' : 'monolingual medical (Deepgram)'} transcription...`);
      webSocketRef.current = new WebSocket(wsEndpoint);

      webSocketRef.current.onopen = () => {
        console.log('[WebSocket] Connection OPENED successfully.');
        setError(null);

        // Send initial metadata for profile selection before anything else
        if (user && (user.uid || user.sub) && currentProfileId) {
          const initialMetadata = {
            type: 'initial_metadata',
            user_id: user.uid || user.sub,
            profile_id: currentProfileId,
            is_multilingual: isMultilingual,
            target_language: targetLanguage,
            // Include session_id if resuming a draft to reuse the same session
            session_id: resumeData?.sessionId || undefined
          };
          
          try {
            webSocketRef.current.send(JSON.stringify(initialMetadata));
            console.log('[WebSocket] Sent initial_metadata:', initialMetadata);
          } catch (error) {
            console.error('[WebSocket] Error sending initial_metadata:', error);
            setError('Failed to send initial configuration. Please try again.');
            return;
          }
        } else {
          console.warn('[WebSocket] Could not send initial_metadata: user_id or profile_id missing.', { userId: user ? (user.uid || user.sub) : 'undefined', profileId: currentProfileId });
        }

        if (audioStreamRef.current) {
          // Small delay to ensure WebSocket is fully ready after sending initial metadata
          setTimeout(() => {
            if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
              console.error('[WebSocket] Connection lost before MediaRecorder could start');
              setError('WebSocket connection lost. Please try again.');
              return;
            }
            
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
          }, 100); // 100ms delay to ensure WebSocket is ready
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
              const backendSessionId = parsedMessage.session_id;
              
              // Only update session ID if we don't already have one from resumeData
              if (!resumeData || !resumeData.sessionId) {
                setSessionId(backendSessionId);
                console.log('[WebSocket] Creating new pending recording with backend session ID:', backendSessionId);
                startPendingRecording(backendSessionId, patientDetails || 'New Session');
              } else {
                // We're resuming a draft - the session ID should already be set
                console.log('[WebSocket] Resuming draft with existing session ID:', resumeData.sessionId);
                // Don't update the recording here - it can cause race conditions
                // The recording is already in draft state and should stay that way
              }
              setError('');
            } else if (parsedMessage.type === 'transcript') {
              if (parsedMessage.is_final) {
                setFinalTranscript(prev => (prev ? prev + ' ' : '') + parsedMessage.text);
                setCurrentInterimTranscript('');
              } else {
                setCurrentInterimTranscript(parsedMessage.text);
              }
            } else if (parsedMessage.type === 'translation') {
              // Handle translation messages from Speechmatics
              console.log('Received translation message:', parsedMessage);
              const translationText = `[${parsedMessage.language?.toUpperCase() || 'TRANSLATION'}] ${parsedMessage.text}`;
              if (parsedMessage.is_final) {
                setFinalTranscript(prev => (prev ? prev + '\n' : '') + translationText);
                setCurrentInterimTranscript('');
              } else {
                setCurrentInterimTranscript(translationText);
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

    if (!user || (!user.uid && !user.sub)) {
      setError('User not authenticated or user ID is missing. Cannot save session.');
      setSaveStatusMessage('Error: User authentication issue.');
      return;
    }

    // Update status to 'saving' immediately to show processing indicator
    updateRecording(sessionId, { 
      status: 'saving', 
      name: `Processing: ${patientDetails || 'New Note'}...` 
    });

    setSaveStatusMessage('Generating and saving notes...');
    setIsSessionSaved(false);

    console.log("[RecordingView] Saving session with ID:", sessionId);
    
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const url = `${API_BASE_URL}/api/v1/save_session_data`;
      
      // Get the active transcription profile and its LLM instructions
      const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === currentProfileId);
      const llmTemplate = activeProfile ? activeProfile.name : 'General Summary';
      const llmTemplateId = activeProfile ? activeProfile.id : null;
      const llmInstructions = activeProfile ? (activeProfile.llmInstructions || activeProfile.llmPrompt) : null;
      const encounterType = activeProfile ? activeProfile.name : patientContext || 'General';
      
      // Comprehensive debug logging
      console.log('=== SAVE SESSION DEBUG ===');
      console.log('currentProfileId:', currentProfileId);
      console.log('userSettings.transcriptionProfiles:', userSettings.transcriptionProfiles);
      console.log('activeProfile found:', activeProfile);
      if (activeProfile) {
        console.log('activeProfile details:', {
          id: activeProfile.id,
          name: activeProfile.name,
          llmInstructions: activeProfile.llmInstructions ? `${activeProfile.llmInstructions.substring(0, 100)}...` : null,
          llmPrompt: activeProfile.llmPrompt ? `${activeProfile.llmPrompt.substring(0, 100)}...` : null,
          hasInstructions: !!activeProfile.llmInstructions,
          hasPrompt: !!activeProfile.llmPrompt
        });
      }
      console.log('Final values being sent:');
      console.log('- llmTemplate:', llmTemplate);
      console.log('- llmTemplateId:', llmTemplateId);
      console.log('- encounterType:', encounterType);
      console.log('- hasInstructions:', !!llmInstructions);
      console.log('==========================')
      
      // Embed location data in the transcript content itself as a backup
      const finalTranscriptContent = combinedTranscript;
      let transcriptWithLocation = finalTranscriptContent;
      if (selectedLocation && selectedLocation.trim() && selectedLocation !== '__LEAVE_OUT__') {
        const locationHeader = `CLINIC LOCATION:\n${selectedLocation.trim()}\n\n---\n\n`;
        transcriptWithLocation = locationHeader + finalTranscriptContent;
      }
      
      const accessToken = await getToken();
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          final_transcript_text: transcriptWithLocation,
          patient_context: patientContext,
          patient_name: patientDetails,
          encounter_type: encounterType,
          llm_template: llmTemplate,
          llm_template_id: llmTemplateId,
          location: selectedLocation === '__LEAVE_OUT__' ? '' : selectedLocation,
          user_id: user.uid || user.sub
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
        setSaveStatusMessage('Notes generated and saved!');
        setIsSessionSaved(true);
        
        // Keep the original patient name if provided, otherwise use a fallback
        const savedName = patientDetails || `Session ${sessionId}`;
        
        // Update with correct property names that match RecordingsContext expectations
        updateRecording(sessionId, {
          status: 'saved',
          name: savedName,
          date: new Date().toISOString(),
          s3PathTranscript: result.saved_paths?.original_transcript,
          s3PathPolished: result.saved_paths?.polished_transcript,
          s3PathAudio: result.saved_paths?.audio,
          context: patientContext,
          location: selectedLocation === '__LEAVE_OUT__' ? '' : selectedLocation,
          encounterType: encounterType
        });
        
        // Clear the selection to prevent the "still being processed" error
        // This ensures the UI doesn't try to show a draft or saving status recording
        if (resumeData && selectRecording) {
          selectRecording(null);
        }
        
        // Trigger a fetch of recordings after a short delay to ensure backend is ready
        setTimeout(() => {
          if (fetchUserRecordings) {
            console.log('Fetching updated recordings after save...');
            fetchUserRecordings();
          }
        }, 1000);
      } else {
        const errorText = result.error || result.detail || `HTTP ${response.status}: ${response.statusText}`;
        console.error('Server responded with error:', errorText);
        setSaveStatusMessage(`Error saving notes: ${errorText}`);
        updateRecording(sessionId, { 
          status: 'failed', 
          name: `Failed: ${patientDetails || 'New Note'}`,
          error: errorText 
        });
      }
    } catch (error) {
      console.error('Error saving session:', error);
      setSaveStatusMessage(`Error saving notes: ${error.message}`);
      updateRecording(sessionId, { 
        status: 'failed', 
        name: `Failed: ${patientDetails || 'New Note'}`,
        error: error.message 
      });
    }
  };

  const handleCloseSession = () => {
    // If there's unsaved content, show confirmation dialog
    if (sessionId && !isSessionSaved && combinedTranscript.trim()) {
      setShowCloseConfirmation(true);
    } else {
      // No unsaved content, close immediately
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
      // Update local recording to draft status
      console.log('[DRAFT SAVE] Updating local recording to draft status:', {
        sessionId,
        status: 'draft',
        name: `Draft: ${patientDetails || 'Untitled Session'}`,
        profileId: currentProfileId,
        transcriptLength: combinedTranscript?.length
      });
      
      updateRecording(sessionId, { 
        status: 'draft',
        transcript: combinedTranscript,
        name: `Draft: ${patientDetails || 'Untitled Session'}`,
        profileId: currentProfileId,
        lastUpdated: new Date().toISOString() // Ensure lastUpdated is set
      });
      
      // Save draft to backend
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const accessToken = await getToken();
        
        console.log('[DRAFT SAVE] Calling backend save_draft endpoint...');
        const response = await fetch(`${API_BASE_URL}/api/v1/save_draft`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            session_id: sessionId,
            transcript: combinedTranscript,
            patient_name: patientDetails || 'Untitled Session',
            profile_id: currentProfileId,
            user_id: user.uid || user.sub
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to save draft to backend:', await response.text());
        } else {
          console.log('[DRAFT SAVE] Draft saved successfully to backend');
          // Force a refresh of recordings to get the draft from backend
          setTimeout(() => {
            console.log('[DRAFT SAVE] Triggering fetchUserRecordings...');
            fetchUserRecordings();
          }, 500);
        }
      } catch (error) {
        console.error('Error saving draft to backend:', error);
      }
    } else if (sessionId && !isSessionSaved) {
      // User chose to discard - remove the recording
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
              {patientDetails || 'New Session'} {sessionId && `(${sessionId})`}
              {resumeData && <span className="text-blue-600 ml-2">[Resumed Draft]</span>}
            </p>
            {currentProfileId && userSettings.transcriptionProfiles && (
              <p className="text-sm text-gray-600 mt-1">
                Profile: {userSettings.transcriptionProfiles.find(p => p.id === currentProfileId)?.name || 'Unknown'}
              </p>
            )}
          </div>
          <Button
            variant="outlined"
            onClick={handleCloseSession}
            sx={{ minWidth: '120px' }}
          >
            Close Session
          </Button>
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
                      disabled={!patientDetails.trim()}
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

      {/* Close Confirmation Dialog */}
      <Dialog
        open={showCloseConfirmation}
        onClose={() => setShowCloseConfirmation(false)}
        aria-labelledby="close-confirmation-dialog-title"
        aria-describedby="close-confirmation-dialog-description"
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
    </main>
  );
}

export default RecordingView;