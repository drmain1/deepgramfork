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

const PatientSelector = ({ selectedPatient, onSelectPatient, onClose }) => {
  const { getToken } = useAuth();
  const [patients, setPatients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    date_of_birth: '',
    date_of_accident: ''
  });

  // Ensure user has a backend session
  const ensureBackendSession = async () => {
    try {
      const token = await getToken();
      const response = await fetch('/api/v1/login', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('Failed to create backend session:', response.status);
      } else {
        console.log('Backend session created/verified');
      }
    } catch (error) {
      console.error('Error creating backend session:', error);
    }
  };

  // Fetch patients on component mount
  useEffect(() => {
    const init = async () => {
      await ensureBackendSession();
      await fetchPatients();
    };
    init();
  }, []);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      const response = await fetch('/api/v1/patients', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }

      const data = await response.json();
      setPatients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async () => {
    try {
      // Validate required fields
      if (!formData.first_name || !formData.last_name || !formData.date_of_birth) {
        setError('Please fill in all required fields');
        return;
      }
      
      // Convert date strings to ISO format
      const requestData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        date_of_birth: new Date(formData.date_of_birth).toISOString(),
        date_of_accident: formData.date_of_accident ? new Date(formData.date_of_accident).toISOString() : null
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
      setShowAddDialog(false);
      resetForm();
      
      // Re-fetch patients to ensure we have the latest data
      await fetchPatients();
      
      // Auto-select the newly created patient
      onSelectPatient(newPatient);
    } catch (err) {
      console.error('Error adding patient:', err);
      setError(err.message);
    }
  };

  const handleUpdatePatient = async () => {
    try {
      // Convert date strings to ISO format
      const requestData = {
        ...formData,
        date_of_birth: formData.date_of_birth ? new Date(formData.date_of_birth).toISOString() : null,
        date_of_accident: formData.date_of_accident ? new Date(formData.date_of_accident).toISOString() : null
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
      setPatients(patients.map(p => p.id === updatedPatient.id ? updatedPatient : p));
      setEditingPatient(null);
      resetForm();
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

      setPatients(patients.filter(p => p.id !== patientId));
      
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
      date_of_accident: ''
    });
  };

  const openEditDialog = (patient) => {
    setEditingPatient(patient);
    setFormData({
      first_name: patient.first_name,
      last_name: patient.last_name,
      date_of_birth: patient.date_of_birth.split('T')[0], // Convert to YYYY-MM-DD
      date_of_accident: patient.date_of_accident ? patient.date_of_accident.split('T')[0] : ''
    });
  };

  const filteredPatients = patients.filter(patient => {
    const searchLower = searchTerm.toLowerCase();
    return (
      patient.first_name.toLowerCase().includes(searchLower) ||
      patient.last_name.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Select Patient</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

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
        {filteredPatients.length === 0 ? (
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
                  button
                  selected={selectedPatient?.id === patient.id}
                  onClick={() => onSelectPatient(patient)}
                >
                  <ListItemText
                    primary={`${patient.last_name}, ${patient.first_name}`}
                    secondary={
                      <Box>
                        <Typography variant="caption" component="div">
                          DOB: {format(new Date(patient.date_of_birth), 'MM/dd/yyyy')}
                        </Typography>
                        {patient.date_of_accident && (
                          <Typography variant="caption" component="div">
                            DOA: {format(new Date(patient.date_of_accident), 'MM/dd/yyyy')}
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

      {/* Add/Edit Patient Dialog */}
      <Dialog
        open={showAddDialog || editingPatient !== null}
        onClose={() => {
          setShowAddDialog(false);
          setEditingPatient(null);
          resetForm();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingPatient ? 'Edit Patient' : 'Add New Patient'}
        </DialogTitle>
        <DialogContent>
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowAddDialog(false);
            setEditingPatient(null);
            resetForm();
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
      </Dialog>
    </Box>
  );
};

export default PatientSelector;