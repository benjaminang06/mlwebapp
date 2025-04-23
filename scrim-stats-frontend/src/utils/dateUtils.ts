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
 * Check if two dates are the same day
 * @param date1 First date to compare
 * @param date2 Second date to compare
 * @returns True if dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Check if date is in the current week
 * @param date Date to check
 * @param baseDate Optional base date (defaults to today)
 * @returns True if date is in the same week as baseDate
 */
export const isThisWeek = (date: Date, baseDate: Date = new Date()): boolean => {
  // Clone the baseDate to avoid modifying the original
  const baseDateClone = new Date(baseDate);
  
  // Set to the start of the week (Sunday)
  const day = baseDateClone.getDay();
  const diff = baseDateClone.getDate() - day;
  const startOfWeek = new Date(baseDateClone.setDate(diff));
  startOfWeek.setHours(0, 0, 0, 0);
  
  // Set to the end of the week (Saturday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  
  // Check if date is between start and end of week
  return date >= startOfWeek && date <= endOfWeek;
};

/**
 * Check if date is in the current month
 * @param date Date to check
 * @param baseDate Optional base date (defaults to today)
 * @returns True if date is in the same month as baseDate
 */
export const isThisMonth = (date: Date, baseDate: Date = new Date()): boolean => {
  return (
    date.getFullYear() === baseDate.getFullYear() &&
    date.getMonth() === baseDate.getMonth()
  );
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