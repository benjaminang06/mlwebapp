import api from './api';
import { Player } from '../types/player.types';

export const getPlayers = async (): Promise<Player[]> => {
  const response = await api.get('/api/players/');
  return response.data.results || [];
};

export const searchPlayerByIGN = async (ign: string): Promise<Player[]> => {
  const response = await api.get(`/api/players/?search=${ign}`);
  return response.data.results || [];
}; 