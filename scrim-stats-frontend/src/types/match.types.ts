import { Team } from './team.types';
import { Player } from './player.types';
import { Hero } from './hero.types';
import { DraftFormData, getEmptyDraftFormData } from './draft';

export interface ScrimGroup {
  scrim_group_id: number;
  scrim_group_name: string;
  start_date: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Match {
  match_id: number;
  scrim_group?: ScrimGroup;
  scrim_group_id?: number; // For write operations
  submitted_by_details?: User;
  submitted_by?: number; // For write operations
  match_date: string;
  our_team_details?: Team;
  our_team_id?: number; // For write operations
  opponent_team_details?: Team;
  opponent_team_id?: number; // For write operations
  match_duration?: string;
  is_external_match?: boolean;
  scrim_type: 'SCRIMMAGE' | 'TOURNAMENT' | 'RANKED';
  match_outcome: 'VICTORY' | 'DEFEAT';
  mvp?: number;
  mvp_loss?: number;
  score_details?: any;
  winning_team?: number;
  general_notes?: string;
  game_number: number;
  team_side: 'BLUE' | 'RED';
  created_at?: string;
  updated_at?: string;
  blue_side_team: number;
  red_side_team: number;
}

export interface PlayerMatchStat {
  stats_id?: number;
  match?: number;
  player_details?: Player;
  player_id?: number;
  team?: number;
  ign?: string;
  role_played?: string | null;
  hero_played?: Hero | string | number | null | undefined;
  kills?: number;
  deaths?: number;
  assists?: number;
  kda?: number | null;
  damage_dealt?: number | null;
  damage_taken?: number | null;
  turret_damage?: number | null;
  teamfight_participation?: number | null;
  gold_earned?: number | null;
  player_notes?: string | null;
  is_our_team?: boolean;
  created_at?: string;
  updated_at?: string;
  is_blue_side?: boolean;
  medal?: string | null;
  pick_order?: number | null;
}

export interface FileUpload {
  file_id: number;
  match: number;
  file_url: string;
  file_type: string;
  uploaded_at?: string;
}

export interface MatchAward {
  id?: number;
  match: number;
  player: number;
  award_type: 'MVP' | 'MVP_LOSS' | 'MOST_DAMAGE' | 'MOST_GOLD' | 'MOST_TURRET_DAMAGE' | 
              'MOST_DAMAGE_TAKEN' | 'BEST_KDA' | 'MOST_KILLS' | 'MOST_ASSISTS' | 'LEAST_DEATHS';
  stat_value?: number | null;
}

export interface MatchFormData {
  match_datetime: string;
  match_duration_hours?: number | '';
  match_duration_minutes?: number | '';
  match_duration_seconds?: number | '';
  match_result: string;
  _temp_winning_team_id?: number;

  is_external_match: boolean;
  team_1?: string;
  team_2?: string;
  team_1_new?: boolean;
  team_2_new?: boolean;
  team_1_name?: string;
  team_1_abbreviation?: string;
  team_1_category?: string;
  team_2_name?: string;
  team_2_abbreviation?: string;
  team_2_category?: string;

  our_team?: string;
  opponent_team: string;
  is_new_opponent: boolean;
  opponent_team_name: string;
  opponent_team_abbreviation: string;
  opponent_category: string;

  game_number: number;
  general_notes: string;
  scrim_type: string;
  team_side: string;

  mvp_player_id?: number | string | Player | undefined;
  mvp_loss_player_id?: number | string | Player | undefined;

  draft: DraftFormData;
  team_players: Partial<PlayerMatchStat>[];
  enemy_players: Partial<PlayerMatchStat>[];
  files: File[];
  players: Player[];
  blueBans: (Hero | null)[];
  redBans: (Hero | null)[];
  draft_format: 'THREE_BANS' | 'FIVE_BANS';
} 