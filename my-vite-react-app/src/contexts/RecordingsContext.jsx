import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const RecordingsContext = createContext();

export function RecordingsProvider({ children }) {
  const { getAccessTokenSilently, user } = useAuth0();
  const [recordings, setRecordings] = useState(() => {
    const saved = localStorage.getItem('recordings');
    try {
      let parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        // Filter out old/placeholder recordings
        parsed = parsed.filter(rec => 
          rec && 
          typeof rec.id === 'string' && 
          rec.id.startsWith('session_') && 
          typeof rec.status === 'string' && 
          ['pending', 'saving', 'saved', 'failed'].includes(rec.status)
        );
        return parsed;
      } else {
        return []; // If not an array, start fresh
      }
    } catch (error) {
      console.error("Error parsing or filtering recordings from localStorage:", error);
      return []; // Fallback to empty array on error
    }
  });

  useEffect(() => {
    localStorage.setItem('recordings', JSON.stringify(recordings));
  }, [recordings]);

  const startPendingRecording = useCallback((sessionId) => {
    const now = new Date();
    const newRecording = {
      id: sessionId, // Use sessionId as the unique ID
      name: `Pending Recording - ${now.toLocaleTimeString()}`,
      date: now.toISOString(),
      status: 'pending',
    };
    // Add to the beginning of the list and ensure no duplicates by sessionId
    setRecordings(prevRecordings => 
      [newRecording, ...prevRecordings.filter(r => r.id !== sessionId)]
    );
  }, []);

  const updateRecording = useCallback((sessionId, updates) => {
    setRecordings(prevRecordings =>
      prevRecordings.map(rec =>
        rec.id === sessionId ? { ...rec, ...updates, date: rec.date } : rec // Preserve original date
      )
    );
  }, []);

  const removeRecording = useCallback((sessionId) => {
    setRecordings(prevRecordings => prevRecordings.filter(rec => rec.id !== sessionId));
  }, []);

  const deletePersistedRecording = useCallback(async (sessionId) => {
    if (!user || !user.sub) {
      console.error('User not authenticated, cannot delete recording.');
      // Optionally, throw an error or provide user feedback
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

      // If backend deletion is successful, remove from local state
      removeRecording(sessionId);
      console.log(`Recording ${sessionId} deleted successfully.`);
      // Optionally, add user feedback here (e.g., a success toast)

    } catch (error) {
      console.error('Error deleting recording:', error);
      // Optionally, add user feedback here (e.g., an error toast)
      // Rethrow or handle as appropriate for your UI
      throw error;
    }
  }, [user, getAccessTokenSilently, removeRecording]);

  // Keep original addRecording for potential other uses or phase out later
  // If this is solely for initially populating or testing, it might be removed
  // if startPendingRecording and updateRecording cover all active use cases.
  const addRecording = (recording) => {
    // Ensure new recordings added this way also don't duplicate by id
    setRecordings(prevRecordings => 
      [recording, ...prevRecordings.filter(r => r.id !== recording.id)]
    );
  };

  return (
    <RecordingsContext.Provider value={{ recordings, addRecording, startPendingRecording, updateRecording, removeRecording, deletePersistedRecording }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => useContext(RecordingsContext);
