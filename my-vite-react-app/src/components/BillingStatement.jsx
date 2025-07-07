import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
  Button,
  Grid,
  Card,
  CardContent,
  Tab,
  Tabs,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  Alert
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  CalendarMonth as CalendarIcon,
  MedicalServices as MedicalIcon,
  Receipt as ReceiptIcon,
  Code as CodeIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
// Removed: import { generatePdfFromText } from './pdfUtils'; - now using server-side PDF generation
import { 
  CPT_DESCRIPTIONS, 
  CPT_FEES, 
  getCptFee,
  formatBillingDataAsText,
  formatBillingDataAsHtml 
} from '../utils/billingFormatter';
import MedicalBillingPDF from './billingPdfGenerator';
// Removed: html2canvas and jsPDF imports - now using server-side PDF generation

function BillingStatement({ billingData, patientInfo, doctorInfo, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [editableBillingLedger, setEditableBillingLedger] = useState([]);
  const [addCptDialog, setAddCptDialog] = useState({ open: false, serviceIndex: -1 });
  const [addIcdDialog, setAddIcdDialog] = useState({ open: false, serviceIndex: -1 });
  const [newCptCode, setNewCptCode] = useState('');
  const [newIcdCode, setNewIcdCode] = useState({ code: '', description: '' });
  const [error, setError] = useState('');
  
  // Extract JSON from the billing data string
  let parsedJson = null;
  let complianceReport = '';
  
  if (typeof billingData === 'string') {
    // Find the JSON object in the billing data
    const jsonMatch = billingData.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        parsedJson = JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse billing JSON:', e);
      }
    }
    
    // Extract compliance report (everything before the JSON)
    const jsonStartIndex = billingData.indexOf('```json');
    if (jsonStartIndex > -1) {
      complianceReport = billingData.substring(0, jsonStartIndex).trim();
    } else {
      complianceReport = billingData;
    }
  } else if (typeof billingData === 'object') {
    parsedJson = billingData;
  }
  
  // Initialize editable state
  useEffect(() => {
    const initialLedger = parsedJson?.billing_data_ledger || [];
    setEditableBillingLedger(JSON.parse(JSON.stringify(initialLedger))); // Deep copy
  }, [billingData]);
  
  const billingLedger = editableBillingLedger;

  // Calculate totals using user-specific fees if available
  const calculateServiceTotal = (cptCodes) => {
    return cptCodes.reduce((total, code) => {
      return total + getCptFee(code, doctorInfo?.cptFees);
    }, 0);
  };

  const grandTotal = billingLedger.reduce((total, service) => {
    return total + calculateServiceTotal(service.cpt_codes);
  }, 0);

  // Handler functions for editing codes
  const removeCptCode = (serviceIndex, codeIndex) => {
    const updatedLedger = [...editableBillingLedger];
    updatedLedger[serviceIndex].cpt_codes.splice(codeIndex, 1);
    setEditableBillingLedger(updatedLedger);
  };

  const removeIcdCode = (serviceIndex, codeIndex) => {
    const updatedLedger = [...editableBillingLedger];
    updatedLedger[serviceIndex].icd10_codes.splice(codeIndex, 1);
    setEditableBillingLedger(updatedLedger);
  };

  const addCptCode = () => {
    if (!newCptCode || !CPT_DESCRIPTIONS[newCptCode]) {
      setError('Please select a valid CPT code');
      return;
    }
    
    const updatedLedger = [...editableBillingLedger];
    updatedLedger[addCptDialog.serviceIndex].cpt_codes.push(newCptCode);
    setEditableBillingLedger(updatedLedger);
    
    setAddCptDialog({ open: false, serviceIndex: -1 });
    setNewCptCode('');
    setError('');
  };

  const addIcdCode = () => {
    if (!newIcdCode.code || !newIcdCode.description) {
      setError('Please enter both ICD-10 code and description');
      return;
    }
    
    const updatedLedger = [...editableBillingLedger];
    updatedLedger[addIcdDialog.serviceIndex].icd10_codes.push({
      code: newIcdCode.code,
      description: newIcdCode.description
    });
    setEditableBillingLedger(updatedLedger);
    
    setAddIcdDialog({ open: false, serviceIndex: -1 });
    setNewIcdCode({ code: '', description: '' });
    setError('');
  };

  // Format date for display
  const formatServiceDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Handle print/download with new professional billing PDF
  const handleDownloadPDF = async () => {
    try {
      const billingPdfGenerator = new MedicalBillingPDF();
      await billingPdfGenerator.generateBillingPDF(
        editableBillingLedger,
        patientInfo,
        doctorInfo,
        {
          fileName: `billing_${patientInfo?.last_name || 'patient'}_${patientInfo?.first_name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
        }
      );
    } catch (error) {
      console.error('Error generating billing PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  return (
    <Box className="billing-statement" sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<ReceiptIcon />} label="Billing Statement" />
          <Tab icon={<DescriptionIcon />} label="Compliance Report" />
        </Tabs>
      </Box>

      {/* Tab 0: Formatted Billing Statement */}
      {activeTab === 0 && (
        <Box>
          {/* Header */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2} justifyContent="space-between">
              <Grid item xs={12} md={6}>
                <Typography variant="h4" gutterBottom>
                  Medical Billing Statement
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  {doctorInfo?.doctorName || 'Healthcare Provider'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {doctorInfo?.clinicName}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6} sx={{ textAlign: { md: 'right' } }}>
                <Typography variant="h6">
                  {patientInfo?.first_name} {patientInfo?.last_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  DOB: {patientInfo?.date_of_birth ? formatServiceDate(patientInfo.date_of_birth) : 'N/A'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

      {/* Services by Date */}
      {billingLedger.map((service, index) => (
        <Card key={index} sx={{ mb: 3 }} elevation={1}>
          <CardContent>
            {/* Date Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CalendarIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">
                Service Date: {formatServiceDate(service.date_of_service)}
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {/* Diagnoses Section */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <MedicalIcon sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Diagnoses
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ICD-10 Code</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {service.icd10_codes.map((diagnosis, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Chip 
                              label={diagnosis.code} 
                              size="small" 
                              variant="outlined" 
                              color="primary"
                            />
                          </TableCell>
                          <TableCell>{diagnosis.description}</TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeIcdCode(index, idx)}
                              title="Remove diagnosis"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setAddIcdDialog({ open: true, serviceIndex: index })}
                          >
                            Add Diagnosis
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Services Section */}
              <Grid item xs={12} md={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ReceiptIcon sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Services Rendered
                  </Typography>
                </Box>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>CPT Code</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Fee</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {service.cpt_codes.map((code, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Chip 
                              label={code} 
                              size="small" 
                              color="secondary"
                            />
                          </TableCell>
                          <TableCell>
                            {CPT_DESCRIPTIONS[code] || 'Service'}
                          </TableCell>
                          <TableCell align="right">
                            ${getCptFee(code, doctorInfo?.cptFees).toFixed(2)}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeCptCode(index, idx)}
                              title="Remove service"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setAddCptDialog({ open: true, serviceIndex: index })}
                          >
                            Add Service
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={3} align="right">
                          <Typography fontWeight="bold">
                            Date Total:
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            ${calculateServiceTotal(service.cpt_codes).toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ))}

      {/* Grand Total */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <Typography variant="h6">
              Total Services: {billingLedger.reduce((count, service) => 
                count + service.cpt_codes.length, 0
              )}
            </Typography>
          </Grid>
          <Grid item>
            <Typography variant="h5" color="primary">
              Grand Total: ${grandTotal.toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadPDF}
            >
              Download PDF
            </Button>
          </Box>
        </Box>
      )}

      {/* Tab 1: Compliance Report */}
      {activeTab === 1 && (
        <Box>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Compliance & Recommendations Report
            </Typography>
            <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {complianceReport || 'No compliance report available.'}
            </Box>
          </Paper>
        </Box>
      )}

      {/* Dialog for adding CPT codes */}
      <Dialog 
        open={addCptDialog.open} 
        onClose={() => {
          setAddCptDialog({ open: false, serviceIndex: -1 });
          setNewCptCode('');
          setError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add CPT Code</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Autocomplete
            options={Object.keys(CPT_DESCRIPTIONS)}
            getOptionLabel={(option) => `${option} - ${CPT_DESCRIPTIONS[option]}`}
            value={newCptCode}
            onChange={(event, newValue) => setNewCptCode(newValue || '')}
            renderInput={(params) => (
              <TextField {...params} label="Select CPT Code" variant="outlined" fullWidth />
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddCptDialog({ open: false, serviceIndex: -1 });
            setNewCptCode('');
            setError('');
          }}>
            Cancel
          </Button>
          <Button onClick={addCptCode} variant="contained">
            Add Code
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for adding ICD-10 codes */}
      <Dialog 
        open={addIcdDialog.open} 
        onClose={() => {
          setAddIcdDialog({ open: false, serviceIndex: -1 });
          setNewIcdCode({ code: '', description: '' });
          setError('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add ICD-10 Code</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="ICD-10 Code"
            value={newIcdCode.code}
            onChange={(e) => setNewIcdCode({ ...newIcdCode, code: e.target.value })}
            fullWidth
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="Description"
            value={newIcdCode.description}
            onChange={(e) => setNewIcdCode({ ...newIcdCode, description: e.target.value })}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddIcdDialog({ open: false, serviceIndex: -1 });
            setNewIcdCode({ code: '', description: '' });
            setError('');
          }}>
            Cancel
          </Button>
          <Button onClick={addIcdCode} variant="contained">
            Add Diagnosis
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}

export default BillingStatement;