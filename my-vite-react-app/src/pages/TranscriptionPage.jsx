import { useEffect } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useUserSettings } from '../hooks/useUserSettings';
import useTranscriptionSessionStore from '../stores/transcriptionSessionStore';
import TranscriptViewer from '../components/TranscriptViewer';
import SetupView from '../components/SetupView';
import RecordingView from '../components/RecordingView';

function TranscriptionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { selectedRecordingId, recordings, selectRecording } = useRecordings();
  const { userSettings, settingsLoading } = useUserSettings();
  const navigate = useNavigate();
  const location = useLocation();

  // Use Zustand store for all state management
  const {
    currentView,
    setCurrentView,
    error,
    setError,
    patientDetails,
    clearPatientSelection,
    initializeSettings
  } = useTranscriptionSessionStore();

  // Clear patient selection and related state when component mounts
  // This ensures a fresh start when navigating back to the transcription page
  // and prevents patient context from persisting across navigation
  useEffect(() => {
    // Clear all patient-related state on mount to avoid bugs
    // where patient selection persists but clinical context is lost
    clearPatientSelection();
    setError(null);
  }, [clearPatientSelection, setError]); // Include dependencies

  // Initialize component view state based on URL
  useEffect(() => {
    // Check if we're coming from a specific view
    const searchParams = new URLSearchParams(location.search);
    const viewParam = searchParams.get('view');
    
    if (viewParam === 'recording') {
      setCurrentView('recording');
    } else {
      setCurrentView('setup');
    }
  }, [location, setCurrentView]);

  // Handle settings initialization
  useEffect(() => {
    if (!settingsLoading && userSettings) {
      initializeSettings(userSettings);
    }
  }, [userSettings, settingsLoading, initializeSettings]);

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
    // Clear patient selection and related state using Zustand store
    clearPatientSelection();
    setError(null);
    // Clear selected recording if it was a draft
    if (selectedRecordingId) {
      const recording = recordings.find(r => r.id === selectedRecordingId);
      if (recording && recording.status === 'draft') {
        selectRecording(null);
      }
    }
  };

  // If a recording is selected from the sidebar
  if (selectedRecordingId) {
    const selectedRecording = recordings.find(r => r.id === selectedRecordingId);
    
    console.log('=== DRAFT DETECTION DEBUG ===');
    console.log('selectedRecordingId:', selectedRecordingId);
    console.log('selectedRecording:', selectedRecording);
    console.log('selectedRecording status:', selectedRecording?.status);
    console.log('Is draft?:', selectedRecording?.status === 'draft');
    console.log('transcript:', selectedRecording?.transcript ? `Has transcript (length: ${selectedRecording.transcript.length})` : 'No transcript');
    console.log('profileId:', selectedRecording?.profileId);
    
    // Show all recordings to see if there are any actual drafts
    console.log('ALL RECORDINGS:');
    recordings.forEach(rec => {
      console.log(`- ${rec.id}: ${rec.name} (status: ${rec.status})`);
    });
    console.log('=============================')
    
    // If it's a draft, show the RecordingView to resume
    if (selectedRecording && selectedRecording.status === 'draft') {
      // Extract saved data from the draft
      const draftData = {
        patientDetails: selectedRecording.name?.replace('Draft: ', '') || patientDetails,
        savedTranscript: selectedRecording.transcript || '',
        sessionId: selectedRecording.id,
        profileId: selectedRecording.profileId || selectedProfileId
      };
      
      // Don't clear the selection here - let handleCloseRecording do it
      // This prevents re-rendering issues
      
      return (
        <RecordingView
          userSettings={userSettings}
          onClose={() => {
            selectRecording(null); // Clear selection when closing
            handleCloseRecording();
          }}
          resumeData={draftData}
        />
      );
    }
    
    // Otherwise show the transcript viewer for saved recordings
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
        userSettings={userSettings}
        settingsLoading={settingsLoading}
        error={error}
        onStartEncounter={handleStartEncounter}
      />
    );
  } else if (currentView === 'recording') {
    return (
      <RecordingView
        userSettings={userSettings}
        onClose={handleCloseRecording}
      />
    );
  }

  return null;
}

export default TranscriptionPage; 