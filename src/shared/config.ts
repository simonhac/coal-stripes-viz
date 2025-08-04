/**
 * Central configuration for the coal stripes visualization
 */

import { CalendarDate } from '@internationalized/date';

// Date navigation physics and interaction configuration
export const DATE_NAV_PHYSICS = {
  // Rubber band effect when dragging beyond data boundaries
  RUBBER_BAND: {
    SCALE_FACTOR: 0.2,              // Controls stretch amount (20% of max at infinity - more resistance)
  },
  
  // Spring physics for snap-back animations
  SPRING: {
    STIFFNESS: 200,                 // Spring constant - higher for snappier response
    DAMPING: 30,                    // Damping coefficient - adjusted for the stiffness
    MASS: 1,                        // Mass of the spring system
    MIN_DISTANCE: 0.5,              // Stop when within 0.5 days of target
    MIN_VELOCITY: 10,               // Stop when velocity is below 10 days/s
  },
  
  // Momentum scrolling after drag release
  MOMENTUM: {
    FRICTION: 0.92,                 // Deceleration factor (8% velocity loss per frame)
    MIN_VELOCITY: 0.5,              // Minimum velocity to continue momentum
    VELOCITY_SCALE: 3,              // Scale up velocity for momentum effect
  },
  
  // Touch-specific settings
  TOUCH: {
    MOVEMENT_SCALE: 1.0,            // No scaling - full touch responsiveness
    MOMENTUM_SCALE: 1.5,            // Touch-specific momentum multiplier (reduced by 50%)
  },
  
  // Drag interaction thresholds
  DRAG: {
    MIN_DISTANCE: 5,                // Minimum pixels to start a drag
    MIN_HORIZONTAL_RATIO: 1.5,      // Horizontal must be 1.5x vertical for drag
    VELOCITY_SAMPLE_WINDOW: 100,    // Keep velocity samples from last 100ms
    DEBOUNCE_DELAY: 150,            // Milliseconds to debounce drag updates
  },
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
  DISPLAY_SLOP_MONTHS: 4,
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