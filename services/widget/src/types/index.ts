// Re-export UIMessage from @ai-sdk/react for consistency
export type { UIMessage } from "@ai-sdk/react";

// Extended message type that includes voice metadata
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
  isVoice?: boolean; // Flag to distinguish voice vs text messages
}

// Widget configuration
export interface WidgetConfig {
  collegeId: string;
  apiEndpoint: string;
  primaryColor?: string;
}

// Widget initialization options
export interface WidgetInitOptions {
  collegeId: string;
  apiEndpoint?: string;
  primaryColor?: string;
}

// Chat state
export interface ChatState {
  isOpen: boolean;
  isMinimized: boolean;
  hasUnread: boolean;
}
