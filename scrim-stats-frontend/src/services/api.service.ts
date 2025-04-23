import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { Team, TeamManagerRole } from '../types/team.types';
import { Player } from '../types/player.types';
import { Match, ScrimGroup, PlayerMatchStat, FileUpload } from '../types/match.types';
import { Hero, HeroStats } from '../types/hero.types';
import { 
  ApiResponse, 
  PaginatedResponse, 
  ApiError,
  toApiError
} from '../types/api';

// Function to get the refresh token
const getRefreshToken = () => localStorage.getItem('refreshToken');
// Function to set the new access token
const setAccessToken = (token: string) => localStorage.setItem('token', token);
// Function to handle logout
const handleLogout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  // Redirect to login or update auth state
  window.location.href = '/login';
};

// Create axios instance with default config
export const api = axios.create({
  baseURL: 'http://localhost:8000', // Adjust as needed for your environment
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Base URL for API endpoints
const API_URL = '/api';

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
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if it's a 401 error, not a retry, and not the refresh token URL itself
    if (
        error.response?.status === 401 && 
        originalRequest.url !== '/api/token/refresh/' && 
        !originalRequest._retry
    ) {
        // Check if the error code specifically indicates an invalid/expired token
        const responseData = error.response?.data as { code?: string };
        if (responseData?.code !== 'token_not_valid') {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            // If we are already refreshing, queue the original request
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
            .then(() => api(originalRequest)) 
            .catch((err) => Promise.reject(err)); 
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
            isRefreshing = false;
            handleLogout();
            return Promise.reject(new Error('No refresh token available'));
        }

        try {
            const refreshResponse = await axios.post(`${api.defaults.baseURL}/api/token/refresh/`, {
                refresh: refreshToken,
            });

            const newAccessToken = refreshResponse.data.access;
            setAccessToken(newAccessToken);
            isRefreshing = false;

            // Process the queue with the new token
            processQueue(null, newAccessToken); 

            // Retry the original request
            return api(originalRequest);

        } catch (refreshError: any) {
            isRefreshing = false;
            processQueue(refreshError, null);
            handleLogout();
            return Promise.reject(refreshError);
        }
    }

    // For errors other than 401 or if refresh fails, reject the promise
    return Promise.reject(error);
  }
);

/**
 * Types for authentication responses
 */
