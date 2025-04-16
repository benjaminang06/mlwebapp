import { PlayerMatchStat } from '../types/match.types'; // Adjust path if needed
import { Hero } from '../types/hero.types'; // Adjust path if needed

// Define the empty player stat structure for resetting
export const getEmptyPlayerStat = (isOurTeam: boolean): Partial<PlayerMatchStat> => ({
  is_our_team: isOurTeam, // Keep this for form logic differentiation if needed
  player_id: undefined,
  ign: '',
  hero_played: undefined, // Use undefined for Autocomplete/Select
  role_played: '',
  kills: 0,
  deaths: 0,
  assists: 0,
  damage_dealt: undefined, // Use undefined for optional number fields
  damage_taken: undefined,
  turret_damage: undefined,
  gold_earned: undefined,
  player_notes: '',
}); 