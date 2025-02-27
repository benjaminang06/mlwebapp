import api from './api';
import { ScrimGroup } from '../types/match.types';

export const getScrimGroups = async (): Promise<ScrimGroup[]> => {
  const response = await api.get('/api/scrim-groups/');
  return response.data.results || [];
};

export const createScrimGroup = async (data: Partial<ScrimGroup>): Promise<ScrimGroup> => {
  const response = await api.post('/api/scrim-groups/', data);
  return response.data;
}; 