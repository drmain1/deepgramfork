import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import TranscriptionPage from './pages/TranscriptionPage';
import PatientsPage from './pages/PatientsPage';
import PatientTranscriptList from './pages/PatientTranscriptList';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { RecordingsProvider } from './contexts/RecordingsContext';
import SessionTimeoutWarning from './components/SessionTimeoutWarning';

function App() {
  return (
    <RecordingsProvider>
      <SessionTimeoutWarning />
      <div className="flex flex-col h-screen bg-gray-50">
        {/* AI Warning Banner */}
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 px-4 py-2 text-sm flex items-center justify-center">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">AI can make errors</span>
          <span className="ml-1">- please review all documentation for accuracy</span>
        </div>
        
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/transcription" element={<TranscriptionPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:patientId/transcripts" element={<PatientTranscriptList />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
            </Routes>
          </div>
        </div>
      </div>
    </RecordingsProvider>
  );
}

export default App;
