import React, { useState } from 'react';
import { Box, Typography, Button, Tabs, Tab, CircularProgress, Paper, Chip, LinearProgress } from '@mui/material';
import { CheckCircle, Edit } from '@mui/icons-material';
import { useRecordings } from '../contexts/RecordingsContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import EditableNote from './EditableNote';
import FormattedMedicalText from './FormattedMedicalText';

const TabPanel = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      id={`transcript-tabpanel-${index}`}
      aria-labelledby={`transcript-tab-${index}`}
      {...other}
      style={value === index ?
        { 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          overflowY: 'auto', 
          minHeight: 0,
          height: '100%' // Ensure explicit height
        } :
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

  const { userSettings } = useUserSettings();
  const [transcriptDisplayTab, setTranscriptDisplayTab] = useState(0);

  // Track signature state for the current recording
  const selectedRec = recordings.find(r => r.id === selectedRecordingId);
  const title = selectedRec ? `Details: ${selectedRec.name}` : "Recording Details";
  const isSigned = selectedRec?.isSigned || false;
  
  // Debug logging for location and transcript content
  console.log("TranscriptViewer - selectedRec:", selectedRec);
  console.log("TranscriptViewer - location:", selectedRec?.location);
  console.log("TranscriptViewer - originalTranscriptContent:", {
    hasContent: !!originalTranscriptContent,
    length: originalTranscriptContent?.length || 0,
    preview: originalTranscriptContent ? originalTranscriptContent.substring(0, 50) + '...' : 'null'
  });
  console.log("TranscriptViewer - polishedTranscriptContent:", {
    hasContent: !!polishedTranscriptContent,
    length: polishedTranscriptContent?.length || 0,
    preview: polishedTranscriptContent ? polishedTranscriptContent.substring(0, 50) + '...' : 'null'
  });

  const handleTabChange = (event, newValue) => {
    setTranscriptDisplayTab(newValue);
  };

  const handleSaveNote = (content) => {
    if (selectedRecordingId && typeof updateRecording === 'function') {
      updateRecording(selectedRecordingId, { polishedTranscript: content });
    }
  };

  const handleSignNote = () => {
    if (selectedRecordingId && typeof updateRecording === 'function') {
      updateRecording(selectedRecordingId, { 
        isSigned: true,
        signedBy: userSettings.doctorName || 'Doctor',
        signedAt: new Date().toISOString()
      });
    }
  };

  const handleUnsignNote = () => {
    if (selectedRecordingId && typeof updateRecording === 'function') {
      updateRecording(selectedRecordingId, { 
        isSigned: false,
        signedBy: null,
        signedAt: null
      });
    }
  };

  const canSign = userSettings.doctorName && userSettings.doctorSignature && polishedTranscriptContent;

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
    // Special handling for processing state
    if (selectedTranscriptError === 'PROCESSING') {
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
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1, flexDirection: 'column', p:4 }}>
            <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary' }}>
              Processing your transcript...
            </Typography>
            <Box sx={{ width: '100%', maxWidth: 400 }}>
              <LinearProgress 
                variant="indeterminate" 
                sx={{ 
                  height: 8, 
                  borderRadius: 4,
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 50%, #1976d2 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 2s ease-in-out infinite',
                  },
                  '@keyframes shimmer': {
                    '0%': {
                      backgroundPosition: '200% 0',
                    },
                    '100%': {
                      backgroundPosition: '-200% 0',
                    },
                  },
                }} 
              />
            </Box>
            <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
              This usually takes 5-10 seconds
            </Typography>
          </Box>
        </Box>
      );
    }
    
    // Regular error display
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

      {/* Signature Status Section */}
      <Paper elevation={1} sx={{ p: 2, mb: 2, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Note Review & Signature
            </Typography>
            {isSigned && (
              <Chip 
                icon={<CheckCircle />} 
                label={`Signed by ${selectedRec.signedBy}`}
                color="success"
                size="small"
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {!isSigned ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSignNote}
                disabled={!canSign}
                startIcon={<Edit />}
                size="small"
              >
                Note Reviewed and Sign
              </Button>
            ) : (
              <Button
                variant="outlined"
                onClick={handleUnsignNote}
                size="small"
              >
                Remove Signature
              </Button>
            )}
          </Box>
        </Box>
        
        {!canSign && !isSigned && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Complete doctor information in Settings to enable signing
          </Typography>
        )}
        
        {isSigned && selectedRec.signedAt && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Signed on {new Date(selectedRec.signedAt).toLocaleString()}
          </Typography>
        )}
      </Paper>

      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius:1, minHeight: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0, backgroundColor: 'background.default' }}>
          <Tabs value={transcriptDisplayTab} onChange={handleTabChange} aria-label="transcript content tabs" variant="fullWidth">
            <Tab label="Original Transcript" id="transcript-tab-0" aria-controls="transcript-tabpanel-0" />
            <Tab label="Polished Note" id="transcript-tab-1" aria-controls="transcript-tabpanel-1" />
          </Tabs>
        </Box>
        
        <TabPanel value={transcriptDisplayTab} index={0}>
          {console.log('[TranscriptViewer] Rendering original transcript tab with content:', 
            originalTranscriptContent ? originalTranscriptContent.substring(0, 100) + '...' : 'null/empty')}
          <FormattedMedicalText
            content={originalTranscriptContent || "Original transcript not available or empty."}
            sx={{ 
              p: 1.5, 
              flexGrow: 1, 
              backgroundColor: 'grey.50', 
              margin: 0,
              overflowY: 'auto',
              maxHeight: '100%',
              minHeight: 0
            }}
          />
        </TabPanel>
        
        <TabPanel value={transcriptDisplayTab} index={1}>
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            height: '100%'
          }}>
            <EditableNote
              content={polishedTranscriptContent}
              onSave={handleSaveNote}
              isLoading={isLoadingSelectedTranscript}
              location={selectedRec?.location}
              recordingId={selectedRecordingId}
              isSigned={isSigned}
              doctorName={userSettings.doctorName}
              doctorSignature={userSettings.doctorSignature}
            />
          </Box>
        </TabPanel>
      </Box>
    </Box>
  );
}

export default TranscriptViewer; 