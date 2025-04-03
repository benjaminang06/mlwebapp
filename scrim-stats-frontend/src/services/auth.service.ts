import api from './api';

// Store user data and token
const TOKEN_KEY = 'token';
const USER_KEY = 'user';

/**
 * Login user and store token in localStorage
 */
export const login = async (username: string, password: string) => {
  try {
    const response = await api.post('/api/token/', { username, password });
    
    if (response.data.access) {
      localStorage.setItem(TOKEN_KEY, response.data.access);
      localStorage.setItem(USER_KEY, JSON.stringify({
        username: username,
        // Add other user data as needed
      }));
      return response.data;
    }
    return null;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

/**
 * Logout user by removing token from localStorage
 */
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

/**
 * Get current user data
 */
export const getCurrentUser = () => {
  const userStr = localStorage.getItem(USER_KEY);
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

/**
 * Check if user is logged in
 */
export const isLoggedIn = () => {
  return !!localStorage.getItem(TOKEN_KEY);
};

/**
 * Initialize with a demo token for development
 * This is just for testing purposes
 */
export const initializeDevAuth = () => {
  // Check if we're in a development environment
  const isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
  
  // Only use this in development and if no token exists!
  if (isDevelopment && !localStorage.getItem(TOKEN_KEY)) {
    // You would replace this with a valid token for your backend
    const demoToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJleHAiOjE3MTY5NTAzMzB9.nf3QJv6LfJJgMYC1ghvgwVDYL4IAcQ5mCFJTTqOh4Mw';
    localStorage.setItem(TOKEN_KEY, demoToken);
    localStorage.setItem(USER_KEY, JSON.stringify({
      username: 'demo_user',
    }));
    return true;
  }
  return false;
}; 