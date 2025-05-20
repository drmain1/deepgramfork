import { useState, useEffect } from 'react';
import { Box, Button, List, ListItem, ListItemText, Card, CardContent, Typography, IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

function CustomVocabularyTab({ customVocabulary: initialCustomVocabulary, saveCustomVocabulary, settingsLoading }) {
  // Ensure initialCustomVocabulary is an array of objects, or convert if necessary.
  // For now, assuming initialCustomVocabulary from props is already in the new format or will be.
  // If it's coming from an older string array format, conversion logic would be needed here.
  const [vocabulary, setVocabulary] = useState(initialCustomVocabulary || []);

  useEffect(() => {
    // Ensure data from props is correctly formatted or convert if necessary
    // This handles updates if settings are reloaded or props change.
    const formattedInitialVocabulary = (initialCustomVocabulary || []).map(item => 
      typeof item === 'string' ? { term: item } : item
    );
    setVocabulary(formattedInitialVocabulary);
  }, [initialCustomVocabulary]);

  const handleAddWord = () => {
    const word = prompt('Enter custom word or phrase:', '');
    if (word && word.trim()) {
      const trimmedWord = word.trim();
      // Check if term already exists
      if (!vocabulary.find(item => item.term === trimmedWord)) {
        const newItem = { term: trimmedWord };
        const updatedVocabulary = [...vocabulary, newItem];
        setVocabulary(updatedVocabulary);
        saveCustomVocabulary(updatedVocabulary);
      } else {
        alert(`'${trimmedWord}' is already in your custom vocabulary.`);
      }
    }
  };

  const handleDeleteWord = (termToDelete) => {
    const updatedVocabulary = vocabulary.filter(item => item.term !== termToDelete);
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
            {vocabulary.map((item, index) => (
              <ListItem 
                key={index} 
                divider 
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteWord(item.term)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={item.term} />
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
