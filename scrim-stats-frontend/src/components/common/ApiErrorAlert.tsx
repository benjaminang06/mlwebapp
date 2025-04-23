import React from 'react';
import { Alert, AlertTitle, Box, Typography } from '@mui/material';
import { ApiError } from '../../types/api';

interface ApiErrorAlertProps {
  error: ApiError | null;
  title?: string;
  onClose?: () => void;
}

/**
 * Component to display API errors in a consistent format
 * Can be used in forms to show validation errors
 */
const ApiErrorAlert: React.FC<ApiErrorAlertProps> = ({ 
  error, 
  title = 'Error',
  onClose
}) => {
  if (!error) return null;

  // Extract form field errors if available
  const fieldErrors = error.response?.data?.detail || {};
  const hasFieldErrors = typeof fieldErrors === 'object' && Object.keys(fieldErrors).length > 0;
  
  // Get general message
  const generalMessage = error.message || 
    (typeof error.response?.data === 'string' ? error.response.data : null) ||
    'An error occurred';

  return (
    <Alert 
      severity="error" 
      onClose={onClose}
      sx={{ mb: 2, width: '100%' }}
    >
      <AlertTitle>{title}</AlertTitle>
      
      <Typography variant="body2" gutterBottom>
        {generalMessage}
      </Typography>
      
      {/* Display status code if available */}
      {error.response?.status && (
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Status: {error.response.status} {error.response.statusText ? `- ${error.response.statusText}` : ''}
        </Typography>
      )}
      
      {/* Display field errors if available */}
      {hasFieldErrors && (
        <Box mt={1}>
          <Typography variant="subtitle2" component="div" fontWeight="bold" gutterBottom>
            Field errors:
          </Typography>
          <Box component="ul" sx={{ pl: 2, m: 0 }}>
            {Object.entries(fieldErrors).map(([field, message]) => (
              <Typography component="li" variant="body2" key={field}>
                <strong>{field}:</strong> {String(Array.isArray(message) ? message.join(', ') : message)}
              </Typography>
            ))}
          </Box>
        </Box>
      )}
    </Alert>
  );
};

export default ApiErrorAlert; 