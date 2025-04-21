/**
 * Format a date string with common options
 * @param dateString ISO date string to format
 * @param options Formatting options
 * @returns Formatted date string
 */
export const formatDate = (
  dateString: string, 
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }
): string => {
  if (!dateString) return 'Not available';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original if parsing fails
  }
};

/**
 * Format a duration string (HH:MM:SS) to a more readable format
 * @param durationString Duration string in HH:MM:SS format
 * @returns Formatted duration
 */
export const formatDuration = (durationString?: string): string => {
  if (!durationString) return 'Not recorded';
  
  // Parse HH:MM:SS format
  const match = durationString.match(/^(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return durationString;
  
  const [_, hours, minutes, seconds] = match;
  
  // Build readable format
  const parts = [];
  if (parseInt(hours) > 0) parts.push(`${parseInt(hours)}h`);
  if (parseInt(minutes) > 0) parts.push(`${parseInt(minutes)}m`);
  if (parseInt(seconds) > 0 || parts.length === 0) parts.push(`${parseInt(seconds)}s`);
  
  return parts.join(' ');
}; 