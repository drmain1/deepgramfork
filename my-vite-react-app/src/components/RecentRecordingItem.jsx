import { ListItem, ListItemText, ListItemIcon, Tooltip, Typography, Box, ListItemSecondaryAction, IconButton } from '@mui/material';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SaveIcon from '@mui/icons-material/Save'; // Represents saving in progress or successfully saved
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloudSyncIcon from '@mui/icons-material/CloudSync'; // For 'saving' status
import DeleteIcon from '@mui/icons-material/Delete';

function RecentRecordingItem({ recording, onDelete }) {
  const handleClick = () => {
    // For now, just log. Later, this could open the recording details or player.
    console.log('Clicked recording:', recording);
    // alert(`Viewing recording ${recording.id}... (Integrate with playback or transcription view)`);
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
      statusIcon = <HourglassEmptyIcon fontSize="small" />;
      statusText = 'Pending...';
      break;
    case 'saving':
      statusIcon = <CloudSyncIcon fontSize="small" />;
      statusColor = 'primary.main'; // Blue for saving
      statusText = 'Saving to cloud...';
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
  ) : primaryText;

  return (
    <Tooltip title={tooltipTitle} placement="right-start" arrow>
      <ListItem button onClick={handleClick} sx={{ 
        borderLeft: recording.status === 'pending' ? '3px solid orange' 
                  : recording.status === 'saving' ? '3px solid blue' 
                  : recording.status === 'failed' ? '3px solid red' 
                  : '3px solid transparent', // Keep space for non-active items
        paddingY: '4px' // Reduce vertical padding slightly
      }}>
        <ListItemText 
          primary={primaryText} 
          secondary={secondaryDisplay}
          primaryTypographyProps={{ variant: 'subtitle2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          secondaryTypographyProps={{ component: 'div' }} // Ensure secondary can host the Box
        />
        <ListItemSecondaryAction>
          <IconButton edge="end" aria-label="delete" onClick={handleDelete} size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </ListItemSecondaryAction>
      </ListItem>
    </Tooltip>
  );
}

export default RecentRecordingItem;
