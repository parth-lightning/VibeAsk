/**
 * Hook for managing widget state (open/closed, minimized, unread)
 */

import { useState, useEffect, useCallback } from "react";
import { saveIsOpen, loadIsOpen } from "@/lib/storage";

export function useWidgetState() {
  const [isOpen, setIsOpen] = useState<boolean>(() => loadIsOpen());
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Save isOpen state to localStorage
  useEffect(() => {
    saveIsOpen(isOpen);
  }, [isOpen]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const newState = !prev;
      // Clear unread when opening
      if (newState) {
        setHasUnread(false);
      }
      return newState;
    });
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const markAsRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  const markAsUnread = useCallback(() => {
    // Only mark as unread if widget is closed
    if (!isOpen) {
      setHasUnread(true);
    }
  }, [isOpen]);

  return {
    isOpen,
    isMinimized,
    hasUnread,
    toggleOpen,
    open,
    close,
    toggleMinimize,
    markAsRead,
    markAsUnread,
  };
}
