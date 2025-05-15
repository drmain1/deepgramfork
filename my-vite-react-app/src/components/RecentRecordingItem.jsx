import { ListItem, ListItemText } from '@mui/material';

function RecentRecordingItem({ recording }) {
  const handleClick = () => {
    alert(`Viewing recording ${recording.id}... (Integrate with playback or transcription view)`);
  };

  return (
    <ListItem button onClick={handleClick}>
      <ListItemText primary={`${recording.name} (${recording.date})`} secondary={recording.status} />
    </ListItem>
  );
}

export default RecentRecordingItem;
