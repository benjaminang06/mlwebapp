import React from 'react';
import { Box, Typography, Alert, AlertTitle } from '@mui/material';

interface FormErrorDisplayProps {
  errors: Record<string, string | undefined>;
  title?: string;
}

/**
 * Component for displaying form validation errors in a user-friendly way
 */
const FormErrorDisplay: React.FC<FormErrorDisplayProps> = ({ 
  errors,
  title = 'Please fix the following errors:' 
}) => {
  // Filter out undefined errors and count the total
  const errorEntries = Object.entries(errors).filter(([_, message]) => message);
  const errorCount = errorEntries.length;
  
  if (errorCount === 0) return null;

  return (
    <Alert 
      severity="error" 
      sx={{ mb: 2, width: '100%' }}
    >
      <AlertTitle>{title}</AlertTitle>
      
      <Box component="ul" sx={{ pl: 2, m: 0 }}>
        {errorEntries.map(([field, message]) => (
          <Typography component="li" variant="body2" key={field}>
            <strong>{field.replace(/_/g, ' ')}:</strong> {message}
          </Typography>
        ))}
      </Box>
    </Alert>
  );
};

export default FormErrorDisplay; 