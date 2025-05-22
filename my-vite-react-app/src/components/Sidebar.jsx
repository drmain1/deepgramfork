import { Drawer, Box, Button, Typography, List, Divider, ListItemText } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import RecentRecordingItem from './RecentRecordingItem';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth0 } from '@auth0/auth0-react';
import LoginButton from './LoginButton';
import LogoutButton from './LogoutButton';

function Sidebar() {
  const { recordings, deletePersistedRecording, isFetchingRecordings, selectRecording } = useRecordings();
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
    selectRecording(null); // Clear the selected recording
    navigate('/'); // Navigate to the root path to show AudioRecorder
  };

  const handleDeleteRecording = async (recordingId) => {
    if (!isAuthenticated) {
      console.error("User not authenticated. Cannot delete recording.");
      // Optionally, show a message to the user
      return;
    }
    if (deletePersistedRecording) {
      try {
        console.log(`Attempting to delete recording via context: ${recordingId}`);
        await deletePersistedRecording(recordingId);
        // Success message or UI update could happen here if not handled by context/item itself
      } catch (error) {
        console.error(`Failed to delete recording ${recordingId}:`, error);
        // Optionally, show an error message to the user
      }
    } else {
      console.error('deletePersistedRecording function not available from context.');
    }
  };

  // Filter out 'pending' recordings from display if they have an associated 'saved' or 'failed' recording
  const processedRecordings = recordings.reduce((acc, current) => {
    const existingRecording = acc.find((recording) => recording.id === current.id);
    if (existingRecording) {
      if (existingRecording.status === 'pending' && (current.status === 'saved' || current.status === 'failed')) {
        return acc;
      } else {
        return acc.map((recording) => recording.id === current.id ? current : recording);
      }
    } else {
      return [...acc, current];
    }
  }, []);

  const sortedRecordings = processedRecordings.sort((a, b) => new Date(b.date) - new Date(a.date));

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
          disabled={isLoading || !isAuthenticated} // Disable if auth is loading or not authenticated
        >
          New Recording
        </Button>
        <Typography variant="h6">Recent Recordings</Typography>
        <List sx={{ overflowY: 'auto', flexGrow: 1 }}>
          {isFetchingRecordings && recordings.length === 0 && (
            <ListItemText primary="Loading recordings..." sx={{ textAlign: 'center', color: 'text.secondary', mt: 2 }} />
          )}
          {!isFetchingRecordings && recordings.length === 0 && isAuthenticated && (
            <ListItemText primary="No recent recordings found." sx={{ textAlign: 'center', color: 'text.secondary', mt: 2 }} />
          )}
          {!isAuthenticated && !isLoading && (
            <ListItemText primary="Login to see recordings." sx={{ textAlign: 'center', color: 'text.secondary', mt: 2}}/>
          )}
          {sortedRecordings.map((recording) => (
            <RecentRecordingItem key={recording.id} recording={recording} onDelete={handleDeleteRecording} />
          ))}
        </List>
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
            disabled={isLoading || !isAuthenticated} // Disable if auth is loading or not authenticated
          >
            Settings
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
