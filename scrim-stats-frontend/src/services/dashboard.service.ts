import api from './api';

/**
 * Interface for overall dashboard statistics
 */
export interface DashboardStats {
  totalMatches: number;
  winRate: number;
  topHeroes: Array<{
    name: string;
    winRate: number;
  }>;
  recentMatches: Array<{
    id: string | number;
    opponent: string;
    result: string;
    date: string;
  }>;
  topPlayers: Array<{
    id: string | number;
    name: string;
    kda: string;
    position: string;
  }>;
}

/**
 * Get dashboard statistics for the home page
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    // Get total matches
    const matchesResponse = await api.get('/api/matches/');
    const matches = matchesResponse.data;
    
    // Calculate win rate
    const wins = matches.filter(match => match.match_outcome === 'Win').length;
    const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;
    
    // Get recent matches
    const recentMatchesResponse = await api.get('/api/matches/recent/');
    const recentMatches = recentMatchesResponse.data.map(match => ({
      id: match.id,
      opponent: match.opponent_team_name,
      result: match.match_outcome,
      date: new Date(match.match_date_time).toLocaleDateString()
    }));
    
    // For top heroes and players, we'll need to make additional API calls
    // These endpoints might not exist yet, so we'll provide placeholder data for now
    
    // Get top heroes (placeholder - actual endpoint should be implemented in backend)
    const topHeroes = [
      { name: 'Ezreal', winRate: 78 },
      { name: 'Lee Sin', winRate: 75 },
      { name: 'Thresh', winRate: 70 }
    ];
    
    // Get top players (placeholder - actual endpoint should be implemented in backend)
    const topPlayers = [
      { id: 1, name: 'Player1', kda: '4.2', position: 'Top' },
      { id: 2, name: 'Player2', kda: '3.8', position: 'Jungle' },
      { id: 3, name: 'Player3', kda: '5.1', position: 'Mid' }
    ];
    
    return {
      totalMatches: matches.length,
      winRate,
      recentMatches,
      topHeroes,
      topPlayers
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return placeholder data if API calls fail
    return {
      totalMatches: 0,
      winRate: 0,
      topHeroes: [],
      recentMatches: [],
      topPlayers: []
    };
  }
};

/**
 * Get statistics about a specific team
 */
export const getTeamStats = async (teamId: string): Promise<any> => {
  const response = await api.get(`/api/teams/${teamId}/statistics/`);
  return response.data;
};

/**
 * Get top heroes by win rate
 */
export const getTopHeroes = async (limit: number = 3): Promise<any[]> => {
  // This endpoint might not exist yet, implement in backend
  try {
    // For now, return placeholder data
    return [
      { name: 'Ezreal', winRate: 78 },
      { name: 'Lee Sin', winRate: 75 },
      { name: 'Thresh', winRate: 70 }
    ];
  } catch (error) {
    console.error('Error fetching top heroes:', error);
    return [];
  }
};

/**
 * Get top players by KDA
 */
export const getTopPlayers = async (limit: number = 3): Promise<any[]> => {
  // This endpoint might not exist yet, implement in backend
  try {
    // For now, return placeholder data
    return [
      { id: 1, name: 'Player1', kda: '4.2', position: 'Top' },
      { id: 2, name: 'Player2', kda: '3.8', position: 'Jungle' },
      { id: 3, name: 'Player3', kda: '5.1', position: 'Mid' }
    ];
  } catch (error) {
    console.error('Error fetching top players:', error);
    return [];
  }
}; 