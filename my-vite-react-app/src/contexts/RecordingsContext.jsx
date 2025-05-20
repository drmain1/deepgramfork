import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const RecordingsContext = createContext();

export function RecordingsProvider({ children }) {
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
    <RecordingsContext.Provider value={{ recordings, addRecording, startPendingRecording, updateRecording, removeRecording }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => useContext(RecordingsContext);
