import { useState } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  Grid,
  TextField,
  Typography,
  ListItemButton,
  Paper
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTemplate } from '../contexts/TemplateContext';

const parseMacroString = (macroStr) => {
  if (typeof macroStr !== 'string') return { trigger: '', phrase: '' };
  const parts = macroStr.split(': ');
  if (parts.length >= 2) {
    return { trigger: parts[0].trim(), phrase: parts.slice(1).join(': ').trim() };
  }
  return { trigger: macroStr.trim(), phrase: '' };
};

const formatMacroString = (trigger, phrase) => {
  const t = typeof trigger === 'string' ? trigger.trim() : '';
  const p = typeof phrase === 'string' ? phrase.trim() : '';
  if (!t) return p;
  return `${t}: ${p}`;
};

function MacroPhrasesTab() {
  const { macroPhrases, setMacroPhrases } = useTemplate();

  const [selectedMacroIndex, setSelectedMacroIndex] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editForm, setEditForm] = useState({ trigger: '', phrase: '' });

  const handleNewMacroClick = () => {
    setSelectedMacroIndex(null);
    setIsCreatingNew(true);
    setEditForm({ trigger: '', phrase: '' });
  };

  const handleMacroSelect = (index) => {
    setSelectedMacroIndex(index);
    setIsCreatingNew(false);
    const parsed = parseMacroString(macroPhrases[index]);
    setEditForm({ trigger: parsed.trigger, phrase: parsed.phrase });
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!editForm.trigger.trim()) {
      alert("Macro trigger cannot be empty.");
      return;
    }

    const newMacroString = formatMacroString(editForm.trigger, editForm.phrase);

    if (isCreatingNew) {
      const newPhrases = [...macroPhrases, newMacroString];
      setMacroPhrases(newPhrases);
      setIsCreatingNew(false);
      setSelectedMacroIndex(newPhrases.length - 1);
    } else if (selectedMacroIndex !== null) {
      const updatedMacroPhrases = [...macroPhrases];
      updatedMacroPhrases[selectedMacroIndex] = newMacroString;
      setMacroPhrases(updatedMacroPhrases);
    }
  };

  const handleDelete = () => {
    if (selectedMacroIndex !== null && !isCreatingNew) {
      setMacroPhrases(macroPhrases.filter((_, index) => index !== selectedMacroIndex));
      setSelectedMacroIndex(null);
      setIsCreatingNew(false);
      setEditForm({ trigger: '', phrase: '' });
    }
  };

  const showEditor = isCreatingNew || selectedMacroIndex !== null;

  return (
    <Box sx={{ p: 2, flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewMacroClick}
            sx={{ mb: 2, width: '100%' }}
          >
            New Macro
          </Button>
          <Paper elevation={2} sx={{ maxHeight: { xs: '200px', md: 'calc(100vh - 220px)' }, overflowY: 'auto' }}>
            <List component="nav" disablePadding>
              {macroPhrases.length > 0 ? macroPhrases.map((macroStr, index) => {
                const parsed = parseMacroString(macroStr);
                return (
                  <ListItemButton
                    key={index}
                    selected={selectedMacroIndex === index && !isCreatingNew}
                    onClick={() => handleMacroSelect(index)}
                  >
                    <ListItemText 
                      primary={parsed.trigger || '(Untitled Macro)'} 
                      secondary={parsed.phrase.substring(0,40) + (parsed.phrase.length > 40 ? '...' : '')}
                      primaryTypographyProps={{ noWrap: true, fontWeight: 'medium' }}
                      secondaryTypographyProps={{ noWrap: true }}
                    />
                  </ListItemButton>
                );
              }) : (
                <ListItem>
                  <ListItemText secondary="No macros defined. Click 'New Macro' to add one." />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          {showEditor ? (
            <Paper elevation={2} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                {isCreatingNew ? 'Create New Macro' : 'Edit Macro'}
              </Typography>
              <TextField
                name="trigger"
                label="Trigger (e.g., 'pe normal')"
                value={editForm.trigger}
                onChange={handleInputChange}
                fullWidth
                margin="dense"
                variant="outlined"
              />
              <TextField
                name="phrase"
                label="Full Phrase (the text this trigger expands to)"
                value={editForm.phrase}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={5}
                margin="dense"
                variant="outlined"
                sx={{ mt: 2}}
              />
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDelete}
                  disabled={selectedMacroIndex === null || isCreatingNew}
                >
                  Delete
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!editForm.trigger.trim()}
                >
                  {isCreatingNew ? 'Create Macro' : 'Save Changes'}
                </Button>
              </Box>
            </Paper>
          ) : (
            <Paper elevation={2} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Manage Your Macro Phrases
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Select a macro from the list on the left to edit its details, <br />or click "New Macro" to create a new one.
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

export default MacroPhrasesTab;
