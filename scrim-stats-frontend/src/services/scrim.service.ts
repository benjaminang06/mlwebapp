import api from './api';
import { ScrimGroup } from '../types/match.types';

// Mock scrim group data to use when API is unavailable
const mockScrimGroups: ScrimGroup[] = [
  { 
    id: 1, 
    scrim_group_name: 'Spring Tournament 2025', 
    start_date: '2025-03-01',
    end_date: '2025-04-30' 
  },
  { 
    id: 2, 
    scrim_group_name: 'Summer Practice Games', 
    start_date: '2025-06-01',
    end_date: '2025-08-31'
  }
];

export const getScrimGroups = async (): Promise<ScrimGroup[]> => {
  try {
    const response = await api.get('/api/scrim-groups/');
    return response.data.results || response.data || mockScrimGroups;
  } catch (error) {
    console.error('Error fetching scrim groups, using mock data:', error);
    // Return mock data if API call fails
    return mockScrimGroups;
  }
};

export const createScrimGroup = async (data: Partial<ScrimGroup>): Promise<ScrimGroup> => {
  try {
    const response = await api.post('/api/scrim-groups/', data);
    return response.data;
  } catch (error) {
    console.error('Error creating scrim group:', error);
    throw error; // Re-throw the error since we can't mock creation
  }
}; 