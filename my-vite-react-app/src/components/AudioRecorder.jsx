import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRecordings } from '../contexts/RecordingsContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import TranscriptViewer from './TranscriptViewer';
import SetupView from './SetupView';
import RecordingView from './RecordingView';

const AudioRecorder = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  const { selectedRecordingId } = useRecordings();
  const { userSettings, settingsLoading } = useUserSettings();

  const [currentView, setCurrentView] = useState('setup');
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [isMultilingual, setIsMultilingual] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('');
 
  // Initialize component state
  useEffect(() => {
    setCurrentView('setup');
    setPatientDetails('');
    setPatientContext('');
    setSelectedLocation('');
    setSelectedProfileId('');
    setIsMultilingual(false);
    setTargetLanguage('');
    setError(null);
  }, []);

  // Handle settings initialization
  useEffect(() => {
    console.log("AudioRecorder - userSettings.officeInformation:", userSettings.officeInformation);
    console.log("AudioRecorder - selectedLocation current state:", selectedLocation);
    
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
        console.log("AudioRecorder - Setting selectedLocation to:", userSettings.officeInformation[0]);
        setSelectedLocation(userSettings.officeInformation[0]);
      }
    } else if (!settingsLoading && (!userSettings.officeInformation || userSettings.officeInformation.length === 0)){
      console.log("AudioRecorder - No office information found, clearing selectedLocation");
      setSelectedLocation('');
    }
  }, [userSettings, settingsLoading]);

  const handleStartEncounter = () => {
    setCurrentView('recording');
    setError(null);
  };

  const handleCloseRecording = () => {
    setCurrentView('setup');
    setError(null);
  };

  // If a recording is selected from the sidebar, show the transcript viewer
  if (selectedRecordingId) {
    return <TranscriptViewer />;
  }

  // Loading and authentication checks
  if (authLoading || settingsLoading) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading user data...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex flex-col justify-center items-center min-h-screen px-8">
          <div className="card max-w-md w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <span className="material-icons text-white text-4xl">mic</span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to Dictation App</h2>
            <p className="text-gray-600 mb-8">
              Please log in to start recording new encounters or view your existing notes.
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={() => window.location.href = '/login'}
            >
              <span className="material-icons">login</span>
              <span>Log In to Continue</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Main view routing
  if (currentView === 'setup') {
    return (
      <SetupView
        patientDetails={patientDetails}
        setPatientDetails={setPatientDetails}
        patientContext={patientContext}
        setPatientContext={setPatientContext}
        selectedLocation={selectedLocation}
        setSelectedLocation={setSelectedLocation}
        selectedProfileId={selectedProfileId}
        setSelectedProfileId={setSelectedProfileId}
        isMultilingual={isMultilingual}
        setIsMultilingual={setIsMultilingual}
        targetLanguage={targetLanguage}
        setTargetLanguage={setTargetLanguage}
        userSettings={userSettings}
        settingsLoading={settingsLoading}
        error={error}
        onStartEncounter={handleStartEncounter}
      />
    );
  } else if (currentView === 'recording') {
    return (
      <RecordingView
        patientDetails={patientDetails}
        patientContext={patientContext}
        selectedLocation={selectedLocation}
        selectedProfileId={selectedProfileId}
        isMultilingual={isMultilingual}
        targetLanguage={targetLanguage}
        userSettings={userSettings}
        onClose={handleCloseRecording}
      />
    );
  }

  return null;
};

export default AudioRecorder;
