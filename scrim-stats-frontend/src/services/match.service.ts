import api from './api';
import { Match, PlayerStat, FileUpload } from '../types/match.types';

// Create a new match
export const createMatch = async (matchData: Match): Promise<Match> => {
  const response = await api.post('/api/matches/', matchData);
  return response.data;
};

// Create player match statistics
export const createPlayerStat = async (statData: PlayerStat): Promise<PlayerStat> => {
  const response = await api.post('/api/player-match-stats/', statData);
  return response.data;
};

// Upload a file for a match
export const uploadMatchFile = async (formData: FormData): Promise<FileUpload> => {
  const response = await api.post('/api/file-uploads/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Get recent matches
export const getRecentMatches = async () => {
  const response = await api.get('/api/matches/recent/');
  return response.data;
};

// Get match by ID
export const getMatchById = async (id: string) => {
  const response = await api.get(`/api/matches/${id}/`);
  return response.data;
};

// Get matches for a date range
export const getMatchesByDateRange = async (startDate: string, endDate: string) => {
  const response = await api.get('/api/matches/', {
    params: {
      start_date: startDate,
      end_date: endDate,
    },
  });
  return response.data;
}; 