import React, { useState } from 'react';
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
  Tabs
} from '@mui/material';
import {
  Print as PrintIcon,
  Download as DownloadIcon,
  CalendarMonth as CalendarIcon,
  MedicalServices as MedicalIcon,
  Receipt as ReceiptIcon,
  Code as CodeIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import { generatePdfFromText } from './pdfUtils';
import { 
  CPT_DESCRIPTIONS, 
  CPT_FEES, 
  getCptFee,
  formatBillingDataAsText,
  formatBillingDataAsHtml 
} from '../utils/billingFormatter';

function BillingStatement({ billingData, patientInfo, doctorInfo, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  
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
  
  const billingLedger = parsedJson?.billing_data_ledger || [];

  // Calculate totals using user-specific fees if available
  const calculateServiceTotal = (cptCodes) => {
    return cptCodes.reduce((total, code) => {
      return total + getCptFee(code, doctorInfo?.cptFees);
    }, 0);
  };

  const grandTotal = billingLedger.reduce((total, service) => {
    return total + calculateServiceTotal(service.cpt_codes);
  }, 0);

  // Format date for display
  const formatServiceDate = (dateString) => {
    try {
      return format(new Date(dateString), 'MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Handle print/download
  const handleDownloadPDF = async () => {
    const billingText = formatBillingDataAsText(billingLedger, patientInfo, doctorInfo, doctorInfo?.cptFees);
    const fileName = `billing_${patientInfo?.last_name || 'patient'}_${patientInfo?.first_name || ''}_${new Date().toISOString().split('T')[0]}`;
    
    // Add clinic location header for consistency with your PDF system
    const locationHeader = doctorInfo?.clinicLocation 
      ? `CLINIC LOCATION:\n${doctorInfo.clinicLocation}\n\n---\n\n`
      : '';
    
    const fullContent = locationHeader + billingText;
    
    // Use existing PDF generation system
    await generatePdfFromText(
      fullContent,
      fileName,
      '', // Location already in content
      {
        doctorName: doctorInfo?.doctorName,
        doctorSignature: doctorInfo?.doctorSignature,
        clinicLogo: doctorInfo?.clinicLogo,
        includeLogoOnPdf: doctorInfo?.includeLogoOnPdf,
        useProfessionalFormat: true,
        usePagedFormat: true
      }
    );
  };

  return (
    <Box className="billing-statement" sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
          <Tab icon={<ReceiptIcon />} label="Billing Statement" />
          <Tab icon={<DescriptionIcon />} label="Compliance Report" />
          <Tab icon={<CodeIcon />} label="Raw Data" />
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
                <Typography variant="body2" color="text.secondary">
                  Patient ID: {patientInfo?.id || 'N/A'}
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
                        </TableRow>
                      ))}
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
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} align="right">
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

      {/* Tab 2: Raw Data */}
      {activeTab === 2 && (
        <Box>
          <Paper elevation={1} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Raw Billing Data
            </Typography>
            <Box sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}>
              {typeof billingData === 'string' ? billingData : JSON.stringify(billingData, null, 2)}
            </Box>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  if (billingData) {
                    navigator.clipboard.writeText(typeof billingData === 'string' ? billingData : JSON.stringify(billingData, null, 2));
                    alert('Billing data copied to clipboard!');
                  }
                }}
              >
                Copy to Clipboard
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default BillingStatement;