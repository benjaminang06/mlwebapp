import { api } from './api.service';
import { ScrimGroup } from '../types/match.types';

// Circuit breaker implementation
const circuitBreaker = {
  scrimGroupsEndpointFailed: false,
  lastFailureTime: 0,
  failureThreshold: 5000, // 5 seconds before trying again
  
  // Check if we should skip the API call
  shouldSkipCall(endpoint: string): boolean {
    if (endpoint === 'scrim-groups' && this.scrimGroupsEndpointFailed) {
      // Check if enough time has passed to try again
      const now = Date.now();
      if (now - this.lastFailureTime > this.failureThreshold) {
        // Reset and allow a retry
        this.scrimGroupsEndpointFailed = false;
        return false;
      }
      return true;
    }
    return false;
  },
  
  // Mark an endpoint as failed
  markEndpointFailed(endpoint: string): void {
    if (endpoint === 'scrim-groups') {
      this.scrimGroupsEndpointFailed = true;
      this.lastFailureTime = Date.now();
      console.warn(`Circuit breaker activated for ${endpoint} endpoint`);
    }
  }
};

// In-memory cache for local scrim groups (client-side only)
let localScrimGroups: ScrimGroup[] = [];

/**
 * Retrieve all scrim groups from the API
 * @returns Promise resolving to an array of ScrimGroup objects
 */
export const getScrimGroups = async (): Promise<ScrimGroup[]> => {
  // Check if we should skip the API call due to previous failures
  if (circuitBreaker.shouldSkipCall('scrim-groups')) {
    console.info('Using local scrim groups due to previous API failures');
    return localScrimGroups;
  }
  
  try {
    const response = await api.get('/api/scrim-groups/');
    const groups = response.data.results || response.data || [];
    
    // Reset circuit breaker if successful
    circuitBreaker.scrimGroupsEndpointFailed = false;
    
    return groups;
  } catch (error) {
    console.error('Failed to fetch scrim groups:', error);
    
    // Activate circuit breaker
    circuitBreaker.markEndpointFailed('scrim-groups');
    
    // Return any local scrim groups we might have
    return localScrimGroups;
  }
};

/**
 * Create a new scrim group 
 * @param data Partial ScrimGroup data to create
 * @returns Promise resolving to the created ScrimGroup
 */
export const createScrimGroup = async (data: Partial<ScrimGroup>): Promise<ScrimGroup> => {
  try {
    // If it's a local group (negative ID), just store it locally
    if (data.scrim_group_id && data.scrim_group_id < 0) {
      const newGroup = data as ScrimGroup;
      
      // Add to local collection
      localScrimGroups.push(newGroup);
      
      return newGroup;
    }
    
    // Otherwise try to create it via API
    if (!circuitBreaker.shouldSkipCall('scrim-groups')) {
      try {
        const response = await api.post('/api/scrim-groups/', data);
        return response.data;
      } catch (error) {
        console.error('Failed to create scrim group via API:', error);
        circuitBreaker.markEndpointFailed('scrim-groups');
      }
    }
    
    // Fallback: create a client-side only group
    const fallbackGroup: ScrimGroup = {
      scrim_group_id: -(Date.now()), // Use negative timestamp as unique ID
      scrim_group_name: data.scrim_group_name || 'New Scrim Group',
      start_date: data.start_date || new Date().toISOString(),
      notes: (data.notes || '') + ' (Created locally due to API issues)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add to local collection
    localScrimGroups.push(fallbackGroup);
    
    return fallbackGroup;
  } catch (error) {
    console.error('Failed to create scrim group:', error);
    
    // Always provide a fallback
    const fallbackGroup: ScrimGroup = {
      scrim_group_id: -(Date.now()), // Use negative timestamp as unique ID
      scrim_group_name: data.scrim_group_name || 'New Scrim Group',
      start_date: data.start_date || new Date().toISOString(),
      notes: (data.notes || '') + ' (Created locally due to error)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Add to local collection
    localScrimGroups.push(fallbackGroup);
    
    return fallbackGroup;
  }
};

/**
 * Get a scrim group by its ID
 * @param id ScrimGroup ID
 * @returns Promise resolving to a ScrimGroup
 */
export const getScrimGroupById = async (id: number): Promise<ScrimGroup | null> => {
  // For local groups (negative IDs), look in local collection
  if (id < 0) {
    const localGroup = localScrimGroups.find(g => g.scrim_group_id === id);
    return localGroup || null;
  }
  
  // Check if we should skip the API call
  if (circuitBreaker.shouldSkipCall('scrim-groups')) {
    console.info('Skipping API call to fetch scrim group due to previous failures');
    return null;
  }
  
  try {
    const response = await api.get(`/api/scrim-groups/${id}/`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch scrim group with ID ${id}:`, error);
    
    // Activate circuit breaker
    circuitBreaker.markEndpointFailed('scrim-groups');
    
    return null;
  }
}; 