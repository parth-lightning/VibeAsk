import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger.js";

let supabaseInstance: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance (lazy initialization)
 * This ensures env vars are loaded before creating the client
 */
export function getSupabase(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error("Missing Supabase environment variables");
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment"
    );
  }

  supabaseInstance = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  logger.info("Supabase client initialized");
  return supabaseInstance;
}
