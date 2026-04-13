/**
 * LocalStorage utilities for persisting widget state
 */

import { STORAGE_KEYS } from "./constants";
import type { ChatMessage } from "@/types";

// Alias for backward compatibility
type Message = ChatMessage;

/**
 * Save chat history to localStorage
 */
export function saveChatHistory(messages: Message[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(messages));
  } catch (error) {
    console.error("Error saving chat history:", error);
  }
}

/**
 * Load chat history from localStorage
 */
export function loadChatHistory(): Message[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.chatHistory);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading chat history:", error);
  }
  return [];
}

/**
 * Clear chat history from localStorage
 */
export function clearChatHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.chatHistory);
  } catch (error) {
    console.error("Error clearing chat history:", error);
  }
}

/**
 * Save widget open state to localStorage
 */
export function saveIsOpen(isOpen: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEYS.isOpen, JSON.stringify(isOpen));
  } catch (error) {
    console.error("Error saving widget state:", error);
  }
}

/**
 * Load widget open state from localStorage
 */
export function loadIsOpen(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.isOpen);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading widget state:", error);
  }
  return false;
}
