import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Button, Typography, AppBar, Toolbar } from '@mui/material';
// import MatchUploadForm from './components/match/MatchUploadForm'; // No longer needed here
import MatchUploadPage from './pages/MatchUploadPage'; // Import the page component
import MatchListPage from './pages/MatchListPage'; // <-- Corrected path
import MatchDetailPage from './pages/MatchDetailPage'; // <-- Corrected path
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import BackendConnectionTest from './components/BackendConnectionTest';
import ApiDiagnostic from './components/ApiDiagnostic';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#3f51b5',
    },
    secondary: {
      main: '#f50057',
    },
  },
});

// Navigation component
const Navigation = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Esports Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button color="inherit" component={Link} to="/">
            Home
          </Button>
          <Button color="inherit" component={Link} to="/matches">
            Matches
          </Button>
          <Button color="inherit" component={Link} to="/upload-match">
            Upload Match
          </Button>
          <Button color="inherit" component={Link} to="/login">
            Login
          </Button>
          <Button color="inherit" component={Link} to="/register">
            Register
          </Button>
          <Button color="inherit" component={Link} to="/diagnostics">
            System Diagnostics
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navigation />
            <Box component="main" sx={{ flexGrow: 1, p: 0 }}>
              <Routes>
                <Route path="/" element={
                  <div>
                    <h1>Esports Management App</h1>
                    <p>Welcome to the Scrim Statistics Tracking application.</p>
                    <BackendConnectionTest />
                    <div style={{ marginTop: '20px' }}>
                      <h2>Quick Links</h2>
                      <ul>
                        <li><a href="/login">Login</a></li>
                        <li><a href="/register">Register</a></li>
                        <li><a href="/upload-match">Upload Match (Protected)</a></li>
                        <li><a href="/diagnostics">API Diagnostics</a></li>
                      </ul>
                    </div>
                  </div>
                } />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Protected Routes */}
                <Route 
                  path="/upload-match"
                  element={
                    <ProtectedRoute>
                      <MatchUploadPage />
                    </ProtectedRoute>
                  } 
                />
                <Route
                  path="/matches"
                  element={
                    <ProtectedRoute>
                      <MatchListPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/matches/:matchId"
                  element={
                    <ProtectedRoute>
                      <MatchDetailPage />
                    </ProtectedRoute>
                  }
                />
                
                {/* Diagnostic Tools */}
                <Route path="/diagnostics" element={<ApiDiagnostic />} />
                
                {/* Add a catch-all route for 404 */}
                <Route path="*" element={<div>404 - Page Not Found</div>} />
              </Routes>
            </Box>
          </Box>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 