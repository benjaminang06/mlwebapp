# Frontend-Backend Integration Guide

This document explains how the frontend (React/TypeScript) and backend (Django/Python) are integrated in the Esports Management App.

## Architecture Overview

1. **Backend (Django)**:
   - RESTful API endpoints using Django REST Framework
   - Serializers to convert Django models to JSON responses
   - Token-based authentication with JWT
   - CORS configuration to allow frontend requests

2. **Frontend (React/TypeScript)**:
   - TypeScript interfaces that match backend serializers
   - Service modules that call backend API endpoints
   - Centralized API service with authentication handling
   - Component that tests backend connectivity

## TypeScript Interfaces

The frontend has TypeScript interfaces that match the structure of Django models:

- `Team` and `TeamManagerRole` (in `team.types.ts`)
- `Player`, `PlayerAlias`, and `PlayerTeamHistory` (in `player.types.ts`)
- `Match`, `ScrimGroup`, `PlayerMatchStat`, etc. (in `match.types.ts`)
- `Hero` (in `hero.types.ts`)

These interfaces ensure type safety when working with data from the backend.

## API Services

The frontend includes service modules for interacting with the backend:

- `api.ts`: Base axios configuration with authentication and error handling
- `api.service.ts`: Comprehensive service that exposes all backend endpoints
- Individual service modules for specific models (e.g., `player.service.ts`, `match.service.ts`)

## Testing the Connection

We've added several tools to test the connection between frontend and backend:

1. **BackendConnectionTest Component**:
   - React component that tests connection to the backend
   - Shows detailed error information if connection fails
   - Provides troubleshooting steps for common issues

2. **testConnection.js Script**:
   - Command-line script to check if both frontend and backend are running
   - Tests API accessibility
   - Provides CORS configuration summary

## How to Test

1. **Start both servers**:
   ```bash
   # Terminal 1: Start the backend
   cd scrim_stats_backend
   python manage.py runserver

   # Terminal 2: Start the frontend
   cd scrim-stats-frontend
   npm run dev
   ```

2. **Run the test script**:
   ```bash
   # From the project root
   node testConnection.js
   ```

3. **Check the frontend**:
   - Open the frontend in your browser (usually http://localhost:5173)
   - The home page includes the BackendConnectionTest component
   - It will show if the connection to the backend is successful

## Common Issues and Solutions

### CORS Errors

If you see CORS errors in the browser console:

1. Verify that `CORS_ALLOWED_ORIGINS` in Django settings includes your frontend URL
2. Make sure `CORS_ALLOW_CREDENTIALS` is set to `True`
3. Check that the frontend is using the correct backend URL

### Authentication Errors

If API calls return 401 Unauthorized:

1. Make sure you're including the JWT token in requests
2. Check if the token has expired
3. Try logging in again to get a new token

### Network Errors

If API calls fail with network errors:

1. Verify that both servers are running
2. Check if the backend port (8000) is already in use
3. Make sure there are no firewall or proxy issues

## Next Steps

1. Implement comprehensive error handling in all API calls
2. Add loading states for API requests
3. Implement proper form validation that matches backend requirements
4. Create detailed documentation for all available endpoints 