import React from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import Button from '@mui/material/Button';

const LoginButton = () => {
  const { loginWithRedirect } = useAuth();

  return (
    <Button variant="contained" color="primary" onClick={() => loginWithRedirect()}>
      Log In
    </Button>
  );
};

export default LoginButton;
