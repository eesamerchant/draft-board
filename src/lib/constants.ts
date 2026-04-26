/**
 * Shared constants for Draft Board application
 */

// Default draft board settings
export const DEFAULT_TIMER_SECONDS = 60;
export const DEFAULT_TRADE_TIME_SECONDS = 30;
export const DEFAULT_NUM_TEAMS = 8;
export const DEFAULT_MAX_PLAYERS_PER_TEAM = 10;

// Draft configuration limits
export const MIN_TEAMS = 2;
export const MAX_TEAMS = 12;
export const MIN_PLAYERS_PER_TEAM = 1;
export const MAX_PLAYERS_PER_TEAM = 25;
export const MIN_TIMER_SECONDS = 10;
export const MAX_TIMER_SECONDS = 300;

// Join code settings
export const JOIN_CODE_LENGTH = 6;
export const JOIN_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Route constants
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  CREATE_DRAFT: '/create',
  DRAFT: (id: string) => `/draft/${id}`,
  SETTINGS: (id: string) => `/draft/${id}/settings`,
  RESULTS: (id: string) => `/draft/${id}/results`,
};

// Animation durations (milliseconds)
export const ANIMATIONS = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
};

// Storage keys
export const STORAGE_KEYS = {
  THEME: 'draft-board-theme',
  RECENT_DRAFTS: 'draft-board-recent-drafts',
  DRAFT_PREFERENCES: (id: string) => `draft-board-prefs-${id}`,
};

// Error messages
export const ERROR_MESSAGES = {
  INVALID_JOIN_CODE: 'Invalid join code. Please check and try again.',
  DRAFT_NOT_FOUND: 'Draft board not found.',
  UNAUTHORIZED: 'You do not have permission to access this draft.',
  PLAYER_ALREADY_DRAFTED: 'This player has already been drafted.',
  INVALID_TRADE: 'Invalid trade configuration.',
  DRAFT_NOT_ACTIVE: 'This draft is not currently active.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  DRAFT_CREATED: 'Draft board created successfully!',
  PLAYER_DRAFTED: 'Player added to team!',
  TRADE_COMPLETED: 'Trade completed!',
  PLAN_SAVED: 'Plan saved!',
};
