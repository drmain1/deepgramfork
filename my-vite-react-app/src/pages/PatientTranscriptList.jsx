import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { auth } from '../firebaseConfig';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Divider,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Download as DownloadIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Description as DescriptionIcon,
  MoreVert as MoreVertIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

function PatientTranscriptList() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [patient, setPatient] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTranscripts, setSelectedTranscripts] = useState(new Set());
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  useEffect(() => {
    if (isAuthenticated && patientId) {
      fetchPatientData();
    }
  }, [isAuthenticated, patientId]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      
      // Fetch patient info
      const patientResponse = await fetch(`/api/v1/patients/${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (patientResponse.ok) {
        const patientData = await patientResponse.json();
        setPatient(patientData);
      } else {
        throw new Error('Failed to fetch patient');
      }
      
      // Fetch transcripts
      const transcriptsResponse = await fetch(`/api/v1/patients/${patientId}/transcripts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (transcriptsResponse.ok) {
        const transcriptsData = await transcriptsResponse.json();
        setTranscripts(transcriptsData);
      } else {
        throw new Error('Failed to fetch transcripts');
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedTranscripts.size === transcripts.length) {
      setSelectedTranscripts(new Set());
    } else {
      setSelectedTranscripts(new Set(transcripts.map(t => t.id)));
    }
  };

  const handleSelectTranscript = (transcriptId) => {
    const newSelected = new Set(selectedTranscripts);
    if (newSelected.has(transcriptId)) {
      newSelected.delete(transcriptId);
    } else {
      newSelected.add(transcriptId);
    }
    setSelectedTranscripts(newSelected);
  };

  const handleViewMultiple = () => {
    if (selectedTranscripts.size > 0) {
      const ids = Array.from(selectedTranscripts).join(',');
      navigate(`/patients/${patientId}/transcripts/view?ids=${ids}`);
    }
  };

  const handlePrintAll = () => {
    // TODO: Implement print functionality
    window.print();
  };

  const handleMenuClick = (event, transcript) => {
    setAnchorEl(event.currentTarget);
    setSelectedTranscript(transcript);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTranscript(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (authLoading || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => navigate('/patients')} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
          Back to Patients
        </Button>
      </Box>
    );
  }

  return (
    <Box p={4}>
      {/* Header */}
      <Box mb={4}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="inherit"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('/patients');
            }}
          >
            Patients
          </Link>
          <Typography color="text.primary">
            {patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}
          </Typography>
        </Breadcrumbs>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h4" gutterBottom>
              {patient ? `${patient.first_name} ${patient.last_name}` : 'Loading...'}
            </Typography>
            {patient && (
              <Box display="flex" gap={2} alignItems="center">
                <Chip
                  icon={<CalendarIcon />}
                  label={`DOB: ${formatDate(patient.date_of_birth)}`}
                  variant="outlined"
                />
                {patient.date_of_accident && (
                  <Chip
                    icon={<CalendarIcon />}
                    label={`DOA: ${formatDate(patient.date_of_accident)}`}
                    color="error"
                    variant="outlined"
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            )}
          </Box>

          <Box display="flex" gap={2}>
            {selectedTranscripts.size > 0 && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<DescriptionIcon />}
                  onClick={handleViewMultiple}
                >
                  View Selected ({selectedTranscripts.size})
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<PrintIcon />}
                  onClick={handlePrintAll}
                >
                  Print Selected
                </Button>
              </>
            )}
            <Button
              variant="text"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/patients')}
            >
              Back to Patients
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Select All */}
      {transcripts.length > 0 && (
        <Box mb={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={selectedTranscripts.size === transcripts.length}
                indeterminate={selectedTranscripts.size > 0 && selectedTranscripts.size < transcripts.length}
                onChange={handleSelectAll}
              />
            }
            label="Select all transcripts"
          />
        </Box>
      )}

      {/* Transcripts List */}
      {transcripts.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <DescriptionIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No transcripts yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Transcripts will appear here after recording sessions
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {transcripts.map((transcript) => (
            <Grid item xs={12} key={transcript.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: selectedTranscripts.has(transcript.id) ? 'action.selected' : 'background.paper',
                  '&:hover': {
                    boxShadow: 2,
                  }
                }}
              >
                <CardContent>
                  <Box display="flex" alignItems="flex-start" gap={2}>
                    <Checkbox
                      checked={selectedTranscripts.has(transcript.id)}
                      onChange={() => handleSelectTranscript(transcript.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <Box
                      flex={1}
                      onClick={() => navigate(`/transcription?id=${transcript.id}`)}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="h6" gutterBottom>
                            {transcript.encounterType || 'Medical Encounter'}
                          </Typography>
                          <Box display="flex" gap={2} flexWrap="wrap">
                            <Chip
                              icon={<CalendarIcon />}
                              label={formatDate(transcript.date)}
                              size="small"
                              variant="outlined"
                            />
                            <Chip
                              icon={<AccessTimeIcon />}
                              label={formatTime(transcript.date)}
                              size="small"
                              variant="outlined"
                            />
                            {transcript.durationSeconds && (
                              <Chip
                                label={`Duration: ${formatDuration(transcript.durationSeconds)}`}
                                size="small"
                                variant="outlined"
                              />
                            )}
                            {transcript.location && (
                              <Chip
                                label={transcript.location}
                                size="small"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Box>
                        
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMenuClick(e, transcript);
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                      
                      {transcript.patientContext && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {transcript.patientContext}
                        </Typography>
                      )}
                    </Box>
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
        <MenuItem
          onClick={() => {
            navigate(`/transcription?id=${selectedTranscript?.id}`);
            handleMenuClose();
          }}
        >
          View Transcript
        </MenuItem>
        <MenuItem
          onClick={() => {
            // TODO: Implement download functionality
            handleMenuClose();
          }}
        >
          Download
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default PatientTranscriptList;