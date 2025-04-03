import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MatchUploadForm from './components/match/MatchUploadForm';
import Dashboard from './components/dashboard/Dashboard';
import Layout from './components/layout/Layout';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload-match" element={<MatchUploadForm />} />
          <Route path="/matches" element={<div>Matches List (Coming Soon)</div>} />
          <Route path="/matches/:id" element={<div>Match Details (Coming Soon)</div>} />
          <Route path="/players" element={<div>Players (Coming Soon)</div>} />
          <Route path="/teams" element={<div>Teams (Coming Soon)</div>} />
          <Route path="/heroes" element={<div>Heroes (Coming Soon)</div>} />
          <Route path="*" element={<div>Page Not Found</div>} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
