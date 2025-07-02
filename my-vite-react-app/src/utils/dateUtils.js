/**
 * Utility functions for date handling without timezone shifts
 */

import { format } from 'date-fns';

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

/**
 * Parse timestamp from session ID (format: YYYYMMDDHHMMSSxxxxxx)
 * Handles backward compatibility for timestamps created before June 26, 2025
 * @param {string} sessionId - Session ID containing timestamp
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseSessionIdTime(sessionId) {
  if (!sessionId || sessionId.length < 14 || !sessionId.substring(0, 14).match(/^\d{14}$/)) {
    return null;
  }
  
  try {
    const year = sessionId.substring(0, 4);
    const month = sessionId.substring(4, 6);
    const day = sessionId.substring(6, 8);
    const hour = sessionId.substring(8, 10);
    const minute = sessionId.substring(10, 12);
    const second = sessionId.substring(12, 14);
    
    // Create UTC date string and parse it
    // Session IDs are now generated in UTC on the backend
    // For backward compatibility: session IDs created before June 26, 2025 are in server local time
    const sessionDate = parseInt(year + month + day);
    const migrationDate = 20250626; // Date when we switched to UTC
    
    if (sessionDate < migrationDate) {
      // Old session IDs - parse as local time (server was likely in UTC or US timezone)
      // This is a best-effort approach since we don't know the exact server timezone
      return new Date(year, month - 1, day, hour, minute, second);
    } else {
      // New session IDs - parse as UTC
      const utcDateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      return new Date(utcDateString);
    }
  } catch (error) {
    return null;
  }
}

/**
 * Format a date with fallback to session ID parsing
 * @param {string} dateString - Date string to format
 * @param {string} sessionId - Optional session ID for more accurate parsing
 * @returns {string} Formatted date string
 */
export function formatDateWithFallback(dateString, sessionId) {
  // Try to parse from session ID first for accuracy
  const sessionDate = parseSessionIdTime(sessionId);
  if (sessionDate) {
    try {
      return format(sessionDate, 'MMM d, yyyy');
    } catch {
      // Fallback to dateString
    }
  }
  
  // Fallback to original date string
  if (!dateString) return 'N/A';
  
  try {
    // Handle UTC dates (e.g., date_of_accident) without timezone shift
    if (dateString.endsWith('Z') || dateString.includes('T00:00:00')) {
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-');
      const localDate = new Date(year, month - 1, day);
      return format(localDate, 'MMM d, yyyy');
    }
    
    return format(new Date(dateString), 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

/**
 * Format time with timezone and fallback to session ID parsing
 * @param {string} dateString - Date string to format
 * @param {string} sessionId - Optional session ID for more accurate parsing
 * @returns {string} Formatted time string with timezone
 */
export function formatTimeWithTimezone(dateString, sessionId) {
  // Try to parse from session ID first for accuracy
  const sessionDate = parseSessionIdTime(sessionId);
  if (sessionDate) {
    try {
      return sessionDate.toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'  // Shows timezone like "PST" or "EST"
      });
    } catch {
      // Fallback to dateString
    }
  }
  
  // Fallback to original date string
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'  // Shows timezone like "PST" or "EST"
    });
  } catch {
    return 'Invalid time';
  }
}