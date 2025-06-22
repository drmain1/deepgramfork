import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import TranscriptViewer from '../components/TranscriptViewer';
import SetupView from '../components/SetupView';
import RecordingView from '../components/RecordingView';

function TranscriptionPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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
  const [targetLanguage, setTargetLanguage] = useState('');

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
      // Don't reset selectedLocation and selectedProfileId - these should persist between sessions
      // setSelectedLocation('');
      // setSelectedProfileId('');
      setError(null);
    }
  }, [location]);

  // Handle settings initialization
  useEffect(() => {
    console.log("TranscriptionPage - userSettings.officeInformation:", userSettings.officeInformation);
    console.log("TranscriptionPage - selectedLocation current state:", selectedLocation);
    console.log("=== PROFILE SELECTION DEBUG ===");
    console.log("settingsLoading:", settingsLoading);
    console.log("userSettings.transcriptionProfiles:", userSettings.transcriptionProfiles);
    console.log("selectedProfileId current state:", selectedProfileId);
    
    if (!settingsLoading && userSettings.transcriptionProfiles) {
      const filteredProfiles = userSettings.transcriptionProfiles.filter(
        profile => profile.name !== 'Default/General summary'
      );
      console.log("filteredProfiles:", filteredProfiles);

      if (filteredProfiles.length > 0) {
        const currentProfileStillExistsInFiltered = filteredProfiles.some(p => p.id === selectedProfileId);
        console.log("currentProfileStillExistsInFiltered:", currentProfileStillExistsInFiltered);
        if (!selectedProfileId || !currentProfileStillExistsInFiltered) {
          const defaultProfile = filteredProfiles.find(p => p.isDefault) || filteredProfiles[0];
          console.log("Setting defaultProfile:", defaultProfile);
          if (defaultProfile) {
            setSelectedProfileId(defaultProfile.id);
            console.log("Set selectedProfileId to:", defaultProfile.id);
          }
        }
      } else {
        console.log("No filtered profiles found, clearing selectedProfileId");
        setSelectedProfileId('');
      }
    }
    console.log("================================");

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
    return <TranscriptViewer key={selectedRecordingId} />;
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

  // Authentication is handled at the app level, so this shouldn't happen
  // But if it does, show a loading state
  if (!isAuthenticated) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Checking authentication...</p>
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
}

export default TranscriptionPage; 