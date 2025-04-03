import api from './api';
import { Player } from '../types/player.types';

// Mock player data to use when API is unavailable
const mockPlayers: Player[] = [
  { player_id: 1, current_ign: 'Player1', primary_role: 'Top' },
  { player_id: 2, current_ign: 'Player2', primary_role: 'Jungle' },
  { player_id: 3, current_ign: 'Player3', primary_role: 'Mid' },
  { player_id: 4, current_ign: 'Player4', primary_role: 'ADC' },
  { player_id: 5, current_ign: 'Player5', primary_role: 'Support' },
];

export const getPlayers = async (): Promise<Player[]> => {
  try {
    const response = await api.get('/api/players/');
    return response.data.results || response.data || mockPlayers;
  } catch (error) {
    console.error('Error fetching players, using mock data:', error);
    // Return mock data if API call fails
    return mockPlayers;
  }
};

export const searchPlayerByIGN = async (ign: string): Promise<Player[]> => {
  try {
    const response = await api.get(`/api/players/?search=${ign}`);
    return response.data.results || response.data || [];
  } catch (error) {
    console.error('Error searching player by IGN:', error);
    // Return filtered mock data based on search
    return mockPlayers.filter(player => 
      player.current_ign.toLowerCase().includes(ign.toLowerCase())
    );
  }
}; 