import axios from 'axios';

// Configure base API client
export const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api', // Adjust this to your Django backend URL
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if needed
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage or other storage
    const token = localStorage.getItem('authToken');
    
    // If token exists, add to headers
    if (token) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for handling common errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle errors like 401 Unauthorized
    if (error.response && error.response.status === 401) {
      // Redirect to login or clear token
      localStorage.removeItem('authToken');
      // window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
); 