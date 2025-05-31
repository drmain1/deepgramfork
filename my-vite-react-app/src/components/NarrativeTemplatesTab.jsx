import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Paper,
  Grid,
  FormControlLabel,
  Switch,
  TextField,
  CircularProgress,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { medicalSpecialties, templatesBySpecialty } from '../templates/templateConfig.js';

// MODIFIED: Accept settingsLoading prop
function NarrativeTemplatesTab({ addTranscriptionProfile, settingsLoading }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null); 
  const [saveButtonState, setSaveButtonState] = useState({ text: 'Save to Transcription Profile', icon: null, color: 'primary', disabled: false });
  const [isSavingProfile, setIsSavingProfile] = useState(false); // New state

  // State for Deepgram options
  const [smartFormat, setSmartFormat] = useState(true);
  const [diarize, setDiarize] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(2);
  const [utterances, setUtterances] = useState(false);
  

  useEffect(() => {
    if (isSavingProfile) {
      // If a save operation is actively being managed by handleSaveProfile,
      // let it control text/icon. Just ensure button remains disabled.
      setSaveButtonState(prevState => ({ ...prevState, disabled: true }));
      return;
    }

    // If no save operation is in progress, set to default state:
    setSaveButtonState({
      text: 'Save to Transcription Profile',
      icon: null,
      color: 'primary',
      disabled: settingsLoading || !selectedTemplate
    });
  }, [selectedSpecialty, selectedTemplate, settingsLoading, isSavingProfile]); // Added isSavingProfile dependency

  useEffect(() => {
    // Reset Deepgram options only when the selected template changes
    if (selectedTemplate) {
        setSmartFormat(true);
        setDiarize(false);
        setNumSpeakers(2);
        setUtterances(false);
    } else {
        // Default DG options if no template selected
        setSmartFormat(true);
        setDiarize(false);
        setNumSpeakers(2);
        setUtterances(false);
    }
  }, [selectedTemplate]);

  const handleSpecialtyChange = (event) => {
    setSelectedSpecialty(event.target.value);
    setSelectedTemplate(null); // Reset selected template when specialty changes
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };

  const handleSaveProfile = async () => { 
    if (selectedTemplate && selectedSpecialty) {
      setIsSavingProfile(true); // Signal start of save operation
      setSaveButtonState({ 
        text: 'Saving...', 
        icon: <CircularProgress size={24} color="inherit" />,
        color: 'info', 
        disabled: true 
      });

      const profileToSave = {
        id: `${selectedSpecialty}_${selectedTemplate.id}`.replace(/\s+/g, '_').toLowerCase(), // Sanitize ID
        name: `${selectedSpecialty} - ${selectedTemplate.name}`,
        llmInstructions: selectedTemplate.llmInstructions,
        specialty: selectedSpecialty,
        originalTemplateId: selectedTemplate.id,
        isDefault: false, // Default for new profiles
        // Deepgram options
        smart_format: smartFormat,
        diarize: diarize,
        num_speakers: diarize ? numSpeakers : null, // Only save numSpeakers if diarize is true
        utterances: utterances,
      };
      
      try {
        const status = await addTranscriptionProfile(profileToSave);
        if (status === 'success') {
          setSaveButtonState({ text: 'Saved!', icon: <CheckCircleOutlineIcon />, color: 'success', disabled: true });
        } else if (status === 'duplicate') {
          setSaveButtonState({ text: 'Already Saved!', icon: <WarningAmberIcon />, color: 'warning', disabled: true });
        } else {
          // Includes 'error' status or any other unexpected string
          setSaveButtonState({ text: 'Save Failed', icon: <ErrorOutlineIcon />, color: 'error', disabled: false }); // Allow retry
        }
      } catch (error) {
        console.error("Error during addTranscriptionProfile call:", error);
        setSaveButtonState({ text: 'Save Failed', icon: <ErrorOutlineIcon />, color: 'error', disabled: false }); // Allow retry
      }

      setTimeout(() => {
        setIsSavingProfile(false); // Signal end of save operation
        setSaveButtonState({
          text: 'Save to Transcription Profile',
          icon: null,
          color: 'primary',
          disabled: settingsLoading || !selectedTemplate 
        });
      }, 2500);
    }
  };

  const currentTemplates = selectedSpecialty ? templatesBySpecialty[selectedSpecialty] || [] : [];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Narrative Templates
      </Typography>
      <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
        <InputLabel id="medical-specialty-select-label">Medical Specialty</InputLabel>
        <Select
          labelId="medical-specialty-select-label"
          id="medical-specialty-select"
          value={selectedSpecialty}
          label="Medical Specialty"
          onChange={handleSpecialtyChange}
        >
          {medicalSpecialties.map((specialty) => (
            <MenuItem key={specialty} value={specialty}>
              {specialty}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedSpecialty && (
        <Box mb={3}>
          <Typography variant="subtitle1" gutterBottom>
            Available Templates for {selectedSpecialty}:
          </Typography>
          <Grid container spacing={2}>
            {currentTemplates.map((template) => (
              <Grid item key={template.id}>
                <Button 
                  variant={selectedTemplate && selectedTemplate.id === template.id ? "contained" : "outlined"} 
                  onClick={() => handleTemplateSelect(template)}
                >
                  {template.name}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {selectedTemplate && (
        <Paper elevation={3} sx={{ p: 2, mt: 2, maxHeight: '70vh', overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Sample Narrative: {selectedTemplate.name}
          </Typography>
          <Box sx={{ 
            maxHeight: '400px', 
            overflow: 'auto', 
            mb: 2, 
            p: 2, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 1,
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            lineHeight: 1.6
          }}>
            <Typography variant="body2" component="div">
              {selectedTemplate.sampleNarrative}
            </Typography>
          </Box>

          <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: '4px' }}>
            <Typography variant="subtitle1" gutterBottom>Deepgram Options</Typography>
            <FormControlLabel
              control={<Switch checked={smartFormat} onChange={(e) => setSmartFormat(e.target.checked)} />}
              label="Enable Smart Formatting"
              disabled={settingsLoading}
            />
            <Typography variant="caption" display="block" sx={{ ml: 4, mb: 1, color: 'text.secondary' }}>
              Automatically formats the transcript with punctuation, capitalization, and more for better readability.
            </Typography>

            <Box>
              <FormControlLabel
                control={<Switch checked={diarize} onChange={(e) => setDiarize(e.target.checked)} />}
                label="Enable Speaker Diarization"
                disabled={settingsLoading}
              />
              {diarize && (
                <TextField
                  label="Number of Speakers"
                  type="number"
                  size="small"
                  value={numSpeakers}
                  onChange={(e) => setNumSpeakers(parseInt(e.target.value, 10) || 1)}
                  inputProps={{ min: 1 }}
                  sx={{ ml: 2, width: '150px' }}
                  disabled={settingsLoading}
                />
              )}
            </Box>
            <Typography variant="caption" display="block" sx={{ ml: 4, mb: 1, color: 'text.secondary' }}>
              Identifies and labels different speakers in the audio. Specify the number of speakers if known.
            </Typography>

            <FormControlLabel
              control={<Switch checked={utterances} onChange={(e) => setUtterances(e.target.checked)} />}
              label="Enable Word-Level Timestamps"
              disabled={settingsLoading}
            />
            <Typography variant="caption" display="block" sx={{ ml: 4, mb: 1, color: 'text.secondary' }}>
              Provides start and end times for each word in the transcript. Useful for precise audio navigation.
            </Typography>
          </Box>


          <Button 
            variant="contained" 
            color={saveButtonState.color} 
            sx={{ mt: 2 }}
            onClick={handleSaveProfile} 
            startIcon={saveButtonState.icon} 
            disabled={saveButtonState.disabled || settingsLoading} 
          >
            {saveButtonState.text}
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default NarrativeTemplatesTab;
