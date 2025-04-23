import { api } from './api.service';
import { toApiError } from '../types/api';
import { TeamStatistics, PlayerStatistics } from '../types/statistics.types';
import { getMatches, getPlayerStatsForMatch } from './match.service';
import { getTeamPlayers } from './team.service';
import { Match, PlayerMatchStat } from '../types/match.types';

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache storage
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface Cache {
  teamStatistics: Record<string, CacheEntry<TeamStatistics> | undefined>;
  playerStatistics: Record<string, CacheEntry<PlayerStatistics> | undefined>;
}

// Initialize cache
const cache: Cache = {
  teamStatistics: {},
  playerStatistics: {}
};

/**
 * Checks if a cache entry is still valid
 */
const isCacheValid = <T>(entry?: CacheEntry<T>): boolean => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_DURATION;
};

/**
 * Ensures all required fields are present in the statistics object
 * @param stats The statistics object to validate
 * @returns A new statistics object with all required fields
 */
const ensureStatsFields = (stats: Partial<TeamStatistics>): TeamStatistics => {
  return {
    total_matches: stats.total_matches || 0,
    wins: stats.wins || 0,
    losses: stats.losses || 0,
    winrate: stats.winrate || 0,
    avg_match_duration: stats.avg_match_duration || '00:00:00',
    avg_team_kda: stats.avg_team_kda || 0,
    avg_kills_per_match: stats.avg_kills_per_match || 0,
    avg_deaths_per_match: stats.avg_deaths_per_match || 0,
    avg_assists_per_match: stats.avg_assists_per_match || 0,
    hero_pick_frequency: stats.hero_pick_frequency || [],
    damage_distribution: stats.damage_distribution || [],
    gold_distribution: stats.gold_distribution || [],
    vision_distribution: stats.vision_distribution || [],
    objective_control_rate: stats.objective_control_rate || 0,
    player_statistics: stats.player_statistics || [],
    recent_matches: stats.recent_matches || [],
    performance_trend: stats.performance_trend || []
  };
};

/**
 * Fetches statistics for a specific team
 * @param teamId The ID of the team
 * @returns Promise containing team statistics
 */
