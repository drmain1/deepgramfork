import React, { useState } from 'react';
import { Button, Box, Typography, Paper } from '@mui/material';
import PdfPreviewModal from './PdfPreviewModal';

function PdfTestComponent() {
  const [showModal, setShowModal] = useState(false);

  // Sample medical transcript based on your screenshots
  const sampleTranscript = `PATIENT INFORMATION:

Patient Name: David Main
Date of Birth: 08/02/1983
Date of Accident: 08/01/2024
Date of Consultation: 08/09/2024

CHIEF COMPLAINT:

Neck pain with radiation down the right arm
Upper thoracic pain
Low back pain with tenderness at L3-L4 levels
Right shoulder pain
Bilateral elbow joint tenderness
Right knee pain with medial epicondyle tenderness

HISTORY OF PRESENT ILLNESS:

The patient presents following a motor vehicle versus pedestrian accident that occurred on 08/01/2024. While crossing the street, the patient was struck by a vehicle on the right shoulder and subsequently fell to the ground. He immediately experienced pain in the neck and upper thoracic region. Later that same day, the pain began radiating down his arm. The patient sought treatment at an urgent care facility where he received a neck X-ray and medications. Despite initial treatment, after approximately three days the pain significantly worsened. Since the accident, the patient has also experienced intermittent blurry vision, insomnia, and difficulty with reading and focusing. The patient reports that his pain interferes with his ability to perform his job duties as a truck driver.

PAST MEDICAL HISTORY:

The patient has a history of diabetes mellitus. He sustained a work-related compensated injury to his low back in 1994, which was successfully treated with chiropractic care. Currently, he is taking medication for diabetes mellitus approximately three years ago.

FAMILY HISTORY:

No significant family history of medical conditions.

ALLERGIES:

No known drug allergies.

SOCIAL HISTORY:

The patient works as a truck driver and reports that his current injuries affect his ability to perform his job duties. He is a nonsmoker. Marital status was not disclosed.

REVIEW OF OTHER SYSTEMS:

The patient reports intermittent blurry vision, insomnia, and difficulty with reading and focusing since the motor vehicle accident.

DUTIES UNDER DURESS / Complicating Factors:

The patient's occupation as a truck driver is significantly impacted and his job duties are occupational and physical limitations.

PHYSICAL EXAMINATION:

The patient appeared in mild distress and was cooperative throughout the examination. Neck and mid and low back pain with tenderness. Right shoulder pain. Bilateral elbow joint tenderness. Right knee pain with medial epicondyle tenderness and low back pain with tenderness at L3-L4 levels.`;

  const sampleLocation = `ABC Pain Management

634 West E Street

Painville, CA

310-522-5811
310-634-0443`;

  const sampleDoctorName = "Dr. Sarah Johnson, MD";

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Professional Medical PDF Generator Test
      </Typography>
      
      <Typography variant="body1" paragraph>
        This component demonstrates the enhanced PDF generation that creates professional 
        medical documents similar to Claude Console's output.
      </Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Typography variant="h6" gutterBottom>
          Features:
        </Typography>
        <ul>
          <li>Automatic section parsing and formatting</li>
          <li>Professional medical document layout</li>
          <li>Header with clinic information</li>
          <li>Patient information box</li>
          <li>Structured medical sections with proper styling</li>
          <li>Numbered lists and bullet points</li>
          <li>Electronic signature support</li>
          <li>Customizable formatting options</li>
        </ul>
      </Paper>

      <Button
        variant="contained"
        color="primary"
        onClick={() => setShowModal(true)}
        size="large"
      >
        Test Professional PDF Generator
      </Button>

      <PdfPreviewModal
        open={showModal}
        onClose={() => setShowModal(false)}
        content={sampleTranscript}
        location={sampleLocation}
        recordingId="test-001"
        doctorName={sampleDoctorName}
        isSigned={false}
      />
    </Box>
  );
}

export default PdfTestComponent; 