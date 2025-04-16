import { useState, useEffect } from 'react';
import { testBackendConnection, BackendConnectionResult } from '../services/api.service';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * A component that tests connection to the backend API
 * This is useful for debugging frontend-backend integration issues
 */
const BackendConnectionTest = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Testing connection to the backend...');
  const [details, setDetails] = useState<string>('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const result: BackendConnectionResult = await testBackendConnection();
        
        if (result.success) {
          setStatus('success');
          setMessage('✅ Connected to backend successfully!');
        } else if (result.requiresAuth) {
          setStatus('error');
          setMessage('❌ Failed to connect to backend - Authentication required');
          
          if (isAuthenticated) {
            setDetails('Your authentication token appears to be invalid or expired. Please log out and log in again.');
          } else {
            setDetails('You need to log in to access this feature.');
          }
        } else {
          setStatus('error');
          setMessage('❌ Failed to connect to backend');
          
          // Add more detailed error information
          if (result.error) {
            const error = result.error as any;
            if (error.code === 'ERR_NETWORK') {
              setDetails(
                'Network error: Make sure the Django server is running on http://localhost:8000 ' +
                'and that CORS is properly configured.'
              );
            } else if (error.response) {
              setDetails(
                `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
              );
            } else {
              setDetails(`Error: ${error.message || 'Unknown error'}`);
            }
          }
        }
      } catch (err) {
        setStatus('error');
        setMessage('❌ Error testing backend connection');
        setDetails(`Unexpected error: ${(err as Error).message}`);
      }
    };

    checkConnection();
  }, [isAuthenticated]);

  return (
    <div className="backend-connection-test" style={{ 
      padding: '20px',
      margin: '20px 0',
      borderRadius: '8px',
      backgroundColor: status === 'loading' ? '#f0f0f0' : 
                      status === 'success' ? '#e6ffe6' : '#fff0f0',
      border: `1px solid ${status === 'loading' ? '#ccc' : 
                          status === 'success' ? '#6c6' : '#f66'}`,
    }}>
      <h3 style={{ margin: '0 0 10px 0' }}>Backend Connection Status</h3>
      <p style={{ fontWeight: 'bold' }}>{message}</p>
      
      {status === 'loading' && (
        <div className="loading-spinner" style={{ 
          display: 'inline-block',
          width: '20px',
          height: '20px',
          border: '3px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '50%',
          borderTopColor: '#333',
          animation: 'spin 1s ease-in-out infinite',
        }}>
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      )}
      
      {details && (
        <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
          <strong>Details:</strong>
          <pre style={{ 
            backgroundColor: '#f8f8f8', 
            padding: '10px', 
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '150px'
          }}>
            {details}
          </pre>
        </div>
      )}
      
      {status === 'error' && !isAuthenticated && details.includes('authentication') && (
        <p style={{ marginTop: '15px' }}>
          <Link to="/login" style={{ 
            display: 'inline-block',
            padding: '8px 16px',
            backgroundColor: '#4285f4',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}>
            Log In
          </Link>
        </p>
      )}
      
      {status === 'error' && (
        <div style={{ marginTop: '15px' }}>
          <h4>Troubleshooting Steps:</h4>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Make sure the Django server is running with <code>python manage.py runserver</code></li>
            <li>Check if the server is running on port 8000</li>
            <li>Verify that CORS headers are properly configured in Django</li>
            <li>Check for any Django errors in the server console</li>
            {details.includes('authentication') && <li>Try logging out and logging back in again</li>}
          </ol>
        </div>
      )}
    </div>
  );
};

export default BackendConnectionTest; 