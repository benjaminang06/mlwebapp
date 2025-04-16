import api from './api';
import { Match, PlayerMatchStat, FileUpload } from '../types/match.types';
import { Player } from '../types/player.types';

// Create a new match
export const createMatch = async (matchData: Match): Promise<Match> => {
  const response = await api.post('/api/matches/', matchData);
  return response.data;
};

// Create player match statistics
export const createPlayerStat = async (statData: PlayerMatchStat): Promise<PlayerMatchStat> => {
  const response = await api.post('/api/player-match-stats/', statData);
  return response.data;
};

// Upload a file for a match
export const uploadMatchFile = async (formData: FormData): Promise<FileUpload> => {
  const response = await api.post('/api/file-uploads/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get recent matches
export const getRecentMatches = async () => {
  const response = await api.get('/api/matches/recent/');
  return response.data;
};

// Get match by ID
export const getMatchById = async (id: string) => {
  const response = await api.get(`/api/matches/${id}/`);
  return response.data;
};

// Get matches for a date range
export const getMatchesByDateRange = async (startDate: string, endDate: string) => {
  const response = await api.get('/api/matches/', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
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
    console.log(`[getTeamPlayers] Fetching players for team ID: ${teamId}`);
    const response = await api.get(`/api/teams/${teamId}/players/`);
    console.log(`[getTeamPlayers] Received response for team ID ${teamId}:`, response.data);
    // The backend endpoint returns player data directly (not paginated based on TeamPlayersView)
    return response.data as Player[]; 
  } catch (error) {
    console.error(`[getTeamPlayers] Error fetching players for team ${teamId}:`, error);
    // Decide error handling: throw or return empty array?
    // Returning empty array might be safer for the form flow.
    return []; 
  }
}; 