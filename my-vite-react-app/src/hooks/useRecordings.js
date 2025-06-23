import { useEffect } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import useRecordingsStore from '../stores/recordingsStore';

// Hook wrapper to maintain compatibility with existing components
export function useRecordings() {
  const { currentUser, getToken, loading: authLoading } = useAuth();
  
  // Get store state and actions
  const recordings = useRecordingsStore((state) => state.recordings);
  const selectedRecordingId = useRecordingsStore((state) => state.selectedRecordingId);
  const originalTranscriptContent = useRecordingsStore((state) => state.originalTranscriptContent);
  const polishedTranscriptContent = useRecordingsStore((state) => state.polishedTranscriptContent);
  const isLoadingSelectedTranscript = useRecordingsStore((state) => state.isLoadingSelectedTranscript);
  const selectedTranscriptError = useRecordingsStore((state) => state.selectedTranscriptError);
  const isFetchingRecordings = useRecordingsStore((state) => state.isFetchingRecordings);
  
  // Actions
  const initialize = useRecordingsStore((state) => state.initialize);
  const fetchUserRecordings = useRecordingsStore((state) => state.fetchUserRecordings);
  const startPendingRecording = useRecordingsStore((state) => state.startPendingRecording);
  const updateRecording = useRecordingsStore((state) => state.updateRecording);
  const removeRecording = useRecordingsStore((state) => state.removeRecording);
  const addRecording = useRecordingsStore((state) => state.addRecording);
  const selectRecording = useRecordingsStore((state) => state.selectRecording);
  const loadSelectedTranscript = useRecordingsStore((state) => state.loadSelectedTranscript);
  const deletePersistedRecording = useRecordingsStore((state) => state.deletePersistedRecording);
  const clearStore = useRecordingsStore((state) => state.clearStore);

  // Initialize store when user changes
  useEffect(() => {
    if (!authLoading && currentUser?.uid) {
      initialize(currentUser, getToken);
    } else if (!authLoading && !currentUser) {
      clearStore();
    }
  }, [currentUser, authLoading, initialize, clearStore, getToken]);

  // Load transcript when selection changes
  useEffect(() => {
    if (selectedRecordingId && currentUser) {
      loadSelectedTranscript(currentUser, getToken);
    }
  }, [selectedRecordingId, currentUser, loadSelectedTranscript, getToken]);

  // Poll for recordings with 'saving' status
  useEffect(() => {
    if (!currentUser?.uid) return;

    const hasSavingRecordings = recordings.some(rec => rec.status === 'saving');
    if (!hasSavingRecordings) return;

    console.log('Detected recordings with saving status, setting up periodic refresh...');
    
    const intervalId = setInterval(() => {
      console.log('Checking for completed recordings...');
      fetchUserRecordings(currentUser, getToken);
    }, 5000);

    return () => {
      console.log('Clearing periodic refresh interval');
      clearInterval(intervalId);
    };
  }, [recordings, currentUser, fetchUserRecordings, getToken]);

  // Return compatible API
  return {
    recordings,
    selectedRecordingId,
    originalTranscriptContent,
    polishedTranscriptContent,
    isLoadingSelectedTranscript,
    selectedTranscriptError,
    isFetchingRecordings,
    
    // Actions with bound parameters
    fetchUserRecordings: () => fetchUserRecordings(currentUser, getToken),
    deletePersistedRecording: (recordingId) => deletePersistedRecording(recordingId, currentUser, getToken),
    startPendingRecording,
    updateRecording,
    removeRecording,
    addRecording,
    selectRecording,
    
    // Computed properties for compatibility
    isLoading: authLoading || isFetchingRecordings
  };
}