/**
 * Core type definitions for Draft Board application
 */

export interface DraftBoard {
  id: string;
  user_id: string;
  name: string;
  status: 'setup' | 'active' | 'completed';
  timer_seconds: number;
  num_teams: number;
  max_players_per_team: number;
  draft_type: 'snake' | 'linear';
  draft_order_type: 'random' | 'custom';
  trade_time_seconds: number;
  join_code: string | null;
  is_multiplayer: boolean;
  sport_preset: string | null;
  position_list: string[];
  created_at: string;
  updated_at: string;
}

export interface DraftTeam {
  id: string;
  draft_id: string;
  name: string;
  draft_order: number;
  color: string | null;
  owner_user_id: string | null;
  created_at: string;
}

export interface DraftPlayer {
  id: string;
  draft_id: string;
  name: string;
  primary_position: string | null;
  secondary_position: string | null;
  ranking: number | null;
  is_drafted: boolean;
  created_at: string;
}

export interface DraftPick {
  id: string;
  draft_id: string;
  round: number;
  pick_number: number;
  pick_in_round: number;
  team_id: string;
  player_id: string | null;
  picked_at: string | null;
  created_at: string;
  // Joined data
  player?: DraftPlayer;
  team?: DraftTeam;
}

export interface DraftPlan {
  id: string;
  draft_id: string;
  pick_id: string;
  player_name: string;
  created_at: string;
}

export interface DraftAction {
  id: string;
  draft_id: string;
  action_type: string;
  action_data: any;
  created_at: string;
}

export type DraftMode = 'draft' | 'edit' | 'trade' | 'plan';

export interface TradeMove {
  pick_id: string;
  from_team_id: string;
  to_team_id: string;
}

/**
 * Sport presets with standard positions
 */
export interface SportPreset {
  id: string;
  name: string;
  positions: string[];
}

export const SPORT_PRESETS: SportPreset[] = [
  { id: 'nba', name: 'NBA Basketball', positions: ['PG', 'SG', 'SF', 'PF', 'C'] },
  { id: 'nfl', name: 'NFL Football', positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OL', 'DL', 'LB', 'CB', 'S'] },
  { id: 'soccer', name: 'Soccer', positions: ['GK', 'LB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] },
  { id: 'mlb', name: 'MLB Baseball', positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] },
  { id: 'nhl', name: 'NHL Hockey', positions: ['C', 'LW', 'RW', 'D', 'G'] },
  { id: 'fantasy', name: 'Fantasy Football', positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX'] },
  { id: 'softball', name: 'Softball', positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] },
  { id: 'cricket', name: 'Cricket', positions: ['BAT', 'BOWL', 'AR', 'WK'] },
];

/**
 * Team colors palette with names for UI display
 */
export interface TeamColor {
  hex: string;
  name: string;
}

export const TEAM_COLORS: TeamColor[] = [
  { hex: '#DC2626', name: 'Red' },
  { hex: '#2563EB', name: 'Blue' },
  { hex: '#16A34A', name: 'Green' },
  { hex: '#CA8A04', name: 'Gold' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#EA580C', name: 'Orange' },
  { hex: '#0891B2', name: 'Cyan' },
  { hex: '#BE185D', name: 'Pink' },
  { hex: '#1D4ED8', name: 'Navy' },
  { hex: '#15803D', name: 'Forest' },
  { hex: '#92400E', name: 'Brown' },
  { hex: '#4F46E5', name: 'Indigo' },
  { hex: '#0D9488', name: 'Teal' },
  { hex: '#B91C1C', name: 'Maroon' },
  { hex: '#374151', name: 'Charcoal' },
  { hex: '#6D28D9', name: 'Violet' },
];

/**
 * UI State interface for draft board
 */
export interface UIState {
  selectedTeamId?: string;
  selectedPlayerId?: string;
  mode: DraftMode;
  showTradeModal: boolean;
  showPlanModal: boolean;
  theme: 'light' | 'dark' | 'system';
}
