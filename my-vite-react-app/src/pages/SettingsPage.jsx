import { Tabs, Tab, Box, Typography } from '@mui/material';
import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import SettingsTabs from '../components/SettingsTabs';

function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const { user, isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0();

  const [userSettings, setUserSettings] = useState({
    transcriptionProfiles: [],
    macroPhrases: [],
    customVocabulary: [],
    officeInformation: [],
  });
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const loadUserSettings = async () => {
      if (isAuthenticated && user && !authLoading) {
        setSettingsLoading(true);
        const storedSettings = localStorage.getItem(`userSettings_${user.sub}`);
        if (storedSettings) {
          setUserSettings(JSON.parse(storedSettings));
        } else {
          setUserSettings({
            transcriptionProfiles: [],
            macroPhrases: [],
            customVocabulary: [],
            officeInformation: [],
          });
        }
        setSettingsLoading(false);
      }
    };
    loadUserSettings();
  }, [isAuthenticated, user, authLoading, getAccessTokenSilently]);

  const saveUserSettings = async (updatedSettings) => {
    if (isAuthenticated && user) {
      localStorage.setItem(`userSettings_${user.sub}`, JSON.stringify(updatedSettings));
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const addTranscriptionProfile = (newProfile) => {
    let status = 'success';
    let updatedProfiles = userSettings.transcriptionProfiles;

    if (userSettings.transcriptionProfiles.find(profile => profile.id === newProfile.id)) {
      status = 'duplicate';
    } else {
      updatedProfiles = [...userSettings.transcriptionProfiles, newProfile];
    }
    
    const newSettings = { ...userSettings, transcriptionProfiles: updatedProfiles };
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
    return status;
  };

  const deleteTranscriptionProfile = (profileIdToDelete) => {
    const updatedProfiles = userSettings.transcriptionProfiles.filter(profile => profile.id !== profileIdToDelete);
    const newSettings = { ...userSettings, transcriptionProfiles: updatedProfiles };
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  };

  const saveMacroPhrases = (macros) => {
    const newSettings = { ...userSettings, macroPhrases: macros };
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  };

  const saveCustomVocabulary = (vocabulary) => {
    const newSettings = { ...userSettings, customVocabulary: vocabulary };
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  };

  const saveOfficeInformation = (offices) => {
    const newSettings = { ...userSettings, officeInformation: offices };
    setUserSettings(newSettings);
    saveUserSettings(newSettings);
  };

  if (authLoading || (isAuthenticated && settingsLoading)) {
    return <Typography>Loading settings...</Typography>;
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
        saveMacroPhrases={saveMacroPhrases} 
        customVocabulary={userSettings.customVocabulary}
        saveCustomVocabulary={saveCustomVocabulary} 
        officeInformation={userSettings.officeInformation}
        saveOfficeInformation={saveOfficeInformation}
        settingsLoading={settingsLoading} 
      />
    </Box>
  );
}

export default SettingsPage;
