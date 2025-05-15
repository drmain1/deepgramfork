import { Drawer, Box, Button, Typography, List, Divider } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RecentRecordingItem from './RecentRecordingItem';
import EasySetupModal from './EasySetupModal';
import AdvancedSetupModal from './AdvancedSetupModal';
import { useRecordings } from '../contexts/RecordingsContext';

function Sidebar({ onEasySetup, onAdvancedSetup, easyModalOpen, setEasyModalOpen, advancedModalOpen, setAdvancedModalOpen, onNewSession }) {
  const { recordings, addRecording } = useRecordings();

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

  return (
    <>
      <Drawer variant="permanent" sx={{ width: 250, flexShrink: 0 }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Typography variant="h5" align="center" gutterBottom>
            Dictation App
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onNewSession}
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
          <Divider sx={{ mb: 2 }} />
          <Button variant="contained" color="success" onClick={onEasySetup} sx={{ mb: 1 }}>
            Easy Template Setup
          </Button>
          <Button variant="contained" color="warning" onClick={onAdvancedSetup}>
            Advanced Template Setup
          </Button>
        </Box>
      </Drawer>
      <EasySetupModal open={easyModalOpen} onClose={() => setEasyModalOpen(false)} />
      <AdvancedSetupModal open={advancedModalOpen} onClose={() => setAdvancedModalOpen(false)} />
    </>
  );
}

export default Sidebar;
