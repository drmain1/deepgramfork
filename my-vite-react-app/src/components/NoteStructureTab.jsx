import { useState } from 'react';
import { Box, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Button, Card, CardContent, Switch, ToggleButton, ToggleButtonGroup, Typography, Modal, IconButton, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, CircularProgress } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'; 
import { useTemplate } from '../contexts/TemplateContext';
import { generateLLMInstructions } from '../utils/generateLLMInstructions';
import { getNoteSample } from '../utils/getNoteSample'; 

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxWidth: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh',
  overflowY: 'auto',
};

function NoteStructureTab({ addTranscriptionProfile, settingsLoading }) {
  const [structure, setStructure] = useState('SOAP');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showDiagnoses, setShowDiagnoses] = useState(false);
  const [outputFormat, setOutputFormat] = useState('paragraph');
  const { macroPhrases, customVocabulary } = useTemplate();

  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [currentSampleText, setCurrentSampleText] = useState('');
  const [currentSampleTitle, setCurrentSampleTitle] = useState('');
  const [saveButtonState, setSaveButtonState] = useState({ text: 'Save to Template', icon: null, color: 'primary', disabled: false });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const handleSave = async () => {
    if (!addTranscriptionProfile) {
      alert('Unable to save profile. Please try again.');
      return;
    }

    setIsSavingProfile(true);
    setSaveButtonState({ 
      text: 'Saving...', 
      icon: <CircularProgress size={24} color="inherit" />,
      color: 'info', 
      disabled: true 
    });

    const template = {
      structure,
      customInstructions,
      macroPhrases,
      customVocabulary,
      showDiagnoses: showDiagnoses,  // Map to expected parameter name
      outputFormat: outputFormat,    // Map to expected parameter name
    };
    
    const llmInstructions = generateLLMInstructions(template);
    
    // Map structure values to backend-expected format
    const structureMapping = {
      'SOAP': 'SOAP',
      'SOAP_Combined': 'SOAP (Assessment & Plan Combined)',
      'DAP': 'DAP',
      'BIRP': 'BIRP'
    };

    const profileToSave = {
      id: `standard_template_${structure}_${Date.now()}`.toLowerCase(),
      name: `Standard Template - ${structureMapping[structure] || structure}`,
      llmInstructions: llmInstructions,
      template_structure: structureMapping[structure] || structure,
      show_visit_diagnoses: showDiagnoses,
      output_format: outputFormat,
      isDefault: false,
      smart_format: true,
      diarize: false,
      utterances: false,
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
      console.error("Error saving standard template profile:", error);
      setSaveButtonState({ text: 'Save Failed', icon: <ErrorOutlineIcon />, color: 'error', disabled: false });
    }

    setTimeout(() => {
      setIsSavingProfile(false);
      setSaveButtonState({
        text: 'Save to Template',
        icon: null,
        color: 'primary',
        disabled: settingsLoading
      });
    }, 2500);
  };

  const handleOutputFormatChange = (event, newFormat) => {
    if (newFormat !== null) {
      setOutputFormat(newFormat);
    }
  };

  const handleViewSample = (selectedStructure) => {
    const sample = getNoteSample(selectedStructure, outputFormat);
    setCurrentSampleText(sample);
    setCurrentSampleTitle(`Sample: ${selectedStructure} (${outputFormat.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())} Format)`);
    setSampleModalOpen(true);
  };

  const handleCloseSampleModal = () => {
    setSampleModalOpen(false);
    setCurrentSampleText('');
    setCurrentSampleTitle('');
  };

  const renderStructureOption = (value, label) => (
    <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ width: '100%' }}>
      <FormControlLabel value={value} control={<Radio />} label={label} sx={{ flexGrow: 1 }} />
      <IconButton onClick={() => handleViewSample(value)} size="small" title={`View sample for ${label}`}>
        <VisibilityIcon />
      </IconButton>
    </Box>
  );

  return (
    <Card>
      <CardContent>
        <Box>
          <FormControl component="fieldset" sx={{ width: '100%' }}>
            <Typography variant="subtitle1" gutterBottom>Select Template Structure</Typography>
            <RadioGroup value={structure} onChange={(e) => setStructure(e.target.value)}>
              {renderStructureOption("SOAP", "SOAP")}
              {renderStructureOption("SOAP_Combined", "SOAP (Assessment & Plan Combined)")}
              {renderStructureOption("DAP", "DAP")}
              {renderStructureOption("BIRP", "BIRP")}
            </RadioGroup>
          </FormControl>

          <Box sx={{ mt: 3, mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>Output Format</Typography>
            <ToggleButtonGroup
              value={outputFormat}
              exclusive
              onChange={handleOutputFormatChange}
              aria-label="output format"
            >
              <ToggleButton value="paragraph" aria-label="paragraph format">
                Paragraph
              </ToggleButton>
              <ToggleButton value="bullet_points" aria-label="bullet points format">
                Bullet Points
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={<Switch checked={showDiagnoses} onChange={(e) => setShowDiagnoses(e.target.checked)} />}
              label="Show visit diagnoses suggestions"
            />
          </Box>
          <TextField
            label="Custom Instructions"
            multiline
            rows={4}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Button 
            variant="contained" 
            color={saveButtonState.color} 
            onClick={handleSave} 
            sx={{ mt: 2 }}
            startIcon={saveButtonState.icon} 
            disabled={saveButtonState.disabled || settingsLoading}
          >
            {saveButtonState.text}
          </Button>
        </Box>
      </CardContent>

      <Dialog open={sampleModalOpen} onClose={handleCloseSampleModal} maxWidth="md" fullWidth>
        <DialogTitle>{currentSampleTitle}</DialogTitle>
        <DialogContent dividers>
          <DialogContentText component="div">
            <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'monospace' }}>
              {currentSampleText}
            </pre>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSampleModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

export default NoteStructureTab;
