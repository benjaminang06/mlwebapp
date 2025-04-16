import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../services/api';

// Define the shape of our authentication context
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, email: string, password: string, confirmPassword: string, firstName?: string, lastName?: string) => Promise<boolean>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: async () => false,
  logout: () => {},
  register: async () => false,
});

// Custom hook for using the auth context
export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check if we have a token when the component mounts
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        // Validate the token by making a request to a user info endpoint
        // Replace '/api/user/' with your actual user endpoint
        await api.get('/api/teams/'); // Use a valid authenticated endpoint
        setIsAuthenticated(true);
      } catch (error: any) {
        // Only invalidate if it's an authentication error (e.g., 401)
        if (error.response && error.response.status === 401) {
          console.error('Auth validation failed (401): Token likely expired or invalid.', error);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken'); // Also remove refresh token
          setIsAuthenticated(false);
          setError('Your session has expired. Please login again.');
        } else {
          // Log other errors but don't necessarily invalidate the session
          // Could be a network issue or temporary server problem
          console.error('Auth validation check encountered an error (not 401):', error);
          // Decide if we want to set an error message without logging out
          // setError('Could not verify session. Network issue?'); 
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Registration function
  const register = async (
    username: string, 
    email: string, 
    password: string, 
    confirmPassword: string, 
    firstName: string = '', 
    lastName: string = ''
  ): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Attempting to register user:', { username, email });
      
      // First, try to get a CSRF token from the server
      try {
        // Get the CSRF token by making a GET request to the registration page or any other page
        const csrfResponse = await api.get('/api/csrf-token/');
        const csrfToken = csrfResponse.data.csrfToken;
        
        console.log('Obtained CSRF token for registration');
        
        // Include the CSRF token in the headers
        const response = await api.post('/api/register/', {
          username,
          email,
          password,
          password2: confirmPassword,
          first_name: firstName,
          last_name: lastName
        }, {
          headers: {
            'X-CSRFToken': csrfToken
          }
        });
        
        console.log('Registration successful:', response.data);
        return await login(username, password);
      } catch (csrfError) {
        console.error('Failed to get CSRF token:', csrfError);
        
        // If getting a CSRF token fails, try the standard endpoints without it
        // Try the standard Django REST Framework user creation endpoint
        const response = await api.post('/api/users/', {
          username,
          email,
          password
        });
        
        console.log('Registration successful:', response.data);
        return await login(username, password);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error response data:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      // Extract the readable error message from HTML if it's an HTML response
      if (error.response && typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
        const errorMatch = error.response.data.match(/<p>Reason given for failure:<\/p>\s*<pre>\s*(.*?)\s*<\/pre>/s);
        if (errorMatch && errorMatch[1]) {
          setError(`CSRF Error: ${errorMatch[1]}`);
        } else {
          setError('Server returned an HTML error page. This likely means the server is not properly configured for API requests.');
        }
        return false;
      }
      
      if (error.response) {
        // Handle various registration errors
        if (error.response.data.username) {
          setError(`Username error: ${error.response.data.username}`);
        } else if (error.response.data.email) {
          setError(`Email error: ${error.response.data.email}`);
        } else if (error.response.data.password) {
          setError(`Password error: ${error.response.data.password}`);
        } else if (error.response.data.password1) {
          setError(`Password error: ${error.response.data.password1}`);
        } else if (error.response.data.non_field_errors) {
          setError(error.response.data.non_field_errors[0]);
        } else if (error.response.data.detail) {
          // DRF often returns errors in a 'detail' field
          setError(`Error: ${error.response.data.detail}`);
        } else {
          // Show more specific error information
          setError(`Registration failed: ${JSON.stringify(error.response.data) || error.message}`);
        }
      } else if (error.request) {
        // Request was made but no response received
        setError('No response from server. Please check your connection and try again.');
      } else {
        setError(`Registration error: ${error.message}`);
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (username: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      // Replace with your actual login endpoint
      const response = await api.post('/api/token/', { username, password });
      
      const { access, refresh } = response.data;
      
      // Store tokens in localStorage
      localStorage.setItem('token', access);
      localStorage.setItem('refreshToken', refresh);
      
      setIsAuthenticated(true);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.response && error.response.status === 401) {
        setError('Invalid username or password');
      } else {
        setError('An error occurred during login. Please try again.');
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        error,
        login,
        logout,
        register
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Keep AuthContext and useAuth as named exports where defined
// export { AuthContext, useAuth }; // Remove this explicit re-export 