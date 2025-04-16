# Fixing Match Upload Connectivity Issues

Follow these steps to fix the match upload form's connection to the backend:

## 1. Update Imports 

First, modify the imports at the top of the file:

```typescript
// Add this import to get the enhanced testBackendConnection function
import { testBackendConnection, BackendConnectionResult } from '../../services/api.service';
```

## 2. Remove Local Function

Find and remove the local testBackendConnection function (around line 335):

```typescript
// Delete this local implementation
const testBackendConnection = async () => {
  try {
    const response = await api.get('/api/status/');
    return response.data;
  } catch (error) {
    throw error;
  }
};
```

## 3. Update the Connection Check Function

Replace the checkConnection function in useEffect with this enhanced version:

```typescript
const checkConnection = async () => {
  try {
    const result = await testBackendConnection();
    
    if (result.success) {
      setConnectionAlert({
        show: true,
        message: 'Connected to backend service',
        severity: 'success'
      });
      console.log("Backend connection successful:", result);
    } else if (result.requiresAuth) {
      // Authentication issue detected
      setConnectionAlert({
        show: true,
        message: 'Authentication required. Please login again to upload matches.',
        severity: 'warning'
      });
      console.warn("Backend authentication required:", result);
    } else {
      setConnectionAlert({
        show: true,
        message: 'Connected, but backend reported an issue',
        severity: 'warning'
      });
      console.warn("Backend connection issue:", result);
    }
  } catch (error) {
    console.error('Backend connection error:', error);
    setConnectionAlert({
      show: true,
      message: 'Failed to connect to backend service. Check server status and refresh page.',
      severity: 'error'
    });
  }
};
```

## 4. Add Authentication Indicator

Add a visual indicator for authentication status right above the form:

```tsx
// Add this near the beginning of the return section
{connectionAlert.severity === 'warning' && connectionAlert.message.includes('Authentication') && (
  <Box sx={{ mb: 2, p: 2, bgcolor: '#fff3cd', borderRadius: 1 }}>
    <Typography>
      <strong>Authentication Issue:</strong> {connectionAlert.message}
      <Button 
        variant="outlined" 
        size="small" 
        sx={{ ml: 2 }}
        onClick={() => navigate('/login')}
      >
        Login Again
      </Button>
    </Typography>
  </Box>
)}
```

## 5. Verify API Configuration

Ensure that in `api.ts` the request interceptor is properly configured to use Bearer tokens:

```typescript
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
```

These changes will ensure that:

1. The match upload form uses the enhanced testBackendConnection function
2. Authentication issues are properly detected and communicated to users
3. The correct token format is used for API requests

Apply these changes and the match upload form should connect to the backend properly. 