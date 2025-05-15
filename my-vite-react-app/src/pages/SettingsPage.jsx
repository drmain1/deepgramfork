import { Tabs, Tab, Box, Typography } from '@mui/material';
import { useState } from 'react';
import SettingsTabs from '../components/SettingsTabs';

function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label="Note Structure" />
        <Tab label="Macro Phrases" />
        <Tab label="Custom Vocabulary" />
      </Tabs>
      <SettingsTabs tabValue={tabValue} />
    </Box>
  );
}

export default SettingsPage;
