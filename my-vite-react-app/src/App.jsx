import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Sidebar from './components/Sidebar';
import SettingsPage from './pages/SettingsPage';
import theme from './theme';
import { RecordingsProvider } from './contexts/RecordingsContext';
import { TemplateProvider } from './contexts/TemplateContext';
import AudioRecorder from './components/AudioRecorder';

function App() {
  const [easyModalOpen, setEasyModalOpen] = useState(false);
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [showAudioRecorderPanel, setShowAudioRecorderPanel] = useState(false);

  const handleNewSession = () => {
    console.log("New session initiated, showing AudioRecorder panel.");
    setShowAudioRecorderPanel(true);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RecordingsProvider>
        <TemplateProvider>
          <Router>
            <Box sx={{ display: 'flex' }}>
              <Sidebar
                onEasySetup={() => setEasyModalOpen(true)}
                onAdvancedSetup={() => setAdvancedModalOpen(true)}
                onNewSession={handleNewSession}
                easyModalOpen={easyModalOpen}
                setEasyModalOpen={setEasyModalOpen}
                advancedModalOpen={advancedModalOpen}
                setAdvancedModalOpen={setAdvancedModalOpen}
              />
              <Box component="main" sx={{ flexGrow: 1, p: 3, ml: '250px' }}>
                {showAudioRecorderPanel ? (
                  <AudioRecorder
                    isOpen={showAudioRecorderPanel}
                    onClose={() => setShowAudioRecorderPanel(false)}
                  />
                ) : (
                  <Routes>
                    <Route path="/" element={<SettingsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                )}
              </Box>
            </Box>
          </Router>
        </TemplateProvider>
      </RecordingsProvider>
    </ThemeProvider>
  );
}

export default App;
