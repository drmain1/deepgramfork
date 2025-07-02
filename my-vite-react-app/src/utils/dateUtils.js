/**
 * Utility functions for date handling without timezone shifts
 */

/**
 * Format a UTC date string as local date without timezone conversion
 * @param {string} dateString - ISO date string (e.g., "2025-01-01T00:00:00.000Z")
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @returns {string} Formatted date string
 */
export function formatUTCDateAsLocal(dateString, locale = 'en-US') {
  if (!dateString) return '';
  
  // Extract just the date part (YYYY-MM-DD)
  const datePart = dateString.split('T')[0];
  const [year, month, day] = datePart.split('-');
  
  // Create date using local timezone to avoid shifts
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString(locale);
}

/**
 * Format a date string for display, handling both UTC and local dates
 * @param {string} dateString - Date string to format
 * @param {string} locale - Locale for formatting
 * @returns {string} Formatted date string
 */
export function formatDateForDisplay(dateString, locale = 'en-US') {
  if (!dateString) return '';
  
  // If it's a UTC date (ends with Z), use special handling
  if (dateString.endsWith('Z') || dateString.includes('T00:00:00')) {
    return formatUTCDateAsLocal(dateString, locale);
  }
  
  // Otherwise, use standard formatting
  return new Date(dateString).toLocaleDateString(locale);
}