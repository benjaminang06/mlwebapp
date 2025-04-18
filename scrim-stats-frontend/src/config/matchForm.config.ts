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
    player_notes: '',
    pick_order: null,
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
    player_notes: '',
    pick_order: null,
  })),
  files: [],
  players: [], // Existing players list fetched for dropdowns? (Confirm usage)
  // --- NEW Ban fields initial values ---
  blueBans: Array(5).fill(null),
  redBans: Array(5).fill(null),
  // --- NEW: Draft Format initial value ---
  draft_format: 'FIVE_BANS',
  // --- END NEW ---
};

// Define the maximum number of bans (adjust if needed, e.g., based on format)

// --- Per-Step Validation Schemas --- 

// Step 0: Match Details Validation
const step0Schema = Yup.object({
  match_datetime: Yup.date().required('Match date and time are required'),
  match_result: Yup.string()
    .required('Match result is required')
    // Validation for match_result depends on whether it's external or not
    .when('is_external_match', {
      is: false, // Internal Match
      // Must be VICTORY or DEFEAT
      then: (schema) => schema.oneOf(['VICTORY', 'DEFEAT', 'DRAW'], 'Outcome must be VICTORY, DEFEAT, or DRAW').required('Match outcome is required'),
      // External Match: Value could be team ID or specific strings like BLUE_VICTORY/RED_VICTORY/DRAW
      // Requires at least some selection
      otherwise: (schema) => schema.min(1, 'Winning team selection is required').required('Match outcome is required') 
    }),
    // Use functions in 'when' for better type inference and clarity
  our_team: Yup.string().when('is_external_match', {
    is: (is_external_match: boolean) => is_external_match === false, // Explicit boolean check
    then: (schema) => schema.required('Our team is required'),
    otherwise: (schema) => schema.notRequired(), // Optional or empty string if external
  }),
  opponent_team: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && !is_new_opponent,
    then: (schema) => schema.required('Opponent team is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_1: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && !team_1_new,
    then: (schema) => schema.required('Blue Side Team is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_2: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && !team_2_new,
    then: (schema) => schema.required('Red Side Team is required'),
    // Add check to prevent selecting same team as team_1
    otherwise: (schema) => schema.notRequired().test('notequal', 'Red team cannot be the same as Blue team', function(value) {
        return String(this.parent.team_1) !== String(value);
    }),
  }),
  opponent_team_name: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: (schema) => schema.required('Opponent team name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  opponent_team_abbreviation: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: (schema) => schema.required('Opponent team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: (schema) => schema.notRequired(),
  }),
  opponent_category: Yup.string().when(['is_external_match', 'is_new_opponent'], {
    is: (is_external_match: boolean, is_new_opponent: boolean) => !is_external_match && is_new_opponent,
    then: (schema) => schema.required('Opponent category is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_1_name: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: (schema) => schema.required('Blue Side Team name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_1_abbreviation: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: (schema) => schema.required('Blue Side Team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_1_category: Yup.string().when(['is_external_match', 'team_1_new'], {
    is: (is_external_match: boolean, team_1_new: boolean) => is_external_match && team_1_new,
    then: (schema) => schema.required('Blue Side Team category is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_2_name: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: (schema) => schema.required('Red Side Team name is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_2_abbreviation: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: (schema) => schema.required('Red Side Team abbreviation is required').max(10, 'Max 10 chars'),
    otherwise: (schema) => schema.notRequired(),
  }),
  team_2_category: Yup.string().when(['is_external_match', 'team_2_new'], {
    is: (is_external_match: boolean, team_2_new: boolean) => is_external_match && team_2_new,
    then: (schema) => schema.required('Red Side Team category is required'),
    otherwise: (schema) => schema.notRequired(),
  }),
  scrim_type: Yup.string().required('Scrim type is required').oneOf(['SCRIMMAGE', 'TOURNAMENT', 'RANKED'], 'Must be a valid scrim type'),
  game_number: Yup.number().required('Game number is required').positive('Must be positive').integer('Must be an integer'),
  team_side: Yup.string().when('is_external_match', {
    is: false,
    then: (schema) => schema.required('Team side is required').oneOf(['BLUE', 'RED'], 'Must be either BLUE or RED'),
    otherwise: (schema) => schema.notRequired(), // Optional if external
  }),
  match_duration_hours: Yup.number()
      .transform((value) => (isNaN(value) || value === null || value === undefined) ? 0 : value) // Default to 0 if empty/invalid
      .min(0, 'Hours must be non-negative')
      .integer('Hours must be an integer'),
  match_duration_minutes: Yup.number()
      .transform((value) => (isNaN(value) || value === null || value === undefined) ? 0 : value) 
      .min(0, 'Minutes must be non-negative')
      .max(59, 'Minutes must be less than 60')
      .integer('Minutes must be an integer'),
  match_duration_seconds: Yup.number()
      .transform((value) => (isNaN(value) || value === null || value === undefined) ? 0 : value) 
      .min(0, 'Seconds must be non-negative')
      .max(59, 'Seconds must be less than 60')
      .integer('Seconds must be an integer'),
  general_notes: Yup.string().notRequired(), // Optional field
  // MVP fields are optional selections, no specific validation needed here usually
  mvp_player_id: Yup.number().nullable().notRequired(),
  mvp_loss_player_id: Yup.number().nullable().notRequired(),
});

// Step 1: Draft Validation (Example: Ensure format is selected)
const step1Schema = Yup.object({
  draft: Yup.object({
    format: Yup.string().required('Draft format is required').oneOf(['6_BANS', '10_BANS'], 'Invalid format'),
    // Add more specific draft validation if needed (e.g., unique picks/bans)
    blueSidePicks: Yup.array().max(5),
    redSidePicks: Yup.array().max(5),
    blueSideBans: Yup.array().max(5), // Depends on format
    redSideBans: Yup.array().max(5), // Depends on format
    notes: Yup.string().notRequired(),
  }),
});

// Step 2: Player Stats Validation (Example: Require player and hero for each entered row)
const playerStatSchema = Yup.object({
    player_id: Yup.number().required('Player selection is required'),
    hero_played: Yup.mixed().required('Hero selection is required'), // Use mixed for object/id
    // Add other required fields if necessary
    kills: Yup.number().min(0).required('Kills required'),
    deaths: Yup.number().min(0).required('Deaths required'),
    assists: Yup.number().min(0).required('Assists required'),
});

const step2Schema = Yup.object({
  team_players: Yup.array().of(playerStatSchema).min(5, 'Requires 5 players').max(5), // Ensure 5 players
  enemy_players: Yup.array().of(playerStatSchema).min(5, 'Requires 5 players').max(5),
});

// Step 3: File Uploads Validation (Optional: Can add validation for file types/size if needed)
const step3Schema = Yup.object({
  files: Yup.array().notRequired(), // Example: No specific validation here
});

// Step 4: Review Validation (Typically no validation needed here)
const step4Schema = Yup.object({});

// Export array of schemas
export const matchValidationSchema = [
  step0Schema, // Index 0
  step1Schema, // Index 1
  step2Schema, // Index 2
  step3Schema, // Index 3
  step4Schema, // Index 4 (Review)
]; 