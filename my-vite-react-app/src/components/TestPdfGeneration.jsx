import React from 'react';
import { Button, Box, Typography } from '@mui/material';
import { generatePdfFromText } from './pdfUtils';

const TestPdfGeneration = () => {
  const testPdfGeneration = () => {
    // Sample medical transcript
    const sampleContent = `CHIEF COMPLAINT:
The patient presents with chronic low back pain radiating to the left leg.

HISTORY OF PRESENT ILLNESS:
The patient is a 45-year-old male who has been experiencing progressive low back pain for the past 6 months. The pain is described as sharp and radiates down the left leg to the knee. Pain is rated 7/10 on average, worsening with prolonged sitting or standing.

PAST MEDICAL HISTORY:
- Hypertension
- Type 2 Diabetes Mellitus
- Previous L4-L5 disc herniation (2019)

MEDICATIONS:
- Metformin 1000mg BID
- Lisinopril 10mg daily
- Ibuprofen 600mg PRN

PHYSICAL EXAMINATION:
General: Alert and oriented, in mild distress due to pain
Spine: Tenderness over L4-L5 region, limited flexion
Neurological: Positive straight leg raise on left at 45 degrees

ASSESSMENT:
1. Chronic low back pain with left-sided radiculopathy
2. Possible recurrent disc herniation at L4-L5

PLAN:
1. MRI lumbar spine to evaluate for disc pathology
2. Physical therapy 2x weekly for 6 weeks
3. Continue current pain management
4. Follow up in 4 weeks`;

    // Sample office location (multi-line format)
    const officeLocation = `Main Chiropractic
1118 N avalon Blvd #2 Wilmington CA 90744
310 701 9095
310 634 0443
Main@gmai.com`;

    // PDF options
    const pdfOptions = {
      doctorName: 'Dr. David Khan',
      includeLogoOnPdf: false,
      fontSize: 11,
      usePagedFormat: true
    };

    // Generate PDF
    generatePdfFromText(
      sampleContent,
      'test-medical-note.pdf',
      officeLocation,
      pdfOptions
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        PDF Generation Test
      </Typography>
      
      <Typography variant="body1" paragraph>
        Click the button below to generate a test PDF with office information in the header.
      </Typography>
      
      <Button 
        variant="contained" 
        color="primary" 
        onClick={testPdfGeneration}
      >
        Generate Test PDF
      </Button>
      
      <Typography variant="caption" display="block" sx={{ mt: 2 }}>
        This will create a PDF with:
        <ul>
          <li>Office name and address in the top right</li>
          <li>Professional medical note formatting</li>
          <li>Doctor's name at the bottom</li>
        </ul>
      </Typography>
    </Box>
  );
};

export default TestPdfGeneration;