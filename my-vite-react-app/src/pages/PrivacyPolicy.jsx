import React from 'react';
import { Container, Typography, Paper, Box, Link, Divider } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  marginTop: theme.spacing(3),
  marginBottom: theme.spacing(3),
  backgroundColor: 'rgba(255, 255, 255, 0.98)',
}));

const PrivacyPolicy = () => {
  const effectiveDate = "January 1, 2025";
  const lastUpdated = "January 12, 2025";

  return (
    <Container maxWidth="md">
      <StyledPaper elevation={3}>
        <Typography variant="h3" component="h1" gutterBottom align="center">
          Privacy Policy
        </Typography>
        
        <Typography variant="subtitle1" color="text.secondary" align="center" paragraph>
          Effective Date: {effectiveDate} | Last Updated: {lastUpdated}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ '& h2': { mt: 4, mb: 2 }, '& h3': { mt: 3, mb: 1 } }}>
          <Typography variant="h5" component="h2">
            1. Introduction
          </Typography>
          <Typography paragraph>
            MedLegalDoc ("we," "our," or "us") is committed to protecting the privacy and security of your personal information 
            and protected health information (PHI). This Privacy Policy explains how we collect, use, disclose, and safeguard 
            your information when you use our medical transcription service at scribe.medlegaldoc.com.
          </Typography>
          <Typography paragraph>
            We comply with the Health Insurance Portability and Accountability Act (HIPAA) and other applicable privacy laws 
            to ensure the confidentiality and security of your health information.
          </Typography>

          <Typography variant="h5" component="h2">
            2. Information We Collect
          </Typography>
          
          <Typography variant="h6" component="h3">
            Account Information
          </Typography>
          <Typography paragraph>
            • Name and contact information<br />
            • Email address<br />
            • Professional credentials<br />
            • Practice information
          </Typography>

          <Typography variant="h6" component="h3">
            Protected Health Information (PHI)
          </Typography>
          <Typography paragraph>
            • Patient demographics<br />
            • Medical history and diagnoses<br />
            • Treatment information<br />
            • Audio recordings of medical encounters<br />
            • Transcribed medical documentation
          </Typography>

          <Typography variant="h6" component="h3">
            Technical Information
          </Typography>
          <Typography paragraph>
            • IP addresses<br />
            • Browser type and version<br />
            • Device information<br />
            • Usage data and access logs
          </Typography>

          <Typography variant="h5" component="h2">
            3. How We Use Your Information
          </Typography>
          <Typography paragraph>
            We use your information solely for the following purposes:
          </Typography>
          <Typography paragraph>
            • Providing medical transcription services<br />
            • Creating and managing your account<br />
            • Ensuring the security and integrity of our services<br />
            • Complying with legal and regulatory requirements<br />
            • Improving our services and user experience<br />
            • Communicating with you about your account and services
          </Typography>

          <Typography variant="h5" component="h2">
            4. HIPAA Compliance
          </Typography>
          <Typography paragraph>
            As a business associate under HIPAA, we:
          </Typography>
          <Typography paragraph>
            • Implement administrative, physical, and technical safeguards to protect PHI<br />
            • Limit access to PHI to authorized personnel only<br />
            • Use encryption for data at rest and in transit<br />
            • Maintain audit logs of all PHI access<br />
            • Conduct regular security assessments<br />
            • Train our staff on HIPAA compliance<br />
            • Report any breaches as required by law
          </Typography>

          <Typography variant="h5" component="h2">
            5. Data Security
          </Typography>
          <Typography paragraph>
            We implement industry-standard security measures including:
          </Typography>
          <Typography paragraph>
            • 256-bit SSL/TLS encryption for all data transmissions<br />
            • AES-256 encryption for data at rest<br />
            • Multi-factor authentication options<br />
            • Regular security audits and penetration testing<br />
            • 24/7 monitoring for security threats<br />
            • Automated backups with point-in-time recovery<br />
            • Session timeouts and account lockout protections
          </Typography>

          <Typography variant="h5" component="h2">
            6. Data Sharing and Disclosure
          </Typography>
          <Typography paragraph>
            We do not sell, rent, or share your personal information or PHI with third parties except:
          </Typography>
          <Typography paragraph>
            • With your explicit consent<br />
            • As required by law or court order<br />
            • To authorized business associates who assist in providing our services<br />
            • In response to lawful requests by public authorities<br />
            • To protect our rights, privacy, safety, or property
          </Typography>

          <Typography variant="h5" component="h2">
            7. Data Retention
          </Typography>
          <Typography paragraph>
            We retain your information for as long as necessary to:
          </Typography>
          <Typography paragraph>
            • Provide our services<br />
            • Comply with legal obligations (typically 7 years for medical records)<br />
            • Resolve disputes and enforce agreements<br />
            • Meet audit and compliance requirements
          </Typography>

          <Typography variant="h5" component="h2">
            8. Your Rights
          </Typography>
          <Typography paragraph>
            Under HIPAA and applicable privacy laws, you have the right to:
          </Typography>
          <Typography paragraph>
            • Access your personal information and PHI<br />
            • Request corrections to your information<br />
            • Request restrictions on uses and disclosures<br />
            • Request confidential communications<br />
            • Receive an accounting of disclosures<br />
            • File a complaint if you believe your rights have been violated<br />
            • Request deletion of your account (subject to legal retention requirements)
          </Typography>

          <Typography variant="h5" component="h2">
            9. Children's Privacy
          </Typography>
          <Typography paragraph>
            Our services are intended for healthcare professionals and are not directed to children under 18. 
            We do not knowingly collect personal information from children.
          </Typography>

          <Typography variant="h5" component="h2">
            10. Changes to This Policy
          </Typography>
          <Typography paragraph>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by 
            posting the new policy on this page and updating the "Last Updated" date.
          </Typography>

          <Typography variant="h5" component="h2">
            11. Contact Information
          </Typography>
          <Typography paragraph>
            If you have questions about this Privacy Policy or our privacy practices, please contact us at:
          </Typography>
          <Typography paragraph>
            MedLegalDoc Privacy Officer<br />
            Email: privacy@medlegaldoc.com<br />
            Phone: 1-800-XXX-XXXX<br />
            Address: [Your Business Address]
          </Typography>

          <Typography variant="h5" component="h2">
            12. HIPAA Complaints
          </Typography>
          <Typography paragraph>
            If you believe your privacy rights have been violated, you may file a complaint with us or with the 
            Secretary of the Department of Health and Human Services. You will not be retaliated against for filing a complaint.
          </Typography>
          <Typography paragraph>
            Office for Civil Rights<br />
            U.S. Department of Health and Human Services<br />
            200 Independence Avenue, S.W.<br />
            Washington, D.C. 20201<br />
            Phone: 1-877-696-6775<br />
            Website: <Link href="https://www.hhs.gov/ocr" target="_blank" rel="noopener">www.hhs.gov/ocr</Link>
          </Typography>
        </Box>
      </StyledPaper>
    </Container>
  );
};

export default PrivacyPolicy;