import { useState } from 'react';
import { Box, Button, List, ListItem, ListItemText, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTemplate } from '../contexts/TemplateContext';

function MacroPhrasesTab() {
  const { macroPhrases, setMacroPhrases } = useTemplate();

  const handleAddMacro = () => {
    const phrase = prompt('Enter macro phrase (trigger: phrase):', 'trigger: Full phrase here');
    if (phrase) {
      setMacroPhrases([...macroPhrases, phrase]);
    }
  };

  return (
    <Card>
      <CardContent>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddMacro} sx={{ mb: 2 }}>
          New Macro
        </Button>
        <List sx={{ maxHeight: 200, overflowY: 'auto' }}>
          {macroPhrases.map((phrase, index) => (
            <ListItem key={index}>
              <ListItemText primary={phrase} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

export default MacroPhrasesTab;
