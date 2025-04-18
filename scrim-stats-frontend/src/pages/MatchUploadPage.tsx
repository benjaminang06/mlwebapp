import React from 'react';
import MatchUploadForm from '../components/match/MatchUploadForm'; // Import the form component
import { Container, Typography, Box } from '@mui/material';
import { FormikProps } from 'formik';

const MatchUploadPage: React.FC = () => {
  
  return (
    <Container maxWidth={false}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Upload New Match Results
        </Typography>
        {/* Render the form component - removed onSubmit prop */}
        <MatchUploadForm />
      </Box>
    </Container>
  );
};

export default MatchUploadPage; 