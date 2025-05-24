import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import TranscriptionPage from './pages/TranscriptionPage';
import PdfTestComponent from './components/PdfTestComponent';
import { RecordingsProvider } from './contexts/RecordingsContext';
import { TemplateProvider } from './contexts/TemplateContext';

function App() {
  return (
    <RecordingsProvider>
      <TemplateProvider>
        <Router>
          <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex-1 overflow-y-auto">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/transcription" element={<TranscriptionPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/pdf-test" element={<PdfTestComponent />} />
              </Routes>
            </div>
          </div>
        </Router>
      </TemplateProvider>
    </RecordingsProvider>
  );
}

export default App;
