import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Paper, Divider, Switch, FormControlLabel } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useAuth } from '../contexts/AuthContext';
import SignaturePad from './SignaturePad';

function OfficeInformationTab({ officeInformation, saveOfficeInformation, settingsLoading }) {
  const [newOfficeText, setNewOfficeText] = useState('');
  const { userSettings, updateDoctorInformation } = useUserSettings();
  const { getAccessTokenSilently } = useAuth();
  const [doctorName, setDoctorName] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clinicLogo, setClinicLogo] = useState(null);
  const [includeLogoOnPdf, setIncludeLogoOnPdf] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');

  // Sync doctor name and logo with userSettings
  useEffect(() => {
    setDoctorName(userSettings.doctorName || '');
    setLogoPreview(userSettings.clinicLogo || '');
    setIncludeLogoOnPdf(userSettings.includeLogoOnPdf || false);
  }, [userSettings.doctorName, userSettings.clinicLogo, userSettings.includeLogoOnPdf]);

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

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit for base64 storage
        alert('Logo file size must be less than 1MB');
        return;
      }
      
      // Store the file for upload
      setClinicLogo(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoSave = async () => {
    if (!clinicLogo) {
      alert('Please upload a logo first');
      return;
    }

    setIsSaving(true);
    try {
      // First, upload the logo to S3
      const formData = new FormData();
      formData.append('file', clinicLogo);
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const accessToken = await getAccessTokenSilently();
      
      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/upload_logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.detail || 'Failed to upload logo');
      }
      
      const { logoUrl } = await uploadResponse.json();
      
      // The logoUrl is now a base64 data URL
      // Update user settings
      await updateDoctorInformation(
        userSettings.doctorName, 
        userSettings.doctorSignature,
        logoUrl,
        includeLogoOnPdf
      );
      
      alert('Logo saved successfully!');
      setClinicLogo(null);
    } catch (error) {
      console.error('Error saving logo:', error);
      alert('Failed to save logo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (window.confirm('Are you sure you want to remove the clinic logo?')) {
      setIsSaving(true);
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const accessToken = await getAccessTokenSilently();
        
        // Call delete endpoint
        const deleteResponse = await fetch(`${API_BASE_URL}/api/v1/delete_logo`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });
        
        if (!deleteResponse.ok) {
          const error = await deleteResponse.json();
          throw new Error(error.detail || 'Failed to delete logo');
        }
        
        // Update local state
        await updateDoctorInformation(
          userSettings.doctorName, 
          userSettings.doctorSignature,
          null,
          false
        );
        
        setLogoPreview('');
        setClinicLogo(null);
        setIncludeLogoOnPdf(false);
        alert('Logo removed successfully!');
      } catch (error) {
        console.error('Error removing logo:', error);
        alert('Failed to remove logo. Please try again.');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleIncludeLogoToggle = async (event) => {
    const newValue = event.target.checked;
    setIncludeLogoOnPdf(newValue);
    
    if (userSettings.clinicLogo) {
      setIsSaving(true);
      try {
        await updateDoctorInformation(
          userSettings.doctorName, 
          userSettings.doctorSignature,
          userSettings.clinicLogo,
          newValue
        );
      } catch (error) {
        console.error('Error updating logo preference:', error);
        setIncludeLogoOnPdf(!newValue); // Revert on error
      } finally {
        setIsSaving(false);
      }
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

      {/* Clinic Logo Section */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Clinic Logo
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          {logoPreview ? (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Current logo:
              </Typography>
              <img 
                src={logoPreview} 
                alt="Clinic logo" 
                style={{ 
                  maxWidth: '200px', 
                  maxHeight: '200px', 
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }} 
              />
              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={includeLogoOnPdf}
                      onChange={handleIncludeLogoToggle}
                      disabled={isSaving}
                    />
                  }
                  label="Include logo on PDF forms"
                />
              </Box>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              No logo uploaded yet
            </Typography>
          )}
          
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
              id="logo-upload-input"
            />
            <label htmlFor="logo-upload-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                disabled={isSaving}
              >
                {logoPreview ? 'Change Logo' : 'Upload Logo'}
              </Button>
            </label>
            
            {clinicLogo && (
              <Button
                variant="contained"
                onClick={handleLogoSave}
                disabled={isSaving}
                size="small"
              >
                Save Logo
              </Button>
            )}
            
            {logoPreview && !clinicLogo && (
              <Button
                variant="outlined"
                color="error"
                onClick={handleRemoveLogo}
                disabled={isSaving}
                size="small"
              >
                Remove Logo
              </Button>
            )}
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Upload your clinic's logo (JPG, PNG, max 1MB). The logo will appear on PDF forms when enabled.
            <br />
            <strong>Recommended dimensions:</strong> 500x500px or larger for best quality. Square logos work best.
          </Typography>
        </Box>
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
