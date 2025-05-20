import { useState, useEffect } from 'react';
import { Box, Button, List, ListItem, ListItemText, Card, CardContent, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

function CustomVocabularyTab({ customVocabulary: initialCustomVocabulary, saveCustomVocabulary, settingsLoading }) {
  const [vocabulary, setVocabulary] = useState(initialCustomVocabulary || []);

  useEffect(() => {
    setVocabulary(initialCustomVocabulary || []);
  }, [initialCustomVocabulary]);

  const handleAddWord = () => {
    const word = prompt('Enter custom word or phrase:', '');
    if (word && word.trim()) {
      const trimmedWord = word.trim();
      if (!vocabulary.includes(trimmedWord)) {
        const updatedVocabulary = [...vocabulary, trimmedWord];
        setVocabulary(updatedVocabulary);
        saveCustomVocabulary(updatedVocabulary);
      } else {
        alert(`'${trimmedWord}' is already in your custom vocabulary.`);
      }
    }
  };

  const handleDeleteWord = (wordToDelete) => {
    const updatedVocabulary = vocabulary.filter(word => word !== wordToDelete);
    setVocabulary(updatedVocabulary);
    saveCustomVocabulary(updatedVocabulary);
  };

  if (settingsLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading custom vocabulary...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWord} sx={{ mb: 2 }}>
          New Word/Phrase
        </Button>
        {vocabulary.length > 0 ? (
          <List sx={{ maxHeight: 300, overflowY: 'auto' }}>
            {vocabulary.map((word, index) => (
              <ListItem 
                key={index} 
                divider 
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteWord(word)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={word} />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography sx={{mt: 2}}>No custom vocabulary defined yet. Click 'New Word/Phrase' to add items.</Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default CustomVocabularyTab;
