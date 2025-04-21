import { apiClient } from './apiClient'; // Assuming apiClient handles base URL and auth
import { Match, PlayerMatchStat } from '../types/match.types'; // Import the Match type

// Define the structure of the paginated response if your API uses pagination
interface PaginatedMatchesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Match[];
}

interface PaginatedPlayerStatsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlayerMatchStat[];
}

/**
 * Fetches a list of matches from the backend API.
 * Handles potential pagination.
 */
export const getMatches = async (): Promise<Match[]> => {
  try {
    // Adjust the endpoint as needed, e.g., if pagination requires query params
    const response = await apiClient.get<PaginatedMatchesResponse>("/api/matches/");
    
    // If your API returns a paginated response, return results.
    // If not paginated, adjust the type and return response.data directly.
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    } else {
      // Handle cases where the API response structure is different than expected
      // or if it's not paginated and returns the array directly.
      // For now, assume pagination based on DRF standards.
      console.error('Unexpected API response structure:', response.data);
      return []; 
    }
  } catch (error) {
    console.error('Error fetching matches:', error);
    // Consider more robust error handling/throwing the error
    throw error; // Re-throw the error to be caught by the component
  }
};

/**
 * Fetches a specific match by ID from the backend API.
 */
export const getMatchById = async (matchId: string | number): Promise<Match> => {
  try {
    const response = await apiClient.get<Match>(`/api/matches/${matchId}/`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching match with ID ${matchId}:`, error);
    throw error; // Re-throw the error to be caught by the component
  }
};

/**
 * Fetches player statistics for a specific match.
 */
export const getPlayerStatsForMatch = async (matchId: string | number): Promise<PlayerMatchStat[]> => {
  try {
    // This endpoint might be different based on your API structure
    // Some possible endpoints:
    // - /api/player-stats/?match=${matchId}
    // - /api/matches/${matchId}/player-stats/
    const response = await apiClient.get<PaginatedPlayerStatsResponse>(`/api/player-stats/?match=${matchId}`);
    
    if (response.data && Array.isArray(response.data.results)) {
      return response.data.results;
    } else if (Array.isArray(response.data)) {
      // In case it's not paginated and returns an array directly
      return response.data;
    } else {
      console.error('Unexpected player stats API response structure:', response.data);
      return [];
    }
  } catch (error) {
    console.error(`Error fetching player stats for match ${matchId}:`, error);
    throw error;
  }
};

// TODO: Add function for creating a match (createMatch) - Might already exist partially in MatchUploadForm logic 