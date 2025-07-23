/**
 * Central configuration for the coal stripes visualization
 */

// Cache configuration
export const CACHE_CONFIG = {
  MAX_CHUNKS: 50,                    // Maximum number of year chunks to keep in cache
  ENABLE_PRELOADING: true,           // Whether to enable background preloading
  RATE_LIMIT_DELAY: 2000,           // Milliseconds between API calls (2 seconds)
  PRELOAD_PAGES_PRIMARY: 5,         // Number of pages to preload in primary direction
  PRELOAD_PAGES_OPPOSITE: 1,        // Number of pages to preload in opposite direction
} as const;

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

// Tile rendering configuration
export const TILE_CONFIG = {
  SHOW_DEBUG_OVERLAY: true,         // Show purple border and year text on tiles
  DEBUG_BORDER_WIDTH: 8,            // Width of debug border in pixels
  DEBUG_BORDER_COLOR: '#9333ea',    // Purple color for debug border
  DEBUG_TEXT_SIZE: 40,              // Font size for year text
  DEBUG_TEXT_COLOR: '#9333ea',      // Purple color for year text
} as const;