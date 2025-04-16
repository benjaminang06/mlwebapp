import { Hero } from './hero';

export type DraftFormat = '6_BANS' | '10_BANS';
export type TeamSide = 'BLUE' | 'RED';

export interface Draft {
  id: number;
  match: number;
  format: DraftFormat;
  is_complete: boolean;
  notes?: string;
  bans?: DraftBan[];
  picks?: DraftPick[];
  created_at: string;
  updated_at: string;
}

export interface DraftBan {
  id: number;
  draft: number;
  hero: Hero;
  team_side: TeamSide;
  ban_order: number;
}

export interface DraftPick {
  id: number;
  draft: number;
  hero: Hero;
  team_side: TeamSide;
  pick_order: number;
}

export interface DraftFormData {
  trackDraft: boolean;
  format: DraftFormat;
  notes?: string;
  blueSideBans: (Hero | null)[];
  redSideBans: (Hero | null)[];
  blueSidePicks: (Hero | null)[];
  redSidePicks: (Hero | null)[];
}

export const getEmptyDraftFormData = (): DraftFormData => ({
  trackDraft: false,
  format: '6_BANS',
  notes: '',
  blueSideBans: Array(5).fill(null),
  redSideBans: Array(5).fill(null),
  blueSidePicks: Array(5).fill(null),
  redSidePicks: Array(5).fill(null),
}); 