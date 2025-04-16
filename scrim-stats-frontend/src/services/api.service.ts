import api from './api';
import { Team, TeamManagerRole } from '../types/team.types';
import { Player } from '../types/player.types';
import { Match, ScrimGroup, PlayerMatchStat, FileUpload } from '../types/match.types';
import { Hero } from '../types/hero.types';

// Base URL for API endpoints
const API_URL = '/api';

// Authentication endpoints
export const AuthService = {
  register: (userData: any) => api.post(`${API_URL}/register/`, userData),
  login: (credentials: { username: string; password: string }) => 
    api.post(`${API_URL}/token/`, credentials),
  refreshToken: (refresh: string) => api.post(`${API_URL}/token/refresh/`, { refresh }),
  getCsrfToken: () => api.get(`${API_URL}/csrf-token/`),
};

// Team endpoints
export const TeamService = {
  getAll: () => api.get<Team[]>(`${API_URL}/teams/`),
  getById: (id: number) => api.get<Team>(`${API_URL}/teams/${id}/`),
  create: (team: Partial<Team>) => api.post<Team>(`${API_URL}/teams/`, team),
  update: (id: number, team: Partial<Team>) => api.put<Team>(`${API_URL}/teams/${id}/`, team),
  delete: (id: number) => api.delete(`${API_URL}/teams/${id}/`),
  
  // Team role management
  getRoles: () => api.get<TeamManagerRole[]>(`${API_URL}/team-roles/`),
  updateRole: (data: TeamManagerRole) => api.post(`${API_URL}/team-roles/`, data),
};

// Player endpoints
export const PlayerService = {
  getAll: () => api.get<Player[]>(`${API_URL}/players/`),
  getById: (id: number) => api.get<Player>(`${API_URL}/players/${id}/`),
  create: (player: Partial<Player>) => api.post<Player>(`${API_URL}/players/`, player),
  update: (id: number, player: Partial<Player>) => api.put<Player>(`${API_URL}/players/${id}/`, player),
  delete: (id: number) => api.delete(`${API_URL}/players/${id}/`),
};

// ScrimGroup endpoints
export const ScrimGroupService = {
  getAll: () => api.get<ScrimGroup[]>(`${API_URL}/scrim-groups/`),
  getById: (id: number) => api.get<ScrimGroup>(`${API_URL}/scrim-groups/${id}/`),
  create: (group: Partial<ScrimGroup>) => api.post<ScrimGroup>(`${API_URL}/scrim-groups/`, group),
  update: (id: number, group: Partial<ScrimGroup>) => api.put<ScrimGroup>(`${API_URL}/scrim-groups/${id}/`, group),
  delete: (id: number) => api.delete(`${API_URL}/scrim-groups/${id}/`),
  
  // Admin data for scrim group
  getAdminData: (id: number) => api.get(`${API_URL}/admin/scrim-group/${id}/`),
};

// Match endpoints
export const MatchService = {
  getAll: () => api.get<Match[]>(`${API_URL}/matches/`),
  getById: (id: number) => api.get<Match>(`${API_URL}/matches/${id}/`),
  create: (match: Partial<Match>) => api.post<Match>(`${API_URL}/matches/`, match),
  update: (id: number, match: Partial<Match>) => api.put<Match>(`${API_URL}/matches/${id}/`, match),
  delete: (id: number) => api.delete(`${API_URL}/matches/${id}/`),
  
  // Player stats for a match
  getPlayerStats: (matchId: number) => 
    api.get<PlayerMatchStat[]>(`${API_URL}/matches/${matchId}/player-stats/`),
  addPlayerStat: (matchId: number, stat: Partial<PlayerMatchStat>) => 
    api.post<PlayerMatchStat>(`${API_URL}/matches/${matchId}/player-stats/`, stat),
  updatePlayerStat: (matchId: number, statId: number, stat: Partial<PlayerMatchStat>) => 
    api.put<PlayerMatchStat>(`${API_URL}/matches/${matchId}/player-stats/${statId}/`, stat),
  
  // File uploads for a match
  getFiles: (matchId: number) => 
    api.get<FileUpload[]>(`${API_URL}/matches/${matchId}/files/`),
  addFile: (matchId: number, file: Partial<FileUpload>) => 
    api.post<FileUpload>(`${API_URL}/matches/${matchId}/files/`, file),
  deleteFile: (matchId: number, fileId: number) => 
    api.delete(`${API_URL}/matches/${matchId}/files/${fileId}/`),
};

// Hero endpoints
export const HeroService = {
  getAll: () => api.get<Hero[]>(`${API_URL}/heroes/`),
  getById: (id: number) => api.get<Hero>(`${API_URL}/heroes/${id}/`),
  create: (hero: Partial<Hero>) => api.post<Hero>(`${API_URL}/heroes/`, hero),
  update: (id: number, hero: Partial<Hero>) => api.put<Hero>(`${API_URL}/heroes/${id}/`, hero),
  delete: (id: number) => api.delete(`${API_URL}/heroes/${id}/`),
};

// A utility to test backend connection
export interface BackendConnectionResult {
  success: boolean;
  message?: string;
  error?: unknown;
  requiresAuth?: boolean;
  data?: any;
}

export const testBackendConnection = async (): Promise<BackendConnectionResult> => {
  try {
    // Try a GET request to a basic endpoint
    await api.get(`${API_URL}/teams/`);
    return { success: true, message: 'Backend connection successful' };
  } catch (error: any) {
    // If we get a 401, the backend is working but requires auth
    if (error.response && error.response.status === 401) {
      return { 
        success: false, 
        requiresAuth: true,
        message: 'Backend connection successful but authentication required',
        error
      };
    }
    
    return { 
      success: false, 
      message: 'Backend connection failed. Make sure the Django server is running on port 8000.',
      error
    };
  }
}; 