export const getTeamStatistics = async (teamId: string): Promise<TeamStatistics> => {
  // Check cache first
  const cachedStats = cache.teamStatistics[teamId];
  if (isCacheValid(cachedStats)) {
    return cachedStats!.data;
  }

  try {
    // First try the backend API if it has a dedicated endpoint
    try {
      const response = await api.get<TeamStatistics>(`/api/statistics/team/${teamId}/`);
      const statistics = ensureStatsFields(response.data);
      
      // Update cache
      cache.teamStatistics[teamId] = {
        data: statistics,
        timestamp: Date.now()
      };
      
      return statistics;
    } catch (error) {
      // If the backend doesn't have this endpoint yet, calculate locally
      console.log('Backend statistics endpoint not available, calculating locally');
      return await calculateTeamStatistics(teamId);
    }
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Calculates team statistics from match data
 * This is a fallback when the backend API doesn't provide statistics
 */
const calculateTeamStatistics = async (teamId: string): Promise<TeamStatistics> => {
  // Fetch all matches
  const allMatches = await getMatches();
  
  // Filter matches for this team
  const teamMatches = allMatches.filter(match => 
    match.blue_side_team === Number(teamId) || 
    match.red_side_team === Number(teamId)
  );
  
  if (teamMatches.length === 0) {
    throw new Error('No matches found for this team');
  }
  
  // Get all player stats for these matches
  let playerStats: PlayerMatchStat[] = [];
  for (const match of teamMatches) {
    try {
      // Use the imported function that already handles paginated responses
      const matchPlayerStats = await getPlayerStatsForMatch(match.match_id);
      
      // Filter only for the specific team
      const teamPlayerStats = matchPlayerStats.filter(stat => stat.team === Number(teamId));
      playerStats = [...playerStats, ...teamPlayerStats];
    } catch (error) {
      console.error(`Failed to fetch player stats for match ${match.match_id}`, error);
    }
  }
  
  // Calculate wins/losses
  const wins = teamMatches.filter(match => match.winning_team === Number(teamId)).length;
  const losses = teamMatches.length - wins;
  
  // Get unique players - FILTER OUT UNDEFINED/NULL PLAYER IDS
  const uniquePlayerIds = [...new Set(playerStats
    .map(stat => stat.player)
    .filter(id => id !== undefined && id !== null))];
  
  console.log(`Found ${uniquePlayerIds.length} unique players with valid IDs for team ${teamId}`);
  
  // Calculate average duration
  let totalSeconds = 0;
  let matchesWithDuration = 0;
  
  for (const match of teamMatches) {
    if (match.match_duration) {
      const [hours, minutes, seconds] = match.match_duration.split(':').map(Number);
      const totalMatchSeconds = hours * 3600 + minutes * 60 + seconds;
      totalSeconds += totalMatchSeconds;
      matchesWithDuration++;
    }
  }
  
  const avgSeconds = matchesWithDuration > 0 ? Math.floor(totalSeconds / matchesWithDuration) : 0;
  const avgHours = Math.floor(avgSeconds / 3600);
  const avgMinutes = Math.floor((avgSeconds % 3600) / 60);
  const avgSecondsRemaining = avgSeconds % 60;
  
  const avgDuration = `${String(avgHours).padStart(2, '0')}:${String(avgMinutes).padStart(2, '0')}:${String(avgSecondsRemaining).padStart(2, '0')}`;
  
  // Calculate KDA and other metrics
  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  
  for (const stat of playerStats) {
    totalKills += stat.kills || 0;
    totalDeaths += stat.deaths || 0;
    totalAssists += stat.assists || 0;
  }
  
  const avgKDA = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : totalKills + totalAssists;
  
  // Hero pick frequencies
  const heroPicks: Record<number, { heroId: number, heroName: string, picks: number, wins: number }> = {};
  
  playerStats.forEach(stat => {
    // Check if hero_played exists and is not null
    if (stat.hero_played !== null && stat.hero_played !== undefined) {
      const heroId = typeof stat.hero_played === 'object' ? 
        (stat.hero_played as any).id || (stat.hero_played as any).hero_id : 
        stat.hero_played;
      
      if (!heroId) {
        console.warn('Cannot determine hero ID from stat', stat);
        return;
      }
      
      // Get hero name from either the hero_name property or from the hero object
      const heroName = stat.hero_name || 
        (typeof stat.hero_played === 'object' ? 
          (stat.hero_played as any).name : 
          `Hero ${heroId}`);
      
      if (!heroPicks[heroId]) {
        heroPicks[heroId] = {
          heroId,
          heroName,
          picks: 0,
          wins: 0
        };
      }
      
      heroPicks[heroId].picks++;
      
      // Determine if this was a win
      const match = teamMatches.find(m => m.match_id === stat.match);
      if (match && match.winning_team === Number(teamId)) {
        heroPicks[heroId].wins++;
      }
    }
  });
  
  console.log(`Found ${Object.keys(heroPicks).length} different heroes played by team ${teamId}`);
  
  const heroPickFrequency = Object.values(heroPicks).map(hero => ({
    hero_id: hero.heroId,
    hero_name: hero.heroName,
    picks: hero.picks,
    wins: hero.wins,
    winrate: (hero.wins / hero.picks) * 100
  })).sort((a, b) => b.picks - a.picks).slice(0, 10); // Top 10 most picked heroes
  
  // Simple player stats
  const playerStatistics = await Promise.all(
    uniquePlayerIds.map(async (playerId) => {
      // SAFETY CHECK: Skip if playerId is still undefined/null
      if (playerId === undefined || playerId === null) {
        console.warn('Skipping player with undefined/null ID');
        return null;
      }
      
      // Fetch the player details
      try {
        const playerResponse = await api.get(`/api/players/${playerId}/`);
        const player = playerResponse.data;
        
        // Get player's stats
        const playerMatchStats = playerStats.filter(stat => stat.player === playerId);
        const playerMatches = teamMatches.filter(match => 
          playerMatchStats.some(stat => stat.match === match.match_id)
        );
        
        const playerWins = playerMatches.filter(match => match.winning_team === Number(teamId)).length;
        const playerLosses = playerMatches.length - playerWins;
        
        let playerKills = 0;
        let playerDeaths = 0;
        let playerAssists = 0;
        let playerDamage = 0;
        let playerGold = 0;
        let playerVision = 0;
        let damageCount = 0;
        let goldCount = 0;
        let visionCount = 0;
        
        for (const stat of playerMatchStats) {
          playerKills += stat.kills || 0;
          playerDeaths += stat.deaths || 0;
          playerAssists += stat.assists || 0;
          
          if (stat.damage_dealt !== null && stat.damage_dealt !== undefined) {
            playerDamage += stat.damage_dealt;
            damageCount++;
          }
          
          if (stat.gold_earned !== null && stat.gold_earned !== undefined) {
            playerGold += stat.gold_earned;
            goldCount++;
          }
          
          if (stat.teamfight_participation !== null && stat.teamfight_participation !== undefined) {
            playerVision += stat.teamfight_participation;
            visionCount++;
          }
        }
        
        // Calculate player hero preferences
        const playerHeroPicks: Record<number, { heroId: number, heroName: string, picks: number, wins: number }> = {};
        
        for (const stat of playerMatchStats) {
          if (stat.hero_played) {
            const heroId = stat.hero_played;
            const heroName = stat.hero_name || 'Unknown Hero';
            
            if (!playerHeroPicks[heroId]) {
              playerHeroPicks[heroId] = { heroId, heroName, picks: 0, wins: 0 };
            }
            
            playerHeroPicks[heroId].picks++;
            
            // Check if this match was a win
            const match = teamMatches.find(m => m.match_id === stat.match);
            if (match && match.winning_team === Number(teamId)) {
              playerHeroPicks[heroId].wins++;
            }
          }
        }
        
        const favoriteHeroes = Object.values(playerHeroPicks).map(hero => ({
          hero_id: hero.heroId,
          hero_name: hero.heroName,
          picks: hero.picks,
          wins: hero.wins,
          winrate: (hero.wins / hero.picks) * 100
        })).sort((a, b) => b.picks - a.picks).slice(0, 5); // Top 5 most played
        
        return {
          player,
          total_matches: playerMatches.length,
          wins: playerWins,
          losses: playerLosses,
          winrate: playerMatches.length > 0 ? (playerWins / playerMatches.length) * 100 : 0,
          avg_kda: playerDeaths > 0 ? (playerKills + playerAssists) / playerDeaths : playerKills + playerAssists,
          avg_kills: playerMatches.length > 0 ? playerKills / playerMatches.length : 0,
          avg_deaths: playerMatches.length > 0 ? playerDeaths / playerMatches.length : 0,
          avg_assists: playerMatches.length > 0 ? playerAssists / playerMatches.length : 0,
          avg_damage_dealt: damageCount > 0 ? playerDamage / damageCount : 0,
          avg_gold_earned: goldCount > 0 ? playerGold / goldCount : 0,
          avg_vision_score: visionCount > 0 ? playerVision / visionCount : 0,
          favorite_heroes: favoriteHeroes,
          recent_matches: playerMatches.sort((a, b) => 
            new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
          ).slice(0, 5) // Last 5 matches
        };
      } catch (error) {
        console.error(`Failed to fetch details for player ${playerId}`, error);
        return null;
      }
    })
  );
  
  // Filter out null values from playerStatistics
  const validPlayerStatistics = playerStatistics.filter(Boolean) as PlayerStatistics[];
  
  // Calculate damage distribution
  const damageDistribution = validPlayerStatistics
    .map(playerStat => ({
      player_id: playerStat.player.player_id,
      player_name: playerStat.player.current_ign,
      average_damage: playerStat.avg_damage_dealt,
      percentage: 0 // Will calculate below
    }))
    .filter(player => player.average_damage > 0);
  
  const totalDamage = damageDistribution.reduce((sum, player) => sum + player.average_damage, 0);
  
  damageDistribution.forEach(player => {
    player.percentage = totalDamage > 0 ? (player.average_damage / totalDamage) * 100 : 0;
  });
  
  // Calculate gold distribution
  const goldDistribution = validPlayerStatistics
    .map(playerStat => ({
      player_id: playerStat.player.player_id,
      player_name: playerStat.player.current_ign,
      average_gold: playerStat.avg_gold_earned,
      percentage: 0 // Will calculate below
    }))
    .filter(player => player.average_gold > 0);
  
  const totalGold = goldDistribution.reduce((sum, player) => sum + player.average_gold, 0);
  
  goldDistribution.forEach(player => {
    player.percentage = totalGold > 0 ? (player.average_gold / totalGold) * 100 : 0;
  });
  
  // Calculate vision distribution
  const visionDistribution = validPlayerStatistics
    .map(playerStat => ({
      player_id: playerStat.player.player_id,
      player_name: playerStat.player.current_ign,
      average_vision: playerStat.avg_vision_score,
      percentage: 0 // Will calculate below
    }))
    .filter(player => player.average_vision > 0);
  
  const totalVision = visionDistribution.reduce((sum, player) => sum + player.average_vision, 0);
  
  visionDistribution.forEach(player => {
    player.percentage = totalVision > 0 ? (player.average_vision / totalVision) * 100 : 0;
  });
  
  // Calculate performance trend over time
  const performanceTrend = teamMatches
    .sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime())
    .map(match => {
      // Find the opponent team
      const opponentTeamId = match.blue_side_team === Number(teamId) 
        ? match.red_side_team 
        : match.blue_side_team;
      
      let opponentName = 'Unknown Opponent';
      if (match.blue_side_team_details && match.red_side_team_details) {
        opponentName = match.blue_side_team === Number(teamId)
          ? match.red_side_team_details.team_name
          : match.blue_side_team_details.team_name;
      }
      
      // Calculate team KDA for this match
      const matchPlayerStats = playerStats.filter(stat => 
        stat.match === match.match_id && stat.team === Number(teamId)
      );
      
      let matchKills = 0;
      let matchDeaths = 0;
      let matchAssists = 0;
      
      for (const stat of matchPlayerStats) {
        matchKills += stat.kills || 0;
        matchDeaths += stat.deaths || 0;
        matchAssists += stat.assists || 0;
      }
      
      const matchKDA = matchDeaths > 0 ? (matchKills + matchAssists) / matchDeaths : matchKills + matchAssists;
      
      return {
        date: match.match_date,
        match_id: match.match_id,
        won: match.winning_team === Number(teamId),
        opponent: opponentName,
        kda: matchKDA
      };
    });
  
  // Create the team statistics object
  const statistics: TeamStatistics = {
    total_matches: teamMatches.length,
    wins,
    losses,
    winrate: (wins / teamMatches.length) * 100,
    avg_match_duration: avgDuration,
    avg_team_kda: avgKDA,
    avg_kills_per_match: totalKills / teamMatches.length,
    avg_deaths_per_match: totalDeaths / teamMatches.length,
    avg_assists_per_match: totalAssists / teamMatches.length,
    hero_pick_frequency: heroPickFrequency,
    damage_distribution: damageDistribution,
    gold_distribution: goldDistribution,
    vision_distribution: visionDistribution,
    objective_control_rate: 0, // This would require additional data
    player_statistics: validPlayerStatistics,
    recent_matches: teamMatches
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime())
      .slice(0, 5), // Last 5 matches
    performance_trend: performanceTrend
  };
  
  // Ensure all fields exist
  const validatedStatistics = ensureStatsFields(statistics);
  
  // Update cache
  cache.teamStatistics[teamId] = {
    data: validatedStatistics,
    timestamp: Date.now()
  };
  
  return validatedStatistics;
};

