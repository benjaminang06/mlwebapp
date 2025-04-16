// Helper function to format duration
export const formatDuration = (h?: number | '', m?: number | '', s?: number | ''): string | null => {
  const hours = parseInt(String(h || 0), 10);
  const minutes = parseInt(String(m || 0), 10);
  const seconds = parseInt(String(s || 0), 10);

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
    return null; // Return null if any part is invalid
  }

  // Return null if all are zero
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return null;
  }

  const pad = (num: number) => num.toString().padStart(2, '0');
  // Format hours without padding, minutes and seconds with padding
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}; 