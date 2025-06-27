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
  generatePdfFromText
} from './pdfUtils';
import { useUserSettings } from '../contexts/UserSettingsContext';

/**
 * Parses medical transcript content into structured sections
 * @param {string} content - The medical transcript content
 * @returns {object} - Parsed sections with headers and content
 */
const parseTranscriptSections = (content) => {
  if (!content || typeof content !== 'string') {
    return { sections: [], unstructuredContent: '' };
  }

  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let unstructuredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if line looks like a medical section header
    const sectionHeaderPatterns = [
      /^(CHIEF COMPLAINT|CC):\s*$/i,
      /^(HISTORY OF PRESENT ILLNESS|HPI):\s*$/i,
      /^(REVIEW OF SYSTEMS|ROS):\s*$/i,
      /^(PAST MEDICAL HISTORY|PMH):\s*$/i,
      /^(MEDICATIONS):\s*$/i,
      /^(ALLERGIES):\s*$/i,
      /^(SOCIAL HISTORY|SH):\s*$/i,
      /^(FAMILY HISTORY|FH):\s*$/i,
      /^(PHYSICAL EXAMINATION|EXAM):\s*$/i,
      /^(ASSESSMENT|IMPRESSION):\s*$/i,
      /^(PLAN|TREATMENT PLAN):\s*$/i,
      /^(PATIENT INFORMATION|PATIENT DETAILS):\s*$/i,
      /^(DATE OF BIRTH|DOB):\s*$/i,
      /^(DATE OF ACCIDENT):\s*$/i,
      /^(DATE OF CONSULTATION):\s*$/i,
      /^[A-Z\s]+:\s*$/
    ];

    const isHeader = sectionHeaderPatterns.some(pattern => pattern.test(line));
    
    if (isHeader) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start new section
      currentSection = {
        header: line.replace(':', '').trim(),
        content: []
      };
    } else if (currentSection) {
      // Add to current section
      if (line) {
        currentSection.content.push(line);
      }
    } else {
      // Add to unstructured content
      if (line) {
        unstructuredLines.push(line);
      }
    }
  }

  // Add last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return {
    sections,
    unstructuredContent: unstructuredLines.join('\n')
  };
};

/**
 * Formats section content with proper medical formatting
 * @param {string} content - Raw section content
 * @returns {string} - Formatted HTML content
 */
const formatSectionContent = (content) => {
  if (!content) return '';
  
  // Simple HTML escaping and paragraph formatting
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  
  // Convert line breaks to HTML
  return escaped.split('\n').map(line => 
    line.trim() ? `<p style="margin: 5px 0;">${line}</p>` : ''
  ).join('');
};

/**
 * Creates a professional medical document HTML template
 * @param {string} content - The medical transcript content
 * @param {object} metadata - Document metadata (location, doctor info, etc.)
 * @param {object} options - Styling options
 * @returns {string} - HTML template for PDF generation
 */
