import { api } from './api.service';
import { Match, PlayerMatchStat, FileUpload, ScrimGroup } from '../types/match.types';
import { Player } from '../types/player.types';
import { PaginatedResponse, ApiError, toApiError } from '../types/api';
import { AxiosResponse } from 'axios';

/**
 * Response type for suggested game number
 */
interface SuggestGameNumberResponse {
  suggested_game_number: number;
}

/**
 * Uniform handling of potentially paginated responses
 * @param response API response that could be paginated or a direct array
 * @returns Extracted array of results
 */
const extractResultsFromResponse = <T>(response: AxiosResponse<PaginatedResponse<T> | T[]>): T[] => {
  if (response.data && 'results' in response.data && Array.isArray(response.data.results)) {
    return response.data.results;
  } else if (Array.isArray(response.data)) {
    return response.data;
  }
  console.error('Unexpected API response structure:', response.data);
  return [];
};

/**
 * Create a new match
 * @param matchData Match data to create
 * @returns Promise resolving to the created match
 */
export const createMatch = async (matchData: Partial<Match>): Promise<Match> => {
  try {
    const response = await api.post<Match>('/api/matches/', matchData);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Create player match statistics
 * @param statData Player match statistics data
 * @returns Promise resolving to the created player match statistics
 */
export const createPlayerStat = async (statData: Partial<PlayerMatchStat>): Promise<PlayerMatchStat> => {
  try {
    const response = await api.post<PlayerMatchStat>('/api/player-match-stats/', statData);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Upload a file for a match
 * @param formData Form data containing the file
 * @returns Promise resolving to the uploaded file information
 */
export const uploadMatchFile = async (formData: FormData): Promise<FileUpload> => {
  try {
    const response = await api.post<FileUpload>('/api/file-uploads/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get recent matches
 * @returns Promise resolving to an array of recent matches
 */
export const getRecentMatches = async (): Promise<Match[]> => {
  try {
    const response = await api.get<Match[]>('/api/matches/recent/');
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get match by ID
 * @param id Match ID
 * @returns Promise resolving to the match with the given ID
 */
export const getMatchById = async (id: string | number): Promise<Match> => {
  try {
    const response = await api.get<Match>(`/api/matches/${id}/`);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Get matches for a date range
 * @param startDate Start date in ISO format
 * @param endDate End date in ISO format
 * @returns Promise resolving to an array of matches
 */
export const getMatchesByDateRange = async (
  startDate: string, 
  endDate: string
): Promise<Match[]> => {
  try {
    const response = await api.get<PaginatedResponse<Match> | Match[]>('/api/matches/', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return extractResultsFromResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetch all matches with optional filters
 * @param params Optional query parameters
 * @returns Promise resolving to an array of matches
 */
export const getMatches = async (
  params?: Record<string, string | number | boolean>
): Promise<Match[]> => {
  try {
    const response = await api.get<PaginatedResponse<Match> | Match[]>(
      '/api/matches/', 
      { 
        params: {
          ...(params || {}),
          page_size: 50 // Request a larger page size to show more matches at once
        } 
      }
    );
    return extractResultsFromResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetch player statistics for a specific match
 * @param matchId The ID of the match
 * @returns Promise resolving to an array of player match statistics
 */
export const getPlayerStatsForMatch = async (matchId: string | number): Promise<PlayerMatchStat[]> => {
  try {
    const response = await api.get<PaginatedResponse<PlayerMatchStat> | PlayerMatchStat[]>(
      `/api/matches/${matchId}/player-stats/`
    );
    return extractResultsFromResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetch players for a specific team.
 * Used for populating player stat rows.
 * @param teamId The ID of the team.
 * @returns A promise that resolves to an array of Player objects.
 */
export const getTeamPlayers = async (teamId: number): Promise<Player[]> => {
  if (!teamId) {
    console.warn('[getTeamPlayers] No teamId provided.');
    return []; // Return empty array if no ID
  }
  
  try {
    const response = await api.get<Player[]>(`/api/teams/${teamId}/players/`);
    return response.data;
  } catch (error) {
    console.error(`[getTeamPlayers] Error fetching players for team ${teamId}:`, error);
    // Returning empty array for form flow safety
    return []; 
  }
};

/**
 * Suggests the next game number based on existing matches within 8 hours
 * @param our_team_id ID of our team
 * @param opponent_team_id ID of opponent team
 * @param match_date Date of the match (ISO string)
 * @param scrim_type Type of scrim (SCRIMMAGE, TOURNAMENT, RANKED)
 * @returns A promise that resolves to the suggested game number
 */
export const suggestGameNumber = async (
  our_team_id: number,
  opponent_team_id: number,
  match_date: string,
  scrim_type: string
): Promise<number> => {
  try {
    const response = await api.get<SuggestGameNumberResponse>('/api/matches/suggest_game_number/', {
      params: {
        our_team_id,
        opponent_team_id,
        match_date,
        scrim_type
      }
    });
    
    return response.data.suggested_game_number;
  } catch (error) {
    console.error('Error suggesting game number:', error);
    // Default to game number 1 if API call fails
    return 1;
  }
};

/**
 * Fetches all scrim groups with their associated matches.
 * @returns A promise resolving to scrim groups as an array
 */
export const getScrimGroups = async (): Promise<ScrimGroup[]> => {
  try {
    const response = await api.get<PaginatedResponse<ScrimGroup> | ScrimGroup[]>('/api/scrim-groups/');
    return extractResultsFromResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetches matches for a specific scrim group.
 * @param scrimGroupId The ID of the scrim group
 * @returns A promise that resolves to matches as an array
 */
export const getMatchesByScrimGroup = async (
  scrimGroupId: number
): Promise<Match[]> => {
  try {
    const response = await api.get<PaginatedResponse<Match> | Match[]>(
      `/api/matches/`, 
      { params: { scrim_group: scrimGroupId } }
    );
    return extractResultsFromResponse(response);
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Update an existing match
 * @param matchId Match ID to update
 * @param matchData Match data to update
 * @returns Promise resolving to the updated match
 */
export const updateMatch = async (matchId: number | string, matchData: Partial<Match>): Promise<Match> => {
  try {
    const response = await api.patch<Match>(`/api/matches/${matchId}/`, matchData);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Update player match statistics
 * @param matchId Match ID containing the stat
 * @param statId PlayerMatchStat ID to update
 * @param statData Player match statistics data to update
 * @returns Promise resolving to the updated player match statistics
 */
export const updatePlayerStat = async (matchId: string | number, statId: number, statData: Partial<PlayerMatchStat>): Promise<PlayerMatchStat> => {
  try {
    const response = await api.patch<PlayerMatchStat>(`/api/matches/${matchId}/update-player-stats/${statId}/`, statData);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}; 