/**
 * Fetches statistics for a specific player in a team
 * @param playerId The ID of the player
 * @param teamId The ID of the team
 * @returns Promise containing player statistics
 */
export const getPlayerStatistics = async (playerId: number, teamId: string): Promise<PlayerStatistics> => {
  // Create a cache key from both IDs
  const cacheKey = `${playerId}_${teamId}`;
  
  // Check cache first
  const cachedStats = cache.playerStatistics[cacheKey];
  if (isCacheValid(cachedStats)) {
    return cachedStats!.data;
  }

  try {
    // First try the backend API if it has a dedicated endpoint
    try {
      const response = await api.get<PlayerStatistics>(`/api/statistics/player/${playerId}/?team=${teamId}`);
      const statistics = response.data;
      
      // Update cache
      cache.playerStatistics[cacheKey] = {
        data: statistics,
        timestamp: Date.now()
      };
      
      return statistics;
    } catch (error) {
      // If the backend doesn't have this endpoint yet, get from team stats
      const teamStats = await getTeamStatistics(teamId);
      const playerStats = teamStats.player_statistics.find(p => p.player.player_id === playerId);
      
      if (!playerStats) {
        throw new Error(`Player ${playerId} not found in team ${teamId}`);
      }
      
      // Update cache
      cache.playerStatistics[cacheKey] = {
        data: playerStats,
        timestamp: Date.now()
      };
      
      return playerStats;
    }
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Invalidates the statistics cache
 */
export const invalidateStatisticsCache = (): void => {
  cache.teamStatistics = {};
  cache.playerStatistics = {};
}; 