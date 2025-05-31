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
                  <div>
                    <div>{profile.llmInstructions ? 
                      'Custom LLM instructions configured' : 
                      'No custom instructions'
                    }</div>
                    <div style={{ marginTop: '4px', fontSize: '0.875rem', color: '#666' }}>
                      Template: {profile.template_structure || 'SOAP'} | 
                      Format: {profile.output_format || 'paragraph'} | 
                      Diagnoses: {profile.show_visit_diagnoses ? 'Enabled' : 'Disabled'}
                    </div>
                  </div>
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
