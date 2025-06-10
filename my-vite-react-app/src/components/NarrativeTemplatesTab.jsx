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
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Fade,
  Zoom,
  alpha,
  Alert,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PreviewIcon from '@mui/icons-material/Preview';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';
import SaveIcon from '@mui/icons-material/Save';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import SettingsIcon from '@mui/icons-material/Settings';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { medicalSpecialties, templatesBySpecialty } from '../templates/templateConfig.js';
import { useUserSettings } from '../contexts/UserSettingsContext';

// Specialty icons mapping
const specialtyIcons = {
  'Ortho Spine': '🦴',
  'Ortho Extremity': '💪',
  'Pain Management': '💊',
  'Chiropractic': '🏃',
  'Acupuncture': '🎯',
  'Podiatry': '🦶',
};

function NarrativeTemplatesTab({ addTranscriptionProfile, settingsLoading }) {
  const { userSettings } = useUserSettings();
  const [selectedTemplate, setSelectedTemplate] = useState(null); 
  const [saveButtonState, setSaveButtonState] = useState({ text: 'Save to Transcription Profile', icon: <SaveIcon />, color: 'primary', disabled: false });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // State for Deepgram options
  const [smartFormat, setSmartFormat] = useState(true);
  const [diarize, setDiarize] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(2);
  const [utterances, setUtterances] = useState(false);

  // Get medical specialty from user settings
  const selectedSpecialty = userSettings.medicalSpecialty || '';

  useEffect(() => {
    if (isSavingProfile) {
      setSaveButtonState(prevState => ({ ...prevState, disabled: true }));
      return;
    }

    setSaveButtonState({
      text: 'Save to Transcription Profile',
      icon: <SaveIcon />,
      color: 'primary',
      disabled: settingsLoading || !selectedTemplate
    });
  }, [selectedSpecialty, selectedTemplate, settingsLoading, isSavingProfile]);

  useEffect(() => {
    if (selectedTemplate) {
        setSmartFormat(true);
        setDiarize(false);
        setNumSpeakers(2);
        setUtterances(false);
    }
  }, [selectedTemplate]);

  // Reset selected template when specialty changes
  useEffect(() => {
    setSelectedTemplate(null);
  }, [selectedSpecialty]);

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };

  const handlePreviewOpen = (template) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setTimeout(() => setPreviewTemplate(null), 300);
  };

  const handleSaveProfile = async () => { 
    if (selectedTemplate && selectedSpecialty) {
      setIsSavingProfile(true);
      setSaveButtonState({ 
        text: 'Saving...', 
        icon: <CircularProgress size={20} color="inherit" />,
        color: 'info', 
        disabled: true 
      });

      const profileToSave = {
        id: `${selectedSpecialty}_${selectedTemplate.id}`.replace(/\s+/g, '_').toLowerCase(),
        name: `${selectedSpecialty} - ${selectedTemplate.name}`,
        llmInstructions: selectedTemplate.llmInstructions,
        specialty: selectedSpecialty,
        originalTemplateId: selectedTemplate.id,
        isDefault: false,
        smart_format: smartFormat,
        diarize: diarize,
        num_speakers: diarize ? numSpeakers : null,
        utterances: utterances,
      };
      
      try {
        const status = await addTranscriptionProfile(profileToSave);
        if (status === 'success') {
          setSaveButtonState({ text: 'Saved!', icon: <CheckCircleOutlineIcon />, color: 'success', disabled: true });
        } else if (status === 'duplicate') {
          setSaveButtonState({ text: 'Already Saved!', icon: <WarningAmberIcon />, color: 'warning', disabled: true });
        } else {
          setSaveButtonState({ text: 'Save Failed', icon: <ErrorOutlineIcon />, color: 'error', disabled: false });
        }
      } catch (error) {
        console.error("Error during addTranscriptionProfile call:", error);
        setSaveButtonState({ text: 'Save Failed', icon: <ErrorOutlineIcon />, color: 'error', disabled: false });
      }

      setTimeout(() => {
        setIsSavingProfile(false);
        setSaveButtonState({
          text: 'Save to Transcription Profile',
          icon: <SaveIcon />,
          color: 'primary',
          disabled: settingsLoading || !selectedTemplate 
        });
      }, 2500);
    }
  };

  const currentTemplates = selectedSpecialty ? templatesBySpecialty[selectedSpecialty] || [] : [];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="600" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalHospitalIcon sx={{ color: 'primary.main' }} />
          Narrative Templates
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Select a template to customize your transcription profiles based on your medical specialty
        </Typography>
      </Box>

      {/* Show current specialty or prompt to select */}
      {!selectedSpecialty ? (
        <Alert 
          severity="info" 
          sx={{ mb: 4 }}
          icon={<InfoOutlinedIcon />}
        >
          <Typography variant="body1">
            Please select your medical specialty in <strong>Office Information</strong> to see available templates.
          </Typography>
        </Alert>
      ) : (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            mb: 4, 
            border: '1px solid',
            borderColor: 'primary.main',
            borderRadius: 2,
            background: theme => alpha(theme.palette.primary.main, 0.02),
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography variant="body1" fontWeight="500">
            Current Medical Specialty:
          </Typography>
          <Chip 
            label={selectedSpecialty}
            icon={<span style={{ marginLeft: 8, fontSize: '1.2rem' }}>{specialtyIcons[selectedSpecialty] || '🏥'}</span>}
            sx={{ 
              fontWeight: 600,
              fontSize: '1rem',
              py: 2,
              px: 1
            }}
            color="primary"
          />
        </Paper>
      )}

      {/* Template Cards */}
      {selectedSpecialty && (
        <Fade in={true} timeout={500}>
          <Box>
            <Typography variant="h6" gutterBottom sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeIcon sx={{ color: 'secondary.main' }} />
              Available Templates for {selectedSpecialty}
            </Typography>
            <Grid container spacing={3}>
              {currentTemplates.map((template, index) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Zoom in={true} timeout={300} style={{ transitionDelay: `${index * 100}ms` }}>
                    <Card 
                      sx={{ 
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        border: selectedTemplate?.id === template.id ? '2px solid' : '1px solid',
                        borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                        transform: selectedTemplate?.id === template.id ? 'scale(1.02)' : 'scale(1)',
                        '&:hover': {
                          transform: 'scale(1.05)',
                          boxShadow: 4,
                          borderColor: 'primary.light'
                        }
                      }}
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                          <DescriptionIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.8 }} />
                          {selectedTemplate?.id === template.id && (
                            <Chip 
                              label="Selected" 
                              color="primary" 
                              size="small"
                              sx={{ fontWeight: 600 }}
                            />
                          )}
                        </Box>
                        <Typography variant="h6" gutterBottom fontWeight="600">
                          {template.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {template.sampleNarrative.substring(0, 100)}...
                        </Typography>
                      </CardContent>
                      <CardActions sx={{ p: 2, pt: 0 }}>
                        <Button 
                          size="small" 
                          startIcon={<PreviewIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreviewOpen(template);
                          }}
                          sx={{ ml: 'auto' }}
                        >
                          Preview Full Note
                        </Button>
                      </CardActions>
                    </Card>
                  </Zoom>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Fade>
      )}

      {/* Selected Template Configuration */}
      {selectedTemplate && (
        <Fade in={true} timeout={500}>
          <Paper 
            elevation={0} 
            sx={{ 
              mt: 4, 
              p: 3, 
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 2,
              background: theme => alpha(theme.palette.primary.main, 0.02)
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon />
                Configure: {selectedTemplate.name}
              </Typography>
              <Chip 
                label={selectedSpecialty} 
                icon={<span style={{ marginLeft: 8 }}>{specialtyIcons[selectedSpecialty]}</span>}
                sx={{ fontWeight: 600 }}
              />
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Deepgram Options */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="600" sx={{ mb: 2 }}>
                Transcription Settings
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormControlLabel
                      control={<Switch checked={smartFormat} onChange={(e) => setSmartFormat(e.target.checked)} />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="500">Enable Smart Formatting</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Automatically formats with punctuation, capitalization, and more
                          </Typography>
                        </Box>
                      }
                      disabled={settingsLoading}
                    />
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                      <FormControlLabel
                        control={<Switch checked={diarize} onChange={(e) => setDiarize(e.target.checked)} />}
                        label={
                          <Box>
                            <Typography variant="body1" fontWeight="500">Enable Speaker Diarization</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Identifies and labels different speakers in the audio
                            </Typography>
                          </Box>
                        }
                        disabled={settingsLoading}
                      />
                      {diarize && (
                        <TextField
                          label="Speakers"
                          type="number"
                          size="small"
                          value={numSpeakers}
                          onChange={(e) => setNumSpeakers(parseInt(e.target.value, 10) || 1)}
                          inputProps={{ min: 1, max: 10 }}
                          sx={{ width: '100px' }}
                          disabled={settingsLoading}
                        />
                      )}
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <FormControlLabel
                      control={<Switch checked={utterances} onChange={(e) => setUtterances(e.target.checked)} />}
                      label={
                        <Box>
                          <Typography variant="body1" fontWeight="500">Enable Word-Level Timestamps</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Provides start and end times for each word
                          </Typography>
                        </Box>
                      }
                      disabled={settingsLoading}
                    />
                  </Paper>
                </Grid>
              </Grid>
            </Box>

            {/* Save Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                color={saveButtonState.color} 
                size="large"
                onClick={handleSaveProfile} 
                startIcon={saveButtonState.icon} 
                disabled={saveButtonState.disabled || settingsLoading}
                sx={{ 
                  px: 4,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4
                  }
                }}
              >
                {saveButtonState.text}
              </Button>
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Preview Dialog */}
      <Dialog 
        open={previewOpen} 
        onClose={handlePreviewClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }}
      >
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <Box>
            <Typography variant="h5" fontWeight="600">
              {previewTemplate?.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sample Clinical Note
            </Typography>
          </Box>
          <IconButton onClick={handlePreviewClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ 
            p: 3,
            backgroundColor: '#f8f9fa',
            minHeight: '400px',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            overflow: 'auto'
          }}>
            {previewTemplate?.sampleNarrative}
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handlePreviewClose}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              handleTemplateSelect(previewTemplate);
              handlePreviewClose();
            }}
            startIcon={<CheckCircleOutlineIcon />}
          >
            Select This Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default NarrativeTemplatesTab;