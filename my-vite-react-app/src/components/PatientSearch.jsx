import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Card,
  CardContent,
  Typography,
  InputAdornment,
  CircularProgress,
  Grid,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Alert,
  Divider
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  CalendarMonth as CalendarIcon,
  LocalHospital as LocalHospitalIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useAuth } from '../contexts/FirebaseAuthContext';
import PatientSelector from './PatientSelector';

const PatientSearch = ({ patients, onPatientSelect, onPatientsUpdate, isLoading }) => {
  const { getToken } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedPatientMenu, setSelectedPatientMenu] = useState(null);
  const [transcriptCounts, setTranscriptCounts] = useState({});
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const fullName = `${patient.first_name} ${patient.last_name}`.toLowerCase();
    return fullName.includes(search) || 
           patient.first_name.toLowerCase().includes(search) ||
           patient.last_name.toLowerCase().includes(search);
  });

  // Load transcript counts for all patients
  useEffect(() => {
    if (patients.length > 0) {
      loadTranscriptCounts();
    }
  }, [patients]);

  const loadTranscriptCounts = async () => {
    try {
      setLoadingTranscripts(true);
      const token = await getToken();
      const counts = {};

      // Fetch transcript count for each patient
      await Promise.all(patients.map(async (patient) => {
        try {
          const response = await fetch(`/api/v1/patients/${patient.id}/transcripts`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const transcripts = await response.json();
            counts[patient.id] = transcripts.length;
          } else {
            counts[patient.id] = 0;
          }
        } catch (error) {
          console.error(`Error fetching transcripts for patient ${patient.id}:`, error);
          counts[patient.id] = 0;
        }
      }));

      setTranscriptCounts(counts);
    } catch (error) {
      console.error('Error loading transcript counts:', error);
    } finally {
      setLoadingTranscripts(false);
    }
  };

  const handleMenuClick = (event, patient) => {
    setAnchorEl(event.currentTarget);
    setSelectedPatientMenu(patient);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPatientMenu(null);
  };

  const handleViewTranscripts = () => {
    if (selectedPatientMenu) {
      onPatientSelect(selectedPatientMenu);
    }
    handleMenuClose();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      // Handle UTC dates (e.g., date_of_accident) without timezone shift
      if (dateString.endsWith('Z') || dateString.includes('T00:00:00')) {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-');
        const localDate = new Date(year, month - 1, day);
        return format(localDate, 'MMM d, yyyy');
      }
      
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

  return (
    <Box>
      {/* Search Bar */}
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search patients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                sx: {
                  backgroundColor: 'white',
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: 'primary.main',
                    },
                  },
                }
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowAddDialog(true)}
              sx={{ height: '56px' }}
            >
              Add New Patient
            </Button>
          </Grid>
        </Grid>
      </Box>

      {/* Results */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      ) : filteredPatients.length === 0 ? (
        <Box textAlign="center" py={8}>
          <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? 'No patients found' : 'No patients yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? 'Try a different search term' : 'Click "Add New Patient" to get started'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredPatients.map((patient) => (
            <Grid item xs={12} md={6} lg={4} key={patient.id}>
              <Card 
                sx={{ 
                  height: '100%',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 3,
                  }
                }}
                onClick={() => onPatientSelect(patient)}
              >
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Box>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {patient.first_name} {patient.last_name}
                      </Typography>
                      <Box display="flex" gap={1} mb={1}>
                        <Chip 
                          icon={<CalendarIcon />} 
                          label={`Age: ${getAge(patient.date_of_birth)}`} 
                          size="small" 
                          variant="outlined"
                        />
                        {patient.date_of_accident && (
                          <Chip 
                            icon={<LocalHospitalIcon />} 
                            label="DOA" 
                            size="small" 
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, patient);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">
                        Date of Birth
                      </Typography>
                      <Typography variant="body2">
                        {formatDate(patient.date_of_birth)}
                      </Typography>
                    </Grid>
                    {patient.date_of_accident && (
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary">
                          Date of Accident
                        </Typography>
                        <Typography variant="body2">
                          {formatDate(patient.date_of_accident)}
                        </Typography>
                      </Grid>
                    )}
                  </Grid>

                  <Box mt={2} display="flex" alignItems="center" gap={1}>
                    <DescriptionIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {loadingTranscripts ? (
                        <CircularProgress size={14} />
                      ) : (
                        `${transcriptCounts[patient.id] || 0} transcript${transcriptCounts[patient.id] !== 1 ? 's' : ''}`
                      )}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleViewTranscripts}>
          <DescriptionIcon sx={{ mr: 1 }} fontSize="small" />
          View Transcripts
        </MenuItem>
      </Menu>

      {/* Add/Edit Patient Dialog */}
      {showAddDialog && (
        <PatientSelector
          selectedPatient={null}
          onSelectPatient={(patient) => {
            setShowAddDialog(false);
            if (patient) {
              onPatientsUpdate();
            }
          }}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </Box>
  );
};

export default PatientSearch;