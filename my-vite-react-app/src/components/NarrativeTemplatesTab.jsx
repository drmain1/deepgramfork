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
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const medicalSpecialties = [
  'Ortho Spine',
  'Ortho Extremity',
  'Pain Management',
  'Chiropractic',
  'Acupuncture',
  'Podiatry',
];

// Placeholder data for templates
const templatesBySpecialty = {
  'Ortho Spine': [
    { id: 'os_consult', name: 'Initial Consultation', llmInstructions: 'LLM instructions for Ortho Spine Consult...', sampleNarrative: 'Sample narrative for Ortho Spine Initial Consultation Report:\n\nPATIENT: John Doe\nDOB: 01/01/1970\nDATE OF SERVICE: 2025-05-20\n\nCHIEF COMPLAINT: Lower back pain radiating to the left leg for 3 months.\n\nHISTORY OF PRESENT ILLNESS: The patient is a 55-year-old male who reports insidious onset of low back pain approximately 3 months ago. The pain is described as sharp and aching, rated 7/10 at its worst. It radiates down the posterior aspect of his left thigh to the calf. Pain is aggravated by prolonged sitting and bending. He has tried OTC NSAIDs with minimal relief.\n\nPAST MEDICAL HISTORY: Hypertension, well-controlled on Lisinopril.\n\nREVIEW OF SYSTEMS: Otherwise negative.\n\nPHYSICAL EXAMINATION: [...]\n\nASSESSMENT: Lumbar radiculopathy, likely L4-L5 disc herniation.\n\nPLAN:\n1. MRI lumbar spine.\n2. Physical therapy referral.\n3. Prescribe NSAIDs (Naproxen 500mg BID).\n4. Follow-up in 2 weeks to review MRI results.' },
    { id: 'os_fu', name: 'Follow-up Visit', llmInstructions: 'LLM instructions for Ortho Spine Follow-up...', sampleNarrative: 'Sample narrative for Ortho Spine Follow-up Visit:\n\nPATIENT: Jane Smith\nDOB: 03/15/1965\nDATE OF SERVICE: 2025-05-20\n\nSUBJECTIVE: Patient returns for follow-up of chronic neck pain. Reports 50% improvement with physical therapy and home exercises. Pain is now 3/10, primarily localized to the cervical paraspinal muscles.\n\nOBJECTIVE: [...]\n\nASSESSMENT: Cervicalgia, improving.\n\nPLAN:\n1. Continue current physical therapy regimen.\n2. Wean off muscle relaxants as tolerated.\n3. Follow-up in 4 weeks or PRN.' },
  ],
  'Ortho Extremity': [
    { id: 'oe_fracture', name: 'Fracture Report', llmInstructions: 'LLM instructions for Ortho Extremity Fracture...', sampleNarrative: 'Sample narrative for Ortho Extremity Fracture Report: Details about a distal radius fracture treatment plan will go here.' },
    { id: 'oe_shoulder', name: 'Shoulder Impingement', llmInstructions: 'LLM for shoulder impingement', sampleNarrative: 'Sample for shoulder impingement: Examination findings and treatment recommendations.'}
  ],
  'Pain Management': [
    { id: 'pm_eval', name: 'New Patient Evaluation', llmInstructions: 'LLM for PM Eval...', sampleNarrative: 'Sample for Pain Management New Patient Evaluation: Comprehensive history, exam, and initial treatment strategy for chronic pain.' },
  ],
  'Chiropractic': [
    { id: 'chiro_adjust', name: 'Adjustment Note', llmInstructions: 'LLM for Chiro Adjust...', sampleNarrative: 'Sample for Chiropractic Adjustment Note: Details of spinal segments adjusted and patient response.' },
  ],
  'Acupuncture': [
    { id: 'acu_treat', name: 'Treatment Session', llmInstructions: 'LLM for Acu Treat...', sampleNarrative: 'Sample for Acupuncture Treatment Session: Points used and patient symptoms addressed.' },
  ],
  'Podiatry': [
    { id: 'pod_routine', name: 'Routine Foot Care', llmInstructions: 'LLM for Pod Routine...', sampleNarrative: 'Sample for Podiatry Routine Foot Care: Nail trimming, callus debridement, and foot examination findings.' },
  ],
};

// MODIFIED: Accept settingsLoading prop
function NarrativeTemplatesTab({ addTranscriptionProfile, settingsLoading }) {
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null); 
  const [saveButtonState, setSaveButtonState] = useState({ text: 'Save to Transcription Profile', icon: null, color: 'primary', disabled: false });

  useEffect(() => {
    // Reset button state when template changes, but also consider settingsLoading
    setSaveButtonState({
      text: 'Save to Transcription Profile',
      icon: null,
      color: 'primary',
      disabled: settingsLoading || !selectedTemplate // MODIFIED: Disable if settings are loading or no template selected
    });
  }, [selectedTemplate, settingsLoading]); // MODIFIED: Add settingsLoading to dependency array

  const handleSpecialtyChange = (event) => {
    setSelectedSpecialty(event.target.value);
    setSelectedTemplate(null); // Reset selected template when specialty changes
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
  };

  const handleSaveProfile = () => {
    if (selectedTemplate && selectedSpecialty) {
      const profileToSave = {
        id: `${selectedSpecialty}_${selectedTemplate.id}`, 
        name: `${selectedSpecialty} - ${selectedTemplate.name}`,
        llmInstructions: selectedTemplate.llmInstructions,
        specialty: selectedSpecialty,
        originalTemplateId: selectedTemplate.id
      };
      const status = addTranscriptionProfile(profileToSave);

      if (status === 'success') {
        setSaveButtonState({ text: 'Saved!', icon: <CheckCircleOutlineIcon />, color: 'success', disabled: true });
      } else if (status === 'duplicate') {
        setSaveButtonState({ text: 'Already Saved!', icon: <WarningAmberIcon />, color: 'warning', disabled: true });
      }

      setTimeout(() => {
        setSaveButtonState({ text: 'Save to Transcription Profile', icon: null, color: 'primary', disabled: false });
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
        <Paper elevation={3} sx={{ p: 2, mt: 2, whiteSpace: 'pre-wrap' }}>
          <Typography variant="h6" gutterBottom>
            Sample Narrative: {selectedTemplate.name}
          </Typography>
          <Typography variant="body1">
            {selectedTemplate.sampleNarrative}
          </Typography>
          <Typography variant="subtitle2" sx={{ mt: 2, fontStyle: 'italic' }}>
            LLM Instructions: {selectedTemplate.llmInstructions}
          </Typography>
          <Button 
            variant="contained" 
            color={saveButtonState.color} 
            sx={{ mt: 2 }}
            onClick={handleSaveProfile} 
            startIcon={saveButtonState.icon} 
            disabled={saveButtonState.disabled || settingsLoading} // MODIFIED: Also disable if settingsLoading is true directly here
          >
            {saveButtonState.text}
          </Button>
        </Paper>
      )}
    </Box>
  );
}

export default NarrativeTemplatesTab;
