import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const RecordingsContext = createContext();

export function RecordingsProvider({ children }) {
  const { getAccessTokenSilently, user, isAuthenticated, isLoading } = useAuth0();
  const [recordings, setRecordings] = useState(() => {
    return []; 
  });
  const [isFetchingRecordings, setIsFetchingRecordings] = useState(false);

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

      setRecordings(prevRecordings => {
        const localNonSaved = prevRecordings.filter(r => r.status !== 'saved');
        const s3Map = new Map(fetchedRecordings.map(r => [r.id, { ...r, date: r.date }])); 

        const merged = [...localNonSaved];
        s3Map.forEach((s3Rec, id) => {
          if (!merged.find(localRec => localRec.id === id)) {
            merged.push(s3Rec);
          }
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

  return (
    <RecordingsContext.Provider value={{ recordings, addRecording, startPendingRecording, updateRecording, removeRecording, deletePersistedRecording, fetchUserRecordings, isFetchingRecordings }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => useContext(RecordingsContext);
