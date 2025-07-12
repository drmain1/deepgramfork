import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  InputAdornment,
  Alert,
  CircularProgress,
  Paper,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { sessionManager } from '../utils/sessionManager';
import usePatientsStore from '../stores/patientsStore';

const PatientSelector = ({ selectedPatient, onSelectPatient, onClose, openAddDialogImmediately = false }) => {
  const { getToken } = useAuth();
  const { patients, fetchPatients, addPatient, updatePatient, removePatient, isLoading } = usePatientsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(openAddDialogImmediately);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    date_of_accident: '',
    notes_private: '',
    notes_ai_context: ''
  });

  // Fetch patients on component mount
  useEffect(() => {
    const init = async () => {
      await sessionManager.ensureSession(getToken);
      await fetchPatients();
    };
    // Always fetch on mount to check for updates (the store will handle caching)
    if (!openAddDialogImmediately && !selectedPatient) {
      init();
    }
  }, [fetchPatients, getToken, openAddDialogImmediately, selectedPatient]);

  // If we have a selectedPatient (editing mode), populate the form
  useEffect(() => {
    if (selectedPatient) {
      setEditingPatient(selectedPatient);
      setFormData({
        first_name: selectedPatient.first_name,
        last_name: selectedPatient.last_name,
        date_of_birth: selectedPatient.date_of_birth.split('T')[0],
        date_of_accident: selectedPatient.date_of_accident ? selectedPatient.date_of_accident.split('T')[0] : '',
        notes_private: selectedPatient.notes_private || '',
        notes_ai_context: selectedPatient.notes_ai_context || ''
      });
      setShowAddDialog(true);
    }
  }, [selectedPatient]);

  const handleAddPatient = async () => {
    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
        setError('Please fill in all required fields');
        return;
      }
      
      // Convert date strings to ISO format - use UTC to avoid timezone issues
      const requestData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth + 'T00:00:00.000Z',
        date_of_accident: formData.date_of_accident ? formData.date_of_accident + 'T00:00:00.000Z' : null,
        notes_private: formData.notes_private || null,
        notes_ai_context: formData.notes_ai_context || null
      };
      
      console.log('Adding patient with data:', requestData);
      const token = await getToken();
      const response = await fetch('/api/v1/patients', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to add patient');
      }

      const newPatient = await response.json();
      console.log('Patient created successfully:', newPatient);
      
      // Add to store immediately
      addPatient(newPatient);
      
      setShowAddDialog(false);
      resetForm();
      
      // Auto-select the newly created patient
      onSelectPatient(newPatient);
    } catch (err) {
      console.error('Error adding patient:', err);
      setError(err.message);
    }
  };

  const handleUpdatePatient = async () => {
    try {
      // Convert date strings to ISO format - use UTC to avoid timezone issues
      const requestData = {
        ...formData,
        date_of_birth: formData.date_of_birth ? formData.date_of_birth + 'T00:00:00.000Z' : null,
        date_of_accident: formData.date_of_accident ? formData.date_of_accident + 'T00:00:00.000Z' : null,
        notes_private: formData.notes_private.trim() || null,
        notes_ai_context: formData.notes_ai_context.trim() || null
      };
      
      const token = await getToken();
      const response = await fetch(`/api/v1/patients/${editingPatient.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error('Failed to update patient');
      }

      const updatedPatient = await response.json();
      
      // Update in store immediately
      updatePatient(updatedPatient.id, updatedPatient);
      
      // Update form data with the returned values to stay in sync
      setFormData({
        first_name: updatedPatient.first_name,
        last_name: updatedPatient.last_name,
        date_of_birth: updatedPatient.date_of_birth.split('T')[0],
        date_of_accident: updatedPatient.date_of_accident ? updatedPatient.date_of_accident.split('T')[0] : '',
        notes_private: updatedPatient.notes_private || '',
        notes_ai_context: updatedPatient.notes_ai_context || ''
      });
      
      // Update editingPatient to reflect the changes
      setEditingPatient(updatedPatient);
      
      // Show success message
      setSuccessMessage('Patient updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!window.confirm('Are you sure you want to delete this patient?')) {
      return;
    }

    try {
      const token = await getToken();
      const response = await fetch(`/api/v1/patients/${patientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete patient');
      }

      // Remove from store immediately
      removePatient(patientId);
      
      // Clear selection if deleted patient was selected
      if (selectedPatient?.id === patientId) {
        onSelectPatient(null);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      date_of_accident: '',
      notes_private: '',
      notes_ai_context: ''
    });
  };

  const openEditDialog = (patient) => {
    setEditingPatient(patient);
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth.split('T')[0], // Convert to YYYY-MM-DD
      date_of_accident: patient.date_of_accident ? patient.date_of_accident.split('T')[0] : '',
      notes_private: patient.notes_private || '',
      notes_ai_context: patient.notes_ai_context || ''
    });
  };

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower)
    );
  });


  return (
    <Dialog open={true} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{showAddDialog ? (editingPatient ? 'Edit Patient' : 'Add New Patient') : 'Select Patient'}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {!showAddDialog && (
        <>
          <Box display="flex" gap={2} mb={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
            >
              Add
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
        {isLoading ? (
          <Box p={3} textAlign="center">
            <CircularProgress size={40} />
            <Typography color="text.secondary" mt={2}>
              Loading patients...
            </Typography>
          </Box>
        ) : filteredPatients.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="text.secondary">
              {searchTerm ? 'No patients found' : 'No patients yet. Click "Add" to create one.'}
            </Typography>
          </Box>
        ) : (
          <List>
            {filteredPatients.map((patient, index) => (
              <React.Fragment key={patient.id}>
                {index > 0 && <Divider />}
                <ListItem
                  component="li"
                  selected={selectedPatient?.id === patient.id}
                  onClick={() => onSelectPatient(patient)}
                  sx={{ cursor: 'pointer' }}
                >
                  <ListItemText
                    primary={`${patient.last_name}, ${patient.first_name}`}
                    secondary={
                      <Box component="span">
                        <Typography variant="caption" component="span" display="block">
                          DOB: {(() => {
                            const datePart = patient.date_of_birth.split('T')[0];
                            const [year, month, day] = datePart.split('-');
                            return format(new Date(year, month - 1, day), 'MM/dd/yyyy');
                          })()}
                        </Typography>
                        {patient.date_of_accident && (
                          <Typography variant="caption" component="span" display="block">
                            DOA: {(() => {
                              const datePart = patient.date_of_accident.split('T')[0];
                              const [year, month, day] = datePart.split('-');
                              return format(new Date(year, month - 1, day), 'MM/dd/yyyy');
                            })()}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(patient);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePatient(patient.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>
        </>
      )}

      {/* Add/Edit Patient Form */}
      {(showAddDialog || editingPatient !== null) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Date of Birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Date of Accident (Optional)"
              type="date"
              value={formData.date_of_accident}
              onChange={(e) => setFormData({ ...formData, date_of_accident: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Private Notes (Not shared with AI)"
              value={formData.notes_private}
              onChange={(e) => setFormData({ ...formData, notes_private: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Private notes about this patient that won't be shared with AI"
              helperText="These notes are only visible to you and will never be shared with AI"
            />
            <TextField
              label="AI Context Notes (Shared with AI)"
              value={formData.notes_ai_context}
              onChange={(e) => setFormData({ ...formData, notes_ai_context: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Important context about this patient that AI should know when transcribing"
              helperText="These notes will be shared with AI to improve transcription accuracy"
            />
          </Box>
        </>
      )}
      </DialogContent>
      {(showAddDialog || editingPatient !== null) && (
        <DialogActions>
          <Button onClick={() => {
            setShowAddDialog(false);
            setEditingPatient(null);
            resetForm();
            if (openAddDialogImmediately || selectedPatient) {
              onClose();
            }
          }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingPatient ? handleUpdatePatient : handleAddPatient}
            disabled={!formData.first_name || !formData.last_name || !formData.date_of_birth}
          >
            {editingPatient ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default PatientSelector;