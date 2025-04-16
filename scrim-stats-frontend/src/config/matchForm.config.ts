import * as Yup from 'yup';
import { getEmptyDraftFormData } from '../types/draft'; // Adjust path if needed
import { MatchFormData, PlayerMatchStat } from '../types/match.types'; // Adjust path if needed

// Initial form values
export const initialMatchValues: MatchFormData = {
  match_datetime: new Date().toISOString().slice(0, 16),
  match_duration_hours: 0,
  match_duration_minutes: 0,
  match_duration_seconds: 0,
  match_result: '', // Required, validated based on is_external_match
  _temp_winning_team_id: undefined, // Helper for external match winner selection

  // External match defaults
  is_external_match: false,
  team_1: '', // Blue side team ID
  team_2: '', // Red side team ID
  team_1_new: false,
  team_2_new: false,
  team_1_name: '', // For new team creation
  team_1_abbreviation: '', // For new team creation
  team_1_category: '', // For new team creation
  team_2_name: '',
  team_2_abbreviation: '',
  team_2_category: '',

  // Our team vs opponent defaults
  our_team: '', // Our team ID
  opponent_team: '', // Opponent team ID
  is_new_opponent: false,
  opponent_team_name: '', // For new opponent creation
  opponent_team_abbreviation: '',
  opponent_category: '',

  // Common defaults
  game_number: 1,
  general_notes: '',
  scrim_type: '', // Required
  team_side: '', // Required if not external

  // MVP selections
  mvp_player_id: undefined,
  mvp_loss_player_id: undefined,

  // Other components
  draft: getEmptyDraftFormData(),
  team_players: Array(5).fill({}).map((): Partial<PlayerMatchStat> => ({
    is_our_team: true, // Default assumption, might be overridden by RosterManager
    player_id: undefined,
    ign: '',
    hero_played: undefined, // Use undefined
    role_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    damage_dealt: undefined,
    damage_taken: undefined,
    turret_damage: undefined,
    gold_earned: undefined,
    player_notes: ''
  })),
  enemy_players: Array(5).fill({}).map((): Partial<PlayerMatchStat> => ({
    is_our_team: false,
    player_id: undefined,
    ign: '',
    hero_played: undefined, // Use undefined
    role_played: '',
    kills: 0,
    deaths: 0,
    assists: 0,
    damage_dealt: undefined,
    damage_taken: undefined,
    turret_damage: undefined,
    gold_earned: undefined,
    player_notes: ''
  })),
  files: [],
  players: [] // Existing players list fetched for dropdowns? (Confirm usage)
};

// Validation Schema
export const matchValidationSchema = Yup.object({
  match_datetime: Yup.date().required('Match date and time are required'),
  match_result: Yup.string()
    .required('Match result is required')
    .when('is_external_match', {
      is: false,
      then: schema => schema.oneOf(['VICTORY', 'DEFEAT'], 'Outcome must be VICTORY or DEFEAT for non-external matches'),
      otherwise: schema => schema.min(1, 'Winning team selection is required for external matches') 
    }),
  our_team: Yup.string().when('is_external_match', {
    is: false,
    then: () => Yup.string().required('Our team is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  opponent_team: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && !is_new_opponent,
    then: () => Yup.string().required('Opponent team is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_1: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && !team_1_new,
    then: () => Yup.string().required('Blue Side Team is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_2: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && !team_2_new,
    then: () => Yup.string().required('Red Side Team is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  opponent_team_name: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: () => Yup.string().required('Opponent team name is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  opponent_team_abbreviation: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: () => Yup.string().required('Opponent team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: () => Yup.string().notRequired(),
  }),
  opponent_category: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: () => Yup.string().required('Opponent category is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_1_name: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: () => Yup.string().required('Blue Side Team name is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_1_abbreviation: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: () => Yup.string().required('Blue Side Team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_1_category: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: () => Yup.string().required('Blue Side Team category is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_2_name: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: () => Yup.string().required('Red Side Team name is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_2_abbreviation: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: () => Yup.string().required('Red Side Team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: () => Yup.string().notRequired(),
  }),
  team_2_category: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: () => Yup.string().required('Red Side Team category is required'),
    otherwise: () => Yup.string().notRequired(),
  }),
  scrim_type: Yup.string().required('Scrim type is required').oneOf(['SCRIMMAGE', 'TOURNAMENT', 'RANKED'], 'Must be a valid scrim type'),
  game_number: Yup.number().required('Game number is required').positive().integer(),
  team_side: Yup.string().when('is_external_match', {
    is: false,
    then: () => Yup.string().required('Team side is required').oneOf(['BLUE', 'RED'], 'Must be either BLUE or RED'),
    otherwise: () => Yup.string().notRequired(),
  }),
  match_duration_hours: Yup.number().transform((value) => (isNaN(value) ? undefined : value)).nullable().min(0, 'Hours must be non-negative'),
  match_duration_minutes: Yup.number().transform((value) => (isNaN(value) ? undefined : value)).nullable().min(0, 'Minutes must be non-negative').max(59, 'Minutes must be less than 60'),
  match_duration_seconds: Yup.number().transform((value) => (isNaN(value) ? undefined : value)).nullable().min(0, 'Seconds must be non-negative').max(59, 'Seconds must be less than 60'),
  // Add validation for player stats if needed (e.g., at least one player per team)
  // Add validation for draft if needed
}); 