/**
 * Constants for PatientTranscriptList component
 */

// Billing progress steps
export const BILLING_STEPS = {
  GATHERING: { step: 1, message: 'Gathering selected transcripts...' },
  ANALYZING: { step: 2, message: 'Analyzing medical encounters...' },
  PROCESSING: { step: 3, message: 'Activating secret billing algorithms...' },
  FINALIZING: { step: 4, message: 'Finalizing billing codes...' },
  COMPLETE: { step: 5, message: 'Complete!' }
};

// Timing constants (in milliseconds)
export const TIMING = {
  BILLING_STEP_DELAY: 500,
  BILLING_COMPLETE_DELAY: 500,
  BILLING_STEP_2_DELAY: 500,
  BILLING_STEP_3_DELAY: 1500
};

// PDF generation constants
export const PDF_CONSTANTS = {
  SEPARATOR: '='.repeat(80),
  CLINIC_LOCATION_PREFIX: 'CLINIC LOCATION:',
  LOCATION_HEADER_TEMPLATE: (location) => 
    `CLINIC LOCATION:\n${location.trim()}\n\n---\n\n`,
  NO_CONTENT_MESSAGE: 'No transcript content available'
};

// Date constants
export const DATE_CONSTANTS = {
  MIGRATION_DATE: 20250626, // Date when session IDs switched to UTC
  SESSION_ID_TIME_LENGTH: 14,
  SESSION_ID_TIME_PATTERN: /^\d{14}$/
};

// UI Text
export const UI_TEXT = {
  NO_TRANSCRIPTS_TITLE: 'No transcripts yet',
  NO_TRANSCRIPTS_MESSAGE: 'Transcripts will appear here after recording sessions',
  GENERATING_PREVIEW: 'Generating Preview...',
  GENERATING_PDF: 'Generating PDF...',
  GENERATING_BILLING: 'Generating Billing...',
  VIEW_SELECTED: (count) => `View Selected (${count})`,
  PRINT_SELECTED: 'Print Selected',
  GENERATE_BILLING: 'Generate Billing',
  BILLING_MAGIC_MESSAGE: '🔮 Magic happening... (30-90 seconds of pure wizardry)'
};

// Error messages
export const ERROR_MESSAGES = {
  FETCH_PATIENT_FAILED: 'Failed to fetch patient',
  FETCH_TRANSCRIPTS_FAILED: 'Failed to fetch transcripts',
  GENERATE_PDF_ERROR: 'Error generating PDF. Please try again.',
  GENERATE_BILLING_ERROR: 'Error generating billing. Please try again.'
};

// API endpoints
export const API_ENDPOINTS = {
  GET_PATIENT: (patientId) => `/api/v1/patients/${patientId}`,
  GET_PATIENT_TRANSCRIPTS: (patientId) => `/api/v1/patients/${patientId}/transcripts`,
  GET_TRANSCRIPT: (userId, transcriptId) => `/api/v1/transcript/${userId}/${transcriptId}`,
  GENERATE_BILLING: (patientId) => `/api/v1/patients/${patientId}/generate-billing`
};