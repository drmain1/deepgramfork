import { useState } from 'react';
import { Modal, Box, Typography, TextField, Button, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useTemplate } from '../contexts/TemplateContext';
import { generateLLMInstructions } from '../utils/generateLLMInstructions';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

function EasySetupModal({ open, onClose }) {
  const [structure, setStructure] = useState('SOAP');
  const [customInstructions, setCustomInstructions] = useState('');
  const { macroPhrases, customVocabulary } = useTemplate();

  const handleGenerate = () => {
    const template = {
      structure,
      customInstructions,
      macroPhrases,
      customVocabulary,
    };
    const llmInstructions = generateLLMInstructions(template);
    alert(`Template generated:\n${llmInstructions}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h6" gutterBottom>
          Easy Template Setup
        </Typography>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Note Structure</InputLabel>
          <Select value={structure} onChange={(e) => setStructure(e.target.value)} label="Note Structure">
            <MenuItem value="SOAP">SOAP</MenuItem>
            <MenuItem value="SOAP_Combined">SOAP (Assessment & Plan Combined)</MenuItem>
            <MenuItem value="Narrative">Narrative</MenuItem>
            <MenuItem value="DAP">DAP</MenuItem>
            <MenuItem value="BIRP">BIRP</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Additional Instructions"
          multiline
          rows={4}
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            Close
          </Button>
          <Button variant="contained" onClick={handleGenerate}>
            Generate Template
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default EasySetupModal;
