import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Box, Typography } from '@mui/material';

const AuthStatus: React.FC = () => {
  const { isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    navigate('/login');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return <Typography>Checking authentication...</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {isAuthenticated ? (
        <>
          <Typography variant="body2">
            You are logged in
          </Typography>
          <Button 
            variant="outlined" 
            color="inherit" 
            size="small" 
            onClick={handleLogout}
          >
            Log out
          </Button>
        </>
      ) : (
        <>
          <Typography variant="body2">
            You are not logged in
          </Typography>
          <Button 
            variant="outlined" 
            color="inherit" 
            size="small" 
            onClick={handleLogin}
          >
            Log in
          </Button>
        </>
      )}
    </Box>
  );
};

export default AuthStatus; 