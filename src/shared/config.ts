/**
 * Central configuration for the coal stripes visualization
 */

import { CalendarDate } from '@internationalized/date';

// Drag interaction configuration  
export const DRAG_CONFIG = {
  DEBOUNCE_DELAY: 150,              // Milliseconds to debounce drag updates
  MIN_DRAG_DISTANCE: 5,             // Minimum pixels to start a drag
} as const;

// Performance monitoring
export const PERF_CONFIG = {
  SLOW_OPERATION_THRESHOLD: 16.67,  // Operations slower than 60fps (16.67ms)
  FPS_BUFFER_SIZE: 60,              // Number of frames to keep for FPS calculation
} as const;

// UI Configuration
export const UI_CONFIG = {
  MOBILE_BREAKPOINT: 768,           // Pixels - below this is mobile
  SHORT_LABELS_BREAKPOINT: 600,     // Pixels - below this use short labels
  MIN_ROW_HEIGHT: 12,               // Minimum height for desktop rows
  MIN_ROW_HEIGHT_MOBILE: 16,        // Minimum height for mobile rows
  MAX_ROW_HEIGHT: 40,               // Maximum row height
  CAPACITY_TO_HEIGHT_RATIO: 30,     // Divide capacity by this to get height
} as const;

// API Configuration
export const API_CONFIG = {
  BASE_URL: '/api/coal-stripes',    // Base URL for API calls
  DEFAULT_TIMEZONE: 'Australia/Brisbane',
} as const;

// Date boundaries
export const DATE_BOUNDARIES = {
  // The earliest date we have data from
  EARLIEST_START_DATE: new CalendarDate(2006, 1, 1),
  // Buffer months to allow beyond data boundaries for UI flexibility
  DISPLAY_SLOP_MONTHS: 6,
} as const;

// Tile rendering configuration
export const TILE_CONFIG = {
  SHOW_DEBUG_OVERLAY: true,         // Show yellow border and year text on tiles
  DEBUG_BORDER_WIDTH: 3,            // Width of debug border in pixels
  DEBUG_BORDER_COLOR: 'yellow',     // Yellow color for debug border
  DEBUG_TEXT_SIZE: 40,              // Font size for year text
  DEBUG_TEXT_COLOR: '#9333ea',      // Purple color for year text
} as const;

// Request queue configuration
export const REQUEST_QUEUE_CONFIG = {
  // Rate limiting
  DEFAULT_MIN_INTERVAL: 100,        // Minimum 100ms between requests
  MAX_CONCURRENT_REQUESTS: 10,      // Max parallel requests
  
  // Retry policy
  MAX_RETRIES: 4,                   // Maximum retry attempts
  RETRY_DELAY_BASE: 1000,           // Base retry delay (1s)
  RETRY_DELAY_MAX: 30000,           // Maximum retry delay (30s)
  
  // Timeouts
  REQUEST_TIMEOUT: 20000,           // 15 second timeout per request
  
  // Circuit breaker
  CIRCUIT_BREAKER_THRESHOLD: 5,     // Open circuit after 5 consecutive failures
  CIRCUIT_BREAKER_RESET_TIME: 60000 // Reset circuit after 1 minute
} as const;