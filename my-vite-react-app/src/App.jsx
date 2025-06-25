import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import TranscriptionPage from './pages/TranscriptionPage';
import PatientsPage from './pages/PatientsPage';
import PatientTranscriptList from './pages/PatientTranscriptList';
import PdfTestComponent from './components/PdfTestComponent';
import { RecordingsProvider } from './contexts/RecordingsContext';
import { TemplateProvider } from './contexts/TemplateContext';

function App() {
  return (
    <RecordingsProvider>
      <TemplateProvider>
        <div className="flex h-screen bg-gray-50">
          <Sidebar />
          <div className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/transcription" element={<TranscriptionPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/patients" element={<PatientsPage />} />
              <Route path="/patients/:patientId/transcripts" element={<PatientTranscriptList />} />
              <Route path="/pdf-test" element={<PdfTestComponent />} />
            </Routes>
          </div>
        </div>
      </TemplateProvider>
    </RecordingsProvider>
  );
}

export default App;
