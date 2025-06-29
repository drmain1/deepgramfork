import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { auth } from '../firebaseConfig';
import { generatePdfFromText } from '../components/pdfUtils';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { shouldShowClinicHeader } from '../utils/encounterTypeUtils';
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
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent
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
  Person as PersonIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';
import { format } from 'date-fns';

function PatientTranscriptList() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { userSettings } = useUserSettings();
  
  const [patient, setPatient] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTranscripts, setSelectedTranscripts] = useState(new Set());
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [generatingDownload, setGeneratingDownload] = useState(false);
  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [billingData, setBillingData] = useState(null);
  const [billingProgress, setBillingProgress] = useState({ step: 0, message: '' });
  const [showBillingProgress, setShowBillingProgress] = useState(false);

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

  // Shared function for generating PDFs
  const generateTranscriptsPDF = async (previewMode = false) => {
    if (selectedTranscripts.size === 0) return;
    
    // Set the appropriate loading state based on mode
    if (previewMode) {
      setGeneratingPreview(true);
    } else {
      setGeneratingDownload(true);
    }
    
    try {
      // Get selected transcript objects
      const selectedTranscriptObjects = transcripts.filter(t => 
        selectedTranscripts.has(t.id)
      );
      
      // Sort by date (oldest first)
      selectedTranscriptObjects.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      // Check if any transcripts have content
      const hasContent = selectedTranscriptObjects.some(t => 
        t.polishedTranscript || t.transcript
      );
      
      if (!hasContent) {
        // If no content, we need to fetch individual transcripts
        console.log('No transcript content in list, fetching individual transcripts...');
        const token = await auth.currentUser?.getIdToken();
        
        for (let i = 0; i < selectedTranscriptObjects.length; i++) {
          const transcript = selectedTranscriptObjects[i];
          try {
            const response = await fetch(`/api/v1/transcript/${auth.currentUser.uid}/${transcript.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
              const detailedTranscript = await response.json();
              // Update the transcript object with the fetched content
              transcript.transcript = detailedTranscript.originalTranscript || detailedTranscript.transcript;
              transcript.polishedTranscript = detailedTranscript.polishedTranscript;
            }
          } catch (fetchError) {
            console.error(`Error fetching transcript ${transcript.id}:`, fetchError);
          }
        }
      }
      
      // Create combined transcript content
      let combinedContent = '';
      
      // Add each transcript
      for (let i = 0; i < selectedTranscriptObjects.length; i++) {
        const transcript = selectedTranscriptObjects[i];
        // Get transcript content (prefer polished over original)
        let content = transcript.polishedTranscript || transcript.transcript || 'No transcript content available';
        
        // Check if content already has a clinic location header
        const hasClinicLocationHeader = content.startsWith('CLINIC LOCATION:');
        
        // Use utility function to determine if we should add a clinic header
        // Only add if: content doesn't already have it, location exists, and encounter type warrants it
        if (!hasClinicLocationHeader && 
            transcript.location && 
            transcript.location.trim() && 
            shouldShowClinicHeader(transcript.encounterType)) {
          const locationHeader = `CLINIC LOCATION:\n${transcript.location.trim()}\n\n---\n\n`;
          content = locationHeader + content;
        }
        
        combinedContent += content;
        
        // Add separator between transcripts if not the last one
        if (i < selectedTranscriptObjects.length - 1) {
          combinedContent += `\n\n${'='.repeat(80)}\n\n`;
        }
      }
      
      // PDF options - match the format used in EditableNote
      const pdfOptions = {
        doctorName: userSettings.doctorName || '',
        doctorSignature: userSettings.doctorSignature || '',
        isSigned: true, // Assuming all saved transcripts are signed
        clinicLogo: userSettings.clinicLogo || '',
        includeLogoOnPdf: userSettings.includeLogoOnPdf || false,
        useProfessionalFormat: true,
        usePagedFormat: true,
        previewMode: previewMode // Add preview mode flag
      };
      
      await generatePdfFromText(
        combinedContent,
        `${patient.last_name}_${patient.first_name}_transcripts`,
        '', // location will be extracted from content
        pdfOptions
      );
      
      // Clear selections after successful PDF generation (only if downloading)
      if (!previewMode) {
        setSelectedTranscripts(new Set());
      }
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      // Reset the appropriate loading state based on mode
      if (previewMode) {
        setGeneratingPreview(false);
      } else {
        setGeneratingDownload(false);
      }
    }
  };

  const handleViewMultiple = async () => {
    // Call the shared function with preview mode
    await generateTranscriptsPDF(true);
  };

  const handlePrintAll = async () => {
    // Call the shared function with download mode
    await generateTranscriptsPDF(false);
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
      return new Date(dateString).toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'  // Shows timezone like "PST" or "EST"
      });
    } catch {
      return 'Invalid time';
    }
  };

  const handleGenerateBilling = async () => {
    if (selectedTranscripts.size === 0) return;
    
    setGeneratingBilling(true);
    setShowBillingProgress(true);
    setBillingProgress({ step: 1, message: 'Gathering selected transcripts...' });
    
    try {
      const token = await auth.currentUser?.getIdToken();
      
      // Simulate progress steps
      setTimeout(() => {
        setBillingProgress({ step: 2, message: 'Analyzing medical encounters...' });
      }, 500);
      
      // Get selected transcript IDs
      const transcriptIds = Array.from(selectedTranscripts);
      
      // Empty billing instructions - backend will use base + custom rules
      const billingInstructions = "";
      
      setTimeout(() => {
        setBillingProgress({ step: 3, message: 'Activating secret billing algorithms...' });
      }, 1500);
      
      const response = await fetch(`/api/v1/patients/${patientId}/generate-billing`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transcript_ids: transcriptIds,
          billing_instructions: billingInstructions
        })
      });
      
      setBillingProgress({ step: 4, message: 'Finalizing billing codes...' });
      
      if (response.ok) {
        const data = await response.json();
        
        setTimeout(() => {
          setBillingProgress({ step: 5, message: 'Complete!' });
          setTimeout(() => {
            setShowBillingProgress(false);
            setBillingData(data);
            setShowBillingDialog(true);
          }, 500);
        }, 500);
      } else {
        const errorText = await response.text();
        console.error('Failed to generate billing:', errorText);
        setShowBillingProgress(false);
        alert('Failed to generate billing. Please try again.');
      }
    } catch (error) {
      console.error('Error generating billing:', error);
      setShowBillingProgress(false);
      alert('Error generating billing. Please try again.');
    } finally {
      setGeneratingBilling(false);
    }
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
                  startIcon={generatingPreview ? <CircularProgress size={20} /> : <DescriptionIcon />}
                  onClick={handleViewMultiple}
                  disabled={generatingPreview}
                >
                  {generatingPreview ? 'Generating Preview...' : `View Selected (${selectedTranscripts.size})`}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={generatingDownload ? <CircularProgress size={20} /> : <PrintIcon />}
                  onClick={handlePrintAll}
                  disabled={generatingDownload}
                >
                  {generatingDownload ? 'Generating PDF...' : 'Print Selected'}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={generatingBilling ? <CircularProgress size={20} /> : <ReceiptIcon />}
                  onClick={handleGenerateBilling}
                  disabled={generatingBilling}
                >
                  {generatingBilling ? 'Generating Billing...' : 'Generate Billing'}
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
                  onClick={() => handleSelectTranscript(transcript.id)}
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

      {/* Billing Progress Dialog */}
      <Dialog
        open={showBillingProgress}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={1}>
            <ReceiptIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6">Billing Generation Magic ✨</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Stepper activeStep={billingProgress.step - 1} orientation="vertical">
              <Step>
                <StepLabel>Gathering Transcripts</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Collecting selected medical encounters...
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Analyzing Encounters</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Reviewing procedures and services provided...
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>🤫 Secret Sauce Processing</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Our classified billing algorithm at work...
                  </Typography>
                  <LinearProgress sx={{ mt: 1 }} />
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Finalizing Codes</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Applying billing rules and modifiers...
                  </Typography>
                </StepContent>
              </Step>
              <Step>
                <StepLabel>Complete</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Billing summary ready!
                  </Typography>
                </StepContent>
              </Step>
            </Stepper>
            
            {billingProgress.step === 3 && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  🔮 Magic happening... (30-90 seconds of pure wizardry)
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Billing Dialog */}
      <Dialog
        open={showBillingDialog}
        onClose={() => setShowBillingDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon />
          Medical Billing Summary
        </DialogTitle>
        <DialogContent dividers>
          {billingData && (
            <Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Generated: {new Date(billingData.generated_at).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Transcripts included: {billingData.transcript_count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Model: {billingData.model_used}
                </Typography>
              </Box>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                {billingData.billing_data}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              // Copy billing data to clipboard
              if (billingData?.billing_data) {
                navigator.clipboard.writeText(billingData.billing_data);
                alert('Billing data copied to clipboard!');
              }
            }}
            startIcon={<DownloadIcon />}
          >
            Copy to Clipboard
          </Button>
          <Button
            onClick={() => {
              // Download as text file
              if (billingData?.billing_data) {
                const blob = new Blob([billingData.billing_data], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `billing_${patient?.last_name}_${patient?.first_name}_${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
            startIcon={<DownloadIcon />}
          >
            Download
          </Button>
          <Button onClick={() => setShowBillingDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PatientTranscriptList;