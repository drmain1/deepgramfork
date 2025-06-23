import React from 'react'; // Removed useState as modal state is gone
import { ListItem, ListItemText, Tooltip, Typography, Box, ListItemSecondaryAction, IconButton, LinearProgress } from '@mui/material'; // Removed Paper, Button, Modal, etc.
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext'; // Import useRecordings

// This wrapper will be the direct child of Tooltip
// and will correctly forward refs and props.
const TooltipCompatibleWrapper = React.forwardRef((props, ref) => {
  // Spread all props (including those from Tooltip and any custom ones) onto the div
  return <div {...props} ref={ref} />;
});
TooltipCompatibleWrapper.displayName = 'TooltipCompatibleWrapper';

function RecentRecordingItem({ recording, onDelete }) {
  const { selectRecording, selectedRecordingId } = useRecordings(); // Get context values
  const navigate = useNavigate();

  const handleClick = () => {
    // Prevent clicking on recordings that are still being processed
    if (recording.status === 'pending' || recording.status === 'saving') {
      return;
    }
    selectRecording(recording.id);
    navigate('/transcription'); // Navigate to transcription route where TranscriptViewer logic is implemented
  };

  const handleDelete = (e) => {
    e.stopPropagation(); // Prevent ListItem's onClick from firing
    if (onDelete) {
      onDelete(recording.id);
    } else {
      console.log('Delete requested for:', recording.id, 'but no onDelete handler provided.');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleString(undefined, { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    } catch (e) {
      return isoString; // Fallback to raw string if date is invalid
    }
  };

  let statusIcon = null;
  let statusColor = 'text.secondary';
  let statusText = recording.status ? recording.status.charAt(0).toUpperCase() + recording.status.slice(1) : 'Unknown';

  switch (recording.status) {
    case 'pending':
      statusIcon = <HourglassEmptyIcon fontSize="small" sx={{ color: '#ffa726' }} />;
      statusText = 'Pending...';
      break;
    case 'saving':
      statusIcon = (
        <CloudSyncIcon 
          fontSize="small" 
          sx={{ 
            color: '#42a5f5',
            animation: 'spin 2s linear infinite',
            '@keyframes spin': {
              '0%': {
                transform: 'rotate(0deg)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }} 
        />
      );
      statusColor = 'primary.main'; // Blue for saving
      statusText = 'Processing transcript with AI...';
      break;
    case 'saved':
      statusIcon = <CheckCircleOutlineIcon fontSize="small" color="success" />;
      statusText = `Saved: ${formatDate(recording.date)}`;
      break;
    case 'failed':
      statusIcon = <ErrorOutlineIcon fontSize="small" color="error" />;
      statusColor = 'error.main'; // Red for failed
      statusText = `Failed: ${recording.error || 'Unknown error'}`;
      break;
    default:
      statusIcon = <SaveIcon fontSize="small" />; // Default icon for unknown or older items without status
      break;
  }

  const primaryText = recording.name || `Session ${recording.id.substring(0, 8)}...`;
  const secondaryDisplay = (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
      {statusIcon}
      <Typography variant="caption" sx={{ ml: 0.5, color: statusColor, whiteSpace: 'normal', wordBreak: 'break-word' }}>
        {statusText}
      </Typography>
    </Box>
  );

  const tooltipTitle = recording.status === 'saved' ? (
    <React.Fragment>
      <Typography color="inherit">{primaryText}</Typography>
      <b>Date:</b> {formatDate(recording.date)}<br />
      {recording.patientContext && <><b>Context:</b> {recording.patientContext}<br /></>}
      {recording.encounterType && <><b>Type:</b> {recording.encounterType}<br /></>}
      {recording.llmTemplate && <><b>Template:</b> {recording.llmTemplate}<br /></>}
      {recording.s3PathAudio && <><b>Audio:</b> {recording.s3PathAudio.split('/').pop()}<br /></>}
      {recording.s3PathTranscript && <><b>Transcript:</b> {recording.s3PathTranscript.split('/').pop()}<br /></>}
      {recording.s3PathPolished && <><b>Note:</b> {recording.s3PathPolished.split('/').pop()}</>}
    </React.Fragment>
  ) : recording.status === 'failed' ? (
    <React.Fragment>
        <Typography color="inherit">{primaryText}</Typography>
        <b>Status:</b> Failed<br />
        <b>Error:</b> {recording.error || 'Unknown error'}
    </React.Fragment>
  ) : recording.status === 'saving' ? (
    <React.Fragment>
      <Typography color="inherit">{primaryText}</Typography>
      <b>Status:</b> Processing LLM note generation<br />
      <em>Please wait 10-20 seconds for completion...</em>
    </React.Fragment>
  ) : recording.status === 'pending' ? (
    <React.Fragment>
      <Typography color="inherit">{primaryText}</Typography>
      <b>Status:</b> Recording in progress<br />
      <em>Complete the recording to view transcript</em>
    </React.Fragment>
  ) : primaryText;

  const isSelected = recording.id === selectedRecordingId;
  const isProcessing = recording.status === 'pending' || recording.status === 'saving';

  return (
    <Tooltip title={tooltipTitle} placement="right-start" arrow>
      <TooltipCompatibleWrapper>
        <style>
          {`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}
        </style>
        <Box sx={{ position: 'relative' }}>
          <ListItem
            button={!isProcessing} // Only allow button behavior if not processing
            onClick={handleClick} // Updated onClick handler
            selected={isSelected} // MUI's selected prop for visual indication
            sx={{
              borderLeft: recording.status === 'pending' ? '3px solid #ffa726'
                        : recording.status === 'saving' ? '3px solid #42a5f5'
                        : recording.status === 'failed' ? '3px solid red'
                        : '3px solid transparent',
              paddingY: '4px',
              width: '100%',
              // Apply disabled styling for processing recordings
              ...(isProcessing && {
                opacity: 0.9,
                cursor: 'not-allowed',
                pointerEvents: 'none', // Completely disable clicking
              }),
              // Apply a different background or style if selected
              ...(isSelected && {
                backgroundColor: 'action.selected', // Example: uses theme's selected color
                '&:hover': {
                  backgroundColor: 'action.hover', // Keep hover effect consistent
                },
              }),
            }}
          >
            <ListItemText
              primary={primaryText}
              secondary={secondaryDisplay}
              primaryTypographyProps={{ variant: 'subtitle2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              secondaryTypographyProps={{ component: 'div' }}
            />
            <ListItemSecondaryAction>
              <IconButton edge="end" aria-label="delete" onClick={handleDelete} size="small">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </ListItemSecondaryAction>
          </ListItem>
          {recording.status === 'saving' && (
            <LinearProgress 
              variant="indeterminate" 
              sx={{ 
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                backgroundColor: 'rgba(66, 165, 245, 0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#42a5f5',
                },
              }} 
            />
          )}
        </Box>
      </TooltipCompatibleWrapper>
    </Tooltip>
    // Modal and related logic removed
  );
}

export default RecentRecordingItem;
// Removed Modal and related state/logic.
// ListItem click now calls selectRecording from context.
// Added visual indication for selected item.
