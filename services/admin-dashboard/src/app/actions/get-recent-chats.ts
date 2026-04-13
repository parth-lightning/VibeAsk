"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

/**
 * Decrypt a message using the encryption key from environment
 */
function decrypt(encrypted: string, iv: string, tag: string): string {
  try {
    const keyHex = process.env.MESSAGE_ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error("MESSAGE_ENCRYPTION_KEY not set");
    }

    const key = Buffer.from(keyHex, "hex");
    const ivBuffer = Buffer.from(iv, "hex");
    const tagBuffer = Buffer.from(tag, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
    decipher.setAuthTag(tagBuffer);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return "[Error decrypting message]";
  }
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  is_voice: boolean;
  created_at: string;
  user_email?: string;
}

export interface GetRecentChatsResult {
  messages: ChatMessage[];
  total: number;
  error: string | null;
}

export async function getRecentChats(): Promise<GetRecentChatsResult> {
  try {
    const supabase = await createClient();

    // Get current user's profile to filter by college_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { messages: [], total: 0, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("college_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { messages: [], total: 0, error: "Profile not found" };
    }

    // Get messages from last 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Use admin client to fetch encrypted messages with conversation and user info
    const { data: messagesData, error: messagesError } = await supabaseAdmin
      .from("messages")
      .select(
        `
        id,
        conversation_id,
        role,
        content_encrypted,
        content_iv,
        content_tag,
        is_voice,
        created_at,
        conversations!inner(
          college_id,
          users!inner(
            email
          )
        )
      `
      )
      .gte("created_at", twentyFourHoursAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(100);

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      return { messages: [], total: 0, error: messagesError.message };
    }

    if (!messagesData) {
      return { messages: [], total: 0, error: null };
    }

    // Filter by college_id and decrypt messages
    const decryptedMessages = messagesData
      .filter((msg) => {
        const conversations = (msg as Record<string, unknown>).conversations as
          | { college_id: string }
          | undefined;
        return conversations?.college_id === profile.college_id;
      })
      .map((msg): ChatMessage => {
        const msgData = msg as Record<string, unknown>;
        const decryptedContent = decrypt(
          msgData.content_encrypted as string,
          msgData.content_iv as string,
          msgData.content_tag as string
        );

        return {
          id: msgData.id as string,
          conversation_id: msgData.conversation_id as string,
          role: msgData.role as "user" | "assistant" | "system",
          content: decryptedContent,
          is_voice: (msgData.is_voice as boolean) || false,
          created_at: msgData.created_at as string,
          user_email: (msgData.conversations as { users: { email: string } })
            .users.email,
        };
      });

    return {
      messages: decryptedMessages,
      total: decryptedMessages.length,
      error: null,
    };
  } catch (error) {
    console.error("Error in getRecentChats:", error);
    return {
      messages: [],
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
