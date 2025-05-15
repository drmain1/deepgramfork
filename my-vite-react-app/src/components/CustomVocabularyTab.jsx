import { useState } from 'react';
import { Box, Button, List, ListItem, ListItemText, Card, CardContent } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useTemplate } from '../contexts/TemplateContext';

function CustomVocabularyTab() {
  const { customVocabulary, setCustomVocabulary } = useTemplate();

  const handleAddWord = () => {
    const word = prompt('Enter custom word:', '');
    if (word) {
      setCustomVocabulary([...customVocabulary, word]);
    }
  };

  return (
    <Card>
      <CardContent>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWord} sx={{ mb: 2 }}>
          New Word
        </Button>
        <List sx={{ maxHeight: 200, overflowY: 'auto' }}>
          {customVocabulary.map((word, index) => (
            <ListItem key={index}>
              <ListItemText primary={word} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

export default CustomVocabularyTab;
