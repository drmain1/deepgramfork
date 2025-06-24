import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { Box, Container, Typography, CircularProgress, Alert, Button } from '@mui/material';

const EmailActionHandler = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleAction = async () => {
      const mode = searchParams.get('mode');
      const oobCode = searchParams.get('oobCode');
      const continueUrl = searchParams.get('continueUrl');

      console.log('Email action handler:', { mode, oobCode, continueUrl });

      if (!mode || !oobCode) {
        setError('Invalid action link');
        setLoading(false);
        return;
      }

      try {
        switch (mode) {
          case 'verifyEmail':
            console.log('Applying email verification code...');
            await applyActionCode(auth, oobCode);
            setMessage('Email verified successfully! You can now log in.');
            console.log('Email verification successful');
            // Redirect to login after 3 seconds
            setTimeout(() => {
              navigate('/');
            }, 3000);
            break;

          case 'resetPassword':
            // Handle password reset
            await verifyPasswordResetCode(auth, oobCode);
            // Redirect to password reset form
            navigate(`/reset-password?oobCode=${oobCode}`);
            break;

          case 'recoverEmail':
            await applyActionCode(auth, oobCode);
            setMessage('Email recovered successfully!');
            break;

          default:
            setError('Unknown action');
        }
      } catch (error) {
        console.error('Error handling email action:', error);
        setError(error.message || 'Failed to process action. The link may have expired or already been used.');
      } finally {
        setLoading(false);
      }
    };

    handleAction();
  }, [searchParams, navigate]);

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {loading && (
          <>
            <CircularProgress />
            <Typography sx={{ mt: 2 }}>Processing...</Typography>
          </>
        )}

        {message && (
          <Alert severity="success" sx={{ width: '100%', mt: 2 }}>
            {message}
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={() => navigate('/')}
          sx={{ mt: 3 }}
        >
          Go to Login
        </Button>
      </Box>
    </Container>
  );
};

export default EmailActionHandler;