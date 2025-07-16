import React, { useState } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  Alert,
  Link,
  CircularProgress,
  Divider,
  Stack
} from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledPaper = styled(Paper)(({ theme }) => ({
  marginTop: theme.spacing(8),
  padding: theme.spacing(4),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  backgroundColor: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: theme.spacing(2),
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: '#666',
    },
    '&:hover fieldset': {
      borderColor: '#888',
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
  '& .MuiInputLabel-root': {
    color: '#999',
  },
  '& .MuiInputBase-input': {
    color: '#fff',
  },
}));

const FirebaseAuthenticator = () => {
  const { login, signup, resetPassword, checkEmailVerification, resendVerificationEmail, error: authError } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const checkAccountLockout = async (email) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/check-lockout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      if (data.is_locked) {
        throw new Error(data.message || 'Account is locked due to too many failed attempts');
      }
      return data;
    } catch (error) {
      console.error('Error checking lockout:', error);
      // Don't block login if lockout check fails
      return { is_locked: false };
    }
  };

  const recordFailedAttempt = async (email) => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/failed-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      if (data.is_locked) {
        throw new Error(data.message || 'Account is locked due to too many failed attempts');
      }
      if (data.remaining_attempts !== undefined) {
        throw new Error(`Invalid credentials. ${data.remaining_attempts} attempts remaining before account lockout.`);
      }
    } catch (error) {
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await resetPassword(email);
        setSuccess('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        // HIPAA-compliant password requirements
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
          throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
        }
        
        // Check for common passwords
        const commonPasswords = ['Password123!', 'Admin123!', 'Welcome123!'];
        if (commonPasswords.includes(password)) {
          throw new Error('Password is too common. Please choose a more secure password');
        }
        await signup(email, password, displayName);
        setSuccess('Account created! Please check your email to verify your account.');
        // Keep the form data in case user needs to log in
        setPassword('');
        setConfirmPassword('');
      } else {
        // Check if account is locked before attempting login
        const lockoutStatus = await checkAccountLockout(email);
        if (lockoutStatus.is_locked) {
          throw new Error(lockoutStatus.message);
        }
        
        try {
          await login(email, password);
          // After successful login, the auth state change will automatically
          // trigger a re-render and show the main app
        } catch (loginError) {
          // Record failed attempt if it's an auth error
          if (loginError.code === 'auth/wrong-password' || 
              loginError.code === 'auth/user-not-found' ||
              loginError.code === 'auth/invalid-credential') {
            await recordFailedAttempt(email);
          }
          throw loginError;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <Container component="main" maxWidth="xs">
      <StyledPaper elevation={6}>
        <Typography component="h1" variant="h4" sx={{ color: '#fff', mb: 3 }}>
          Medical Transcription
        </Typography>
        
        <Typography component="h2" variant="h6" sx={{ color: '#ccc', mb: 2 }}>
          {isForgotPassword ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
        </Typography>

        {(error || authError) && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error || authError}
            {(error || authError)?.includes('verify your email') && (
              <Box sx={{ mt: 1 }}>
                <Stack direction="row" spacing={2}>
                  <Button 
                    size="small" 
                    onClick={async () => {
                      try {
                        await resendVerificationEmail();
                        setSuccess('Verification email sent! Please check your inbox.');
                        setError('');
                      } catch (err) {
                        setError('Failed to send verification email.');
                      }
                    }}
                    sx={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Resend verification email
                  </Button>
                  <Button 
                    size="small" 
                    onClick={async () => {
                      try {
                        const verified = await checkEmailVerification();
                        if (verified) {
                          window.location.reload();
                        } else {
                          setError('Email not verified yet. Please check your inbox and click the verification link.');
                        }
                      } catch (err) {
                        setError('Failed to check verification status.');
                      }
                    }}
                    sx={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    I've verified my email
                  </Button>
                </Stack>
              </Box>
            )}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
            {success}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
          <Stack spacing={2}>
            {isSignUp && !isForgotPassword && (
              <StyledTextField
                fullWidth
                label="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
              />
            )}

            <StyledTextField
              fullWidth
              required
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />

            {!isForgotPassword && (
              <StyledTextField
                fullWidth
                required
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            )}

            {isSignUp && !isForgotPassword && (
              <>
                <StyledTextField
                  fullWidth
                  required
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Typography variant="caption" sx={{ color: '#999', mt: -1 }}>
                  Password must include: 8+ characters, uppercase, lowercase, number, and special character
                </Typography>
              </>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              sx={{ 
                mt: 2, 
                mb: 2,
                py: 1.5,
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
              }}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                isForgotPassword ? 'Send Reset Email' : isSignUp ? 'Sign Up' : 'Sign In'
              )}
            </Button>
          </Stack>

          <Divider sx={{ my: 2, borderColor: '#444' }} />

          <Stack spacing={1} alignItems="center">
            {!isForgotPassword && (
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={switchMode}
                sx={{ color: '#90caf9', textDecoration: 'none', cursor: 'pointer' }}
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </Link>
            )}

            {!isSignUp && (
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() => {
                  setIsForgotPassword(!isForgotPassword);
                  setError('');
                  setSuccess('');
                }}
                sx={{ color: '#90caf9', textDecoration: 'none', cursor: 'pointer' }}
              >
                {isForgotPassword ? 'Back to Sign In' : 'Forgot Password?'}
              </Link>
            )}
          </Stack>
        </Box>

        <Typography variant="caption" sx={{ color: '#666', mt: 3, textAlign: 'center' }}>
          HIPAA-compliant medical transcription service
        </Typography>
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: '#666' }}>
            By using this service, you agree to our{' '}
            <Link component={RouterLink} to="/terms" sx={{ color: '#90caf9' }}>
              Terms of Service
            </Link>
            {' and '}
            <Link component={RouterLink} to="/privacy" sx={{ color: '#90caf9' }}>
              Privacy Policy
            </Link>
          </Typography>
        </Box>
      </StyledPaper>
    </Container>
  );
};

export default FirebaseAuthenticator;