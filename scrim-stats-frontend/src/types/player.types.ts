export interface PlayerAlias {
  alias_id: number;
  alias: string;
  created_at: string;
}

export interface PlayerTeamHistory {
  history_id: number;
  team: number;
  team_name: string;
  joined_date: string;
  left_date?: string;
  notes?: string;
}

export interface Player {
  player_id: number;
  current_ign: string;
  primary_role?: string;
  profile_image_url?: string;
  primary_team?: Team;
  team_id?: number; // For write operations
  aliases?: PlayerAlias[];
  team_history?: PlayerTeamHistory[];
  created_at?: string;
  updated_at?: string;
}

// Import Team type from team.types.ts
import { Team } from './team.types'; 