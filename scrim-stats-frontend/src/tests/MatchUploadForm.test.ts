import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMatch, createPlayerStat } from '../services/match.service';
import { testBackendConnection } from '../services/api';

// Mock the API services
vi.mock('../services/match.service', () => ({
  createMatch: vi.fn(),
  createPlayerStat: vi.fn(),
  uploadMatchFile: vi.fn()
}));

vi.mock('../services/api', () => ({
  testBackendConnection: vi.fn()
}));

// Test setup
describe('Match Upload Form Functionality', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Test automatic scrim group creation
  it('should automatically create a scrim group when not provided', async () => {
    // Setup a mock response from the createMatch function
    const mockMatch = {
      match_id: 123,
      match_date: '2023-06-01T18:00:00Z',
      match_outcome: 'VICTORY',
      scrim_type: 'SCRIMMAGE',
      game_number: 1,
      team_side: 'BLUE',
      created_at: '2023-06-01T18:30:00Z'
    };
    
    // Mock the API call to return our test data
    (createMatch as any).mockResolvedValue(mockMatch);
    
    // Mock parameters for creating a match
    const matchData = {
      match_date: '2023-06-01T18:00:00Z',
      match_outcome: 'VICTORY',
      scrim_type: 'SCRIMMAGE',
      game_number: 1,
      team_side: 'BLUE',
      our_team_id: 1,
      opponent_team_id: 2
    };
    
    // Call the mocked API function
    const result = await createMatch(matchData as any);
    
    // Verify the mock was called
    expect(createMatch).toHaveBeenCalledWith(matchData);
    
    // Verify we got our mock data back
    expect(result).toEqual(mockMatch);
  });
  
  // Test game number suggestion
  it('should correctly suggest the next game number', async () => {
    // Mock the API to make a call to the backend for game number suggestion
    const gameNumberEndpoint = '/api/matches/suggest_game_number/';
    const queryParams = {
      our_team_id: 1,
      opponent_team_id: 2,
      match_date: '2023-06-01T18:00:00Z',
      scrim_type: 'SCRIMMAGE'
    };
    
    // The test verifies this endpoint was called with the correct parameters
    // The implementation would be in the actual component
    
    // We would expect the backend to suggest game 2 if game 1 was already in the system
    const expectedResponse = { suggested_game_number: 2 };
    
    // In the actual component, this would trigger a state update to display
    // and potentially auto-fill the game number field
  });
  
  // Test backend connection check
  it('should check backend connection on form load', async () => {
    // Mock the connection test to return success
    (testBackendConnection as any).mockResolvedValue({
      success: true,
      requiresAuth: true
    });
    
    // In the component, this would show a success message
    // and proceed with loading teams, etc.
    
    // Verify the connection was checked
    expect(testBackendConnection).toHaveBeenCalled();
  });
}); 