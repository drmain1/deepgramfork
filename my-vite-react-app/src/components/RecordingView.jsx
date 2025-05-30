import React, { useState, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRecordings } from '../contexts/RecordingsContext';


function RecordingView({
  patientDetails,
  patientContext,
  selectedLocation,
  selectedProfileId,
  isMultilingual,
  targetLanguage,
  userSettings,
  onClose
}) {
  const { user } = useAuth0();
  const { startPendingRecording, updateRecording, removeRecording, fetchUserRecordings } = useRecordings();

  const [isRecording, setIsRecording] = useState(false);
  const [hasStreamedOnce, setHasStreamedOnce] = useState(false);
  const [error, setError] = useState(null);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [currentInterimTranscript, setCurrentInterimTranscript] = useState('');
  const [combinedTranscript, setCombinedTranscript] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [frontendGeneratedId, setFrontendGeneratedId] = useState(null);
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

      // Generate session ID in same format as backend: YYYYMMDDHHMMSSSSSS
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
      const microseconds = String(Math.floor(Math.random() * 1000)).padStart(3, '0'); // Approximate microseconds
      
      let newSessionId = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}${microseconds}`;
      console.log('=== STARTING NEW RECORDING ===');
      console.log('Generated frontend sessionId:', newSessionId);
      console.log('Backend format expected');
      console.log('==============================');
      setFrontendGeneratedId(newSessionId);
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
            profile_id: selectedProfileId,
            is_multilingual: isMultilingual,
            target_language: targetLanguage
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
              console.log('=== UPDATING SESSION ID ===');
              console.log('Frontend generated ID:', frontendGeneratedId);
              console.log('Current sessionId:', sessionId);
              console.log('New sessionId from backend:', parsedMessage.session_id);
              console.log('============================');
              
              // Always remove the old recording and replace with backend ID
              // Use sessionId if available, otherwise find any pending recording
              if (sessionId && sessionId !== parsedMessage.session_id) {
                console.log('Removing old recording with ID:', sessionId);
                removeRecording(sessionId);
              } else {
                // If sessionId is null/undefined, remove any pending recordings
                console.log('Cleaning up any pending recordings before adding backend recording');
              }
              
              console.log('Adding new recording with backend ID:', parsedMessage.session_id);
              startPendingRecording(parsedMessage.session_id, patientDetails || 'New Session');
              
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
      
      // Get the active transcription profile and its LLM instructions
      const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === selectedProfileId);
      const llmTemplate = activeProfile ? activeProfile.name : 'General Summary';
      const llmTemplateId = activeProfile ? activeProfile.id : null;
      const llmInstructions = activeProfile ? (activeProfile.llmInstructions || activeProfile.llmPrompt) : null;
      const encounterType = activeProfile ? activeProfile.name : patientContext || 'General';
      
      // Comprehensive debug logging
      console.log('=== SAVE SESSION DEBUG ===');
      console.log('selectedProfileId:', selectedProfileId);
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
      if (selectedLocation && selectedLocation.trim()) {
        const locationHeader = `CLINIC LOCATION:\n${selectedLocation.trim()}\n\n---\n\n`;
        transcriptWithLocation = locationHeader + finalTranscriptContent;
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
          encounter_type: encounterType,
          llm_template: llmTemplate,
          llm_template_id: llmTemplateId,
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
        console.log('=== SAVE RESPONSE DEBUG ===');
        console.log('Full server response:', result);
        console.log('Frontend sessionId:', sessionId);
        console.log('Backend session_id:', result.session_id);
        console.log('IDs match:', sessionId === result.session_id);
        console.log('saved_paths:', result.saved_paths);
        console.log('original_transcript path:', result.saved_paths?.original_transcript);
        console.log('polished_transcript path:', result.saved_paths?.polished_transcript);
        console.log('============================');
        
        setSaveStatusMessage(`Notes generated and saved!\nNotes: ${result.notes_s3_path || 'N/A'}\nAudio: ${result.audio_s3_path || 'N/A'}`);
        setIsSessionSaved(true);
        const savedName = patientDetails
          ? `${patientDetails} - ${new Date().toLocaleDateString()}`
          : `Session ${sessionId} - ${new Date().toLocaleDateString()}`;
        
        // Extract S3 key from full S3 path (remove s3://bucket/ prefix)
        const extractS3Key = (s3Path) => {
          if (!s3Path) return null;
          if (s3Path.startsWith('s3://')) {
            // Remove s3://bucketname/ prefix to get just the key
            const extracted = s3Path.split('/').slice(3).join('/');
            console.log(`Extracted S3 key: ${s3Path} -> ${extracted}`);
            return extracted;
          }
          console.log(`S3 path already in key format: ${s3Path}`);
          return s3Path;
        };
        
        const extractedOriginal = extractS3Key(result.saved_paths?.original_transcript);
        const extractedPolished = extractS3Key(result.saved_paths?.polished_transcript);
        
        console.log('=== S3 PATH EXTRACTION ===');
        console.log('Original from server:', result.saved_paths?.original_transcript);
        console.log('Extracted original:', extractedOriginal);
        console.log('Polished from server:', result.saved_paths?.polished_transcript);
        console.log('Extracted polished:', extractedPolished);
        console.log('==========================');
        
        const updatedRecording = {
          status: 'saved',
          name: savedName,
          date: new Date().toISOString(),
          s3PathTranscript: extractedOriginal,
          s3PathPolished: extractedPolished,
          audioS3Path: result.audio_s3_path,
          context: patientContext,
          location: selectedLocation,
          encounterType: encounterType
        };
        
        console.log('=== UPDATING RECORDING ===');
        console.log('sessionId:', sessionId);
        console.log('updatedRecording:', updatedRecording);
        console.log('==========================');
        
        updateRecording(sessionId, updatedRecording);
        
        // Force refresh of recordings to ensure proper state sync
        console.log('Recording updated in local state with S3 paths');
        console.log('Triggering fetchUserRecordings to refresh state...');
        await fetchUserRecordings();
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
    if (isRecording) {
      stopRecording();
    }
    if (sessionId && !isSessionSaved) {
      removeRecording(sessionId);
    }
    onClose();
  };


  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Recording Session</h1>
            <p className="text-sm text-gray-500 mt-1">
              {patientDetails || 'david'} {sessionId && `(${sessionId})`}
            </p>
          </div>
          <button
            onClick={handleCloseSession}
            className="btn btn-secondary px-6 py-2 text-sm font-medium"
          >
            CLOSE SESSION
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Controls */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Recording Controls</h3>
                
                <div className="space-y-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecordingProcess}
                      disabled={!patientDetails.trim() || isSessionSaved}
                      className="w-full btn btn-primary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {hasStreamedOnce && !isSessionSaved ? 'RESUME RECORDING' : 'START RECORDING'}
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="w-full btn bg-red-600 hover:bg-red-700 text-white py-3 text-base font-medium"
                    >
                      PAUSE RECORDING
                    </button>
                  )}

                  <button
                    onClick={handleSaveSession}
                    disabled={isRecording || !combinedTranscript.trim() || isSessionSaved}
                    className="w-full btn btn-secondary py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSessionSaved ? 'NOTES SAVED' : 'GENERATE & SAVE NOTES'}
                  </button>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {saveStatusMessage && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 whitespace-pre-line">{saveStatusMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Transcript */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                {/* Tab Headers */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex">
                    <button
                      onClick={() => setActiveTab(0)}
                      className={`py-4 px-6 text-sm font-medium border-b-2 ${
                        activeTab === 0
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      LIVE TRANSCRIPT
                    </button>
                    <button
                      onClick={() => setActiveTab(1)}
                      disabled
                      className="py-4 px-6 text-sm font-medium border-b-2 border-transparent text-gray-300 cursor-not-allowed"
                    >
                      NOTES
                    </button>
                  </nav>
                </div>
                
                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Live Transcript</h3>
                        {isRecording && (
                          <div className="flex items-center">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                            <span className="text-sm text-red-600 font-medium">Recording</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="min-h-[400px] p-4 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm leading-relaxed whitespace-pre-wrap overflow-y-auto">
                        {combinedTranscript || 'Transcript will appear here as you speak...'}
                      </div>
                    </div>
                  )}

                  {activeTab === 1 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Generated Notes</h3>
                      <p className="text-gray-500">
                        Notes will be available after generating and saving the session.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default RecordingView;