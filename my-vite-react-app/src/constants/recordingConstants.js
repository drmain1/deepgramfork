// Recording Status
export const RECORDING_STATUS = {
  DRAFT: 'draft',
  PROCESSING: 'processing',
  FAILED: 'failed',
  COMPLETED: 'completed'
};

// WebSocket Message Types
export const WS_MESSAGE_TYPES = {
  SESSION_INIT: 'session_init',
  TRANSCRIPT: 'transcript',
  TRANSLATION: 'translation',
  ERROR: 'error',
  STATUS: 'status',
  INITIAL_METADATA: 'initial_metadata',
  EOS: 'eos'
};

// WebSocket States
export const WS_CLOSE_CODES = {
  NORMAL: 1000,
  USER_PAUSE: 'User paused recording'
};

// API Endpoints
export const API_ENDPOINTS = {
  SAVE_SESSION: '/api/v1/save_session_data',
  SAVE_DRAFT: '/api/v1/save_draft'
};

// UI Constants
export const LOCATION_LEAVE_OUT = '__LEAVE_OUT__';
export const MEDIA_RECORDER_INTERVAL = 1000;
export const WS_INIT_DELAY = 100;

// Error Messages
export const ERROR_MESSAGES = {
  RECORDING_ACTIVE: 'Please pause or stop streaming before generating notes.',
  NO_SESSION_ID: 'Session ID is missing. Cannot save.',
  NO_TRANSCRIPT: 'No transcript to save.',
  NO_USER_AUTH: 'User not authenticated or user ID is missing. Cannot save session.',
  AUDIO_STREAM_LOST: 'Audio stream lost. Please try again.',
  WS_CONNECTION: 'WebSocket connection error. Please check your connection or the server and try again.',
  WS_CLOSED_UNEXPECTED: 'Live connection lost. You might need to resume or restart.',
  MICROPHONE_ACCESS: 'Please ensure microphone access.',
  INITIAL_METADATA_SEND: 'Failed to send initial configuration. Please try again.'
};