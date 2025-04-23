import { Match } from './match.types';
import { Player } from './player.types';
import { Team } from './team.types';

export interface HeroPickStats {
  hero_id: number;
  hero_name: string;
  picks: number;
  wins: number;
  winrate: number;
}

export interface PlayerStatistics {
  player: Player;
  total_matches: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_kda: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_damage_dealt: number;
  avg_gold_earned: number;
  avg_vision_score: number;
  favorite_heroes: HeroPickStats[];
  recent_matches: Match[];
}

export interface TeamStatistics {
  total_matches: number;
  wins: number;
  losses: number;
  winrate: number;
  avg_match_duration: string;
  avg_team_kda: number;
  avg_kills_per_match: number;
  avg_deaths_per_match: number;
  avg_assists_per_match: number;
  hero_pick_frequency: HeroPickStats[];
  damage_distribution: {
    player_id: number;
    player_name: string;
    average_damage: number;
    percentage: number;
  }[];
  gold_distribution: {
    player_id: number;
    player_name: string;
    average_gold: number;
    percentage: number;
  }[];
  vision_distribution: {
    player_id: number;
    player_name: string;
    average_vision: number;
    percentage: number;
  }[];
  objective_control_rate: number;
  player_statistics: PlayerStatistics[];
  recent_matches: Match[];
  performance_trend: {
    date: string;
    match_id: number;
    won: boolean;
    opponent: string;
    kda: number;
  }[];
} 