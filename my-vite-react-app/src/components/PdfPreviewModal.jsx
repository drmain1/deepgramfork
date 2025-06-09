import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Switch,
  TextField,
  Divider,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import { Download, Visibility, Close } from '@mui/icons-material';
import { 
  generateProfessionalMedicalPdf, 
  parseTranscriptSections,
  createMedicalDocumentTemplate 
} from './pdfUtils';
import { useUserSettings } from '../contexts/UserSettingsContext';

function PdfPreviewModal({ 
  open, 
  onClose, 
  content, 
  location = '', 
  recordingId = '',
  doctorName = '',
  doctorSignature = '',
  isSigned = false 
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [options, setOptions] = useState({
    patientName: '',
    dateOfBirth: '',
    dateOfAccident: '',
    dateOfConsultation: new Date().toLocaleDateString(),
    phoneNumber: '',
    fontSize: 11,
    headerFontSize: 14,
    lineHeight: 1.4,
    useProfessionalFormat: true
  });
  const [parsedSections, setParsedSections] = useState({ sections: [], unstructuredContent: '' });
  
  // Get user settings for logo
  const { userSettings } = useUserSettings();

  // Parse content when it changes
  useEffect(() => {
    if (content) {
      const parsed = parseTranscriptSections(content);
      setParsedSections(parsed);
    }
  }, [content]);

  // Generate preview HTML when options or content change
  useEffect(() => {
    if (content && open) {
      const metadata = {
        location,
        doctorName,
        doctorSignature,
        isSigned,
        clinicLogo: userSettings.clinicLogo,
        includeLogoOnPdf: userSettings.includeLogoOnPdf,
        ...options
      };
      
      const htmlTemplate = createMedicalDocumentTemplate(content, metadata, options);
      setPreviewHtml(htmlTemplate);
    }
  }, [content, options, location, doctorName, doctorSignature, isSigned, open, userSettings.clinicLogo, userSettings.includeLogoOnPdf]);

  const handleOptionChange = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGeneratePdf = async () => {
    if (!content) return;

    setIsGenerating(true);
    try {
      const metadata = {
        location,
        doctorName,
        doctorSignature,
        isSigned,
        clinicLogo: userSettings.clinicLogo,
        includeLogoOnPdf: userSettings.includeLogoOnPdf,
        ...options
      };

      const fileName = `medical-note-${recordingId || 'current'}-${new Date().toISOString().split('T')[0]}.pdf`;
      
      await generateProfessionalMedicalPdf(content, fileName, location, metadata);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!content) {
    return null;
  }

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh', maxHeight: '90vh' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" component="div">
            Professional Medical PDF Generator
          </Typography>
          <Button
            onClick={onClose}
            size="small"
            startIcon={<Close />}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', gap: 2, p: 2 }}>
        {/* Options Panel */}
        <Paper sx={{ width: '300px', p: 2, flexShrink: 0, overflowY: 'auto' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Document Options
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Patient Information
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            label="Patient Name"
            value={options.patientName}
            onChange={handleOptionChange('patientName')}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Date of Birth"
            type="date"
            value={options.dateOfBirth}
            onChange={handleOptionChange('dateOfBirth')}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Date of Accident"
            type="date"
            value={options.dateOfAccident}
            onChange={handleOptionChange('dateOfAccident')}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Date of Consultation"
            type="date"
            value={options.dateOfConsultation}
            onChange={handleOptionChange('dateOfConsultation')}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Phone Number"
            value={options.phoneNumber}
            onChange={handleOptionChange('phoneNumber')}
            sx={{ mb: 2 }}
          />
          
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Formatting Options
          </Typography>
          
          <TextField
            fullWidth
            size="small"
            label="Font Size"
            type="number"
            value={options.fontSize}
            onChange={handleOptionChange('fontSize')}
            inputProps={{ min: 8, max: 16, step: 1 }}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Header Font Size"
            type="number"
            value={options.headerFontSize}
            onChange={handleOptionChange('headerFontSize')}
            inputProps={{ min: 10, max: 20, step: 1 }}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            size="small"
            label="Line Height"
            type="number"
            value={options.lineHeight}
            onChange={handleOptionChange('lineHeight')}
            inputProps={{ min: 1.0, max: 2.0, step: 0.1 }}
            sx={{ mb: 2 }}
          />
          
          {/* Document Sections Summary */}
          <Divider sx={{ my: 2 }} />
          
          <Typography variant="subtitle2" gutterBottom>
            Document Structure
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{parsedSections.sections.length}</strong> sections detected:
            </Typography>
            {parsedSections.sections.map((section, index) => (
              <Typography key={index} variant="body2" sx={{ fontSize: '0.8rem', ml: 1 }}>
                • {section.header}
              </Typography>
            ))}
            {parsedSections.unstructuredContent && (
              <Typography variant="body2" sx={{ fontSize: '0.8rem', ml: 1 }}>
                • Additional Notes
              </Typography>
            )}
          </Alert>
        </Paper>
        
        {/* Preview Panel */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            Document Preview
          </Typography>
          
          <Paper 
            sx={{ 
              flexGrow: 1, 
              p: 2, 
              overflowY: 'auto',
              bgcolor: '#f5f5f5',
              border: '1px solid #ddd'
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: '794px',
                margin: '0 auto',
                backgroundColor: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                minHeight: '1123px'
              }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </Paper>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          Professional formatting automatically structures your medical notes
        </Typography>
        
        <Button
          onClick={onClose}
          variant="outlined"
        >
          Cancel
        </Button>
        
        <Button
          onClick={handleGeneratePdf}
          variant="contained"
          startIcon={isGenerating ? <CircularProgress size={16} /> : <Download />}
          disabled={isGenerating || !content}
        >
          {isGenerating ? 'Generating...' : 'Download PDF'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PdfPreviewModal; 