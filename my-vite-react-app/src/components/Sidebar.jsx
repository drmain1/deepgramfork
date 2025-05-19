import { Drawer, Box, Button, Typography, List, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import RecentRecordingItem from './RecentRecordingItem';
import { useRecordings } from '../contexts/RecordingsContext';

function Sidebar() {
  const { recordings } = useRecordings();
  const navigate = useNavigate();

  // This local handleNewRecording might be used differently or integrated elsewhere if needed.
  // For now, the button will directly call onNewSession.
  // const handleNewRecording = () => {
  //   const newRecording = {
  //     id: Date.now(),
  //     name: `Recording ${new Date().toISOString().split('T')[0]}`,
  //     date: new Date().toISOString().split('T')[0],
  //     status: 'Not started - 0 min',
  //   };
  //   addRecording(newRecording);
  // };

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleNewRecordingClick = () => {
    navigate('/'); // Navigate to the root path to show AudioRecorder
  };

  return (
    <Drawer variant="permanent" sx={{ width: 250, flexShrink: 0, '& .MuiDrawer-paper': { width: 250, boxSizing: 'border-box' } }}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Typography variant="h5" align="center" gutterBottom>
          Dictation App
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewRecordingClick} 
          sx={{ mb: 2 }}
        >
          New Recording
        </Button>
        <Typography variant="h6">Recent Recordings</Typography>
        <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
          <List>
            {recordings.map((recording) => (
              <RecentRecordingItem key={recording.id} recording={recording} />
            ))}
          </List>
        </Box>
        {/* Wrapper for bottom items to ensure they are pushed to the end of the flex container */}
        <Box sx={{ marginTop: 'auto' }}>
          <Divider sx={{ mb: 1 }} /> 
          <Button 
            variant="contained" 
            startIcon={<SettingsIcon />}
            onClick={handleGoToSettings} 
            sx={{ mb: 1, width: '100%' }} 
          >
            Settings
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
