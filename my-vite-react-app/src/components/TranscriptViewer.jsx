import React, { useState } from 'react';
import { Box, Typography, Button, Tabs, Tab, CircularProgress } from '@mui/material';
import { useRecordings } from '../contexts/RecordingsContext';
import EditableNote from './EditableNote';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      id={`transcript-tabpanel-${index}`}
      aria-labelledby={`transcript-tab-${index}`}
      {...other}
      style={value === index ?
        { flexGrow: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 } :
        { display: 'none' }
      }
    >
      {children}
    </div>
  );
};

function TranscriptViewer() {
  const {
    recordings,
    selectedRecordingId,
    selectRecording,
    originalTranscriptContent,
    polishedTranscriptContent,
    isLoadingSelectedTranscript,
    selectedTranscriptError,
    updateRecording
  } = useRecordings();

  const [transcriptDisplayTab, setTranscriptDisplayTab] = useState(0);

  const selectedRec = recordings.find(r => r.id === selectedRecordingId);
  const title = selectedRec ? `Details: ${selectedRec.name}` : "Recording Details";

  const handleTabChange = (event, newValue) => {
    setTranscriptDisplayTab(newValue);
  };

  const handleSaveNote = (content) => {
    if (selectedRecordingId && typeof updateRecording === 'function') {
      updateRecording(selectedRecordingId, { polishedTranscript: content });
    }
  };

  if (isLoadingSelectedTranscript) {
    return (
      <Box sx={{ p: 2, height: 'calc(100vh - 16px)', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1, flexShrink: 0}}>
          <Typography variant="h5" gutterBottom sx={{mb:0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {title}
          </Typography>
          <Button onClick={() => selectRecording(null)} variant="outlined" size="small">
            Back to Recorder
          </Button>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading transcripts...</Typography>
        </Box>
      </Box>
    );
  }

  if (selectedTranscriptError) {
    return (
      <Box sx={{ p: 2, height: 'calc(100vh - 16px)', display: 'flex', flexDirection: 'column', width: '100%' }}>
        <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1, flexShrink: 0}}>
          <Typography variant="h5" gutterBottom sx={{mb:0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
            {title}
          </Typography>
          <Button onClick={() => selectRecording(null)} variant="outlined" size="small">
            Back to Recorder
          </Button>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, flexDirection: 'column', p:2 }}>
          <Typography color="error" variant="h6" gutterBottom>Error loading transcripts:</Typography>
          <Typography color="error" sx={{mt:1, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{selectedTranscriptError}</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: 'calc(100vh - 16px)', display: 'flex', flexDirection: 'column', width: '100%' }}>
      <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb:1, flexShrink: 0}}>
        <Typography variant="h5" gutterBottom sx={{mb:0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {title}
        </Typography>
        <Button onClick={() => selectRecording(null)} variant="outlined" size="small">
          Back to Recorder
        </Button>
      </Box>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius:1, minHeight: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, backgroundColor: 'background.default' }}>
          <Tabs value={transcriptDisplayTab} onChange={handleTabChange} aria-label="transcript content tabs" variant="fullWidth">
            <Tab label="Original Transcript" id="transcript-tab-0" aria-controls="transcript-tabpanel-0" />
            <Tab label="Polished Note" id="transcript-tab-1" aria-controls="transcript-tabpanel-1" />
          </Tabs>
        </Box>
        
        <TabPanel value={transcriptDisplayTab} index={0}>
          <Box component="pre" sx={{ 
            p: 1.5, 
            flexGrow: 1, 
            whiteSpace: 'pre-wrap', 
            wordBreak: 'break-word', 
            fontFamily: 'monospace', 
            fontSize: '1.1rem', 
            lineHeight: 1.6, 
            backgroundColor: 'grey.50', 
            margin: 0, 
            color: 'text.primary' 
          }}>
            {originalTranscriptContent || "Original transcript not available or empty."}
          </Box>
        </TabPanel>
        
        <TabPanel value={transcriptDisplayTab} index={1}>
          <EditableNote
            content={polishedTranscriptContent}
            onSave={handleSaveNote}
            isLoading={isLoadingSelectedTranscript}
            location={selectedRec?.location}
            recordingId={selectedRecordingId}
          />
        </TabPanel>
      </Box>
    </Box>
  );
}

export default TranscriptViewer; 