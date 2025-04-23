import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { ApiError } from '../../types/api';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | ApiError | null;
  info: ErrorInfo | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in its child component tree
 * and displays a fallback UI instead of the component tree that crashed.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      info: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      info: null
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({
      info
    });
    
    // You could log the error to an error reporting service here
    console.error('ErrorBoundary caught an error:', error, info);
  }

  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      info: null
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, render it
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <Paper 
          elevation={3}
          sx={{ 
            p: 3, 
            m: 2, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            maxWidth: '800px',
            mx: 'auto'
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60 }} />
            <Typography variant="h5" component="h2" gutterBottom>
              Something went wrong
            </Typography>
          </Box>

          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              {error?.message || 'An unexpected error occurred'}
            </Typography>
            
            {/* Display API-specific error details if available */}
            {'response' in error! && error!.response && (
              <Typography variant="body2" component="div">
                Status: {error!.response.status} - {error!.response.statusText}
                {error!.response.data && (
                  <Box component="pre" sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.04)', overflow: 'auto' }}>
                    {JSON.stringify(error!.response.data, null, 2)}
                  </Box>
                )}
              </Typography>
            )}
          </Alert>

          <Button 
            variant="contained" 
            color="primary" 
            onClick={this.resetErrorBoundary}
          >
            Try Again
          </Button>
        </Paper>
      );
    }

    return children;
  }
}

export default ErrorBoundary; 