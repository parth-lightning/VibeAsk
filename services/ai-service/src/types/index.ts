import { UIMessage } from "ai";

export interface ChatRequest {
  messages: UIMessage[]; // Widget sends UIMessage[] with parts array
  collegeId?: string; // Used for RAG filtering
  sessionId?: string;
  email?: string; // User email for conversation logging
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// User types for email-based auth
export interface User {
  id: string;
  email: string;
  college_id: string;
  created_at: string;
  last_active_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  college_id: string;
  session_id: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content_encrypted: string;
  content_iv: string;
  content_tag: string;
  is_voice: boolean;
  created_at: string;
}

export interface IdentifyUserRequest {
  email: string;
  collegeId: string;
}

export interface IdentifyUserResponse {
  userId: string;
  isNew: boolean;
}

// RAG-specific types
export interface SearchResult {
  id: number;
  content: string;
  metadata: {
    filename: string;
    college_id: string;
    chunk_index: number;
    storage_path?: string;
  };
  similarity: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface HealthCheckResponse {
  status: "ok" | "error";
  timestamp: string;
  service: string;
}

// Knowledge gap types
export interface KnowledgeGap {
  id: string;
  query: string;
  ai_comment: string;
  college_id: string;
  user_email: string | null;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
  cascaded_at: string | null;
}
