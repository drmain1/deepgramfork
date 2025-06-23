import { createContext, useContext } from 'react';
import { useRecordings as useRecordingsHook } from '../hooks/useRecordings';

const RecordingsContext = createContext();

// Thin wrapper around Zustand store for backward compatibility
export function RecordingsProvider({ children }) {
  const recordingsData = useRecordingsHook();

  return (
    <RecordingsContext.Provider value={recordingsData}>
      {children}
    </RecordingsContext.Provider>
  );
}

export const useRecordings = () => {
  const context = useContext(RecordingsContext);
  if (!context) {
    throw new Error('useRecordings must be used within a RecordingsProvider');
  }
  return context;
};