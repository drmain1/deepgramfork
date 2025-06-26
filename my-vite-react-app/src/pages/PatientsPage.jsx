import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { auth } from '../firebaseConfig';
import usePatientsStore from '../stores/patientsStore';
import { sessionManager } from '../utils/sessionManager';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Box,
  Button,
  Chip,
  CircularProgress
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  CalendarMonth as CalendarIcon,
  LocalHospital as LocalHospitalIcon,
  Delete as DeleteIcon,
  Build as BuildIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import PatientSelector from '../components/PatientSelector';

function PatientsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, getToken } = useAuth();
  const { patients, isLoading: isLoadingPatients, fetchPatients, removePatient } = usePatientsStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deletingPatientId, setDeletingPatientId] = useState(null);
  const [editingPatient, setEditingPatient] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      const init = async () => {
        await sessionManager.ensureSession(getToken);
        await fetchPatients();
      };
      init();
    }
  }, [isAuthenticated, getToken, fetchPatients]);

  const handlePatientClick = (patient) => {
    navigate(`/patients/${patient.id}/transcripts`);
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete ${patient.first_name} ${patient.last_name}?`)) {
      return;
    }

    try {
      setDeletingPatientId(patient.id);
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/v1/patients/${patient.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        // Remove patient from store
        removePatient(patient.id);
      } else {
        console.error('Failed to delete patient');
        alert('Failed to delete patient');
      }
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Error deleting patient');
    } finally {
      setDeletingPatientId(null);
    }
  };

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    return fullName.includes(search) || 
           patient.first_name.toLowerCase().includes(search) ||
           patient.last_name.toLowerCase().includes(search);
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const getAge = (birthDate) => {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="material-icons text-gray-600 text-6xl mb-4 block">lock</span>
          <p className="text-gray-500">Please log in to view patients</p>
        </div>
      </div>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Patient Profiles
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <IconButton
              onClick={() => fetchPatients(true)}
              color="primary"
              title="Refresh patients"
            >
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Search and manage patient profiles
        </Typography>
      </Box>

      {/* Search and Add Bar */}
      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search patients by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          sx={{ minWidth: '150px' }}
        >
          Add Patient
        </Button>
      </Box>

      {/* Patients Table */}
      {isLoadingPatients ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : filteredPatients.length === 0 ? (
        <Paper sx={{ p: 8, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? 'No patients found' : 'No patients yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try a different search term' : 'Click "Add Patient" to get started'}
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={1}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Patient Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Age</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date of Birth</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date of Accident</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow
                  key={patient.id}
                  hover
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                  onClick={() => handlePatientClick(patient)}
                >
                  <TableCell>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {patient.first_name} {patient.last_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{getAge(patient.date_of_birth)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon fontSize="small" color="action" />
                      {formatDate(patient.date_of_birth)}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {patient.date_of_accident ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalHospitalIcon fontSize="small" color="error" />
                        {formatDate(patient.date_of_accident)}
                      </Box>
                    ) : (
                      <Typography color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(patient.created_at)}</TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPatient(patient);
                          setShowAddDialog(true);
                        }}
                        title="Edit Patient"
                      >
                        <BuildIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePatient(patient);
                        }}
                        disabled={deletingPatientId === patient.id}
                        title="Delete Patient"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Patient Dialog */}
      {showAddDialog && (
        <PatientSelector
          selectedPatient={editingPatient}
          onSelectPatient={(patient) => {
            setShowAddDialog(false);
            setEditingPatient(null);
            if (patient) {
              fetchPatients(true);
            }
          }}
          onClose={() => {
            setShowAddDialog(false);
            setEditingPatient(null);
          }}
          openAddDialogImmediately={!editingPatient}
        />
      )}
    </Box>
  );
}

export default PatientsPage;