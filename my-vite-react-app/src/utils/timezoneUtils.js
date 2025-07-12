/**
 * Convert a UTC date to a specific timezone
 * @param {Date|string} date - The date to convert (UTC)
 * @param {string} timezone - IANA timezone string (e.g., 'America/Los_Angeles')
 * @returns {Date} - Date object representing the time in the specified timezone
 */
export function convertToTimezone(date, timezone) {
  if (!date || !timezone) return new Date(date);
  
  // Create a date object if string is passed
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Get the date string in the target timezone
  const tzDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(dateObj);
  
  // Parse the formatted date to get components
  const [datePart, timePart] = tzDate.split(', ');
  const [month, day, year] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // Create a new date object with the timezone-adjusted values
  // Note: This creates a date in the local timezone with the values from the target timezone
  return new Date(year, month - 1, day, hour, minute, second);
}

/**
 * Get a date at midnight in a specific timezone
 * @param {Date|string} date - The date to process
 * @param {string} timezone - IANA timezone string
 * @returns {Date} - Date at midnight in the specified timezone
 */
export function getDateAtMidnightInTimezone(date, timezone) {
  const tzDate = convertToTimezone(date, timezone);
  return new Date(tzDate.getFullYear(), tzDate.getMonth(), tzDate.getDate());
}

/**
 * Get today at midnight in a specific timezone
 * @param {string} timezone - IANA timezone string
 * @returns {Date} - Today at midnight in the specified timezone
 */
export function getTodayInTimezone(timezone) {
  return getDateAtMidnightInTimezone(new Date(), timezone);
}

/**
 * Get yesterday at midnight in a specific timezone
 * @param {string} timezone - IANA timezone string
 * @returns {Date} - Yesterday at midnight in the specified timezone
 */
export function getYesterdayInTimezone(timezone) {
  const today = getTodayInTimezone(timezone);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday;
}

/**
 * Format a date in a specific timezone
 * @param {Date|string} date - The date to format
 * @param {string} timezone - IANA timezone string
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export function formatDateInTimezone(date, timezone, options = {}) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options
  }).format(dateObj);
}