/**
 * Helper function to safely extract an ID (e.g., team_id, player_id) 
 * from various potential inputs (object, string, number) and parse it as an integer.
 * Returns undefined if the ID cannot be determined or parsed.
 */
export const getId = (value: any): number | undefined => {
  if (typeof value === 'object' && value !== null && (value.id || value.team_id || value.player_id || value.scrim_group_id)) {
    const id = value.id || value.team_id || value.player_id || value.scrim_group_id;
    // Ensure the extracted ID is converted to string before parsing, 
    // in case it's already a number.
    const parsedId = parseInt(String(id), 10);
    return !isNaN(parsedId) ? parsedId : undefined;
  } else if (value !== null && value !== undefined && !isNaN(parseInt(String(value), 10))) {
    // Handles cases where value is already a number or a string representation of a number.
    // Ensure value is converted to string before parsing.
    const parsedId = parseInt(String(value), 10);
    return !isNaN(parsedId) ? parsedId : undefined;
  }
  return undefined;
}; 