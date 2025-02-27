import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MatchUploadForm from './components/match/MatchUploadForm';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/upload-match" element={<MatchUploadForm />} />
      </Routes>
    </Router>
  );
}

export default App; 