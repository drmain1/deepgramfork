import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const AuthLoading = () => {
  return (
    <Box 
      display="flex" 
      flexDirection="column"
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh"
      bgcolor="background.default"
    >
      <CircularProgress />
      <Typography variant="h6" sx={{ mt: 2 }}>
        Loading authentication...
      </Typography>
    </Box>
  );
};

export default AuthLoading;