const createMedicalDocumentTemplate = (content, metadata = {}, options = {}) => {
  const {
    location = '',
    doctorName = '',
    doctorSignature = '',
    isSigned = false,
    patientName = '',
    dateOfBirth = '',
    dateOfAccident = '',
    dateOfConsultation = '',
    phoneNumber = '',
    clinicLogo = '',
    includeLogoOnPdf = false
  } = metadata;

  const {
    fontSize = 11,
    headerFontSize = 14,
    lineHeight = 1.4,
    marginTop = 20,
    marginBottom = 20,
    marginLeft = 25,
    marginRight = 25
  } = options;

  // Parse the content into sections
  const { sections, unstructuredContent } = parseTranscriptSections(content);

  // Header section with logo on left and location on right using table layout
  let headerHTML = '';
  if ((includeLogoOnPdf && clinicLogo) || location) {
    headerHTML += `
      <table style="
        width: 100%;
        margin-bottom: 20px;
        border-collapse: collapse;
        margin-top: -10px;
      ">
        <tr>
          <td style="
            width: 50%;
            vertical-align: top;
            padding: 0;
            padding-left: 0;
          ">
    `;
    
    // Logo on the left
    if (includeLogoOnPdf && clinicLogo) {
      headerHTML += `
        <img src="${clinicLogo}" alt="Clinic Logo" style="
          max-width: 180px;
          max-height: 180px;
          object-fit: contain;
          display: block;
        " />
      `;
    }
    
    headerHTML += `
          </td>
          <td style="
            width: 50%;
            vertical-align: top;
            text-align: right;
            padding: 0;
          ">
    `;
    
    // Location on the right - Professional formatting
    if (location) {
      const locationLines = location.split('\n').filter(line => line.trim());
      headerHTML += `
        <div style="
          text-align: right;
          color: #000;
          line-height: 1.4;
        ">
      `;
      
      locationLines.forEach((line, index) => {
        if (index === 0) {
          // Office name - bold and larger
          headerHTML += `
            <div style="
              font-size: ${headerFontSize}px;
              font-weight: bold;
              margin-bottom: 4px;
            ">${line.trim()}</div>
          `;
        } else {
          // Address lines - normal weight
          headerHTML += `
            <div style="
              font-size: ${headerFontSize - 2}px;
              font-weight: normal;
            ">${line.trim()}</div>
          `;
        }
      });
      
      headerHTML += `</div>`;
    }
    
    headerHTML += `
          </td>
        </tr>
      </table>
      <div style="
        border-bottom: 2px solid #2c3e50;
        margin-bottom: 20px;
      "></div>
    `;
  }

  // Patient information header (if available)
  let patientInfoHTML = '';
  if (patientName || dateOfBirth || phoneNumber) {
    patientInfoHTML = `
      <div style="
        background: #f8f9fa;
        padding: 15px;
        margin-bottom: 20px;
        border-left: 4px solid #3498db;
        border-radius: 0 5px 5px 0;
      ">
        <h3 style="
          margin: 0 0 10px 0;
          color: #2c3e50;
          font-size: ${fontSize + 2}px;
          font-weight: 600;
        ">PATIENT INFORMATION</h3>
        ${patientName ? `<p style="margin: 5px 0;"><strong>Name:</strong> ${patientName}</p>` : ''}
        ${dateOfBirth ? `<p style="margin: 5px 0;"><strong>Date of Birth:</strong> ${dateOfBirth}</p>` : ''}
        ${dateOfAccident ? `<p style="margin: 5px 0;"><strong>Date of Accident:</strong> ${dateOfAccident}</p>` : ''}
        ${dateOfConsultation ? `<p style="margin: 5px 0;"><strong>Date of Consultation:</strong> ${dateOfConsultation}</p>` : ''}
        ${phoneNumber ? `<p style="margin: 5px 0;"><strong>Phone:</strong> ${phoneNumber}</p>` : ''}
      </div>
    `;
  }

  // Generate sections HTML
  let sectionsHTML = '';
  sections.forEach((section, index) => {
    const sectionContent = section.content.join('\n').trim();
    if (sectionContent) {
      sectionsHTML += `
        <div style="margin-bottom: 25px;">
          <h3 style="
            color: #2c3e50;
            font-size: ${fontSize + 1}px;
            font-weight: 600;
            margin: 0 0 10px 0;
            padding-bottom: 5px;
            border-bottom: 1px solid #bdc3c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${section.header}</h3>
          <div style="
            padding-left: 10px;
            line-height: ${lineHeight};
            color: #34495e;
          ">
            ${formatSectionContent(sectionContent)}
          </div>
        </div>
      `;
    }
  });

  // Add unstructured content if any
  if (unstructuredContent.trim()) {
    sectionsHTML += `
      <div style="margin-bottom: 25px;">
        <h3 style="
          color: #2c3e50;
          font-size: ${fontSize + 1}px;
          font-weight: 600;
          margin: 0 0 10px 0;
          padding-bottom: 5px;
          border-bottom: 1px solid #bdc3c7;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">ADDITIONAL NOTES</h3>
        <div style="
          padding-left: 10px;
          line-height: ${lineHeight};
          color: #34495e;
        ">
          ${formatSectionContent(unstructuredContent)}
        </div>
      </div>
    `;
  }

  // Signature section
  let signatureHTML = '';
  if (isSigned && doctorName) {
    signatureHTML = `
      <div style="
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #bdc3c7;
      ">
        ${doctorSignature ? `
          <div style="margin-bottom: 15px;">
            <img src="${doctorSignature}" alt="Doctor's signature" style="
              max-width: 200px;
              max-height: 80px;
              display: block;
            " />
          </div>
        ` : ''}
        <div style="
          font-weight: 600;
          font-size: ${fontSize}px;
          margin-bottom: 5px;
          color: #2c3e50;
        ">${doctorName}</div>
        <div style="
          font-size: ${fontSize - 1}px;
          color: #7f8c8d;
          font-style: italic;
        ">Electronically signed on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page {
          margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: ${fontSize}px;
          line-height: ${lineHeight};
          color: #2c3e50;
          margin: 0;
          padding: 0;
          background: white;
        }
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        ul, ol {
          padding-left: 20px;
        }
        li {
          margin-bottom: 5px;
        }
        .page-break {
          page-break-before: always;
        }
      </style>
    </head>
    <body>
      ${headerHTML}
      ${patientInfoHTML}
      ${sectionsHTML}
      ${signatureHTML}
    </body>
    </html>
  `;
};

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
      
      await generatePdfFromText(content, fileName, location, metadata);
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