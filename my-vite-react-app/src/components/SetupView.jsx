import React from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Grid,
  Switch,
  FormControlLabel
} from '@mui/material';

function SetupView({
  patientDetails,
  setPatientDetails,
  patientContext,
  setPatientContext,
  selectedLocation,
  setSelectedLocation,
  selectedProfileId,
  setSelectedProfileId,
  isMultilingual,
  setIsMultilingual,
  userSettings,
  settingsLoading,
  error,
  onStartEncounter
}) {
  return (
    <Box sx={{ p: 3, width: '100%' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'left', mb: 4, fontWeight: 'medium' }}>
        Encounter
      </Typography>
      <Stack spacing={3} direction="column" sx={{ maxWidth: '800px', mx: 'auto' }}>
        <Typography variant="overline" display="block" gutterBottom sx={{ color: 'text.secondary', mt: 1 }}>
          CONTEXT
        </Typography>
        <FormControl fullWidth required error={!!(error && error.includes('patient details'))}>
          <TextField
            id="patient-details"
            label="Patient Name / Session Title"
            placeholder="e.g., John Doe - Annual Checkup"
            value={patientDetails}
            onChange={(e) => setPatientDetails(e.target.value)}
            variant="standard"
            fullWidth
            required
            error={!!error && !patientDetails.trim()}
            helperText={!!error && !patientDetails.trim() ? 'Please enter patient details' : ''}
          />
        </FormControl>

        <FormControl fullWidth>
          <TextField
            id="patient-context"
            placeholder="Add patient context (optional)"
            value={patientContext}
            onChange={(e) => setPatientContext(e.target.value)}
            multiline
            rows={3}
            variant="standard"
          />
        </FormControl>

        <Typography variant="overline" display="block" gutterBottom sx={{ color: 'text.secondary', mt: 3 }}>
          SETTINGS
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={12}>
            <FormControl fullWidth variant="standard">
              <InputLabel id="location-select-label">Location</InputLabel>
              <Select
                labelId="location-select-label"
                id="location-select"
                value={selectedLocation}
                label="Location"
                onChange={(e) => setSelectedLocation(e.target.value)}
                disabled={settingsLoading || (!userSettings.officeInformation && !settingsLoading)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {settingsLoading && !userSettings.officeInformation ? (
                  <MenuItem value="" disabled>Loading locations...</MenuItem>
                ) : (
                  userSettings.officeInformation && userSettings.officeInformation.map((loc, index) => (
                    <MenuItem key={index} value={loc}>
                      {loc}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth variant="standard">
              <InputLabel id="profile-select-label">Transcription Profile</InputLabel>
              <Select
                labelId="profile-select-label"
                id="profile-select"
                value={selectedProfileId}
                label="Transcription Profile"
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={settingsLoading || (!userSettings.transcriptionProfiles && !settingsLoading)}
              >
                {settingsLoading && !userSettings.transcriptionProfiles ? (
                  <MenuItem value="" disabled>Loading profiles...</MenuItem>
                ) : (
                  userSettings.transcriptionProfiles &&
                  userSettings.transcriptionProfiles
                    .filter(profile => profile.name !== 'Default/General summary')
                    .map((profile) => (
                      <MenuItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </MenuItem>
                    ))
                )}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={<Switch checked={isMultilingual} onChange={(e) => setIsMultilingual(e.target.checked)} />}
              label="Enable Multilingual Support"
              sx={{ mt: 1, mb: 0.5, width: '100%', justifyContent: 'flex-start'}}
            />
          </Grid>

          <Grid item xs={12} sx={{ mt: 0.5, mb: 2 }}>
          </Grid>
        </Grid>

        {error && <Typography color="error" sx={{ mt: 2, textAlign: 'center' }}>{error}</Typography>}

        <Stack direction="row" justifyContent="center" sx={{ mt: 4 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={onStartEncounter} 
            sx={{ px: 5, py: 1.5, minWidth: '200px', fontSize: '1rem' }} 
            fullWidth
          >
            Start Encounter
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default SetupView; 