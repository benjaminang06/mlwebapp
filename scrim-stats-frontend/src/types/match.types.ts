export interface Match {
  id?: string;
  match_date_time: string;
  opponent_category: string;
  opponent_team_name: string;
  opponent_team_abbreviation: string;
  scrim_type: string;
  match_outcome: string;
  general_notes?: string;
  game_number: number;
  team_side: string;
  scrim_group?: number | null;
  submitted_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerStat {
  id?: string;
  match: string;
  player: number;
  hero_played: string;
  kills: number;
  deaths: number;
  assists: number;
  computed_kda?: number;
  damage_dealt?: number;
  damage_taken?: number;
  turret_damage?: number;
  teamfight_participation?: number;
  gold_earned?: number;
  player_notes?: string;
  is_our_team: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FileUpload {
  id?: string;
  match: string;
  file_url: string;
  file_type: string;
  uploaded_at?: string;
}

export interface ScrimGroup {
  id: number;
  scrim_group_name: string;
  start_date: string;
  end_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
} 