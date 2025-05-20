import { Tabs, Tab, Box, Typography } from '@mui/material';
import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SettingsTabs from '../components/SettingsTabs';
import { useUserSettings } from '../contexts/UserSettingsContext';

function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth0();

  const {
    userSettings,
    settingsLoading,
    settingsError,
    updateOfficeInformation,
    updateTranscriptionProfiles,
    updateCustomVocabulary,
    updateMacroPhrases
  } = useUserSettings();

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const addTranscriptionProfile = async (newProfile) => {
    let status = 'success';
    let updatedProfiles = userSettings.transcriptionProfiles || [];

    if (updatedProfiles.find(profile => profile.id === newProfile.id)) {
      status = 'duplicate';
      console.warn('Attempted to add duplicate transcription profile ID:', newProfile.id);
      return status;
    } else {
      updatedProfiles = [...updatedProfiles, newProfile];
    }
    
    try {
      await updateTranscriptionProfiles(updatedProfiles);
      console.log("Transcription profiles updated successfully via context.");
    } catch (error) {
      console.error("Failed to update transcription profiles via context:", error);
      status = 'error';
    }
    return status;
  };

  const deleteTranscriptionProfile = async (profileIdToDelete) => {
    const updatedProfiles = (userSettings.transcriptionProfiles || []).filter(profile => profile.id !== profileIdToDelete);
    try {
      await updateTranscriptionProfiles(updatedProfiles);
      console.log("Transcription profile deleted successfully via context.");
    } catch (error) {
      console.error("Failed to delete transcription profile via context:", error);
    }
  };

  if (authLoading || settingsLoading) {
    return <Typography>Loading settings...</Typography>;
  }

  if (settingsError) {
    return <Typography>Error loading settings: {settingsError}. Please try again later.</Typography>;
  }

  if (!isAuthenticated) {
    return <Typography>Please log in to manage your settings.</Typography>;
  }

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
        <Tab label="Office Information" /> 
        <Tab label="Transcription Profiles" /> 
      </Tabs>
      <SettingsTabs 
        tabValue={tabValue} 
        transcriptionProfiles={userSettings.transcriptionProfiles}
        addTranscriptionProfile={addTranscriptionProfile} 
        deleteTranscriptionProfile={deleteTranscriptionProfile} 
        macroPhrases={userSettings.macroPhrases}
        saveMacroPhrases={updateMacroPhrases}
        customVocabulary={userSettings.customVocabulary}
        saveCustomVocabulary={updateCustomVocabulary}
        officeInformation={userSettings.officeInformation}
        saveOfficeInformation={updateOfficeInformation}
        settingsLoading={settingsLoading}
      />
    </Box>
  );
}

export default SettingsPage;
