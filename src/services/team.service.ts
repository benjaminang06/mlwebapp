import api from './api';
import { Team } from '../types/team.types';
import { PaginatedResponse, toApiError } from '../types/api';

/**
 * Fetches all teams from the database
 * @returns Promise resolving to an array of teams
 */
export const getAllTeams = async (): Promise<Team[]> => {
  try {
    const response = await api.get<PaginatedResponse<Team>>('/api/teams/');
    return response.data.results || [];
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Fetches a team by ID
 * @param teamId The ID of the team to fetch
 * @returns Promise resolving to a team object
 */
export const getTeamById = async (teamId: number | string): Promise<Team> => {
  try {
    const response = await api.get<Team>(`/api/teams/${teamId}/`);
    return response.data;
  } catch (error) {
    throw toApiError(error);
  }
}; 