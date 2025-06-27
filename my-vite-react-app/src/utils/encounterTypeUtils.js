/**
 * Utility functions for classifying encounter types
 */

/**
 * Determines if an encounter type represents an initial/new patient visit
 * @param {string} encounterType - The encounter type from the transcript
 * @returns {boolean} - True if this is an initial visit
 */
export function isInitialVisit(encounterType) {
  if (!encounterType) return false;
  
  const lowerType = encounterType.toLowerCase();
  
  // Keywords that indicate an initial/new patient visit
  const initialKeywords = [
    'initial',
    'new patient',
    'consultation',
    'evaluation',
    'first visit',
    'intake',
    'assessment'
  ];
  
  return initialKeywords.some(keyword => lowerType.includes(keyword));
}

/**
 * Determines if an encounter type represents a follow-up visit
 * @param {string} encounterType - The encounter type from the transcript
 * @returns {boolean} - True if this is a follow-up visit
 */
export function isFollowUpVisit(encounterType) {
  if (!encounterType) return false;
  
  const lowerType = encounterType.toLowerCase();
  
  // Keywords that indicate a follow-up visit
  const followUpKeywords = [
    'follow-up',
    'follow up',
    'followup',
    'f/u',
    'recheck',
    're-check',
    'return visit',
    'subsequent',
    'progress',
    'treatment session',
    'routine',
    'maintenance'
  ];
  
  // Special handling for generic "visit" - only consider it follow-up
  // if it's not also marked as initial
  if (lowerType.includes('visit') && !isInitialVisit(encounterType)) {
    // Check if it has any other qualifying terms
    const hasQualifier = followUpKeywords.some(keyword => lowerType.includes(keyword));
    return hasQualifier || lowerType === 'visit';
  }
  
  return followUpKeywords.some(keyword => lowerType.includes(keyword));
}

/**
 * Determines if a clinic location header should be shown for a transcript
 * @param {string} encounterType - The encounter type from the transcript
 * @returns {boolean} - True if clinic header should be shown
 */
export function shouldShowClinicHeader(encounterType) {
  // If no encounter type is specified, default to showing the header
  if (!encounterType) return true;
  
  // Show header for initial visits
  if (isInitialVisit(encounterType)) return true;
  
  // Don't show header for follow-up visits
  if (isFollowUpVisit(encounterType)) return false;
  
  // For any other unrecognized types, default to showing the header
  return true;
}

/**
 * Gets a display-friendly classification of the encounter type
 * @param {string} encounterType - The encounter type from the transcript
 * @returns {string} - 'initial', 'follow-up', or 'other'
 */
export function classifyEncounterType(encounterType) {
  if (isInitialVisit(encounterType)) return 'initial';
  if (isFollowUpVisit(encounterType)) return 'follow-up';
  return 'other';
}