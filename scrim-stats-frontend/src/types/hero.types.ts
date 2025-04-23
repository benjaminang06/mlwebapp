/**
 * Represents a playable character/hero in the game
 */
export interface Hero {
  hero_id: number;
  id?: number; // Legacy ID field, kept for backward compatibility
  name: string;
  role?: string;
  released_date?: string;
  image_url?: string;
  win_rate?: number;
  pick_rate?: number;
  ban_rate?: number;
}

/**
 * Represents hero statistics
 */
export interface HeroStats {
  hero: Hero;
  picks: number;
  bans: number;
  wins: number;
  losses: number;
  win_rate: number;
  pick_rate: number;
  ban_rate: number;
}

/**
 * Represents a hero pairing (two heroes that work well together)
 */
export interface HeroPairing {
  hero1: Hero;
  hero2: Hero;
  wins: number;
  total_games: number;
  win_rate: number;
}

/**
 * Represents a hero counter (hero that performs well against another hero)
 */
export interface HeroCounter {
  hero: Hero;
  counter_hero: Hero;
  wins: number;
  total_games: number;
  win_rate: number;
} 