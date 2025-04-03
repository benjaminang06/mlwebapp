import api from './api';
import { Hero } from '../types/hero.types';

// Mock heroes data to use when API is unavailable
const mockHeroes: Hero[] = [
  { id: 1, hero_name: 'Ezreal', hero_role: 'ADC' },
  { id: 2, hero_name: 'Lee Sin', hero_role: 'Jungle' },
  { id: 3, hero_name: 'Thresh', hero_role: 'Support' },
  { id: 4, hero_name: 'Syndra', hero_role: 'Mid' },
  { id: 5, hero_name: 'Aatrox', hero_role: 'Top' },
];

export const getHeroes = async (): Promise<Hero[]> => {
  try {
    // Try to fetch from the real API
    const response = await api.get('/api/heroes/');
    return response.data.results || response.data || mockHeroes;
  } catch (error) {
    console.error('Error fetching heroes, using mock data:', error);
    // Return mock data if API call fails
    return mockHeroes;
  }
}; 