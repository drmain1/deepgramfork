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
        const localNonSaved = prevRecordings.filter(r => r.status !== 'saved');
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

        const merged = [...localNonSaved];
        s3Map.forEach((s3Rec, id) => {
          if (!merged.find(localRec => localRec.id === id)) {
            // Check if we have location data in localStorage for this recording
            const localRecWithLocation = prevRecordings.find(localRec => localRec.id === id);
            if (localRecWithLocation && localRecWithLocation.location && !s3Rec.location) {
              console.log(`Preserving location from localStorage for recording ${id}:`, localRecWithLocation.location);
              s3Rec.location = localRecWithLocation.location;
            }
            merged.push(s3Rec);
          }
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
              rec && typeof rec.id === 'string' && rec.id.startsWith('session_') && 
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

  const startPendingRecording = useCallback((sessionId) => {
    const now = new Date();
    const newRecording = {
      id: sessionId, 
      name: `Pending Recording - ${now.toLocaleTimeString()}`,
      date: now.toISOString(),
      status: 'pending',
    };
    setRecordings(prevRecordings => 
      [newRecording, ...prevRecordings.filter(r => r.id !== sessionId)]
    );
  }, []);

  const updateRecording = useCallback((sessionId, updates) => {
    setRecordings(prevRecordings =>
      prevRecordings.map(rec =>
        rec.id === sessionId ? { ...rec, ...updates, date: rec.date, lastUpdated: new Date().toISOString() } : rec 
      )
    );
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
    if (recordingId === null) {
      setOriginalTranscriptContent(null);
      setPolishedTranscriptContent(null);
      setSelectedTranscriptError(null);
      setIsLoadingSelectedTranscript(false);
    }
  }, [selectedRecordingId]);

  // Effect to handle recording selection changes (initial load)
  useEffect(() => {
    if (selectedRecordingId) {
      const recording = recordings.find(r => r.id === selectedRecordingId);
      if (recording) {
        setIsLoadingSelectedTranscript(true);
        setSelectedTranscriptError(null);
        setOriginalTranscriptContent(null); // Clear previous content
        setPolishedTranscriptContent(null); // Clear previous content

        const fetchAllTranscripts = async () => {
          try {
            let originalContent = 'Original transcript not available or S3 path missing.';
            if (recording.s3PathTranscript) {
              originalContent = await fetchTranscriptContent(recording.s3PathTranscript, 'original');
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
              polishedContentToSet = 'Polished transcript not available or S3 path missing.';
            }
            setPolishedTranscriptContent(polishedContentToSet);

          } catch (error) {
            console.error("Error fetching transcript contents in context:", error);
            setSelectedTranscriptError(error.message || 'An unexpected error occurred while fetching transcripts.');
          } finally {
            setIsLoadingSelectedTranscript(false);
          }
        };
        fetchAllTranscripts();
      } else {
        // Recording ID selected but not found in the list, maybe clear?
        setSelectedTranscriptError(`Recording with ID ${selectedRecordingId} not found.`);
        setOriginalTranscriptContent(null);
        setPolishedTranscriptContent(null);
        setIsLoadingSelectedTranscript(false);
      }
    }
  }, [selectedRecordingId, fetchTranscriptContent]); // Removed 'recordings' dependency

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
