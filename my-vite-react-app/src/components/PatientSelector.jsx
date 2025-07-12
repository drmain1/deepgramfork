import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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

// Memoized date formatter
const formatDateDisplay = (dateString) => {
  if (!dateString) return '';
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  return format(new Date(year, month - 1, day), 'MM/dd/yyyy');
};

// Memoized ListItem component
const PatientListItem = React.memo(({ patient, isSelected, onSelect, onEdit, onDelete }) => {
  const handleEditClick = useCallback((e) => {
    e.stopPropagation();
    onEdit(patient);
  }, [onEdit, patient]);

  const handleDeleteClick = useCallback((e) => {
    e.stopPropagation();
    onDelete(patient.id);
  }, [onDelete, patient.id]);

  return (
    <ListItem
      component="li"
      selected={isSelected}
      onClick={() => onSelect(patient)}
      sx={{ cursor: 'pointer' }}
    >
      <ListItemText
        primary={`${patient.last_name}, ${patient.first_name}`}
        secondary={
          <Box component="span">
            <Typography variant="caption" component="span" display="block">
              DOB: {formatDateDisplay(patient.date_of_birth)}
            </Typography>
            {patient.date_of_accident && (
              <Typography variant="caption" component="span" display="block">
                DOA: {formatDateDisplay(patient.date_of_accident)}
              </Typography>
            )}
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <IconButton size="small" onClick={handleEditClick}>
          <EditIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={handleDeleteClick}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  );
});

const PatientSelector = ({ selectedPatient, onSelectPatient, onClose, openAddDialogImmediately = false }) => {
  const { getToken } = useAuth();
  const { patients, fetchPatients, addPatient, updatePatient, removePatient, isLoading, getPatientById } = usePatientsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(openAddDialogImmediately);
  const [editingPatient, setEditingPatient] = useState(null);
  const [isOpen, setIsOpen] = useState(true);
  
  // Use refs for AI context notes to avoid re-renders on every keystroke
  const notesPrivateRef = useRef('');
  const notesAiContextRef = useRef('');
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    date_of_accident: ''
  });

  // Debounce timer for AI context notes
  const aiContextDebounceRef = useRef(null);

  // Only fetch if store is empty and we're not in add mode
  useEffect(() => {
    const init = async () => {
      await sessionManager.ensureSession(getToken);
      // Only fetch if we don't have patients in the store
      if (patients.length === 0) {
        await fetchPatients();
      }
    };
    
    if (!openAddDialogImmediately && !selectedPatient && patients.length === 0) {
      init();
    }
  }, [fetchPatients, getToken, openAddDialogImmediately, selectedPatient, patients.length]);

  // If we have a selectedPatient (editing mode), populate the form
  useEffect(() => {
    if (selectedPatient) {
      // Always get fresh data from store
      const freshPatient = getPatientById(selectedPatient.id);
      if (freshPatient) {
        setEditingPatient(freshPatient);
        setFormData({
          first_name: freshPatient.first_name,
          last_name: freshPatient.last_name,
          date_of_birth: freshPatient.date_of_birth.split('T')[0],
          date_of_accident: freshPatient.date_of_accident ? freshPatient.date_of_accident.split('T')[0] : ''
        });
        notesPrivateRef.current = freshPatient.notes_private || '';
        notesAiContextRef.current = freshPatient.notes_ai_context || '';
        setShowAddDialog(true);
      }
    }
  }, [selectedPatient, getPatientById]);

  // Sync with store updates when editing
  useEffect(() => {
    if (editingPatient) {
      const currentPatient = getPatientById(editingPatient.id);
      if (currentPatient && currentPatient !== editingPatient) {
        setEditingPatient(currentPatient);
        // Only update if the dialog is open and we're not actively typing
        if (showAddDialog && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setFormData({
            first_name: currentPatient.first_name,
            last_name: currentPatient.last_name,
            date_of_birth: currentPatient.date_of_birth.split('T')[0],
            date_of_accident: currentPatient.date_of_accident ? currentPatient.date_of_accident.split('T')[0] : ''
          });
          notesPrivateRef.current = currentPatient.notes_private || '';
          notesAiContextRef.current = currentPatient.notes_ai_context || '';
        }
      }
    }
  }, [patients, editingPatient, showAddDialog, getPatientById]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (aiContextDebounceRef.current) {
        clearTimeout(aiContextDebounceRef.current);
      }
    };
  }, []);

  // Memoized filtered patients
  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients;
    
    const searchLower = searchTerm.toLowerCase();
    return patients.filter(patient => 
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower)
    );
  }, [patients, searchTerm]);

  // Optimized handlers using functional updates
  const handleFormChange = useCallback((field) => (e) => {
    let value = e.target.value;
    
    // For date fields, validate the year is not more than 4 digits
    if ((field === 'date_of_birth' || field === 'date_of_accident') && value) {
      const parts = value.split('-');
      if (parts.length > 0 && parts[0].length > 4) {
        // Truncate year to 4 digits
        parts[0] = parts[0].substring(0, 4);
        value = parts.join('-');
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddPatient = useCallback(async () => {
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
        notes_private: notesPrivateRef.current || null,
        notes_ai_context: notesAiContextRef.current || null
      };
      
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
  }, [formData, getToken, addPatient, onSelectPatient]);

  const handleUpdatePatient = useCallback(async () => {
    try {
      // Convert date strings to ISO format - use UTC to avoid timezone issues
      const requestData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: formData.date_of_birth ? formData.date_of_birth + 'T00:00:00.000Z' : null,
        date_of_accident: formData.date_of_accident ? formData.date_of_accident + 'T00:00:00.000Z' : null,
        notes_private: notesPrivateRef.current?.trim() || null,
        notes_ai_context: notesAiContextRef.current?.trim() || null
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
        date_of_accident: updatedPatient.date_of_accident ? updatedPatient.date_of_accident.split('T')[0] : ''
      });
      notesPrivateRef.current = updatedPatient.notes_private || '';
      notesAiContextRef.current = updatedPatient.notes_ai_context || '';
      
      // Update editingPatient to reflect the changes
      setEditingPatient(updatedPatient);
      
      // Show success message
      setSuccessMessage('Patient updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  }, [formData, editingPatient, getToken, updatePatient]);

  const handleDeletePatient = useCallback(async (patientId) => {
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
  }, [getToken, removePatient, selectedPatient, onSelectPatient]);

  const resetForm = useCallback(() => {
    setFormData({
      first_name: '',
      last_name: '',
      date_of_birth: '',
      date_of_accident: ''
    });
    notesPrivateRef.current = '';
    notesAiContextRef.current = '';
  }, []);

  const openEditDialog = useCallback((patient) => {
    // Get fresh patient data from store
    const freshPatient = getPatientById(patient.id);
    if (freshPatient) {
      setEditingPatient(freshPatient);
      setFormData({
        first_name: freshPatient.first_name,
        last_name: freshPatient.last_name,
        date_of_birth: freshPatient.date_of_birth.split('T')[0],
        date_of_accident: freshPatient.date_of_accident ? freshPatient.date_of_accident.split('T')[0] : ''
      });
      notesPrivateRef.current = freshPatient.notes_private || '';
      notesAiContextRef.current = freshPatient.notes_ai_context || '';
      setShowAddDialog(true);
    }
  }, [getPatientById]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onClose();
  }, [onClose]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setShowAddDialog(false);
    setEditingPatient(null);
    resetForm();
    if (openAddDialogImmediately || selectedPatient) {
      handleClose();
    }
  }, [openAddDialogImmediately, selectedPatient, resetForm, handleClose]);

  // Don't render dialog if closed
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            {showAddDialog ? (editingPatient ? 'Edit Patient' : 'Add New Patient') : 'Select Patient'}
          </Typography>
          <IconButton onClick={handleClose} size="small">
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
              onChange={handleSearchChange}
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
                <PatientListItem
                  patient={patient}
                  isSelected={selectedPatient?.id === patient.id}
                  onSelect={onSelectPatient}
                  onEdit={openEditDialog}
                  onDelete={handleDeletePatient}
                />
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
              onChange={handleFormChange('first_name')}
              required
              fullWidth
            />
            <TextField
              label="Last Name"
              value={formData.last_name}
              onChange={handleFormChange('last_name')}
              required
              fullWidth
            />
            <TextField
              label="Date of Birth"
              type="date"
              value={formData.date_of_birth}
              onChange={handleFormChange('date_of_birth')}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{
                max: '9999-12-31',
                min: '1900-01-01'
              }}
            />
            <TextField
              label="Date of Accident (Optional)"
              type="date"
              value={formData.date_of_accident}
              onChange={handleFormChange('date_of_accident')}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{
                max: '9999-12-31',
                min: '1900-01-01'
              }}
            />
            <TextField
              label="Private Notes (Not shared with AI)"
              defaultValue={notesPrivateRef.current}
              onChange={(e) => {
                notesPrivateRef.current = e.target.value;
              }}
              fullWidth
              multiline
              rows={3}
              placeholder="Private notes about this patient that won't be shared with AI"
              helperText="These notes are only visible to you and will never be shared with AI"
            />
            <TextField
              label="AI Context Notes (Shared with AI)"
              defaultValue={notesAiContextRef.current}
              onChange={(e) => {
                // Clear existing debounce
                if (aiContextDebounceRef.current) {
                  clearTimeout(aiContextDebounceRef.current);
                }
                
                // Update ref immediately for form submission
                const value = e.target.value;
                
                // Debounce the actual update
                aiContextDebounceRef.current = setTimeout(() => {
                  notesAiContextRef.current = value;
                }, 300);
              }}
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
          <Button onClick={handleCancelEdit}>
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