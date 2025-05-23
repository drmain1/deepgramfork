import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SettingsPage from './pages/SettingsPage';
import { RecordingsProvider } from './contexts/RecordingsContext';
import { TemplateProvider } from './contexts/TemplateContext';
import AudioRecorder from './components/AudioRecorder';

function App() {
  return (
    <RecordingsProvider>
      <TemplateProvider>
        <Router>
          <div className="flex h-screen bg-gray-50 overflow-hidden">
            <Sidebar />
            <div className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<AudioRecorder />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </div>
        </Router>
      </TemplateProvider>
    </RecordingsProvider>
  );
}

export default App;
