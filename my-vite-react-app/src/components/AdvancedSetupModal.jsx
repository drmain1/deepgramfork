import { useState } from 'react';
import { Modal, Box, Typography, TextField, Button } from '@mui/material';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

function AdvancedSetupModal({ open, onClose }) {
  const [instructions, setInstructions] = useState('');

  const handleSave = () => {
    alert(`Advanced template saved:\n${instructions}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={style}>
        <Typography variant="h6" gutterBottom>
          Advanced Template Setup
        </Typography>
        <Typography variant="body2" gutterBottom>
          Enter raw LLM instructions for full customization. Use placeholders [ ] for dynamic content, and ( ) for specific instructions.
        </Typography>
        <TextField
          multiline
          rows={10}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          fullWidth
          sx={{ mb: 2, fontFamily: 'monospace' }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} sx={{ mr: 1 }}>
            Close
          </Button>
          <Button variant="contained" onClick={handleSave}>
            Save Advanced Template
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default AdvancedSetupModal;
