import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, List, ListItem, ListItemText, Chip, CircularProgress } from '@mui/material';
import { checkApiStatus, checkEndpoint } from '../services/api';

interface EndpointStatus {
  endpoint: string;
  available: boolean;
  status?: number;
  message?: string;
  error?: string | number;
  data?: any;
}

const ApiDiagnostic: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [endpointStatuses, setEndpointStatuses] = useState<EndpointStatus[]>([]);

  const endpoints = [
    '/api/',
    '/api/status/',
    '/api/scrim-groups/',
    '/api/teams/',
    '/api/players/',
    '/api/matches/'
  ];

  const runDiagnostics = async () => {
    setLoading(true);
    
    try {
      // First check overall API status
      const status = await checkApiStatus();
      setApiStatus(status);
      
      // Then check individual endpoints
      const results = await Promise.all(
        endpoints.map(async (endpoint) => {
          const result = await checkEndpoint(endpoint);
          return {
            endpoint,
            ...result
          };
        })
      );
      
      setEndpointStatuses(results);
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusColor = (available: boolean, status?: number): 'success' | 'error' | 'warning' => {
    if (!available) return 'error';
    if (status && status >= 400) return status >= 500 ? 'error' : 'warning';
    return 'success';
  };

  const getDetailedErrorInfo = (endpoint: string, error: any): string => {
    if (endpoint === '/api/scrim-groups/' && error === 500) {
      return 'The scrim-groups endpoint is returning a server error (500). Possible causes include database connection issues, malformed database schema, or backend logic errors.';
    }
    
    if (error === 404) {
      return 'This endpoint does not exist on the server. Check if the API routes are correctly configured.';
    }
    
    if (error === 'Network error') {
      return 'Network error - unable to reach the server. Make sure the backend is running.';
    }
    
    return `Error: ${error}`;
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>API Diagnostic Tool</Typography>
      
      <Button 
        variant="contained"
        onClick={runDiagnostics}
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={24} /> : 'Run Diagnostics'}
      </Button>
      
      {apiStatus && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6">Overall API Status</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <Chip 
              label={apiStatus.isOnline ? 'Online' : 'Offline'}
              color={apiStatus.isOnline ? 'success' : 'error'}
              sx={{ mr: 2 }}
            />
            <Typography>{apiStatus.message}</Typography>
          </Box>
          {apiStatus.error && (
            <Typography color="error" sx={{ mt: 1 }}>
              Error: {apiStatus.error}
            </Typography>
          )}
        </Paper>
      )}
      
      {endpointStatuses.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Endpoint Status</Typography>
          <List>
            {endpointStatuses.map((endpoint) => (
              <ListItem 
                key={endpoint.endpoint}
                divider
                sx={{ 
                  backgroundColor: endpoint.endpoint === '/api/scrim-groups/' 
                    ? 'rgba(255, 244, 229, 0.5)' 
                    : 'transparent'
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography 
                        component="span" 
                        fontFamily="monospace" 
                        fontWeight={endpoint.endpoint === '/api/scrim-groups/' ? 'bold' : 'normal'}
                      >
                        {endpoint.endpoint}
                      </Typography>
                      <Chip 
                        label={endpoint.available ? 'Available' : 'Unavailable'}
                        color={getStatusColor(endpoint.available, endpoint.status)}
                        size="small"
                        sx={{ ml: 2 }}
                      />
                      {endpoint.status && (
                        <Chip 
                          label={`Status: ${endpoint.status}`}
                          color={endpoint.status >= 400 ? (endpoint.status >= 500 ? 'error' : 'warning') : 'default'}
                          size="small"
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 1 }}>
                      {endpoint.error && (
                        <Typography color="error" variant="body2">
                          {getDetailedErrorInfo(endpoint.endpoint, endpoint.error)}
                        </Typography>
                      )}
                      {endpoint.message && (
                        <Typography variant="body2">
                          Message: {endpoint.message}
                        </Typography>
                      )}
                      {endpoint.available && endpoint.data && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="body2">Response preview:</Typography>
                          <Box 
                            component="pre" 
                            sx={{ 
                              mt: 1, 
                              p: 1, 
                              backgroundColor: 'rgba(0,0,0,0.04)', 
                              borderRadius: 1,
                              maxHeight: '100px',
                              overflow: 'auto',
                              fontSize: '0.75rem'
                            }}
                          >
                            {JSON.stringify(endpoint.data, null, 2)}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
      
      {apiStatus && apiStatus.error === 'Network Error' && (
        <Box sx={{ mt: 3, p: 2, border: '1px solid #d32f2f', borderRadius: 1 }}>
          <Typography variant="h6" color="error">Backend Server Not Running</Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            It appears that the backend server is not running or not accessible. Here are some steps to diagnose:
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="1. Check if the backend server is running on http://localhost:8000" />
            </ListItem>
            <ListItem>
              <ListItemText primary="2. Verify there are no CORS issues by checking browser developer console" />
            </ListItem>
            <ListItem>
              <ListItemText primary="3. Make sure the backend is properly configured and database connections are working" />
            </ListItem>
          </List>
        </Box>
      )}
      
      {apiStatus && apiStatus.isOnline && endpointStatuses.some(e => e.endpoint === '/api/scrim-groups/' && e.error === 500) && (
        <Box sx={{ mt: 3, p: 2, border: '1px solid #ed6c02', borderRadius: 1, backgroundColor: 'rgba(255, 244, 229, 0.5)' }}>
          <Typography variant="h6" color="warning.dark">Scrim Groups Endpoint Issues</Typography>
          <Typography variant="body1" sx={{ mt: 1 }}>
            The scrim-groups endpoint is returning a 500 Internal Server Error. This typically indicates a server-side issue:
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="1. Check the backend logs for specific error messages related to this endpoint" />
            </ListItem>
            <ListItem>
              <ListItemText primary="2. Verify the database schema for the ScrimGroup model is correctly set up" />
            </ListItem>
            <ListItem>
              <ListItemText primary="3. Look for any recent changes to the backend code that handles this endpoint" />
            </ListItem>
            <ListItem>
              <ListItemText primary="4. Check if there are database migration issues or invalid database entries" />
            </ListItem>
          </List>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Your frontend application has been updated to handle this error gracefully with local fallbacks,
            but fixing the backend issue is recommended for full functionality.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ApiDiagnostic; 