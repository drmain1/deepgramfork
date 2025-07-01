import React, { useState, useRef, useEffect } from 'react';
import PatientSelector from './PatientSelector';
import PreviousFindings from './PreviousFindings';
import ReEvaluationIndicator from './ReEvaluationIndicator';
import { useAuth } from '../contexts/FirebaseAuthContext';

function SetupView({
  patientDetails,
  setPatientDetails,
  patientContext,
  setPatientContext,
  selectedLocation,
  setSelectedLocation,
  selectedProfileId,
  setSelectedProfileId,
  isMultilingual,
  setIsMultilingual,
  targetLanguage,
  setTargetLanguage,
  userSettings,
  settingsLoading,
  error,
  onStartEncounter,
  selectedPatient,
  setSelectedPatient,
  isDictationMode,
  setIsDictationMode,
  dateOfService,
  setDateOfService,
  evaluationType,
  setEvaluationType,
  initialEvaluationId,
  setInitialEvaluationId,
  previousFindings,
  setPreviousFindings
}) {
  // Debug logging
  // TEMPORARILY DISABLED FOR DEBUGGING
  // console.log('SetupView props debug:', {
  //   targetLanguage,
  //   setTargetLanguage: typeof setTargetLanguage,
  //   isMultilingual,
  //   setIsMultilingual: typeof setIsMultilingual
  // });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [micStatus, setMicStatus] = useState('checking'); // 'checking', 'active', 'error', 'denied'
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showLastTranscript, setShowLastTranscript] = useState(false);
  const [lastTranscript, setLastTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [recommendedEvalType, setRecommendedEvalType] = useState(null);
  const { getToken, user } = useAuth();
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationRef = useRef(null);
  const dataArrayRef = useRef(null);
  const isMonitoringRef = useRef(false);

  // Auto-start microphone monitoring when component mounts
  useEffect(() => {
    startMicrophoneMonitoring();
    
    // Cleanup on unmount
    return () => {
      stopMicrophoneMonitoring();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted!', { patientDetails, onStartEncounter });
    if (!patientDetails.trim()) {
      console.log('No patient details provided');
      return;
    }
    console.log('Calling onStartEncounter...');
    onStartEncounter();
  };

  const startMicrophoneMonitoring = async () => {
    try {
      console.log('🎤 Starting microphone monitoring...');
      setMicStatus('checking');
      
      // Stop any existing monitoring first
      stopMicrophoneMonitoring();
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      console.log('✅ Microphone access granted');
      micStreamRef.current = stream;
      setPermissionGranted(true);
      setMicStatus('active');
      
      // Set up audio analysis
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume audio context if it's suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      setIsMonitoring(true);
      isMonitoringRef.current = true;
      
      console.log('🔊 Starting audio level monitoring...');
      updateLevel();
      
    } catch (error) {
      console.error('❌ Microphone access failed:', error);
      console.log('Error name:', error.name);
      console.log('Error message:', error.message);
      setMicStatus(error.name === 'NotAllowedError' ? 'denied' : 'error');
      setPermissionGranted(false);
      setIsMonitoring(false);
      isMonitoringRef.current = false;
    }
  };

  const updateLevel = () => {
    if (!isMonitoringRef.current || !analyserRef.current || !dataArrayRef.current) {
      console.log('⏸️ Stopping updateLevel - monitoring stopped or refs missing');
      return;
    }
    
    try {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / dataArrayRef.current.length;
      
      // Normalize to 0-100 range with better sensitivity
      const normalizedLevel = Math.min(100, Math.max(0, (average / 128) * 100));
      
      setMicLevel(normalizedLevel);
      
      // Log for debugging (remove this once it's working)
      // TEMPORARILY DISABLED FOR DEBUGGING
      // if (normalizedLevel > 5) {
      //   console.log('🔊 Audio detected:', normalizedLevel.toFixed(1));
      // }
      
      // Continue the animation loop
      if (isMonitoringRef.current) {
        animationRef.current = requestAnimationFrame(updateLevel);
      }
    } catch (error) {
      console.error('❌ Error in updateLevel:', error);
      isMonitoringRef.current = false;
      setIsMonitoring(false);
    }
  };

  const stopMicrophoneMonitoring = () => {
    console.log('🛑 Stopping microphone monitoring...');
    
    isMonitoringRef.current = false;
    setIsMonitoring(false);
    setMicLevel(0);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('🔇 Stopped audio track');
      });
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('🔇 Closed audio context');
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
  };

  const retryMicrophoneAccess = () => {
    console.log('🔄 Retrying microphone access...');
    setMicStatus('checking');
    startMicrophoneMonitoring();
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-semibold text-gray-900">New Encounter</h1>
          <p className="text-lg text-gray-500 mt-2">Start a new patient encounter session</p>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-10">
              {/* Left Column - Patient Information */}
              <div className="xl:col-span-3 space-y-10">
                {/* Patient Details Card */}
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-10 flex items-center gap-3">
                    <span className="material-icons text-indigo-600 text-4xl">person</span>
                    Patient Information
                  </h2>
                  
                  <div className="form-group">
                    <label className="form-label text-xl" htmlFor="session-title">
                      Patient Name / Session Title <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-3">
                      <input
                        className="input-field text-xl py-5 flex-1"
                        id="session-title"
                        name="session-title"
                        placeholder="Enter patient name or session title"
                        type="text"
                        value={patientDetails}
                        onChange={(e) => {
                          setPatientDetails(e.target.value);
                          // Clear selected patient if user manually types
                          if (selectedPatient) {
                            setSelectedPatient(null);
                            setEvaluationType(''); // Clear evaluation type
                            setRecommendedEvalType(null); // Clear recommendation
                          }
                        }}
                        autoComplete="off"
                        required
                      />
                      <button
                        type="button"
                        className="px-6 py-5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-xl transition-colors flex items-center gap-2"
                        onClick={() => setShowPatientSelector(true)}
                      >
                        <span className="material-icons">{selectedPatient ? 'edit' : 'person_search'}</span>
                        {selectedPatient ? 'Edit Patient' : 'Select Patient'}
                      </button>
                    </div>
                    {selectedPatient && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="text-lg text-blue-700">
                            <span className="font-medium">Selected:</span> {selectedPatient.last_name}, {selectedPatient.first_name}
                            {selectedPatient.date_of_accident && (
                              <span className="text-base text-blue-600 ml-2">
                                (DOA: {new Date(selectedPatient.date_of_accident).toLocaleDateString()})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              setSelectedPatient(null);
                              setPatientDetails('');
                              setEvaluationType(''); // Clear evaluation type
                              setRecommendedEvalType(null); // Clear recommendation
                            }}
                          >
                            <span className="material-icons">close</span>
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                          onClick={async () => {
                            setLoadingTranscript(true);
                            setShowLastTranscript(true);
                            
                            try {
                              const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                              const accessToken = await getToken();
                              
                              // First, fetch all user recordings to find ones matching this patient
                              const recordingsResponse = await fetch(
                                `${API_BASE_URL}/api/v1/user_recordings/${user.uid}`,
                                {
                                  headers: {
                                    Authorization: `Bearer ${accessToken}`,
                                  },
                                }
                              );
                              
                              if (recordingsResponse.ok) {
                                const recordings = await recordingsResponse.json();
                                
                                // Filter recordings that match the patient name
                                const patientName = `${selectedPatient.last_name}, ${selectedPatient.first_name}`;
                                const patientRecordings = recordings.filter(r => 
                                  r.name && r.name.toLowerCase().includes(patientName.toLowerCase())
                                );
                                
                                if (patientRecordings.length > 0) {
                                  // Sort by date to get the most recent
                                  patientRecordings.sort((a, b) => new Date(b.date) - new Date(a.date));
                                  const lastRecording = patientRecordings[0];
                                  
                                  // Fetch the actual transcript content
                                  const transcriptResponse = await fetch(
                                    `${API_BASE_URL}/api/v1/transcript/${user.uid}/${lastRecording.id}`,
                                    {
                                      headers: {
                                        Authorization: `Bearer ${accessToken}`,
                                      },
                                    }
                                  );
                                  
                                  if (transcriptResponse.ok) {
                                    const transcriptData = await transcriptResponse.json();
                                    setLastTranscript({
                                      date: new Date(lastRecording.date).toLocaleDateString(),
                                      content: transcriptData.polishedTranscript || transcriptData.originalTranscript || 'No transcript content available.'
                                    });
                                  } else {
                                    setLastTranscript(null);
                                  }
                                } else {
                                  setLastTranscript(null);
                                }
                              }
                            } catch (error) {
                              console.error('Error fetching last transcript:', error);
                              setLastTranscript(null);
                            } finally {
                              setLoadingTranscript(false);
                            }
                          }}
                        >
                          <span className="material-icons text-sm">history</span>
                          View Last Visit
                          </button>
                          <ReEvaluationIndicator patient={selectedPatient} />
                        </div>
                      </div>
                    )}
                    {error && !patientDetails.trim() && (
                      <p className="text-red-500 text-lg mt-3 flex items-center gap-2">
                        <span className="material-icons text-xl">error</span>
                        Please enter patient details
                      </p>
                    )}
                    
                    {/* Dictation Mode Section - Only show when a patient is selected */}
                    {selectedPatient && (
                      <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                        <label className="flex items-center cursor-pointer">
                          <input
                            className="checkbox-custom"
                            type="checkbox"
                            checked={isDictationMode}
                            onChange={(e) => {
                              setIsDictationMode(e.target.checked);
                              // Clear date of service when unchecking
                              if (!e.target.checked) {
                                setDateOfService('');
                              }
                            }}
                          />
                          <span className="ml-4">
                            <span className="text-lg font-medium text-indigo-700">Dictation Mode</span>
                            <span className="block text-base text-indigo-600 mt-1">
                              Record notes for a past patient visit
                            </span>
                          </span>
                        </label>
                        
                        {isDictationMode && (
                          <div className="mt-4">
                            <label className="form-label text-lg" htmlFor="date-of-service">
                              Date of Service <span className="text-red-500">*</span>
                            </label>
                            <input
                              className="input-field text-lg py-4"
                              id="date-of-service"
                              name="date-of-service"
                              type="date"
                              value={dateOfService}
                              onChange={(e) => setDateOfService(e.target.value)}
                              max={new Date().toISOString().split('T')[0]} // Can't select future dates
                              required={isDictationMode}
                            />
                            <p className="text-base text-indigo-600 mt-2">
                              Select the date when you saw this patient
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="form-group mb-0">
                    <label className="form-label text-xl" htmlFor="patient-context">
                      Clinical Context
                    </label>
                    <textarea
                      className="input-field text-xl py-5 resize-none"
                      id="patient-context"
                      name="patient-context"
                      placeholder="e.g., Follow-up for hypertension, Annual check-up, Post-operative visit"
                      rows="7"
                      value={patientContext}
                      onChange={(e) => setPatientContext(e.target.value)}
                    />
                    <p className="text-lg text-gray-500 mt-3">
                      Add any relevant clinical context or chief complaint
                    </p>
                  </div>
                </div>

                {/* Session Settings Card */}
                <div className="bg-white p-12 rounded-lg shadow-sm border border-gray-200">
                  <h2 className="text-2xl font-semibold text-gray-800 mb-10 flex items-center gap-3">
                    <span className="material-icons text-indigo-600 text-4xl">tune</span>
                    Session Settings
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="form-group">
                      <label className="form-label text-xl" htmlFor="location">
                        Location
                      </label>
                      <select
                        className="input-field text-xl py-5"
                        id="location"
                        name="location"
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        disabled={settingsLoading || (!userSettings.officeInformation && !settingsLoading)}
                      >
                        <option value="">Select a location...</option>
                        <option value="__LEAVE_OUT__">Leave out of transcript</option>
                        {settingsLoading && !userSettings.officeInformation ? (
                          <option value="" disabled>Loading locations...</option>
                        ) : (
                          userSettings.officeInformation && userSettings.officeInformation.map((loc, index) => (
                            <option key={index} value={loc}>
                              {loc.length > 50 ? `${loc.substring(0, 50)}...` : loc}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-xl" htmlFor="treatment-session">
                        Treatment Type
                      </label>
                      <select
                        className="input-field text-xl py-5"
                        id="treatment-session"
                        name="treatment-session"
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        disabled={settingsLoading || (!userSettings.transcriptionProfiles && !settingsLoading)}
                      >
                        {settingsLoading && !userSettings.transcriptionProfiles ? (
                          <option value="" disabled>Loading profiles...</option>
                        ) : (
                          userSettings.transcriptionProfiles &&
                          userSettings.transcriptionProfiles
                            .filter(profile => profile.name !== 'Default/General summary')
                            .map((profile) => (
                              <option key={profile.id} value={profile.id}>
                                {profile.name}
                              </option>
                            ))
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Evaluation Type Selector - Only show when patient is selected */}
                  {selectedPatient && (
                    <div className="mt-10">
                      <h3 className="text-xl font-medium text-gray-800 mb-4">
                        Visit Type
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Initial Evaluation Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluationType('initial');
                            setInitialEvaluationId(null);
                            setPreviousFindings(null);
                          }}
                          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
                            evaluationType === 'initial'
                              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {recommendedEvalType === 'initial' && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                              Recommended
                            </span>
                          )}
                          <div className="flex flex-col items-center text-center">
                            <span className={`material-icons text-3xl mb-3 ${
                              evaluationType === 'initial' ? 'text-indigo-600' : 'text-gray-400'
                            }`}>
                              article
                            </span>
                            <h4 className={`font-semibold text-lg mb-2 ${
                              evaluationType === 'initial' ? 'text-indigo-900' : 'text-gray-700'
                            }`}>
                              Initial Evaluation
                            </h4>
                            <p className={`text-sm ${
                              evaluationType === 'initial' ? 'text-indigo-700' : 'text-gray-500'
                            }`}>
                              First comprehensive assessment
                            </p>
                          </div>
                        </button>

                        {/* Follow-up Visit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluationType('follow_up');
                            setInitialEvaluationId(null);
                            setPreviousFindings(null);
                          }}
                          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
                            evaluationType === 'follow_up'
                              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {recommendedEvalType === 'follow_up' && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                              Recommended
                            </span>
                          )}
                          <div className="flex flex-col items-center text-center">
                            <span className={`material-icons text-3xl mb-3 ${
                              evaluationType === 'follow_up' ? 'text-indigo-600' : 'text-gray-400'
                            }`}>
                              update
                            </span>
                            <h4 className={`font-semibold text-lg mb-2 ${
                              evaluationType === 'follow_up' ? 'text-indigo-900' : 'text-gray-700'
                            }`}>
                              Follow-up Visit
                            </h4>
                            <p className={`text-sm ${
                              evaluationType === 'follow_up' ? 'text-indigo-700' : 'text-gray-500'
                            }`}>
                              Routine treatment session
                            </p>
                          </div>
                        </button>

                        {/* Re-evaluation Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEvaluationType('re_evaluation');
                          }}
                          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
                            evaluationType === 're_evaluation'
                              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          {recommendedEvalType === 're_evaluation' && (
                            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
                              Recommended
                            </span>
                          )}
                          <div className="flex flex-col items-center text-center">
                            <span className={`material-icons text-3xl mb-3 ${
                              evaluationType === 're_evaluation' ? 'text-indigo-600' : 'text-gray-400'
                            }`}>
                              assessment
                            </span>
                            <h4 className={`font-semibold text-lg mb-2 ${
                              evaluationType === 're_evaluation' ? 'text-indigo-900' : 'text-gray-700'
                            }`}>
                              Re-evaluation
                            </h4>
                            <p className={`text-sm ${
                              evaluationType === 're_evaluation' ? 'text-indigo-700' : 'text-gray-500'
                            }`}>
                              Progress assessment
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Re-evaluation Workflow - Show when re-evaluation is selected */}
                  {selectedPatient && evaluationType === 're_evaluation' && (
                    <div className="mt-8">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-2xl font-semibold flex items-center gap-3">
                              <span className="material-icons text-3xl">assessment</span>
                              Re-evaluation Workflow
                            </h3>
                            <p className="text-indigo-100 mt-2">
                              Compare current findings with initial evaluation
                            </p>
                          </div>
                          {!previousFindings && (
                            <div className="text-right">
                              <p className="text-sm text-indigo-100">Step 1 of 2</p>
                              <p className="text-xs text-indigo-200 mt-1">Load previous findings</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-6 bg-white p-6 rounded-lg shadow-md border border-gray-200">
                        {!previousFindings ? (
                            <button
                              type="button"
                              disabled={loadingFindings}
                              onClick={async () => {
                                setLoadingFindings(true);
                                try {
                                  const token = await getToken();
                                  const response = await fetch(`/api/v1/patients/${selectedPatient.id}/initial-evaluation`, {
                                    headers: {
                                      'Authorization': `Bearer ${token}`
                                    }
                                  });
                                  
                                  if (response.ok) {
                                    const evaluation = await response.json();
                                    setInitialEvaluationId(evaluation.id);
                                    
                                    // Extract findings if not already done
                                    if (evaluation.positive_findings) {
                                      console.log('Found existing positive_findings:', evaluation.positive_findings);
                                      console.log('Found existing positive_findings_markdown:', evaluation.positive_findings_markdown);
                                      
                                      // Check if we need to re-extract due to old format
                                      const needsReExtraction = evaluation.positive_findings.raw_findings && 
                                                              !evaluation.positive_findings.pain_findings &&
                                                              !evaluation.positive_findings_markdown;
                                      
                                      if (needsReExtraction) {
                                        console.log('Old format detected, triggering re-extraction');
                                        // Trigger re-extraction for old format
                                        const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
                                          method: 'POST',
                                          headers: {
                                            'Authorization': `Bearer ${token}`
                                          }
                                        });
                                        
                                        if (extractResponse.ok) {
                                          const extractResult = await extractResponse.json();
                                          if (extractResult.success && extractResult.findings) {
                                            setPreviousFindings({
                                              ...extractResult.findings,
                                              date: evaluation.date || evaluation.created_at,
                                              _markdown: extractResult.findings_markdown || null
                                            });
                                          }
                                        }
                                      } else {
                                        setPreviousFindings({
                                          ...evaluation.positive_findings,
                                          date: evaluation.date || evaluation.created_at,
                                          // Include markdown version if available
                                          _markdown: evaluation.positive_findings_markdown || null
                                        });
                                      }
                                    } else {
                                      // Trigger extraction of findings
                                      const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
                                        method: 'POST',
                                        headers: {
                                          'Authorization': `Bearer ${token}`
                                        }
                                      });
                                      
                                      if (extractResponse.ok) {
                                        const extractResult = await extractResponse.json();
                                        console.log('Extract findings response:', extractResult);
                                        console.log('Findings data:', extractResult.findings);
                                        
                                        if (extractResult.success && extractResult.findings) {
                                          console.log('Extract API response:', extractResult);
                                          console.log('Markdown content:', extractResult.findings_markdown);
                                          setPreviousFindings({
                                            ...extractResult.findings,
                                            date: evaluation.date || evaluation.created_at,
                                            // Include markdown version if available
                                            _markdown: extractResult.findings_markdown || null
                                          });
                                          console.log('Previous findings set to:', {
                                            ...extractResult.findings,
                                            date: evaluation.date || evaluation.created_at,
                                            _markdown: extractResult.findings_markdown || null
                                          });
                                        } else {
                                          console.error('Extract findings failed or no findings returned');
                                          alert('Failed to extract findings from the previous evaluation');
                                        }
                                      } else {
                                        console.error('Extract findings API call failed:', extractResponse.status);
                                        alert('Failed to extract findings from the previous evaluation');
                                      }
                                    }
                                  } else if (response.status === 404) {
                                    alert('No initial evaluation found for this patient');
                                  }
                                } catch (error) {
                                  console.error('Error fetching initial evaluation:', error);
                                  alert('Failed to load previous findings');
                                } finally {
                                  setLoadingFindings(false);
                                }
                              }}
                              className={`bg-indigo-600 text-white px-6 py-3 rounded-lg transition-all text-lg flex items-center justify-center ${
                                loadingFindings ? 'opacity-75 cursor-not-allowed' : 'hover:bg-indigo-700'
                              }`}
                            >
                              {loadingFindings ? (
                                <>
                                  <svg 
                                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24"
                                  >
                                    <circle 
                                      className="opacity-25" 
                                      cx="12" 
                                      cy="12" 
                                      r="10" 
                                      stroke="currentColor" 
                                      strokeWidth="4"
                                    />
                                    <path 
                                      className="opacity-75" 
                                      fill="currentColor" 
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  Loading Previous Findings...
                                </>
                              ) : (
                                'Load Previous Findings'
                              )}
                            </button>
                          ) : (
                            <div>
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-medium text-gray-800">
                                  Previous Findings Loaded
                                </h4>
                                <span className="text-sm text-green-600 flex items-center gap-1">
                                  <span className="material-icons text-base">check_circle</span>
                                  Ready to compare
                                </span>
                              </div>
                              <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                                <PreviousFindings 
                                  findings={previousFindings} 
                                  evaluationDate={previousFindings.date}
                                />
                              </div>
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <p className="text-sm text-blue-800">
                                  <span className="font-medium">Tip:</span> The previous findings will be automatically included in your transcription context for easy comparison.
                                </p>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  <div className="mt-10 p-8 bg-gray-50 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        className="checkbox-custom"
                        id="multilingual-support"
                        name="multilingual-support"
                        type="checkbox"
                        checked={isMultilingual}
                        onChange={(e) => setIsMultilingual(e.target.checked)}
                      />
                      <span className="ml-4">
                        <span className="text-xl font-medium text-gray-700">Enable Multilingual Support</span>
                        <span className="block text-lg text-gray-500 mt-2">
                          Automatically detect and transcribe multiple languages
                        </span>
                      </span>
                    </label>
                    
                    {isMultilingual && (
                      <div className="mt-6 p-6 bg-white rounded-lg border border-gray-200">
                        <label className="block text-lg font-medium text-gray-700 mb-3">
                          Target Language (Optional)
                        </label>
                        <div className="relative">
                          <select
                            className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            style={{
                              position: 'relative',
                              zIndex: 10,
                              pointerEvents: 'auto',
                              cursor: 'pointer',
                              appearance: 'menulist',
                              WebkitAppearance: 'menulist',
                              MozAppearance: 'menulist'
                            }}
                            value={targetLanguage || ''}
                            onChange={(e) => {
                              console.log('Target language changed:', e.target.value);
                              setTargetLanguage(e.target.value);
                            }}
                            onClick={(e) => {
                              console.log('Select clicked:', e.target);
                              e.stopPropagation();
                            }}
                            onFocus={(e) => {
                              console.log('Select focused:', e.target);
                            }}
                          >
                            <option value="">Auto-detect (Code-switching)</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="hi">Hindi</option>
                            <option value="ru">Russian</option>
                            <option value="pt">Portuguese</option>
                            <option value="ja">Japanese</option>
                            <option value="it">Italian</option>
                            <option value="nl">Dutch</option>
                          </select>
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                          Select a specific language for pure single-language content, or leave as "Auto-detect" for conversations that switch between languages.
                        </p>
                        {/* Debug info */}
                        <div className="mt-2 text-xs text-gray-400">
                          Current value: "{targetLanguage || 'empty'}"
                        </div>
                        {/* Test button */}
                        <button
                          type="button"
                          className="mt-2 px-3 py-1 text-xs bg-gray-200 rounded"
                          onClick={() => {
                            console.log('Test button clicked, current targetLanguage:', targetLanguage);
                            setTargetLanguage(targetLanguage === 'es' ? 'fr' : 'es');
                          }}
                        >
                          Test Toggle (ES/FR)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Quick Actions & Info */}
              <div className="xl:col-span-2 space-y-8">
                {/* Start Recording Card */}
                <div className="bg-blue-50 border border-blue-200 p-10 rounded-lg shadow-sm">
                  <div className="text-center">
                    <div className="w-32 h-32 mx-auto mb-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="material-icons text-6xl text-blue-600">mic</span>
                    </div>
                    <h3 className="text-2xl font-semibold mb-4 text-blue-900">Ready to Record</h3>
                    <p className="text-lg text-blue-700 mb-8 leading-relaxed">
                      Ensure patient information is complete before starting your encounter session
                    </p>
                    
                    {/* Microphone Monitor Section - Animated based on evaluation type */}
                    <div 
                      className={`mb-8 p-6 bg-blue-100 rounded-lg border border-blue-200 transition-all duration-500 ${
                        evaluationType === 're_evaluation' 
                          ? 'transform scale-95 opacity-75' 
                          : 'transform scale-100 opacity-100'
                      }`}
                      style={{
                        maxHeight: evaluationType === 're_evaluation' ? '120px' : '400px',
                        overflow: 'hidden'
                      }}>
                      <h4 className="text-lg font-medium mb-4 flex items-center justify-center gap-2 text-blue-900">
                        <span className="material-icons text-xl text-blue-600">hearing</span>
                        Microphone Monitor
                      </h4>
                      

                      

                      
                      {micStatus === 'checking' && (
                        <div className="space-y-4 text-center">
                          <div className="w-12 h-12 mx-auto">
                                                          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600"></div>
                          </div>
                          <p className="text-base text-blue-800">Requesting microphone access...</p>
                          <button
                            type="button"
                            onClick={startMicrophoneMonitoring}
                            className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            Manual Start
                          </button>
                        </div>
                      )}
                      
                      {micStatus === 'active' && (
                        <div className="space-y-4">
                          {/* Circular microphone visualization */}
                          <div className="flex justify-center mb-6">
                            <div className="relative w-24 h-24">
                              {/* Outer ring that pulses with audio */}
                              <div 
                                className="absolute inset-0 rounded-full border-4 transition-all duration-100"
                                style={{ 
                                  transform: `scale(${1 + (micLevel / 150)})`,
                                  borderColor: micLevel > 20 ? '#2563EB' : micLevel > 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)',
                                  opacity: 0.4 + (micLevel / 200),
                                  boxShadow: micLevel > 10 ? `0 0 ${Math.min(20, micLevel / 5)}px rgba(37, 99, 235, 0.5)` : 'none'
                                }}
                              />
                              {/* Middle ring */}
                              <div 
                                className="absolute inset-3 rounded-full border-2 transition-all duration-75"
                                style={{ 
                                  transform: `scale(${1 + (micLevel / 300)})`,
                                  borderColor: micLevel > 15 ? '#2563EB' : micLevel > 3 ? '#3B82F6' : 'rgba(59, 130, 246, 0.5)',
                                  opacity: 0.6 + (micLevel / 250)
                                }}
                              />
                              {/* Inner microphone icon */}
                              <div 
                                className="absolute inset-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-100"
                                style={{
                                  backgroundColor: micLevel > 10 ? 'rgba(37, 99, 235, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                                  transform: `scale(${1 + (micLevel / 500)})`
                                }}
                              >
                                <span 
                                  className="material-icons text-2xl transition-colors duration-100"
                                  style={{ color: micLevel > 10 ? '#2563EB' : '#3B82F6' }}
                                >
                                  {micLevel > 25 ? 'mic' : micLevel > 5 ? 'mic_none' : 'mic_off'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Level bars */}
                          <div className="space-y-2">
                            <div className="flex justify-center gap-1">
                              {[...Array(10)].map((_, i) => {
                                const threshold = (i + 1) * 8; // More sensitive thresholds (8, 16, 24, etc.)
                                const isActive = micLevel > threshold;
                                const barHeight = Math.min(20, 8 + (i * 1.5)); // Varying heights
                                
                                return (
                                  <div 
                                    key={i}
                                    className="w-1.5 rounded-full transition-all duration-75"
                                    style={{ 
                                      height: `${barHeight}px`,
                                      backgroundColor: isActive ? 
                                        (i < 6 ? '#2563EB' : i < 8 ? '#3B82F6' : '#60A5FA') : // Blue gradient
                                        'rgba(59, 130, 246, 0.25)',
                                      opacity: isActive ? (0.7 + (micLevel / 200)) : 0.4,
                                      transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)'
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div className="text-center">
                              <p className="text-sm text-blue-700">
                                {micLevel > 10 ? `Audio: ${Math.round(micLevel)}%` : 'Speak to test...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {micStatus === 'denied' && (
                        <div className="space-y-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-red-200">
                            <span className="material-icons text-2xl">mic_off</span>
                          </div>
                          <p className="text-base text-blue-800">Microphone access denied</p>
                          <p className="text-sm text-blue-600">Please allow microphone access and refresh</p>
                          <button
                            type="button"
                            onClick={retryMicrophoneAccess}
                            className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            Retry Access
                          </button>
                        </div>
                      )}
                      
                      {micStatus === 'error' && (
                        <div className="space-y-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-red-200">
                            <span className="material-icons text-2xl">error</span>
                          </div>
                          <p className="text-base text-blue-800">Microphone error</p>
                          <p className="text-sm text-blue-600">Please check your microphone connection</p>
                          <button
                            type="button"
                            onClick={retryMicrophoneAccess}
                            className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                          >
                            Try Again
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Re-evaluation Notice */}
                    {evaluationType === 're_evaluation' && (
                      <div className="mb-6 p-4 bg-indigo-100 rounded-lg border border-indigo-300 transition-all duration-500">
                        <div className="flex items-start gap-3">
                          <span className="material-icons text-2xl text-indigo-600 mt-0.5">info</span>
                          <div>
                            <h5 className="font-medium text-indigo-900 mb-1">Re-evaluation Mode Active</h5>
                            <p className="text-sm text-indigo-700">
                              {previousFindings 
                                ? "Previous findings loaded and will be included in the transcription context for comparison."
                                : "Please load previous findings before starting the re-evaluation."
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      className={`w-full font-semibold text-xl py-5 px-8 rounded-lg transition-all duration-300 disabled:bg-gray-300 disabled:text-gray-500 ${
                        evaluationType === 're_evaluation' 
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                      type="submit"
                      disabled={!patientDetails.trim() || (isDictationMode && !dateOfService) || (evaluationType === 're_evaluation' && !previousFindings)}
                      onClick={(e) => {
                        console.log('Button clicked!', e);
                        console.log('Patient details:', patientDetails);
                        console.log('Button disabled?', !patientDetails.trim());
                      }}
                    >
                      <span className="flex items-center justify-center gap-4">
                        <span className="material-icons text-3xl">
                          {evaluationType === 're_evaluation' ? 'assessment' : 'play_arrow'}
                        </span>
                        {evaluationType === 're_evaluation' 
                          ? 'Start Re-evaluation' 
                          : 'Start Encounter'
                        }
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Patient Selector Dialog */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <PatientSelector
              selectedPatient={selectedPatient}
              onSelectPatient={async (patient) => {
                setSelectedPatient(patient);
                if (patient) {
                  // Set patient details when a patient is selected
                  setPatientDetails(`${patient.last_name}, ${patient.first_name}`);
                  // Add date of birth to context
                  if (patient.date_of_birth && !patientContext.includes('DOB:')) {
                    const dobFormatted = new Date(patient.date_of_birth).toLocaleDateString();
                    setPatientContext(prev => prev ? `${prev}\nDOB: ${dobFormatted}` : `DOB: ${dobFormatted}`);
                  }
                  // If patient has date of accident, add it to context
                  if (patient.date_of_accident && !patientContext.includes('DOA:')) {
                    const doaFormatted = new Date(patient.date_of_accident).toLocaleDateString();
                    setPatientContext(prev => prev ? `${prev}\nDOA: ${doaFormatted}` : `DOA: ${doaFormatted}`);
                  }
                  
                  // Auto-detect evaluation type based on visit history
                  try {
                    const token = await getToken();
                    const response = await fetch(`/api/v1/patients/${patient.id}/transcripts`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    
                    if (response.ok) {
                      const transcripts = await response.json();
                      
                      // If no previous transcripts, automatically set to initial evaluation
                      if (transcripts.length === 0) {
                        setEvaluationType('initial');
                        setRecommendedEvalType('initial');
                      } else {
                        // Check if re-evaluation is needed
                        const reEvalResponse = await fetch(`/api/v1/patients/${patient.id}/re-evaluation-status`, {
                          headers: {
                            'Authorization': `Bearer ${token}`
                          }
                        });
                        
                        if (reEvalResponse.ok) {
                          const reEvalStatus = await reEvalResponse.json();
                          
                          // If re-evaluation is overdue (red status), suggest re-evaluation
                          if (reEvalStatus.color === 'red') {
                            setEvaluationType('re_evaluation');
                            setRecommendedEvalType('re_evaluation');
                          } else if (reEvalStatus.color === 'yellow') {
                            // If due soon, still suggest re-evaluation
                            setEvaluationType('re_evaluation');
                            setRecommendedEvalType('re_evaluation');
                          } else {
                            // Otherwise default to follow-up
                            setEvaluationType('follow_up');
                            setRecommendedEvalType('follow_up');
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Error checking patient visit history:', error);
                    // Don't set evaluation type on error, let user choose manually
                  }
                }
                setShowPatientSelector(false);
              }}
              onClose={() => setShowPatientSelector(false)}
            />
          </div>
        </div>
      )}
      
      {/* Last Transcript Modal */}
      {showLastTranscript && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowLastTranscript(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold flex items-center gap-3">
                    <span className="material-icons">medical_information</span>
                    Previous Visit Summary
                  </h2>
                  <p className="text-blue-100 mt-1">
                    {selectedPatient?.last_name}, {selectedPatient?.first_name}
                  </p>
                </div>
                <button
                  onClick={() => setShowLastTranscript(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <span className="material-icons text-2xl">close</span>
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
              {loadingTranscript ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Loading transcript...</p>
                </div>
              ) : lastTranscript ? (
                <div>
                  {/* Date Badge */}
                  <div className="mb-6">
                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-gray-700">
                      <span className="material-icons text-sm">calendar_today</span>
                      <span className="font-medium">Visit Date: {lastTranscript.date}</span>
                    </span>
                  </div>
                  
                  {/* Transcript Content */}
                  <div className="prose prose-lg max-w-none">
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                        {lastTranscript.content}
                      </pre>
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="mt-6 flex gap-3">
                    <button
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      onClick={() => {
                        // Copy relevant info to context
                        const relevantInfo = `Previous visit (${lastTranscript.date}): ${lastTranscript.content.split('\n')[0]}`;
                        setPatientContext(prev => prev ? `${prev}\n\n${relevantInfo}` : relevantInfo);
                        setShowLastTranscript(false);
                      }}
                    >
                      <span className="material-icons text-sm">content_copy</span>
                      Copy Summary to Context
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="material-icons text-6xl text-gray-300 mb-4">description</span>
                  <p className="text-gray-600">No previous transcripts found for this patient.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default SetupView;