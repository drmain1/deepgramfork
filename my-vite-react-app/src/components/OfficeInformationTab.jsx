import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Paper, Divider, Switch, FormControlLabel, FormControl, Select, MenuItem, InputLabel } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useAuth } from '../contexts/FirebaseAuthContext';
import SignaturePad from './SignaturePad';
import { medicalSpecialties } from '../templates/templateConfig';
import { timezones } from '../utils/timezones';

function OfficeInformationTab({ officeInformation, saveOfficeInformation, settingsLoading }) {
  const [newOfficeText, setNewOfficeText] = useState('');
  const { userSettings, updateDoctorInformation, updateMedicalSpecialty, updateTimezone } = useUserSettings();
  const { getToken } = useAuth();
  const [doctorName, setDoctorName] = useState('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clinicLogo, setClinicLogo] = useState(null);
  const [includeLogoOnPdf, setIncludeLogoOnPdf] = useState(false);
  const [logoPreview, setLogoPreview] = useState('');
  const [medicalSpecialty, setMedicalSpecialty] = useState('');
  const [isSavingSpecialty, setIsSavingSpecialty] = useState(false);
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  // Sync with userSettings
  useEffect(() => {
    console.log('OfficeInformationTab - userSettings changed:', {
      medicalSpecialty: userSettings.medicalSpecialty,
      localMedicalSpecialty: medicalSpecialty
    });
    if (userSettings) {
      setDoctorName(userSettings.doctorName || '');
      setLogoPreview(userSettings.clinicLogo || '');
      setIncludeLogoOnPdf(userSettings.includeLogoOnPdf || false);
      // Only update medical specialty if local state is empty (initial load)
      // This prevents overwriting user's selection while they're using the dropdown
      if (!medicalSpecialty && userSettings.medicalSpecialty) {
        console.log('Setting medical specialty from userSettings:', userSettings.medicalSpecialty);
        setMedicalSpecialty(userSettings.medicalSpecialty);
      }
      
      // Set timezone from user settings
      if (userSettings.timezone) {
        setTimezone(userSettings.timezone);
      }
      
      // Auto-migrate base64 logos to GCS
      if (userSettings.clinicLogo && userSettings.clinicLogo.startsWith('data:')) {
        console.log('Detected base64 logo, initiating auto-migration...');
        migrateBase64Logo();
      }
      
      // Auto-migrate base64 signatures to GCS
      if (userSettings.doctorSignature && userSettings.doctorSignature.startsWith('data:')) {
        console.log('Detected base64 signature, initiating auto-migration...');
        migrateBase64Signature();
      }
    }
  }, [userSettings.doctorName, userSettings.clinicLogo, userSettings.includeLogoOnPdf, userSettings.medicalSpecialty, userSettings.doctorSignature]);

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
      const result = await updateDoctorInformation(
        doctorName.trim(), 
        userSettings.doctorSignature, 
        userSettings.clinicLogo,
        userSettings.includeLogoOnPdf,
        medicalSpecialty || userSettings.medicalSpecialty  // Use local state if available
      );
      console.log('Doctor name save result:', result);
      alert('Doctor name saved successfully!');
    } catch (error) {
      console.error('Error saving doctor name:', error);
      alert('Failed to save doctor name. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMedicalSpecialtyChange = (event) => {
    const newSpecialty = event.target.value;
    console.log('Medical specialty changed to:', newSpecialty);
    setMedicalSpecialty(newSpecialty);
    
    // Debounce the save to prevent rapid updates
    if (window.medicalSpecialtyTimeout) {
      clearTimeout(window.medicalSpecialtyTimeout);
    }
    
    window.medicalSpecialtyTimeout = setTimeout(async () => {
      setIsSavingSpecialty(true);
      try {
        console.log('Saving medical specialty:', newSpecialty);
        const result = await updateMedicalSpecialty(newSpecialty);
        console.log('Medical specialty saved successfully, result:', result);
      } catch (error) {
        console.error('Error saving medical specialty:', error);
        alert('Failed to save medical specialty. Please try again.');
        setMedicalSpecialty(userSettings.medicalSpecialty || ''); // Revert on error
      } finally {
        setIsSavingSpecialty(false);
      }
    }, 500); // Reduced to 500ms for better UX
  };

  const handleTimezoneChange = (event) => {
    const newTimezone = event.target.value;
    console.log('Timezone changed to:', newTimezone);
    setTimezone(newTimezone);
    
    // Debounce the save to prevent rapid updates
    if (window.timezoneTimeout) {
      clearTimeout(window.timezoneTimeout);
    }
    
    window.timezoneTimeout = setTimeout(async () => {
      setIsSavingTimezone(true);
      try {
        console.log('Saving timezone:', newTimezone);
        const result = await updateTimezone(newTimezone);
        console.log('Timezone saved successfully, result:', result);
      } catch (error) {
        console.error('Failed to save timezone:', error);
        alert('Failed to save timezone. Please try again.');
        setTimezone(userSettings.timezone || 'America/Los_Angeles'); // Revert on error
      } finally {
        setIsSavingTimezone(false);
      }
    }, 500); // Reduced to 500ms for better UX
  };

  const handleSignatureSave = async (signatureData) => {
    setIsSaving(true);
    try {
      // Convert base64 to blob
      const response = await fetch(signatureData);
      const blob = await response.blob();
      
      // Create file from blob
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      
      // Upload signature to GCS
      const formData = new FormData();
      formData.append('file', file);
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const accessToken = await getToken();
      
      const uploadResponse = await fetch(`${API_BASE_URL}/api/v1/upload_signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.detail || 'Failed to upload signature');
      }
      
      const { signatureUrl } = await uploadResponse.json();
      
      // Update user settings with the GCS URL
      const result = await updateDoctorInformation(
        userSettings.doctorName, 
        signatureUrl,
        userSettings.clinicLogo,
        userSettings.includeLogoOnPdf,
        medicalSpecialty || userSettings.medicalSpecialty
      );
      
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
      if (file.size > 5 * 1024 * 1024) { // 5MB limit for GCS storage
        alert('Logo file size must be less than 5MB');
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
      // First, upload the logo to GCS
      const formData = new FormData();
      formData.append('file', clinicLogo);
      
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const accessToken = await getToken();
      
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
      
      // The logoUrl is now a GCS URL
      // Update user settings
      await updateDoctorInformation(
        userSettings.doctorName, 
        userSettings.doctorSignature,
        logoUrl,
        includeLogoOnPdf,
        medicalSpecialty || userSettings.medicalSpecialty  // Use local state if available
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
        const accessToken = await getToken();
        
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
          false,
          medicalSpecialty || userSettings.medicalSpecialty  // Use local state if available
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
          newValue,
          medicalSpecialty || userSettings.medicalSpecialty  // Use local state if available
        );
      } catch (error) {
        console.error('Error updating logo preference:', error);
        setIncludeLogoOnPdf(!newValue); // Revert on error
      } finally {
        setIsSaving(false);
      }
    }
  };

  const migrateBase64Logo = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const accessToken = await getToken();
      
      const response = await fetch(`${API_BASE_URL}/api/v1/migrate_logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.migrated) {
          console.log('Logo migrated successfully to:', result.logoUrl);
          // The settings will be updated automatically through the context
        }
      }
    } catch (error) {
      console.error('Error migrating base64 logo:', error);
    }
  };

  const migrateBase64Signature = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
      const accessToken = await getToken();
      
      const response = await fetch(`${API_BASE_URL}/api/v1/migrate_signature`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.migrated) {
          console.log('Signature migrated successfully to:', result.signatureUrl);
          // The settings will be updated automatically through the context
        }
      }
    } catch (error) {
      console.error('Error migrating base64 signature:', error);
    }
  };

  const handleRemoveSignature = async () => {
    if (window.confirm('Are you sure you want to remove your signature?')) {
      setIsSaving(true);
      try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
        const accessToken = await getToken();
        
        // Call delete endpoint
        const deleteResponse = await fetch(`${API_BASE_URL}/api/v1/delete_signature`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });
        
        if (!deleteResponse.ok) {
          const error = await deleteResponse.json();
          throw new Error(error.detail || 'Failed to delete signature');
        }
        
        // Update local state
        await updateDoctorInformation(
          userSettings.doctorName, 
          null,
          userSettings.clinicLogo,
          userSettings.includeLogoOnPdf,
          medicalSpecialty || userSettings.medicalSpecialty
        );
        
        alert('Signature removed successfully!');
      } catch (error) {
        console.error('Error removing signature:', error);
        alert('Failed to remove signature. Please try again.');
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
          
          <FormControl fullWidth sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Medical Specialty
              </Typography>
              {isSavingSpecialty && (
                <Typography variant="caption" color="primary.main">
                  Saving...
                </Typography>
              )}
            </Box>
            <Select
              value={medicalSpecialty}
              onChange={handleMedicalSpecialtyChange}
              displayEmpty
              size="small"
              disabled={false} // Never disable to prevent UI refresh
              sx={{ 
                backgroundColor: 'background.paper',
                '& .MuiSelect-select': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }
              }}
              renderValue={(selected) => {
                if (!selected) {
                  return <Typography color="text.secondary">Choose your Medical Specialty</Typography>;
                }
                return selected;
              }}
            >
              <MenuItem value="">
                <Typography color="text.secondary">Choose your Medical Specialty</Typography>
              </MenuItem>
              {medicalSpecialties.map((specialty) => (
                <MenuItem key={specialty} value={specialty}>
                  {specialty}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Time Zone
              </Typography>
              {isSavingTimezone && (
                <Typography variant="caption" color="primary.main">
                  Saving...
                </Typography>
              )}
            </Box>
            <Select
              value={timezone}
              onChange={handleTimezoneChange}
              displayEmpty
              size="small"
              disabled={false}
              sx={{ 
                backgroundColor: 'background.paper',
                '& .MuiSelect-select': {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }
              }}
            >
              {timezones.map((tz) => (
                <MenuItem key={tz.value} value={tz.value}>
                  {tz.label}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
              All dates and times will be displayed in this timezone
            </Typography>
          </FormControl>
          
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
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }} 
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No signature saved yet
              </Typography>
            )}
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="outlined" 
                onClick={() => setShowSignaturePad(!showSignaturePad)}
                size="small"
                disabled={isSaving}
              >
                {userSettings.doctorSignature ? 'Update Signature' : 'Add Signature'}
              </Button>
              
              {userSettings.doctorSignature && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoveSignature}
                  disabled={isSaving}
                  size="small"
                >
                  Remove Signature
                </Button>
              )}
            </Box>

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
          Office Information
        </Typography>
        
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Add your office information line by line. Each line will appear separately on your PDFs.
        </Typography>

        <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center' }}>
          <TextField 
            fullWidth 
            label="Office Information Line (e.g., Clinic Name, Address, Phone, Email)" 
            value={newOfficeText} 
            onChange={handleInputChange} 
            variant="outlined" 
            size="small" 
            sx={{ mr: 2 }}
            placeholder="Enter one line of office information"
          />
          <Button variant="contained" color="primary" onClick={handleAddOffice} disabled={settingsLoading}>
            + Add Line
          </Button>
        </Paper>

        <Typography variant="subtitle1" gutterBottom sx={{ mt: 3, mb: 1 }}>Current Office Information</Typography>
        {(!officeInformation || officeInformation.length === 0) ? (
          <Typography>No office information added yet.</Typography>
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
                  <ListItemText 
                    primary={office}
                    sx={{ 
                      whiteSpace: 'pre-wrap',
                      '& .MuiListItemText-primary': {
                        whiteSpace: 'pre-wrap'
                      }
                    }} 
                  />
                </ListItem>
              </Paper>
            ))}
          </List>
        )}
        
        {officeInformation && officeInformation.length > 0 && (
          <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              PDF Preview:
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', fontFamily: 'monospace' }}>
              {officeInformation.join('\n')}
            </Typography>
          </Paper>
        )}
      </Paper>
    </Box>
  );
}

export default OfficeInformationTab;
