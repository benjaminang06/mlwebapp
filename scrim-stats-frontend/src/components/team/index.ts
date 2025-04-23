/**
 * Barrel file for team components
 * This file exports all team-related components to provide a single import point.
 * 
 * @module Components/Team
 */

// Export team statistic components
export { TeamOverview } from './TeamOverview';
export { PlayerList } from './PlayerList';
export { DetailedPlayerView } from './DetailedPlayerView';

// Earlier marker object (no longer needed since we have actual components now)
// export const TeamModuleMarker = {}; 

// Future exports:
// - TeamList: Component for displaying a list of teams
// - TeamForm: Component for creating/editing team information 
// - TeamDetail: Component for displaying detailed team information
// - TeamRoster: Component for managing team roster

// When team components are created, they will be exported here
// Example: 
// export { default as TeamList } from './TeamList';
// export { default as TeamForm } from './TeamForm';
// export { default as TeamDetail } from './TeamDetail'; 