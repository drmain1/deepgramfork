import React from 'react';
import { Container, Typography, Paper, Box, Link, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
}));

const TermsOfService = () => {
  const effectiveDate = "January 1, 2025";
  const lastUpdated = "January 12, 2025";

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Terms of Service
        </Typography>
        
        <Typography variant="subtitle1" color="text.secondary" align="center" paragraph>
          Effective Date: {effectiveDate} | Last Updated: {lastUpdated}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ '& h2': { mt: 4, mb: 2 }, '& h3': { mt: 3, mb: 1 } }}>
          <Typography variant="h5" component="h2">
            1. Acceptance of Terms
          </Typography>
          <Typography paragraph>
            By accessing or using MedLegalDoc's medical transcription services ("Services") at scribe.medlegaldoc.com, 
            you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, 
            do not use our Services.
          </Typography>

          <Typography variant="h5" component="h2">
            2. Description of Services
          </Typography>
          <Typography paragraph>
            MedLegalDoc provides HIPAA-compliant medical transcription services, including:
          </Typography>
          <Typography paragraph>
            • Real-time audio transcription of medical encounters<br />
            • AI-assisted documentation generation<br />
            • Secure storage and retrieval of medical records<br />
            • Practice management tools for healthcare providers
          </Typography>

          <Typography variant="h5" component="h2">
            3. User Eligibility
          </Typography>
          <Typography paragraph>
            Our Services are available only to:
          </Typography>
          <Typography paragraph>
            • Licensed healthcare professionals<br />
            • Authorized medical staff<br />
            • Healthcare organizations with proper credentials<br />
            • Users who are 18 years of age or older
          </Typography>
          <Typography paragraph>
            By using our Services, you represent and warrant that you meet these eligibility requirements.
          </Typography>

          <Typography variant="h5" component="h2">
            4. Account Registration and Security
          </Typography>
          <Typography paragraph>
            To use our Services, you must:
          </Typography>
          <Typography paragraph>
            • Create an account with accurate and complete information<br />
            • Verify your email address<br />
            • Maintain the confidentiality of your login credentials<br />
            • Use strong passwords meeting our security requirements<br />
            • Enable multi-factor authentication when available<br />
            • Immediately notify us of any unauthorized access
          </Typography>
          <Typography paragraph>
            You are responsible for all activities that occur under your account.
          </Typography>

          <Typography variant="h5" component="h2">
            5. HIPAA Compliance and PHI
          </Typography>
          <Typography paragraph>
            <strong>Business Associate Agreement:</strong> By using our Services to process Protected Health Information (PHI), 
            you acknowledge that MedLegalDoc acts as a Business Associate under HIPAA. A separate Business Associate 
            Agreement (BAA) must be executed.
          </Typography>
          <Typography paragraph>
            <strong>Your Responsibilities:</strong> You agree to:
          </Typography>
          <Typography paragraph>
            • Use the Services only for lawful healthcare purposes<br />
            • Obtain necessary patient consents before recording<br />
            • Comply with all applicable HIPAA regulations<br />
            • Ensure minimum necessary access to PHI<br />
            • Report any suspected breaches immediately
          </Typography>

          <Typography variant="h5" component="h2">
            6. Acceptable Use Policy
          </Typography>
          <Typography paragraph>
            You agree NOT to:
          </Typography>
          <Typography paragraph>
            • Use the Services for any illegal or unauthorized purpose<br />
            • Violate any laws in your jurisdiction<br />
            • Transmit any malicious code or viruses<br />
            • Attempt to gain unauthorized access to our systems<br />
            • Interfere with or disrupt the Services<br />
            • Use the Services to harass, abuse, or harm others<br />
            • Reverse engineer or attempt to extract source code<br />
            • Resell or redistribute the Services without authorization
          </Typography>

          <Typography variant="h5" component="h2">
            7. Intellectual Property Rights
          </Typography>
          <Typography paragraph>
            <strong>Our Property:</strong> The Services, including all software, designs, and content (excluding user-generated content), 
            are owned by MedLegalDoc and protected by intellectual property laws.
          </Typography>
          <Typography paragraph>
            <strong>Your Content:</strong> You retain ownership of the medical records and content you create using our Services. 
            By using the Services, you grant us a limited license to process and store your content solely to provide the Services.
          </Typography>
          <Typography paragraph>
            <strong>AI-Generated Content:</strong> Content generated by our AI remains your property, but we make no warranties 
            about its accuracy. You are responsible for reviewing and verifying all AI-generated documentation.
          </Typography>

          <Typography variant="h5" component="h2">
            8. Payment Terms
          </Typography>
          <Typography paragraph>
            • Subscription fees are billed in advance on a monthly or annual basis<br />
            • All fees are non-refundable except as required by law<br />
            • We reserve the right to change pricing with 30 days' notice<br />
            • Failure to pay may result in suspension or termination of Services
          </Typography>

          <Typography variant="h5" component="h2">
            9. Data Retention and Deletion
          </Typography>
          <Typography paragraph>
            • We retain medical records according to legal requirements (typically 7 years)<br />
            • You may request deletion of your account, subject to legal retention obligations<br />
            • Upon termination, we will retain data as required by law and then securely delete it<br />
            • You are responsible for maintaining your own backups
          </Typography>

          <Typography variant="h5" component="h2">
            10. Disclaimers and Limitations
          </Typography>
          <Typography paragraph>
            <strong>AI Disclaimer:</strong> Our AI-assisted features are tools to aid documentation but do not replace 
            professional medical judgment. You are solely responsible for the accuracy and completeness of all medical records.
          </Typography>
          <Typography paragraph>
            <strong>Service Availability:</strong> While we strive for 99.9% uptime, we do not guarantee uninterrupted access 
            to the Services. We are not liable for any downtime or service interruptions.
          </Typography>
          <Typography paragraph>
            <strong>No Medical Advice:</strong> We do not provide medical advice, diagnosis, or treatment. Our Services are 
            documentation tools only.
          </Typography>

          <Typography variant="h5" component="h2">
            11. Limitation of Liability
          </Typography>
          <Typography paragraph>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, MEDLEGALDOC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
            CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, 
            OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
          </Typography>
          <Typography paragraph>
            Our total liability shall not exceed the amount you paid us in the twelve months preceding the claim.
          </Typography>

          <Typography variant="h5" component="h2">
            12. Indemnification
          </Typography>
          <Typography paragraph>
            You agree to indemnify and hold harmless MedLegalDoc, its officers, directors, employees, and agents from any 
            claims, damages, or expenses arising from:
          </Typography>
          <Typography paragraph>
            • Your use of the Services<br />
            • Your violation of these Terms<br />
            • Your violation of any rights of another party<br />
            • Your violation of any applicable laws or regulations
          </Typography>

          <Typography variant="h5" component="h2">
            13. Termination
          </Typography>
          <Typography paragraph>
            Either party may terminate these Terms:
          </Typography>
          <Typography paragraph>
            • By you: Cancel your subscription at any time<br />
            • By us: For violation of these Terms or non-payment<br />
            • Immediately upon written notice for material breach<br />
            • For convenience with 30 days' written notice
          </Typography>

          <Typography variant="h5" component="h2">
            14. Governing Law and Disputes
          </Typography>
          <Typography paragraph>
            These Terms are governed by the laws of [Your State], without regard to conflict of law principles. 
            Any disputes shall be resolved through binding arbitration in [Your City, State], except for claims 
            seeking injunctive relief.
          </Typography>

          <Typography variant="h5" component="h2">
            15. Changes to Terms
          </Typography>
          <Typography paragraph>
            We may modify these Terms at any time. We will notify you of material changes via email or through the Services. 
            Continued use after changes constitutes acceptance of the modified Terms.
          </Typography>

          <Typography variant="h5" component="h2">
            16. Severability
          </Typography>
          <Typography paragraph>
            If any provision of these Terms is found to be unenforceable, the remaining provisions shall continue in full 
            force and effect.
          </Typography>

          <Typography variant="h5" component="h2">
            17. Entire Agreement
          </Typography>
          <Typography paragraph>
            These Terms, together with our Privacy Policy and any applicable BAA, constitute the entire agreement between 
            you and MedLegalDoc regarding the use of our Services.
          </Typography>

          <Typography variant="h5" component="h2">
            18. Contact Information
          </Typography>
          <Typography paragraph>
            For questions about these Terms, please contact us at:
          </Typography>
          <Typography paragraph>
            MedLegalDoc Legal Department<br />
            Email: legal@medlegaldoc.com<br />
            Phone: 1-800-XXX-XXXX<br />
            Address: [Your Business Address]
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Typography variant="body2" color="text.secondary" align="center">
            By using MedLegalDoc, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </Typography>
        </Box>
      </StyledPaper>
    </Container>
  );
};

export default TermsOfService;