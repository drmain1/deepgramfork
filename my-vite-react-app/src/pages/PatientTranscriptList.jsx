import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import BillingStatement from '../components/BillingStatement';

// Custom hooks
import { usePatientTranscripts } from '../hooks/usePatientTranscripts';
import { useTranscriptSelection } from '../hooks/useTranscriptSelection';
import { useBillingGeneration } from '../hooks/useBillingGeneration';
import { usePdfGeneration } from '../hooks/usePdfGeneration';

// Utilities
import { formatDateWithFallback, formatTimeWithTimezone } from '../utils/dateUtils';
import { UI_TEXT } from '../constants/patientTranscriptConstants';

// MUI Components
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Checkbox,
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
  CalendarMonth as CalendarIcon,
  AccessTime as AccessTimeIcon,
  Description as DescriptionIcon,
  MoreVert as MoreVertIcon,
  Receipt as ReceiptIcon
} from '@mui/icons-material';

function PatientTranscriptList() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { userSettings } = useUserSettings();
  
  // Data fetching hook
  const { 
    patient, 
    transcripts, 
    loading, 
    error, 
    fetchTranscriptDetails 
  } = usePatientTranscripts(patientId, isAuthenticated);
  
  // Selection management hook
  const {
    selectedTranscripts,
    handleSelectAll,
    handleSelectTranscript,
    clearSelection,
    getSelectedTranscriptObjects,
    hasSelection,
    isAllSelected,
    isPartiallySelected
  } = useTranscriptSelection(transcripts);
  
  // PDF generation hook
  const {
    generatingPreview,
    generatingDownload,
    generateTranscriptsPDF
  } = usePdfGeneration(patient, userSettings);
  
  // Billing generation hook
  const {
    generatingBilling,
    showBillingDialog,
    billingData,
    billingProgress,
    showBillingProgress,
    handleGenerateBilling,
    closeBillingDialog
  } = useBillingGeneration();
  
  // Local UI state
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTranscript, setSelectedTranscript] = useState(null);

  // PDF generation handlers
  const handleViewMultiple = async () => {
    const selected = getSelectedTranscriptObjects();
    await generateTranscriptsPDF(selected, true, fetchTranscriptDetails);
    // Keep selection after preview
  };

  const handlePrintAll = async () => {
    const selected = getSelectedTranscriptObjects();
    const success = await generateTranscriptsPDF(selected, false, fetchTranscriptDetails);
    if (success) {
      clearSelection();
    }
  };
  
  // Billing generation handler
  const onGenerateBilling = () => {
    const selectedIds = Array.from(selectedTranscripts);
    handleGenerateBilling(patientId, selectedIds);
  };

  // Menu handlers

  const handleMenuClick = (event, transcript) => {
    setAnchorEl(event.currentTarget);
    setSelectedTranscript(transcript);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTranscript(null);
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
                  label={`DOB: ${formatDateWithFallback(patient.date_of_birth)}`}
                  variant="outlined"
                />
                {patient.date_of_accident && (
                  <Chip
                    icon={<CalendarIcon />}
                    label={`DOA: ${formatDateWithFallback(patient.date_of_accident)}`}
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
            {hasSelection && (
              <>
                <Button
                  variant="outlined"
                  startIcon={generatingPreview ? <CircularProgress size={20} /> : <DescriptionIcon />}
                  onClick={handleViewMultiple}
                  disabled={generatingPreview}
                >
                  {generatingPreview ? UI_TEXT.GENERATING_PREVIEW : UI_TEXT.VIEW_SELECTED(selectedTranscripts.size)}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={generatingDownload ? <CircularProgress size={20} /> : <PrintIcon />}
                  onClick={handlePrintAll}
                  disabled={generatingDownload}
                >
                  {generatingDownload ? UI_TEXT.GENERATING_PDF : UI_TEXT.PRINT_SELECTED}
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={generatingBilling ? <CircularProgress size={20} /> : <ReceiptIcon />}
                  onClick={onGenerateBilling}
                  disabled={generatingBilling}
                >
                  {generatingBilling ? UI_TEXT.GENERATING_BILLING : UI_TEXT.GENERATE_BILLING}
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
                {UI_TEXT.NO_TRANSCRIPTS_TITLE}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {UI_TEXT.NO_TRANSCRIPTS_MESSAGE}
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
                    indeterminate={isPartiallySelected}
                    checked={isAllSelected}
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
              {[...transcripts].sort((a, b) => {
                // Sort by date in descending order (newest first, oldest at bottom)
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return dateB - dateA;
              }).map((transcript) => (
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
                        <Typography variant="body2">{formatDateWithFallback(transcript.date, transcript.id)}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {formatTimeWithTimezone(transcript.date, transcript.id)}
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
                  {UI_TEXT.BILLING_MAGIC_MESSAGE}
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
        onClose={closeBillingDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon />
          Medical Billing Summary
        </DialogTitle>
        <DialogContent dividers>
          {billingData && (
            <BillingStatement 
              billingData={billingData.billing_data}
              patientInfo={patient}
              doctorInfo={userSettings}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBillingDialog}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default PatientTranscriptList;