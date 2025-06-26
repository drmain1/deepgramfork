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
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper
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
        console.log(`Fetched ${transcriptsData.length} transcripts for patient ${patientId}`);
        setTranscripts(transcriptsData);
      } else {
        const errorText = await transcriptsResponse.text();
        console.error('Failed to fetch transcripts:', transcriptsResponse.status, errorText);
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

      {/* Transcripts Table */}
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
        <TableContainer component={Paper} elevation={1}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.50' }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedTranscripts.size > 0 && selectedTranscripts.size < transcripts.length}
                    checked={transcripts.length > 0 && selectedTranscripts.size === transcripts.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date & Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Encounter Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transcripts.map((transcript) => (
                <TableRow
                  key={transcript.id}
                  hover
                  selected={selectedTranscripts.has(transcript.id)}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                  onClick={() => navigate(`/transcription?id=${transcript.id}`)}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedTranscripts.has(transcript.id)}
                      onChange={() => handleSelectTranscript(transcript.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2">{formatDate(transcript.date)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {formatTime(transcript.date)}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {transcript.encounterType || 'Medical Encounter'}
                    </Typography>
                  </TableCell>
                  <TableCell>{transcript.location || '—'}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(e, transcript);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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