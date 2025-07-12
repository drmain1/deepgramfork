import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Box,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { useAuth } from '../contexts/FirebaseAuthContext';
import QRCode from 'qrcode';

const MFASetup = ({ open, onClose }) => {
  const { currentUser } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);

  const steps = ['Choose MFA Method', 'Verify Phone Number', 'Confirm Setup'];

  useEffect(() => {
    // Check if MFA is already enabled
    if (currentUser) {
      const multiFactorUser = multiFactor(currentUser);
      setMfaEnabled(multiFactorUser.enrolledFactors.length > 0);
    }

    // Initialize reCAPTCHA
    if (!recaptchaVerifier && window.RecaptchaVerifier) {
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved
        }
      });
      setRecaptchaVerifier(verifier);
    }

    return () => {
      if (recaptchaVerifier) {
        recaptchaVerifier.clear();
      }
    };
  }, [currentUser, recaptchaVerifier]);

  const handleSendVerification = async () => {
    setError('');
    setLoading(true);

    try {
      if (!phoneNumber) {
        throw new Error('Please enter a phone number');
      }

      // Format phone number (ensure it starts with +1 for US)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;

      const multiFactorUser = multiFactor(currentUser);
      const session = await multiFactorUser.getSession();

      const phoneAuthProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneAuthProvider.verifyPhoneNumber(
        {
          phoneNumber: formattedPhone,
          session
        },
        recaptchaVerifier
      );

      setVerificationId(verificationId);
      setActiveStep(1);
      setSuccess('Verification code sent to your phone!');
    } catch (err) {
      console.error('MFA setup error:', err);
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setError('');
    setLoading(true);

    try {
      if (!verificationCode || verificationCode.length !== 6) {
        throw new Error('Please enter a 6-digit verification code');
      }

      const cred = PhoneAuthProvider.credential(verificationId, verificationCode);
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

      const multiFactorUser = multiFactor(currentUser);
      await multiFactorUser.enroll(multiFactorAssertion, 'Primary Phone');

      setActiveStep(2);
      setMfaEnabled(true);
      setSuccess('Multi-factor authentication enabled successfully!');
    } catch (err) {
      console.error('MFA verification error:', err);
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    setError('');
    setLoading(true);

    try {
      const multiFactorUser = multiFactor(currentUser);
      const factors = multiFactorUser.enrolledFactors;
      
      // Unenroll all factors
      for (const factor of factors) {
        await multiFactorUser.unenroll(factor);
      }

      setMfaEnabled(false);
      setSuccess('Multi-factor authentication disabled');
      setActiveStep(0);
    } catch (err) {
      console.error('MFA disable error:', err);
      setError(err.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    setPhoneNumber('');
    setVerificationCode('');
    setVerificationId('');
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {mfaEnabled ? 'Multi-Factor Authentication Settings' : 'Set Up Multi-Factor Authentication'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {/* Hidden reCAPTCHA container */}
          <div id="recaptcha-container"></div>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          {mfaEnabled && activeStep === 0 ? (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Multi-factor authentication is currently enabled for your account.
              </Alert>
              <Typography variant="body2" color="text.secondary" paragraph>
                Your account is protected with an additional layer of security. 
                You'll need to verify your identity with your phone when signing in.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                onClick={handleDisableMFA}
                disabled={loading}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : 'Disable MFA'}
              </Button>
            </Box>
          ) : (
            <>
              <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
                {steps.map((label) => (
                  <Step key={label}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {activeStep === 0 && (
                <Box>
                  <Typography variant="body1" paragraph>
                    Enhance your account security by enabling multi-factor authentication.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    For HIPAA compliance, we strongly recommend enabling MFA to protect patient data.
                  </Typography>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="+1 (555) 123-4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    helperText="Enter your phone number to receive verification codes"
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendVerification}
                    disabled={loading || !phoneNumber}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={24} /> : 'Send Verification Code'}
                  </Button>
                </Box>
              )}

              {activeStep === 1 && (
                <Box>
                  <Typography variant="body1" paragraph>
                    Enter the 6-digit verification code sent to {phoneNumber}
                  </Typography>
                  <TextField
                    fullWidth
                    label="Verification Code"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    inputProps={{ maxLength: 6 }}
                    sx={{ mb: 2 }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleVerifyCode}
                    disabled={loading || verificationCode.length !== 6}
                    fullWidth
                  >
                    {loading ? <CircularProgress size={24} /> : 'Verify and Enable MFA'}
                  </Button>
                </Box>
              )}

              {activeStep === 2 && (
                <Box>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    Multi-factor authentication has been successfully enabled!
                  </Alert>
                  <Typography variant="body2" color="text.secondary">
                    Your account now has an additional layer of security. You'll be prompted to 
                    enter a verification code from your phone when signing in.
                  </Typography>
                </Box>
              )}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>
          {activeStep === 2 || (mfaEnabled && activeStep === 0) ? 'Done' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MFASetup;