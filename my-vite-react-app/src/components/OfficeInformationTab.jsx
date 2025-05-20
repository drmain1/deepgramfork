import React, { useState } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Paper } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function OfficeInformationTab({ officeInformation, saveOfficeInformation, settingsLoading }) {
  const [newOfficeText, setNewOfficeText] = useState('');

  const handleInputChange = (e) => {
    setNewOfficeText(e.target.value);
  };

  const handleAddOffice = () => {
    if (!newOfficeText.trim()) {
      alert('Please enter an office location.');
      return;
    }
    const updatedOfficeInfo = [...(officeInformation || []), newOfficeText.trim()];
    saveOfficeInformation(updatedOfficeInfo);
    setNewOfficeText(''); // Reset form
  };

  const handleDeleteOffice = (indexToDelete) => {
    const updatedOfficeInfo = (officeInformation || []).filter((_, index) => index !== indexToDelete);
    saveOfficeInformation(updatedOfficeInfo);
  };

  if (settingsLoading) {
    return <Typography>Loading office information...</Typography>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Manage Office Locations
      </Typography>

      <Paper elevation={2} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
        <TextField 
          fullWidth 
          label="New Office Location" 
          value={newOfficeText} 
          onChange={handleInputChange} 
          variant="outlined" 
          size="small" 
          multiline
          minRows={3}
          sx={{ mr: 2 }}
        />
        <Button variant="contained" color="primary" onClick={handleAddOffice} disabled={settingsLoading}>
          Add
        </Button>
      </Paper>

      <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 1 }}>Current Office Locations</Typography>
      {(!officeInformation || officeInformation.length === 0) ? (
        <Typography>No office locations added yet.</Typography>
      ) : (
        <List>
          {officeInformation.map((office, index) => (
            <Paper key={index} elevation={1} sx={{ mb: 1 }}>
              <ListItem 
                secondaryAction={
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteOffice(index)} disabled={settingsLoading}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemText primary={office} />
              </ListItem>
            </Paper>
          ))}
        </List>
      )}
    </Box>
  );
}

export default OfficeInformationTab;
