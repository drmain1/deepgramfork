import React from 'react';
import { Box, Typography, List, ListItem, ListItemText, Paper, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function TranscriptionProfilesTab({ transcriptionProfiles, deleteTranscriptionProfile }) {
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
                secondary={`LLM Instructions: ${profile.llmInstructions}`}
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
