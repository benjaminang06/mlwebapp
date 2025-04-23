import { api } from './api.service';
import { Hero, HeroStats } from '../types/hero.types';
import { HeroService } from './api.service';
import { PaginatedResponse } from '../types/api';

// Helper function to extract results from paginated responses
const extractResultsFromPaginated = <T>(data: PaginatedResponse<T> | T[]): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data && 'results' in data && Array.isArray(data.results)) {
    return data.results;
  }
  
  console.error('Unexpected API response structure:', data);
  return [];
};

// Cache configuration
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Cache interface
interface Cache {
  heroes: {
    data: Hero[] | null;
    timestamp: number | null;
  };
  heroById: {
    [id: number]: {
      data: Hero | null;
      timestamp: number | null;
    };
  };
  heroStats: {
    [id: number]: {
      data: HeroStats | null;
      timestamp: number | null;
    };
  };
  popularHeroes: {
    [limit: number]: {
      data: Hero[] | null;
      timestamp: number | null;
    };
  };
}

// Initialize cache
const cache: Cache = {
  heroes: {
    data: null,
    timestamp: null,
  },
  heroById: {},
  heroStats: {},
  popularHeroes: {},
};

/**
 * Check if a cache entry is still valid
 */
const isCacheValid = (timestamp: number | null): boolean => {
  if (timestamp === null) {
    return false;
  }
  return Date.now() - timestamp < CACHE_DURATION_MS;
};

/**
 * Get all heroes with caching
 * @returns Promise<Hero[]> An array of heroes
 */
export const getHeroes = async (): Promise<Hero[]> => {
  // Check if we have cached data and it's still valid
  if (cache.heroes.data && isCacheValid(cache.heroes.timestamp)) {
    console.log('[hero.service] Returning cached heroes');
    return cache.heroes.data;
  }

  console.log('[hero.service] Fetching heroes from API');
  try {
    const response = await HeroService.getAll();
    // Use the local function with the response data
    const heroes = extractResultsFromPaginated(response.data);
    
    // Update cache
    cache.heroes = {
      data: heroes,
      timestamp: Date.now(),
    };
    
    return heroes;
  } catch (error) {
    console.error('[hero.service] Error fetching heroes:', error);
    throw error;
  }
};

/**
 * Get a hero by ID with caching
 * @param id The hero ID
 * @returns Promise<Hero> The hero
 */
export const getHero = async (id: number): Promise<Hero> => {
  // Check if we have cached data and it's still valid
  if (cache.heroById[id]?.data && isCacheValid(cache.heroById[id]?.timestamp)) {
    console.log(`[hero.service] Returning cached hero with ID ${id}`);
    return cache.heroById[id].data!;
  }

  console.log(`[hero.service] Fetching hero with ID ${id} from API`);
  try {
    const response = await HeroService.getById(id);
    
    // Update cache
    if (!cache.heroById[id]) {
      cache.heroById[id] = {
        data: null,
        timestamp: null,
      };
    }
    
    cache.heroById[id] = {
      data: response.data,
      timestamp: Date.now(),
    };
    
    return response.data;
  } catch (error) {
    console.error(`[hero.service] Error fetching hero with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Get hero statistics with caching
 * @param heroId The hero ID
 * @returns Promise<HeroStats> The hero statistics
 */
export const getHeroStats = async (heroId: number): Promise<HeroStats> => {
  // Check if we have cached data and it's still valid
  if (cache.heroStats[heroId]?.data && isCacheValid(cache.heroStats[heroId]?.timestamp)) {
    console.log(`[hero.service] Returning cached hero stats for hero ID ${heroId}`);
    return cache.heroStats[heroId].data!;
  }

  console.log(`[hero.service] Fetching hero stats for hero ID ${heroId} from API`);
  try {
    const response = await HeroService.getStats(heroId);
    
    // Update cache
    if (!cache.heroStats[heroId]) {
      cache.heroStats[heroId] = {
        data: null,
        timestamp: null,
      };
    }
    
    cache.heroStats[heroId] = {
      data: response.data,
      timestamp: Date.now(),
    };
    
    return response.data;
  } catch (error) {
    console.error(`[hero.service] Error fetching hero stats for hero ID ${heroId}:`, error);
    throw error;
  }
};

/**
 * Get popular heroes with caching
 * @param limit Number of heroes to return
 * @returns Promise<Hero[]> Array of popular heroes
 */
export const getPopularHeroes = async (limit?: number): Promise<Hero[]> => {
  const cacheKey = limit || 0;
  
  // Check if we have cached data and it's still valid
  if (cache.popularHeroes[cacheKey]?.data && isCacheValid(cache.popularHeroes[cacheKey]?.timestamp)) {
    console.log(`[hero.service] Returning cached popular heroes (limit: ${limit})`);
    return cache.popularHeroes[cacheKey].data!;
  }

  console.log(`[hero.service] Fetching popular heroes from API (limit: ${limit})`);
  try {
    const response = await HeroService.getPopular(limit);
    
    // Update cache
    if (!cache.popularHeroes[cacheKey]) {
      cache.popularHeroes[cacheKey] = {
        data: null,
        timestamp: null,
      };
    }
    
    cache.popularHeroes[cacheKey] = {
      data: response.data,
      timestamp: Date.now(),
    };
    
    return response.data;
  } catch (error) {
    console.error(`[hero.service] Error fetching popular heroes (limit: ${limit}):`, error);
    throw error;
  }
}; 