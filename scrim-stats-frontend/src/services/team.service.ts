import { api } from './api.service';
import { Team, TeamManagerRole } from '../types/team.types';
import { Player } from '../types/player.types';
import { PaginatedResponse, toApiError } from '../types/api';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface Cache {
  allTeams?: CacheEntry<Team[]>;
  managedTeams?: CacheEntry<Team[]>;
  teamById: Record<string, CacheEntry<Team> | undefined>;
  teamPlayers: Record<string, CacheEntry<Player[]> | undefined>;
}

// Initialize cache
const cache: Cache = {
  teamById: {},
  teamPlayers: {}
};

/**
 * Checks if a cache entry is still valid
 * @param entry The cache entry to check
 * @returns True if the entry is valid, false otherwise
 */
const isCacheValid = <T>(entry?: CacheEntry<T>): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_DURATION;
};

/**
 * Get all teams with caching
 * @returns Promise containing list of teams
 */
export const getTeams = async (): Promise<Team[]> => {
  // Check cache first
  if (isCacheValid(cache.allTeams)) {
    return cache.allTeams?.data || [];
  }

  try {
    const response = await api.get<PaginatedResponse<Team>>('/api/teams/');
    const teams = response.data.results;
    
    // Update cache
    cache.allTeams = {
      data: teams,
      timestamp: Date.now()
    };
    
    return teams;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get teams managed by the current user with caching
 * @returns Promise containing list of managed teams
 */
export const getManagedTeams = async (): Promise<Team[]> => {
  // Check cache first
  if (isCacheValid(cache.managedTeams)) {
    return cache.managedTeams?.data || [];
  }

  try {
    const response = await api.get<PaginatedResponse<Team>>('/api/teams/', {
      params: { managed: true }
    });
    const teams = response.data.results;
    
    // Update cache
    cache.managedTeams = {
      data: teams,
      timestamp: Date.now()
    };
    
    return teams;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get a team by ID with caching
 * @param teamId The ID of the team to fetch
 * @returns Promise containing the team details
 */
export const getTeam = async (teamId: string): Promise<Team> => {
  // Check cache first
  const cachedTeam = cache.teamById[teamId];
  if (isCacheValid(cachedTeam)) {
    return cachedTeam!.data;
  }

  try {
    const response = await api.get<Team>(`/api/teams/${teamId}/`);
    const team = response.data;
    
    // Update cache
    cache.teamById[teamId] = {
      data: team,
      timestamp: Date.now()
    };
    
    return team;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get players for a specific team with caching
 * @param teamId The ID of the team
 * @returns Promise containing list of players
 */
export const getTeamPlayers = async (teamId: string): Promise<Player[]> => {
  // Check cache first
  const cachedPlayers = cache.teamPlayers[teamId];
  if (isCacheValid(cachedPlayers)) {
    return cachedPlayers!.data;
  }

  try {
    const response = await api.get<PaginatedResponse<Player>>(`/api/teams/${teamId}/players/`);
    const players = response.data.results;
    
    // Update cache
    cache.teamPlayers[teamId] = {
      data: players,
      timestamp: Date.now()
    };
    
    return players;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Creates a new team
 * @param teamData The team data to create
 * @returns Promise resolving to the created team
 */
export const createTeam = async (teamData: Partial<Team>): Promise<Team> => {
  try {
    const response = await api.post<Team>('/api/teams/', teamData);
    
    // Invalidate relevant caches
    cache.allTeams = undefined;
    cache.managedTeams = undefined;
    
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Updates an existing team
 * @param teamId The ID of the team to update
 * @param teamData The updated team data
 * @returns Promise resolving to the updated team
 */
export const updateTeam = async (teamId: number | string, teamData: Partial<Team>): Promise<Team> => {
  try {
    const response = await api.put<Team>(`/api/teams/${teamId}/`, teamData);
    
    // Invalidate relevant caches
    const cacheKey = String(teamId);
    cache.allTeams = undefined;
    cache.managedTeams = undefined;
    cache.teamById[cacheKey] = undefined;
    
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Deletes a team
 * @param teamId The ID of the team to delete
 * @returns Promise resolving to void
 */
export const deleteTeam = async (teamId: number | string): Promise<void> => {
  try {
    await api.delete(`/api/teams/${teamId}/`);
    
    // Invalidate relevant caches
    const cacheKey = String(teamId);
    cache.allTeams = undefined;
    cache.managedTeams = undefined;
    cache.teamById[cacheKey] = undefined;
    
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Adds a player to a team
 * @param teamId The ID of the team
 * @param playerData The player data to add
 * @returns Promise resolving to the added player
 */
export const addPlayerToTeam = async (
  teamId: number | string, 
  playerData: Partial<Player>
): Promise<Player> => {
  try {
    const response = await api.post<Player>(`/api/teams/${teamId}/add_player/`, playerData);
    
    // Invalidate team players cache
    const cacheKey = String(teamId);
    cache.teamPlayers[cacheKey] = undefined;
    
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetches team manager roles
 * @returns Promise resolving to an array of team manager roles
 */
export const getTeamManagerRoles = async (): Promise<TeamManagerRole[]> => {
  try {
    const response = await api.get<TeamManagerRole[]>('/api/team-roles/');
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Updates a team manager role
 * @param roleData The role data to update
 * @returns Promise resolving to the updated role
 */
export const updateTeamManagerRole = async (
  roleData: TeamManagerRole
): Promise<TeamManagerRole> => {
  try {
    const response = await api.post<TeamManagerRole>('/api/team-roles/', roleData);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Manually invalidates the team cache
 * Useful when you know the data might have changed
 */
export const invalidateTeamCache = (): void => {
  cache.allTeams = undefined;
  cache.managedTeams = undefined;
  cache.teamById = {};
  cache.teamPlayers = {};
}; 