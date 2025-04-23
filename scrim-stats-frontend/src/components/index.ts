/**
 * Root barrel file for all components
 * This file exports component groups by domain for easier imports
 */

// Export component groups
export * as TeamComponents from './team';
export * as PlayerComponents from './player';
export * as MatchComponents from './match';

// Export shared components directly
// The ImportExample component has been removed as it was unused

// In the future, add more shared components here
// Example:
// export { default as LoadingSpinner } from './LoadingSpinner';
// export { default as ErrorMessage } from './ErrorMessage';
// export { default as PageHeader } from './PageHeader'; 