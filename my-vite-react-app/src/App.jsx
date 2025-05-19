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
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RecordingsProvider>
        <TemplateProvider>
          <Router>
            <Box sx={{ display: 'flex', height: '100vh' }}>
              <Sidebar />
              <Box component="main" sx={{ flexGrow: 1, p: 1, ml: '250px' }}>
                <Routes>
                  <Route path="/" element={<AudioRecorder />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Box>
            </Box>
          </Router>
        </TemplateProvider>
      </RecordingsProvider>
    </ThemeProvider>
  );
}

export default App;
