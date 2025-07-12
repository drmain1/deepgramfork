import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Box
} from '@mui/material';
import { useAuth } from '../contexts/FirebaseAuthContext';

const SESSION_TIMEOUT = 25 * 60 * 1000; // 25 minutes
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before timeout
const CHECK_INTERVAL = 10 * 1000; // Check every 10 seconds

const SessionTimeoutWarning = () => {
  const { logout, refreshSession } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(WARNING_TIME);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Track user activity
  const updateActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
  }, []);

  // Activity event listeners
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [updateActivity]);

  // Check for timeout
  useEffect(() => {
    const checkTimeout = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity >= SESSION_TIMEOUT) {
        // Session has timed out
        logout();
      } else if (timeSinceActivity >= (SESSION_TIMEOUT - WARNING_TIME)) {
        // Show warning
        const remaining = SESSION_TIMEOUT - timeSinceActivity;
        setTimeRemaining(remaining);
        setShowWarning(true);
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(checkTimeout);
  }, [lastActivity, logout]);

  // Update countdown
  useEffect(() => {
    if (!showWarning) return;

    const countdown = setInterval(() => {
      setTimeRemaining(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          logout();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [showWarning, logout]);

  const handleContinue = async () => {
    try {
      await refreshSession();
      updateActivity();
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = (timeRemaining / WARNING_TIME) * 100;

  return (
    <Dialog
      open={showWarning}
      onClose={() => {}}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Session Timeout Warning
      </DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Your session will expire due to inactivity in:
        </Typography>
        <Typography variant="h4" align="center" sx={{ my: 2 }}>
          {formatTime(timeRemaining)}
        </Typography>
        <Box sx={{ width: '100%', mb: 2 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: progress > 50 ? '#4caf50' : progress > 25 ? '#ff9800' : '#f44336'
              }
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          For security and HIPAA compliance, sessions automatically expire after 25 minutes of inactivity.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={logout} color="error">
          Log Out
        </Button>
        <Button onClick={handleContinue} variant="contained" autoFocus>
          Continue Session
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionTimeoutWarning;