import { createContext, useContext, useState, useEffect } from 'react';

const RecordingsContext = createContext();

export function RecordingsProvider({ children }) {
  const [recordings, setRecordings] = useState(() => {
    const saved = localStorage.getItem('recordings');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('recordings', JSON.stringify(recordings));
  }, [recordings]);

  const addRecording = (recording) => {
    setRecordings([recording, ...recordings]);
  };

  return (
    <RecordingsContext.Provider value={{ recordings, addRecording }}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => useContext(RecordingsContext);