export interface AuthResponse {
  access: string;
  refresh: string;
  user?: {
    id: number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  password2: string;
  first_name?: string;
  last_name?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

// Authentication endpoints
export const AuthService = {
  register: (userData: RegisterData): Promise<AxiosResponse<AuthResponse>> => 
    api.post(`${API_URL}/register/`, userData),
    
  login: (credentials: LoginData): Promise<AxiosResponse<AuthResponse>> => 
    api.post(`${API_URL}/token/`, credentials),
    
  refreshToken: (refresh: string): Promise<AxiosResponse<{ access: string }>> => 
    api.post(`${API_URL}/token/refresh/`, { refresh }),
    
  getCsrfToken: (): Promise<AxiosResponse<{ csrfToken: string }>> => 
    api.get(`${API_URL}/csrf-token/`),
};

// Team endpoints
export const TeamService = {
  getAll: (): Promise<AxiosResponse<PaginatedResponse<Team> | Team[]>> => 
    api.get(`${API_URL}/teams/`),
    
  getById: (id: number): Promise<AxiosResponse<Team>> => 
    api.get(`${API_URL}/teams/${id}/`),
    
  create: (team: Partial<Team>): Promise<AxiosResponse<Team>> => 
    api.post(`${API_URL}/teams/`, team),
    
  update: (id: number, team: Partial<Team>): Promise<AxiosResponse<Team>> => 
    api.put(`${API_URL}/teams/${id}/`, team),
    
  delete: (id: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/teams/${id}/`),
  
  // Team role management
  getRoles: (): Promise<AxiosResponse<TeamManagerRole[]>> => 
    api.get(`${API_URL}/team-roles/`),
    
  updateRole: (data: TeamManagerRole): Promise<AxiosResponse<TeamManagerRole>> => 
    api.post(`${API_URL}/team-roles/`, data),
};

// Player endpoints
export const PlayerService = {
  getAll: (): Promise<AxiosResponse<PaginatedResponse<Player> | Player[]>> => 
    api.get(`${API_URL}/players/`),
    
  getById: (id: number): Promise<AxiosResponse<Player>> => 
    api.get(`${API_URL}/players/${id}/`),
    
  create: (player: Partial<Player>): Promise<AxiosResponse<Player>> => 
    api.post(`${API_URL}/players/`, player),
    
  update: (id: number, player: Partial<Player>): Promise<AxiosResponse<Player>> => 
    api.put(`${API_URL}/players/${id}/`, player),
    
  delete: (id: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/players/${id}/`),
};

// ScrimGroup endpoints
export const ScrimGroupService = {
  getAll: (): Promise<AxiosResponse<PaginatedResponse<ScrimGroup> | ScrimGroup[]>> => 
    api.get(`${API_URL}/scrim-groups/`),
    
  getById: (id: number): Promise<AxiosResponse<ScrimGroup>> => 
    api.get(`${API_URL}/scrim-groups/${id}/`),
    
  create: (group: Partial<ScrimGroup>): Promise<AxiosResponse<ScrimGroup>> => 
    api.post(`${API_URL}/scrim-groups/`, group),
    
  update: (id: number, group: Partial<ScrimGroup>): Promise<AxiosResponse<ScrimGroup>> => 
    api.put(`${API_URL}/scrim-groups/${id}/`, group),
    
  delete: (id: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/scrim-groups/${id}/`),
  
  // Admin data for scrim group
  getAdminData: (id: number): Promise<AxiosResponse<Record<string, unknown>>> => 
    api.get(`${API_URL}/admin/scrim-group/${id}/`),
};

// Match endpoints
export const MatchService = {
  getAll: (): Promise<AxiosResponse<PaginatedResponse<Match> | Match[]>> => 
    api.get(`${API_URL}/matches/`),
    
  getById: (id: number): Promise<AxiosResponse<Match>> => 
    api.get(`${API_URL}/matches/${id}/`),
    
  create: (match: Partial<Match>): Promise<AxiosResponse<Match>> => 
    api.post(`${API_URL}/matches/`, match),
    
  update: (id: number, match: Partial<Match>): Promise<AxiosResponse<Match>> => 
    api.put(`${API_URL}/matches/${id}/`, match),
    
  delete: (id: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/matches/${id}/`),
  
  // Player stats for a match
  getPlayerStats: (matchId: number): Promise<AxiosResponse<PlayerMatchStat[]>> => 
    api.get(`${API_URL}/matches/${matchId}/player-stats/`),
    
  addPlayerStat: (matchId: number, stat: Partial<PlayerMatchStat>): Promise<AxiosResponse<PlayerMatchStat>> => 
    api.post(`${API_URL}/matches/${matchId}/player-stats/`, stat),
    
  updatePlayerStat: (matchId: number, statId: number, stat: Partial<PlayerMatchStat>): Promise<AxiosResponse<PlayerMatchStat>> => 
    api.put(`${API_URL}/matches/${matchId}/player-stats/${statId}/`, stat),
  
  // File uploads for a match
  getFiles: (matchId: number): Promise<AxiosResponse<FileUpload[]>> => 
    api.get(`${API_URL}/matches/${matchId}/files/`),
    
  addFile: (matchId: number, file: FormData): Promise<AxiosResponse<FileUpload>> => 
    api.post(`${API_URL}/matches/${matchId}/files/`, file, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
    
  deleteFile: (matchId: number, fileId: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/matches/${matchId}/files/${fileId}/`),
};

// Hero endpoints
export const HeroService = {
  getAll: (): Promise<AxiosResponse<PaginatedResponse<Hero> | Hero[]>> => 
    api.get(`${API_URL}/heroes/`),
    
  getById: (id: number): Promise<AxiosResponse<Hero>> => 
    api.get(`${API_URL}/heroes/${id}/`),
    
  create: (hero: Partial<Hero>): Promise<AxiosResponse<Hero>> => 
    api.post(`${API_URL}/heroes/`, hero),
    
  update: (id: number, hero: Partial<Hero>): Promise<AxiosResponse<Hero>> => 
    api.put(`${API_URL}/heroes/${id}/`, hero),
    
  delete: (id: number): Promise<AxiosResponse<void>> => 
    api.delete(`${API_URL}/heroes/${id}/`),
    
  getStats: (heroId: number): Promise<AxiosResponse<HeroStats>> =>
    api.get(`${API_URL}/heroes/${heroId}/stats/`),
    
  getPopular: (limit?: number): Promise<AxiosResponse<Hero[]>> =>
    api.get(`${API_URL}/heroes/popular/`, { params: { limit } }),
};

/**
 * Result of a backend connection test
 */
export interface BackendConnectionResult {
  success: boolean;
  message?: string;
  error?: ApiError;
  requiresAuth?: boolean;
  data?: Record<string, unknown>;
}

/**
 * Test connection to the backend API
 */
export const testBackendConnection = async (): Promise<BackendConnectionResult> => {
  try {
    // Try a GET request to a basic endpoint
    await api.get(`${API_URL}/teams/`);
    return { success: true, message: 'Backend connection successful' };
  } catch (error: unknown) {
    const apiError = toApiError(error);
    
    // If we get a 401, the backend is working but requires auth
    if (apiError.response?.status === 401) {
      return { 
        success: false, 
        requiresAuth: true,
        message: 'Backend connection successful but authentication required',
        error: apiError
      };
    }
    
    return { 
      success: false, 
      message: 'Backend connection failed. Make sure the Django server is running on port 8000.',
      error: apiError
    };
  }
};

/**
 * Check overall API status
 */
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
        const response = await api.get('/api/');
        return {
          isOnline: true,
          message: 'API is online but status endpoint unavailable',
          data: response.data
        };
      } catch (rootError: any) {
        if (rootError.response) {
          return {
            isOnline: true,
            message: 'API is online but returning errors',
            status: rootError.response.status,
            error: rootError.message
          };
        }
        throw rootError;
      }
    }
  } catch (error: any) {
    return {
      isOnline: false,
      message: 'API appears to be offline',
      error: error.message
    };
  }
};

/**
 * Check if a specific endpoint is available
 */
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