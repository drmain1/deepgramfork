import { Tabs, Tab, Box, Typography } from '@mui/material';
import { useState } from 'react';
import SettingsTabs from '../components/SettingsTabs';

function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [transcriptionProfiles, setTranscriptionProfiles] = useState([]); // Added state for profiles

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // Function to add a new transcription profile
  const addTranscriptionProfile = (newProfile) => {
    let status = 'success'; // Default status
    setTranscriptionProfiles((prevProfiles) => {
      // Prevent adding duplicates based on id
      if (prevProfiles.find(profile => profile.id === newProfile.id)) {
        status = 'duplicate';
        return prevProfiles;
      }
      return [...prevProfiles, newProfile];
    });
    return status; // Return status
  };

  // Function to delete a transcription profile
  const deleteTranscriptionProfile = (profileIdToDelete) => {
    setTranscriptionProfiles((prevProfiles) => 
      prevProfiles.filter(profile => profile.id !== profileIdToDelete)
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Standard Templates" /> 
        <Tab label="Narrative Templates" />
        <Tab label="Macro Phrases" />
        <Tab label="Custom Vocabulary" />
        <Tab label="Transcription Profiles" /> 
      </Tabs>
      <SettingsTabs 
        tabValue={tabValue} 
        transcriptionProfiles={transcriptionProfiles} // Pass profiles
        addTranscriptionProfile={addTranscriptionProfile} // Pass add function
        deleteTranscriptionProfile={deleteTranscriptionProfile} // Pass delete function
      />
    </Box>
  );
}

export default SettingsPage;
