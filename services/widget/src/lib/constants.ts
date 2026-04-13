/**
 * Configuration constants for the widget
 */

// Environment flag to switch between production and local API
// Default to production unless explicitly set to "false" (for local development)
const USE_PRODUCTION_API = import.meta.env.VITE_USE_PRODUCTION_API !== "false";

// Production API URL - Heroku deployment
const PRODUCTION_API_URL =
  import.meta.env.VITE_PRODUCTION_API_URL ||
  "https://sih-ai-service-7f9dc48e0055.herokuapp.com";
const LOCAL_API_URL =
  import.meta.env.VITE_LOCAL_API_URL || "http://localhost:3000";

// Base API URL (without /api/chat path) - used for voice token endpoint
export const API_BASE_URL = USE_PRODUCTION_API
  ? PRODUCTION_API_URL
  : LOCAL_API_URL;

// API endpoint - full URL including /api/chat
export const API_ENDPOINT =
  import.meta.env.VITE_API_ENDPOINT || `${API_BASE_URL}/api/chat`;

// Debug log for production verification
console.log("[CollegeChatbot] API Config:", {
  USE_PRODUCTION_API,
  API_BASE_URL,
  API_ENDPOINT,
});

// College ID - will be overridden by env variable or widget configuration
export const DEFAULT_COLLEGE_ID =
  import.meta.env.VITE_COLLEGE_ID || "TEST_COLLEGE";

// Widget configuration defaults
export const WIDGET_CONFIG = {
  maxMessageLength: 500,
  autoScrollDelay: 100,
  typingIndicatorDelay: 300,
} as const;

// Session storage keys
export const STORAGE_KEYS = {
  sessionId: "widget_session_id",
  chatHistory: "widget_chat_history",
  isOpen: "widget_is_open",
  userEmail: "widget_user_email",
} as const;
