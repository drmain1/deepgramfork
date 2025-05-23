import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import TranscriptViewer from '../components/TranscriptViewer';
import SetupView from '../components/SetupView';
import RecordingView from '../components/RecordingView';

function TranscriptionPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();
  const { selectedRecordingId } = useRecordings();
  const { userSettings, settingsLoading } = useUserSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentView, setCurrentView] = useState('setup');
  const [error, setError] = useState(null);
  const [patientDetails, setPatientDetails] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [isMultilingual, setIsMultilingual] = useState(false);

  // Initialize component state
  useEffect(() => {
    // Check if we're coming from a specific view or should start fresh
    const searchParams = new URLSearchParams(location.search);
    const viewParam = searchParams.get('view');
    
    if (viewParam === 'recording') {
      setCurrentView('recording');
    } else {
      setCurrentView('setup');
    }
    
    // Reset state when starting fresh
    if (!viewParam) {
      setPatientDetails('');
      setPatientContext('');
      setSelectedLocation('');
      setSelectedProfileId('');
      setError(null);
    }
  }, [location]);

  // Handle settings initialization
  useEffect(() => {
    console.log("TranscriptionPage - userSettings.officeInformation:", userSettings.officeInformation);
    console.log("TranscriptionPage - selectedLocation current state:", selectedLocation);
    
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
        console.log("TranscriptionPage - Setting selectedLocation to:", userSettings.officeInformation[0]);
        setSelectedLocation(userSettings.officeInformation[0]);
      }
    } else if (!settingsLoading && (!userSettings.officeInformation || userSettings.officeInformation.length === 0)){
      console.log("TranscriptionPage - No office information found, clearing selectedLocation");
      setSelectedLocation('');
    }
  }, [userSettings, settingsLoading]);

  const handleStartEncounter = () => {
    setCurrentView('recording');
    // Update URL to reflect the recording state
    navigate('/transcription?view=recording', { replace: true });
    setError(null);
  };

  const handleCloseRecording = () => {
    setCurrentView('setup');
    // Navigate back to clean transcription URL
    navigate('/transcription', { replace: true });
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
        userSettings={userSettings}
        onClose={handleCloseRecording}
      />
    );
  }

  return null;
}

export default TranscriptionPage; 