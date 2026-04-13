/**
 * Session management utilities
 */

import { STORAGE_KEYS } from "./constants";

/**
 * Generate a unique session ID using crypto API or fallback to timestamp
 */
export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get or create a session ID from localStorage
 */
export function getSessionId(): string {
  try {
    const storedId = localStorage.getItem(STORAGE_KEYS.sessionId);

    if (storedId) {
      return storedId;
    }

    const newId = generateSessionId();
    localStorage.setItem(STORAGE_KEYS.sessionId, newId);
    return newId;
  } catch (error) {
    console.error("Error managing session ID:", error);
    // Return a temporary session ID if localStorage fails
    return generateSessionId();
  }
}

/**
 * Clear the current session
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.sessionId);
    localStorage.removeItem(STORAGE_KEYS.chatHistory);
  } catch (error) {
    console.error("Error clearing session:", error);
  }
}

/**
 * Get the stored user email
 */
export function getUserEmail(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.userEmail);
  } catch (error) {
    console.error("Error getting user email:", error);
    return null;
  }
}

/**
 * Set the user email in localStorage
 */
export function setUserEmail(email: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.userEmail, email.toLowerCase().trim());
  } catch (error) {
    console.error("Error setting user email:", error);
  }
}

/**
 * Clear the user email from localStorage
 */
export function clearUserEmail(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.userEmail);
  } catch (error) {
    console.error("Error clearing user email:", error);
  }
}
