import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import MatchUploadForm from './components/match/MatchUploadForm';
import Dashboard from './components/dashboard/Dashboard';
import Layout from './components/layout/Layout';
import Login from './components/auth/Login';
import PrivateRoute from './components/auth/PrivateRoute';
import { initializeDevAuth } from './services/auth.service';

function App() {
  // Try to initialize authentication on app start
  useEffect(() => {
    initializeDevAuth();
  }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/upload-match" element={
        <PrivateRoute>
          <Layout>
            <MatchUploadForm />
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/matches" element={
        <PrivateRoute>
          <Layout>
            <div>Matches List (Coming Soon)</div>
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/matches/:id" element={
        <PrivateRoute>
          <Layout>
            <div>Match Details (Coming Soon)</div>
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/players" element={
        <PrivateRoute>
          <Layout>
            <div>Players (Coming Soon)</div>
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/teams" element={
        <PrivateRoute>
          <Layout>
            <div>Teams (Coming Soon)</div>
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/heroes" element={
        <PrivateRoute>
          <Layout>
            <div>Heroes (Coming Soon)</div>
          </Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={
        <PrivateRoute>
          <Layout>
            <div>Page Not Found</div>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default App; 