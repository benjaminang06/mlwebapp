export interface Team {
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  team_category: string;
  managers?: number[];
  is_opponent_only?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TeamManagerRole {
  id?: number;
  team: number;
  user: number;
  role: 'head_coach' | 'assistant' | 'analyst' | 'viewer';
} 