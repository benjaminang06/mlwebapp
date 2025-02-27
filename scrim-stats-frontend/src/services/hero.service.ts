import api from './api';
import { Hero } from '../types/hero.types';

export const getHeroes = async (): Promise<Hero[]> => {
  // This endpoint would need to be created in your backend
  // For now, we'll return a mock list of heroes
  return [
    { id: 1, hero_name: 'Hero 1' },
    { id: 2, hero_name: 'Hero 2' },
    { id: 3, hero_name: 'Hero 3' },
  ];
}; 