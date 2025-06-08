import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import Button from '@mui/material/Button';

const LogoutButton = () => {
  const { logout } = useAuth();

  return (
    <Button 
      variant="contained" 
      color="secondary" 
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      Log Out
    </Button>
  );
};

export default LogoutButton;
