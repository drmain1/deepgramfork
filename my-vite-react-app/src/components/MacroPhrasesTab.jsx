import { useState, useEffect } from 'react';
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

const parseMacroString = (macroStr) => {
  if (typeof macroStr !== 'string') return { trigger: '', phrase: '' }; 
  const parts = macroStr.split(': ');
  if (parts.length >= 2) {
    return { trigger: parts[0].trim(), phrase: parts.slice(1).join(': ').trim() };
  }
  return { trigger: macroStr.trim(), phrase: '' }; 
};

function MacroPhrasesTab({ macroPhrases: initialMacroPhrases, saveMacroPhrases, settingsLoading }) {
  const [macros, setMacros] = useState([]);
  const [selectedMacroIndex, setSelectedMacroIndex] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editForm, setEditForm] = useState({ trigger: '', phrase: '' });

  useEffect(() => {
    const formattedInitialMacros = (initialMacroPhrases || []).map(item => {
      if (typeof item === 'string') {
        return parseMacroString(item); 
      } else if (typeof item === 'object' && item !== null && 'trigger' in item && 'phrase' in item) {
        return item; 
      }
      return { trigger: '', phrase: '' }; 
    });
    setMacros(formattedInitialMacros);

    if (selectedMacroIndex !== null && selectedMacroIndex >= formattedInitialMacros.length) {
      setSelectedMacroIndex(null);
      setIsCreatingNew(false);
      setEditForm({ trigger: '', phrase: '' });
    }
  }, [initialMacroPhrases, selectedMacroIndex]);

  const handleNewMacroClick = () => {
    setSelectedMacroIndex(null);
    setIsCreatingNew(true);
    setEditForm({ trigger: '', phrase: '' });
  };

  const handleMacroSelect = (index) => {
    setSelectedMacroIndex(index);
    setIsCreatingNew(false);
    const selected = macros[index];
    setEditForm({ trigger: selected.trigger, phrase: selected.phrase });
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

    const newMacroObject = {
      trigger: editForm.trigger.trim(),
      phrase: editForm.phrase.trim()
    };

    let updatedMacros;

    if (isCreatingNew) {
      updatedMacros = [...macros, newMacroObject];
    } else if (selectedMacroIndex !== null) {
      updatedMacros = [...macros];
      updatedMacros[selectedMacroIndex] = newMacroObject;
    } else {
      return; 
    }
    
    setMacros(updatedMacros);
    saveMacroPhrases(updatedMacros); 
    
    if (isCreatingNew) {
      setSelectedMacroIndex(updatedMacros.length - 1);
    } 
    setIsCreatingNew(false); 
  };

  const handleDelete = () => {
    if (selectedMacroIndex !== null && !isCreatingNew) {
      const updatedMacros = macros.filter((_, index) => index !== selectedMacroIndex);
      setMacros(updatedMacros);
      saveMacroPhrases(updatedMacros); 
      setSelectedMacroIndex(null);
      setIsCreatingNew(false);
      setEditForm({ trigger: '', phrase: '' });
    }
  };

  const showEditor = isCreatingNew || selectedMacroIndex !== null;

  if (settingsLoading) {
    return <Typography sx={{ p: 2 }}>Loading macros...</Typography>;
  }

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
              {macros.length > 0 ? macros.map((macro, index) => {
                return (
                  <ListItemButton
                    key={index}
                    selected={selectedMacroIndex === index && !isCreatingNew}
                    onClick={() => handleMacroSelect(index)}
                  >
                    <ListItemText 
                      primary={macro.trigger || '(Untitled Macro)'} 
                      secondary={macro.phrase.substring(0,40) + (macro.phrase.length > 40 ? '...' : '')}
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
                helperText="Shorthand trigger for quick expansion"
              />
              <TextField
                name="phrase"
                label="Full Phrase (multiple words for better recognition)"
                value={editForm.phrase}
                onChange={handleInputChange}
                fullWidth
                multiline
                rows={5}
                margin="dense"
                variant="outlined"
                sx={{ mt: 2}}
                helperText="This phrase will be boosted in Deepgram recognition (e.g., 'artificial intelligence', 'machine learning model')"
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
