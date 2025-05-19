import { Drawer, Box, Button, Typography, List, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import RecentRecordingItem from './RecentRecordingItem';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';

function Sidebar() {
  const { recordings } = useRecordings();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user } = useAuth0();

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
          {
            isLoading ? (
              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mb: 1 }}>Loading user...</Typography>
            ) : isAuthenticated ? (
              <Box sx={{ mb: 1, textAlign: 'center' }}>
                {user?.email && <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>{user.email}</Typography>}
                <LogoutButton />
              </Box>
            ) : (
              <Box sx={{ mb: 1, textAlign: 'center' }}>
                <LoginButton />
              </Box>
            )
          }
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
