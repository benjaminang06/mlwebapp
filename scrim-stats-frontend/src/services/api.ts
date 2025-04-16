import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Function to get the refresh token (example)
const getRefreshToken = () => localStorage.getItem('refreshToken');
// Function to set the new access token (example)
const setAccessToken = (token: string) => localStorage.setItem('token', token);
// Function to handle logout (example - you might need to import/call your actual logout function)
const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  // Redirect to login or update auth state
  window.location.href = '/login'; // Simple redirect, adjust as needed
};

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:8000', // Adjust as needed for your environment
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track if we're currently refreshing the token
let isRefreshing = false;
// Store pending requests that should be retried after token refresh
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

// Process the queue of failed requests
const processQueue = (error: any | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      // If we got a new token, we don't need to modify the config here,
      // the request interceptor will pick up the new token from storage.
      // We just need to resolve the promise to retry the request.
      prom.resolve();
    }
  });

  failedQueue = [];
};

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Updated response interceptor for 401 handling and token refresh
api.interceptors.response.use(
  (response) => {
    // Any status code within the range of 2xx cause this function to trigger
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }; // Add _retry flag type

    // Log the error details
    if (error.response) {
      console.error(
        `API error ${error.response.status} for ${originalRequest.method?.toUpperCase()} ${originalRequest.url}:`,
         error.message,
         error.response.data // Log response data for context
      );
    } else if (error.request) {
        console.error(`API network error for ${originalRequest.method?.toUpperCase()} ${originalRequest.url}:`, error.message);
    } else {
        console.error('API request setup error:', error.message);
    }

    // Check if it's a 401 error, not a retry, and not the refresh token URL itself
    if (
        error.response?.status === 401 && 
        originalRequest.url !== '/api/token/refresh/' && 
        !originalRequest._retry
    ) {
        // Check if the error code specifically indicates an invalid/expired token
        const responseData = error.response?.data as { code?: string };
        if (responseData?.code !== 'token_not_valid') {
            // If it's a 401 but not due to token expiry (e.g., invalid credentials on login attempt),
            // don't attempt refresh, just reject.
            console.warn('401 error, but not token_not_valid. Rejecting.');
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // If we are already refreshing, queue the original request
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
            .then(() => api(originalRequest)) // Retry with new token (interceptor adds it)
            .catch((err) => Promise.reject(err)); // Propagate subsequent errors
        }

        console.log('Attempting token refresh...');
        originalRequest._retry = true; // Mark as retried
        isRefreshing = true;

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            console.error('No refresh token found. Logging out.');
            isRefreshing = false;
            handleLogout();
            return Promise.reject(new Error('No refresh token available'));
        }

        try {
            const refreshResponse = await axios.post(`${api.defaults.baseURL}/api/token/refresh/`, {
                refresh: refreshToken,
            });

            const newAccessToken = refreshResponse.data.access;
            console.log('Token refreshed successfully!');
            setAccessToken(newAccessToken);
            isRefreshing = false;

            // Process the queue with the new token
            processQueue(null, newAccessToken); 

            // Retry the original request. The request interceptor will add the new token.
            return api(originalRequest);

        } catch (refreshError: any) {
            console.error('Token refresh failed:', refreshError.response?.data || refreshError.message);
            isRefreshing = false;
            processQueue(refreshError, null);
            handleLogout(); // Logout if refresh fails
            return Promise.reject(refreshError);
        }
    }

    // For errors other than 401 or if refresh fails, reject the promise
    return Promise.reject(error);
  }
);

// Simple function to test backend connectivity
export const testBackendConnection = async () => {
  try {
    // First try the status endpoint which doesn't require authentication
    const statusResponse = await api.get('/api/status/');
    console.log('Backend connection successful to status endpoint');
    
    // If status check passed, try an authenticated endpoint
    try {
      const response = await api.get('/api/teams/');
      console.log('Backend connection successful and authenticated!');
      return { success: true, data: response.data };
    } catch (authError: any) {
      // If we get a 401, the backend is working but auth is failing
      if (authError.response && authError.response.status === 401) {
        console.log('Backend is running but authentication failed');
        console.log('Current token:', localStorage.getItem('token'));
        return { 
          success: false, 
          requiresAuth: true, 
          message: 'Backend is running but authentication failed. Please log in again.',
          error: authError 
        };
      }
      throw authError; // Re-throw unexpected errors
    }
  } catch (error: any) {
    // If we get a 401, the backend is working but requires auth
    if (error.response && error.response.status === 401) {
      console.log('Backend is running but requires authentication');
      return { success: true, requiresAuth: true };
    }
    
    if (error.code === 'ERR_NETWORK') {
      console.error('Backend connection failed - Server might not be running at:', api.defaults.baseURL);
    } else {
      console.error('Backend connection error:', error.message);
    }
    return { success: false, error };
  }
};

// Diagnostic function to check overall API status
export const checkApiStatus = async () => {
  try {
    // First try the specific status endpoint if it exists
    try {
      const response = await api.get('/api/status/');
      return {
        isOnline: true,
        message: 'API is online',
        data: response.data
      };
    } catch (statusError: any) {
      // If status endpoint fails, try a simpler endpoint
      try {
        // Try to access a simple endpoint that should always work
        const response = await api.get('/api/');
        return {
          isOnline: true,
          message: 'API is online but status endpoint unavailable',
          data: response.data
        };
      } catch (rootError: any) {
        // If both fail in specific ways, the API might be partially available
        if (rootError.response) {
          // Got a response, even if it's an error, means server is running
          return {
            isOnline: true,
            message: 'API is online but returning errors',
            status: rootError.response.status,
            error: rootError.message
          };
        }
        // Re-throw to be caught by outer catch
        throw rootError;
      }
    }
  } catch (error: any) {
    // Likely a network error - server completely unavailable
    return {
      isOnline: false,
      message: 'API appears to be offline',
      error: error.message
    };
  }
};

// Utility to check if a specific endpoint is available
export const checkEndpoint = async (endpoint: string) => {
  try {
    const response = await api.get(endpoint);
    return {
      available: true,
      status: response.status,
      data: response.data
    };
  } catch (error: any) {
    return {
      available: false,
      error: error.response ? error.response.status : 'Network error',
      message: error.message
    };
  }
};

export default api; 