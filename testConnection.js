#!/usr/bin/env node

/**
 * This script tests if both frontend and backend services are running
 * and if the frontend can connect to the backend.
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

// Configuration
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:8000';
const BACKEND_API_PATH = '/api/teams/';

// Console colors
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';

// Helper to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { 
        resolve({ 
          statusCode: res.statusCode,
          data 
        }); 
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Helper to check if a port is in use
async function isPortInUse(port) {
  try {
    // Check if process is listening on port
    const { stdout } = await execPromise(`lsof -i:${port} -t`);
    return stdout.trim() !== '';
  } catch (error) {
    return false;
  }
}

// Main function
async function runTests() {
  console.log(`${BLUE}========================================${RESET}`);
  console.log(`${BLUE}Testing Frontend/Backend Connectivity${RESET}`);
  console.log(`${BLUE}========================================${RESET}\n`);

  // Check if frontend is running
  console.log(`${YELLOW}Checking frontend (${FRONTEND_URL})...${RESET}`);
  const frontendRunning = await isPortInUse(5173);
  
  if (frontendRunning) {
    console.log(`${GREEN}✓ Frontend is running on port 5173${RESET}`);
  } else {
    console.log(`${RED}✗ Frontend is NOT running on port 5173${RESET}`);
    console.log(`  Start it with: cd scrim-stats-frontend && npm run dev`);
  }

  // Check if backend is running
  console.log(`\n${YELLOW}Checking backend (${BACKEND_URL})...${RESET}`);
  const backendRunning = await isPortInUse(8000);
  
  if (backendRunning) {
    console.log(`${GREEN}✓ Backend is running on port 8000${RESET}`);
    
    // Try to access the API
    try {
      console.log(`\n${YELLOW}Testing API access (${BACKEND_URL + BACKEND_API_PATH})...${RESET}`);
      const response = await makeRequest(BACKEND_URL + BACKEND_API_PATH);
      
      if (response.statusCode === 200) {
        console.log(`${GREEN}✓ API endpoint accessible (200 OK)${RESET}`);
      } else if (response.statusCode === 401) {
        console.log(`${GREEN}✓ API endpoint accessible (401 Unauthorized)${RESET}`);
        console.log(`  This is expected if authentication is required`);
      } else {
        console.log(`${RED}✗ API returned unexpected status: ${response.statusCode}${RESET}`);
      }
    } catch (error) {
      console.log(`${RED}✗ Could not connect to API: ${error.message}${RESET}`);
    }
  } else {
    console.log(`${RED}✗ Backend is NOT running on port 8000${RESET}`);
    console.log(`  Start it with: cd scrim_stats_backend && python manage.py runserver`);
  }

  // CORS test summary
  console.log(`\n${YELLOW}CORS Configuration:${RESET}`);
  if (backendRunning) {
    console.log(`${GREEN}Backend CORS should allow these origins:${RESET}`);
    console.log(`  - http://localhost:5173`);
    console.log(`  - http://localhost:5174`);
    console.log(`  - http://127.0.0.1:5173`);
    console.log(`  - http://127.0.0.1:5174`);
    
    console.log(`\nIf you're experiencing CORS issues, check:`);
    console.log(`1. The frontend is using the correct backend URL (http://localhost:8000)`);
    console.log(`2. The backend's CORS_ALLOWED_ORIGINS includes your frontend URL`);
    console.log(`3. CORS_ALLOW_CREDENTIALS is set to True in Django settings`);
  } else {
    console.log(`${RED}Start the backend first to test CORS configuration${RESET}`);
  }

  console.log(`\n${BLUE}========================================${RESET}`);
  console.log(`${BLUE}Test Complete${RESET}`);
  console.log(`${BLUE}========================================${RESET}`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${RED}Error running tests: ${error.message}${RESET}`);
}); 