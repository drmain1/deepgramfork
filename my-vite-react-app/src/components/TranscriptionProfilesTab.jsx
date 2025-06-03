import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Paper, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function TranscriptionProfilesTab({ transcriptionProfiles, deleteTranscriptionProfile, settingsLoading }) {
  
  if (settingsLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Transcription Profiles Management
        </Typography>
        <Typography sx={{ mt: 2 }}>Loading transcription profiles...</Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Transcription Profiles Management
      </Typography>
      {transcriptionProfiles && transcriptionProfiles.length > 0 ? (
        <List sx={{ mt: 2 }}>
          {transcriptionProfiles.map((profile, index) => (
            <Paper key={profile.id} elevation={1} sx={{ mb: 2, p: 1.5, display: 'flex', alignItems: 'center' }}>
              <IconButton 
                aria-label="delete profile" 
                onClick={() => deleteTranscriptionProfile(profile.id)} 
                sx={{ mr: 1.5 }}
              >
                <DeleteIcon />
              </IconButton>
              <ListItemText 
                primary={profile.name} 
                secondary={
                  <Box>
                    {profile.specialty && <Typography variant="body2" color="text.secondary">Specialty: {profile.specialty}</Typography>}
                    <Typography variant="caption" color="text.secondary">
                      Settings: 
                      {profile.smart_format && ' Smart Format'}
                      {profile.diarize && ` • Speaker Diarization (${profile.num_speakers || 'auto'} speakers)`}
                      {profile.utterances && ' • Word Timestamps'}
                    </Typography>
                    {profile.isDefault && <Typography variant="caption" color="primary" display="block">Default Profile</Typography>}
                  </Box>
                }
              />
            </Paper>
          ))}
        </List>
      ) : (
        <Typography variant="body1" sx={{ mt: 2 }}>
          No transcription profiles saved yet. You can save a template from the 'Narrative Templates' tab.
        </Typography>
      )}
    </Box>
  );
}

export default TranscriptionProfilesTab;
