import { useState, useEffect } from 'react';
import PatientSelector from './PatientSelector';
import ReEvaluationIndicator from './ReEvaluationIndicator';
import MicrophoneMonitor from './MicrophoneMonitor';
import EvaluationTypeSelector from './EvaluationTypeSelector';
import ReEvaluationWorkflow from './ReEvaluationWorkflow';
import LastTranscriptModal from './LastTranscriptModal';
import MultilingualSettings from './MultilingualSettings';
import { useAuth } from '../contexts/FirebaseAuthContext';
import useTranscriptionSessionStore from '../stores/transcriptionSessionStore';
import { useMicrophoneMonitor } from '../hooks/useMicrophoneMonitor';
import { formatDateForDisplay } from '../utils/dateUtils';

function SetupView({ userSettings, settingsLoading, error, onStartEncounter }) {
  // Get all state and actions from Zustand store
  const {
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
    selectedPatient,
    updatePatientFromSelector,
    clearPatientSelection,
    isDictationMode,
    setIsDictationMode,
    dateOfService,
    setDateOfService,
    evaluationType,
    setEvaluationType,
    initialEvaluationId,
    setInitialEvaluationId,
    previousFindings,
    setPreviousFindings,
    initializeSettings
  } = useTranscriptionSessionStore();

      const [showPatientSelector, setShowPatientSelector] = useState(false);
  const [showLastTranscript, setShowLastTranscript] = useState(false);
  const [lastTranscript, setLastTranscript] = useState(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [recommendedEvalType, setRecommendedEvalType] = useState(null);
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const { getToken, user } = useAuth();
  
  // Use the microphone monitoring hook
  const { micLevel, micStatus, retryMicrophoneAccess } = useMicrophoneMonitor();
  
  // Initialize settings when user settings are loaded
  useEffect(() => {
    if (!settingsLoading && userSettings) {
      initializeSettings(userSettings);
    }
  }, [userSettings, settingsLoading, initializeSettings]);


  const handleLoadFindings = async () => {
    if (!selectedPatient) return;
    
    setLoadingFindings(true);
    try {
      const token = await getToken();
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/v1/patients/${selectedPatient.id}/initial-evaluation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const evaluation = await response.json();
        setInitialEvaluationId(evaluation.id);
        
        // Extract findings if not already done
        if (evaluation.positive_findings) {
          // Check if we need to re-extract due to old format
          const needsReExtraction = evaluation.positive_findings.raw_findings && 
                                  !evaluation.positive_findings.pain_findings &&
                                  !evaluation.positive_findings_markdown;
          
          if (needsReExtraction) {
            // Trigger re-extraction for old format
            const extractResponse = await fetch(`${API_BASE_URL}/api/v1/transcripts/${evaluation.id}/extract-findings`, {
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
          const extractResponse = await fetch(`${API_BASE_URL}/api/v1/transcripts/${evaluation.id}/extract-findings`, {
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
                // Include markdown version if available
                _markdown: extractResult.findings_markdown || null
              });
            } else {
              alert('Failed to extract findings from the previous evaluation');
            }
          } else {
            alert('Failed to extract findings from the previous evaluation');
          }
        }
      } else if (response.status === 404) {
        alert('No initial evaluation found for this patient');
      }
    } catch (error) {
      alert('Failed to load previous findings');
    } finally {
      setLoadingFindings(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!patientDetails.trim()) {
      return;
    }
    onStartEncounter();
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
                            clearPatientSelection();
                            setRecommendedEvalType(null); // Clear recommendation
                            setIsNewPatient(false); // Reset new patient status
                          } else if (!selectedPatient && e.target.value.trim()) {
                            // For manually entered patients, default to initial evaluation
                            setEvaluationType('initial');
                            setIsNewPatient(true);
                          } else if (!e.target.value.trim()) {
                            // Reset when field is cleared
                            setEvaluationType('initial');
                            setIsNewPatient(false);
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
                                (DOA: {formatDateForDisplay(selectedPatient.date_of_accident)})
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              clearPatientSelection();
                              setRecommendedEvalType(null); // Clear recommendation
                              setIsNewPatient(false); // Reset new patient status
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
                        
                        {/* Evaluation Type Selector - Moved here for better UX */}
                        <EvaluationTypeSelector
                          evaluationType={evaluationType}
                          setEvaluationType={setEvaluationType}
                          recommendedEvalType={recommendedEvalType}
                          isNewPatient={isNewPatient}
                          onTypeChange={(type) => {
                            if (type === 'initial' || type === 'follow_up') {
                              setInitialEvaluationId(null);
                              setPreviousFindings(null);
                            }
                          }}
                          loadingFindings={loadingFindings}
                          previousFindings={previousFindings}
                          onLoadFindings={handleLoadFindings}
                        />
                      </div>
                    )}
                    
                    {/* Show evaluation type selector for manually entered patients too */}
                    {!selectedPatient && patientDetails.trim() && (
                      <div className="mt-3">
                        <EvaluationTypeSelector
                          evaluationType={evaluationType}
                          setEvaluationType={setEvaluationType}
                          recommendedEvalType={recommendedEvalType}
                          isNewPatient={true} // Assume new patient when manually entered
                          onTypeChange={(type) => {
                            if (type === 'initial' || type === 'follow_up') {
                              setInitialEvaluationId(null);
                              setPreviousFindings(null);
                            }
                          }}
                          loadingFindings={loadingFindings}
                          previousFindings={previousFindings}
                          onLoadFindings={handleLoadFindings}
                        />
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

                  {/* Re-evaluation Workflow - Show when re-evaluation is selected */}
                  {selectedPatient && evaluationType === 're_evaluation' && (
                    <ReEvaluationWorkflow
                      previousFindings={previousFindings}
                    />
                  )}

                  <MultilingualSettings
                    isMultilingual={isMultilingual}
                    setIsMultilingual={setIsMultilingual}
                    targetLanguage={targetLanguage}
                    setTargetLanguage={setTargetLanguage}
                  />
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
                      

                      

                      
                      <MicrophoneMonitor 
                        micStatus={micStatus} 
                        micLevel={micLevel} 
                        onRetry={retryMicrophoneAccess} 
                      />
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
              onSelectPatient={(patient) => {
                updatePatientFromSelector(patient);
                setShowPatientSelector(false); // Close dialog immediately
                
                if (patient) {
                  // Auto-detect evaluation type in the background
                  (async () => {
                    try {
                      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
                      const token = await getToken();
                      const response = await fetch(`${API_BASE_URL}/api/v1/patients/${patient.id}/transcripts`, {
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      
                      if (response.ok) {
                        const transcripts = await response.json();
                        
                        // If no previous transcripts, automatically set to initial evaluation
                        if (transcripts.length === 0) {
                          setIsNewPatient(true);
                          setEvaluationType('initial');
                          setRecommendedEvalType('initial');
                        } else {
                          setIsNewPatient(false);
                          // Check if re-evaluation is needed
                          const reEvalResponse = await fetch(`${API_BASE_URL}/api/v1/patients/${patient.id}/re-evaluation-status`, {
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
                          } else {
                            // If re-evaluation endpoint fails, default to follow-up
                            setEvaluationType('follow_up');
                            setRecommendedEvalType('follow_up');
                          }
                        }
                      }
                    } catch (error) {
                      // Don't set evaluation type on error, let user choose manually
                      console.error('Error fetching patient status:', error);
                    }
                  })();
                }
              }}
              onClose={() => setShowPatientSelector(false)}
            />
          </div>
        </div>
      )}
      
      <LastTranscriptModal
        show={showLastTranscript}
        onClose={() => setShowLastTranscript(false)}
        selectedPatient={selectedPatient}
        lastTranscript={lastTranscript}
        loadingTranscript={loadingTranscript}
        onCopyToContext={(relevantInfo) => {
          setPatientContext(prev => prev ? `${prev}\n\n${relevantInfo}` : relevantInfo);
        }}
      />
      
    </main>
  );
}

export default SetupView;