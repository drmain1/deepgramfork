import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const RecordingsContext = createContext();

export function RecordingsProvider({ children }) {
  const { getAccessTokenSilently, user, isAuthenticated, isLoading } = useAuth0();
  const [recordings, setRecordings] = useState(() => {
    return []; 
  });
  const [isFetchingRecordings, setIsFetchingRecordings] = useState(false);

  // State for selected recording and its transcript content
  const [selectedRecordingId, setSelectedRecordingId] = useState(null);
  const [originalTranscriptContent, setOriginalTranscriptContent] = useState(null);
  const [polishedTranscriptContent, setPolishedTranscriptContent] = useState(null);
  const [isLoadingSelectedTranscript, setIsLoadingSelectedTranscript] = useState(false);
  const [selectedTranscriptError, setSelectedTranscriptError] = useState(null);
  const [previousRecordingStatus, setPreviousRecordingStatus] = useState({});


  useEffect(() => {
    if (isAuthenticated && user && user.sub) {
      localStorage.setItem(`recordings_${user.sub}`, JSON.stringify(recordings));
    } else {
      const currentUserId = user?.sub; 
      if (currentUserId) {
        localStorage.removeItem(`recordings_${currentUserId}`);
      }
    }
  }, [recordings, isAuthenticated, user]);

  const fetchUserRecordings = useCallback(async () => {
    if (!isAuthenticated || !user || !user.sub || isFetchingRecordings) {
      return;
    }
    console.log("Attempting to fetch user recordings...");
    setIsFetchingRecordings(true);
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(`/api/v1/user_recordings/${user.sub}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch recordings.' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }
      const fetchedRecordings = await response.json();
      console.log("Fetched recordings from S3:", fetchedRecordings);
      console.log("Raw API Response - First recording full object:", JSON.stringify(fetchedRecordings[0], null, 2));
      
      // Debug: Check if location exists in fetched recordings
      fetchedRecordings.forEach((recording, index) => {
        console.log(`Recording ${index} from S3:`, {
          id: recording.id,
          name: recording.name,
          location: recording.location,
          hasLocation: recording.hasOwnProperty('location')
        });
      });

      setRecordings(prevRecordings => {
        console.log("[fetchUserRecordings] Current local recordings:", prevRecordings.map(r => ({ id: r.id, name: r.name, status: r.status })));
        // Include ALL local recordings for proper merging
        const localRecordings = prevRecordings;
        const s3Map = new Map(fetchedRecordings.map(r => [r.id, { ...r, date: r.date }])); 

        // Debug: Check what's in the s3Map
        console.log("S3 Map entries:");
        s3Map.forEach((recording, id) => {
          console.log(`${id}:`, {
            name: recording.name,
            location: recording.location,
            hasLocation: recording.hasOwnProperty('location')
          });
        });

        const merged = [];
        
        // First, handle ALL local recordings
        localRecordings.forEach(localRec => {
          const s3Version = s3Map.get(localRec.id);
          if (s3Version) {
            // Recording exists in both local and S3 - use S3 version (it's been processed)
            console.log(`[MERGE] Found S3 version for local recording ${localRec.id} (was ${localRec.status}, now saved)`);
            // Preserve any local data that might not be in S3
            const updatedRec = {
              ...localRec,
              ...s3Version,
              status: 'saved' // Ensure status is updated
            };
            merged.push(updatedRec);
            s3Map.delete(localRec.id); // Remove from s3Map so we don't add it again
          } else {
            // Recording only exists locally (still processing or failed)
            console.log(`[MERGE] Keeping local-only recording ${localRec.id} with status ${localRec.status}`);
            merged.push(localRec);
          }
        });
        
        // Then, add any remaining S3 recordings that weren't in local storage
        s3Map.forEach((s3Rec, id) => {
          merged.push(s3Rec);
        });
        
        // Debug: Check final merged recordings
        console.log("Final merged recordings:");
        merged.forEach((recording, index) => {
          console.log(`Recording ${index}:`, {
            id: recording.id,
            name: recording.name,
            location: recording.location,
            status: recording.status,
            hasLocation: recording.hasOwnProperty('location')
          });
        });
        
        return merged.sort((a, b) => new Date(b.date) - new Date(a.date));
      });

    } catch (error) {
      console.error('Error fetching user recordings:', error);
    } finally {
      setIsFetchingRecordings(false);
    }
  }, [isAuthenticated, user, getAccessTokenSilently]);

  useEffect(() => {
    if (isAuthenticated && user && user.sub) {
      const savedLocalRecordings = localStorage.getItem(`recordings_${user.sub}`);
      if (savedLocalRecordings) {
        try {
          const parsed = JSON.parse(savedLocalRecordings);
          if (Array.isArray(parsed)) {
            const filteredLocal = parsed.filter(rec => 
              rec && typeof rec.id === 'string' && 
              typeof rec.status === 'string' && ['pending', 'saving', 'saved', 'failed'].includes(rec.status)
            );
            setRecordings(filteredLocal.sort((a,b) => new Date(b.date) - new Date(a.date)));
          }
        } catch (e) {
          console.error("Error parsing recordings from user-specific localStorage:", e);
        }
      }
      fetchUserRecordings();
    } else if (!isLoading && !isAuthenticated) {
      const currentUserId = user?.sub; 
      if (currentUserId) {
        localStorage.removeItem(`recordings_${currentUserId}`);
      }
      setRecordings([]);
    }
  }, [isAuthenticated, user, isLoading, fetchUserRecordings]);

  // Periodic check for recordings with 'saving' status to auto-refresh when processing completes
  useEffect(() => {
    if (!isAuthenticated || !user || !user.sub) return;

    const hasSavingRecordings = recordings.some(rec => rec.status === 'saving');
    if (!hasSavingRecordings) return;

    console.log('Detected recordings with saving status, setting up periodic refresh...');
    
    const intervalId = setInterval(() => {
      console.log('Checking for completed recordings...');
      fetchUserRecordings();
    }, 5000); // Check every 5 seconds

    return () => {
      console.log('Clearing periodic refresh interval');
      clearInterval(intervalId);
    };
  }, [recordings, isAuthenticated, user, fetchUserRecordings]);

  const startPendingRecording = useCallback((sessionId, recordingName) => {
    const now = new Date();
    const newRecording = {
      id: sessionId, 
      name: recordingName || `Pending Recording - ${now.toLocaleTimeString()}`,
      date: now.toISOString(),
      status: 'pending',
    };
    setRecordings(prevRecordings => 
      [newRecording, ...prevRecordings.filter(r => r.id !== sessionId)]
    );
  }, []);

  const updateRecording = useCallback((sessionId, updates) => {
    console.log(`[updateRecording] Updating recording ${sessionId} with:`, updates);
    setRecordings(prevRecordings => {
      console.log(`[updateRecording] Current recordings:`, prevRecordings.map(r => ({ id: r.id, status: r.status })));
      const updated = prevRecordings.map(rec =>
        rec.id === sessionId ? { ...rec, ...updates, date: rec.date, lastUpdated: new Date().toISOString() } : rec 
      );
      console.log(`[updateRecording] Updated recordings:`, updated.map(r => ({ id: r.id, status: r.status })));
      return updated;
    });
  }, []);

  const removeRecording = useCallback((sessionId) => {
    setRecordings(prevRecordings => prevRecordings.filter(rec => rec.id !== sessionId));
  }, []);

  const deletePersistedRecording = useCallback(async (sessionId) => {
    if (!user || !user.sub) {
      console.error('User not authenticated, cannot delete recording.');
      return;
    }
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(`/api/v1/recordings/${user.sub}/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to delete recording from server.' }));
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      removeRecording(sessionId);
      console.log(`Recording ${sessionId} deleted successfully.`);
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw error;
    }
  }, [user, getAccessTokenSilently, removeRecording]);

  const addRecording = (recording) => {
    setRecordings(prevRecordings =>
      [recording, ...prevRecordings.filter(r => r.id !== recording.id)].sort((a,b) => new Date(b.date) - new Date(a.date))
    );
  };

  const fetchTranscriptContent = useCallback(async (s3Key, type) => {
    if (!s3Key) {
      return type === 'original' ? 'Original transcript S3 path not found.' : 'Polished transcript S3 path not found.';
    }
    try {
      // Ensure VITE_API_BASE_URL is correctly configured in your .env file for production
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/v1/s3_object_content?s3_key=${encodeURIComponent(s3Key)}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch ${type} transcript (${s3Key}): ${response.status} ${response.statusText}. Server: ${errorText}`);
        return `Error fetching ${type} transcript: ${response.statusText}. Details: ${errorText}`;
      }
      return await response.text();
    } catch (error) {
      console.error(`Error fetching ${type} transcript (${s3Key}):`, error);
      return `Could not fetch ${type} transcript: ${error.message}`;
    }
  }, []);

  const selectRecording = useCallback((recordingId) => {
    if (recordingId === selectedRecordingId) { // If clicking the same recording, deselect it or do nothing (currently deselects)
        // setSelectedRecordingId(null);
        // setOriginalTranscriptContent(null);
        // setPolishedTranscriptContent(null);
        // setSelectedTranscriptError(null);
        return; // Or toggle behavior can be implemented here
    }
    setSelectedRecordingId(recordingId);
    // Clear transcript content when selecting any recording (including new ones)
    setOriginalTranscriptContent(null);
    setPolishedTranscriptContent(null);
    setSelectedTranscriptError(null);
    if (recordingId === null) {
      setIsLoadingSelectedTranscript(false);
    }
  }, [selectedRecordingId]);

  // Effect to handle recording selection changes (initial load)
  useEffect(() => {
    if (selectedRecordingId) {
      const recording = recordings.find(r => r.id === selectedRecordingId);
      if (recording) {
        // Check if recording is still being processed
        if (recording.status === 'pending' || recording.status === 'saving') {
          setIsLoadingSelectedTranscript(false);
          setSelectedTranscriptError('Recording is still being processed. Please wait for it to complete.');
          setOriginalTranscriptContent(null);
          setPolishedTranscriptContent(null);
          return;
        }

        console.log('Fetching transcript content for recording:', recording.id);

        setIsLoadingSelectedTranscript(true);
        setSelectedTranscriptError(null);
        setOriginalTranscriptContent(null); // Clear previous content
        setPolishedTranscriptContent(null); // Clear previous content

        const fetchAllTranscripts = async () => {
          try {
            let originalContent = 'Original transcript not available or S3 path missing.';
            if (recording.s3PathTranscript) {
              originalContent = await fetchTranscriptContent(recording.s3PathTranscript, 'original');
            } else {
              // Check if recording was just saved and might have missing paths
              if (recording.status === 'saved' && !recording.s3PathTranscript) {
                originalContent = 'Original transcript S3 path missing. Please refresh the page and try again.';
              }
            }
            setOriginalTranscriptContent(originalContent);

            let polishedContentToSet;
            // Prioritize locally edited 'polishedTranscript' if it exists on the recording object.
            // This field is set by updateRecording when "Save Changes" is clicked in AudioRecorder.
            if (recording && typeof recording.polishedTranscript === 'string') {
              polishedContentToSet = recording.polishedTranscript;
            } else if (recording && recording.s3PathPolished) {
              // If no local edit or if we prefer S3, fetch from S3 path.
              polishedContentToSet = await fetchTranscriptContent(recording.s3PathPolished, 'polished');
            } else {
              // Fallback if neither local edit nor S3 path is available.
              if (recording.status === 'saved' && !recording.s3PathPolished) {
                polishedContentToSet = 'Polished transcript S3 path missing. Please refresh the page and try again.';
              } else {
                polishedContentToSet = 'Polished transcript not available or S3 path missing.';
              }
            }
            setPolishedTranscriptContent(polishedContentToSet);

          } catch (error) {
            console.error("Error fetching transcript contents in context:", error);
            setSelectedTranscriptError(error.message || 'An unexpected error occurred while fetching transcripts.');
          } finally {
            setIsLoadingSelectedTranscript(false);
          }
        };
        
        // Add a small delay to allow for state propagation
        setTimeout(fetchAllTranscripts, 100);
      } else {
        // Recording ID selected but not found in the list, maybe clear?
        setSelectedTranscriptError(`Recording with ID ${selectedRecordingId} not found.`);
        setOriginalTranscriptContent(null);
        setPolishedTranscriptContent(null);
        setIsLoadingSelectedTranscript(false);
      }
    }
  }, [selectedRecordingId, recordings, fetchTranscriptContent]); // Simplified dependencies

  // Track status changes for all recordings
  useEffect(() => {
    const statusMap = {};
    recordings.forEach(rec => {
      const prevStatus = previousRecordingStatus[rec.id];
      const currentStatus = rec.status;
      statusMap[rec.id] = currentStatus;
      
      // If this is the selected recording and it transitioned from saving/pending to saved
      if (selectedRecordingId === rec.id && 
          (prevStatus === 'saving' || prevStatus === 'pending') && 
          currentStatus === 'saved') {
        console.log('Detected status transition to saved for selected recording:', rec.id);
        // Trigger a re-fetch by clearing the error
        setSelectedTranscriptError(null);
        // Force refetch transcripts
        setOriginalTranscriptContent(null);
        setPolishedTranscriptContent(null);
      }
    });
    setPreviousRecordingStatus(statusMap);
  }, [recordings, selectedRecordingId]); // Don't include previousRecordingStatus to avoid infinite loop

  // Separate effect to handle polished transcript updates from recordings changes
  useEffect(() => {
    if (selectedRecordingId) {
      const recording = recordings.find(r => r.id === selectedRecordingId);
      if (recording && typeof recording.polishedTranscript === 'string') {
        // Only update if we have a local edit and it's different from current content
        setPolishedTranscriptContent(recording.polishedTranscript);
      }
    }
  }, [selectedRecordingId, recordings]);

  return (
    <RecordingsContext.Provider value={{
      recordings,
      addRecording,
      startPendingRecording,
      updateRecording,
      removeRecording,
      deletePersistedRecording,
      fetchUserRecordings,
      isFetchingRecordings,
      selectedRecordingId,
      selectRecording,
      originalTranscriptContent,
      polishedTranscriptContent,
      isLoadingSelectedTranscript,
      selectedTranscriptError
    }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => useContext(RecordingsContext);
