import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Paper, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useUserSettings } from '../contexts/UserSettingsContext';
import SignaturePad from './SignaturePad';

function OfficeInformationTab({ officeInformation, saveOfficeInformation, settingsLoading }) {
  const [newOfficeText, setNewOfficeText] = useState('');
  const { userSettings, updateDoctorInformation } = useUserSettings();
  const [doctorName, setDoctorName] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync doctor name with userSettings
  useEffect(() => {
    setDoctorName(userSettings.doctorName || '');
  }, [userSettings.doctorName]);

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

  const handleDoctorNameSave = async () => {
    if (!doctorName.trim()) {
      alert('Please enter a doctor name before saving.');
      return;
    }

    setIsSaving(true);
    try {
      console.log('Saving doctor name:', doctorName);
      const result = await updateDoctorInformation(doctorName.trim(), userSettings.doctorSignature);
      console.log('Doctor name save result:', result);
      alert('Doctor name saved successfully!');
    } catch (error) {
      console.error('Error saving doctor name:', error);
      alert('Failed to save doctor name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureSave = async (signatureData) => {
    setIsSaving(true);
    try {
      console.log('Saving signature for doctor:', userSettings.doctorName);
      const result = await updateDoctorInformation(userSettings.doctorName, signatureData);
      console.log('Signature save result:', result);
      setShowSignaturePad(false);
      alert('Signature saved successfully!');
    } catch (error) {
      console.error('Error saving signature:', error);
      alert('Failed to save signature. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isDoctorNameSaved = userSettings.doctorName && userSettings.doctorName.trim() !== '';

  if (settingsLoading) {
    return <Typography>Loading office information...</Typography>;
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Manage Office Information
      </Typography>

      {/* Doctor Information Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Doctor Information
        </Typography>
        
        <Box sx={{ mb: 3 }}>
          <TextField 
            fullWidth 
            label="Doctor's Name (e.g. John Smith MD)" 
            value={doctorName} 
            onChange={(e) => setDoctorName(e.target.value)}
            variant="outlined" 
            size="small" 
            sx={{ mb: 2 }}
            disabled={isSaving}
          />
          
          {isDoctorNameSaved ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="success.main" gutterBottom>
                ✓ Doctor name saved: {userSettings.doctorName}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              Enter and save doctor name to enable signature feature
            </Typography>
          )}
          
          <Button 
            variant="contained" 
            onClick={handleDoctorNameSave} 
            disabled={settingsLoading || !doctorName.trim() || isSaving}
            size="small"
          >
            {isSaving ? 'Saving...' : 'Save Doctor Name'}
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Only show signature section if doctor name is saved */}
        {isDoctorNameSaved && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Digital Signature
            </Typography>
            
            {userSettings.doctorSignature ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="success.main" gutterBottom>
                  ✓ Signature saved
                </Typography>
                <img 
                  src={userSettings.doctorSignature} 
                  alt="Doctor's signature" 
                  style={{ 
                    maxWidth: '240px', 
                    maxHeight: '120px', 
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }} 
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No signature saved yet
              </Typography>
            )}
            
            <Button 
              variant="outlined" 
              onClick={() => setShowSignaturePad(!showSignaturePad)}
              size="small"
              disabled={isSaving}
            >
              {userSettings.doctorSignature ? 'Update Signature' : 'Add Signature'}
            </Button>

            {showSignaturePad && (
              <Box sx={{ mt: 3 }}>
                <SignaturePad 
                  onSave={handleSignatureSave}
                  initialSignature={userSettings.doctorSignature}
                  width={480}
                  height={180}
                />
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Office Locations Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
          Office Locations
        </Typography>

        <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
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
      </Paper>
    </Box>
  );
}

export default OfficeInformationTab;
