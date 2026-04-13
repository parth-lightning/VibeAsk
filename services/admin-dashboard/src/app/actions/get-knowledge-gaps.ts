"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface KnowledgeGap {
  id: string;
  query: string;
  ai_comment: string;
  college_id: string;
  answer: string | null;
  user_email: string | null;
  created_at: string;
  answered_at: string | null;
  cascaded_at: string | null;
}

interface GetKnowledgeGapsParams {
  page?: number;
  pageSize?: number;
  status?: "all" | "unanswered" | "answered" | "cascaded";
  search?: string;
}

interface GetKnowledgeGapsResult {
  gaps: KnowledgeGap[];
  total: number;
  error: string | null;
}

export async function getKnowledgeGaps({
  page = 1,
  pageSize = 10,
  status = "all",
  search = "",
}: GetKnowledgeGapsParams = {}): Promise<GetKnowledgeGapsResult> {
  const supabase = await createClient();

  // Get the current user's profile to filter by college_id
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { gaps: [], total: 0, error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { gaps: [], total: 0, error: "Profile not found" };
  }

  // Build the query using admin client for reliable access
  let query = supabaseAdmin
    .from("knowledge_gaps")
    .select("*", { count: "exact" })
    .eq("college_id", profile.college_id)
    .order("created_at", { ascending: false });

  // Apply status filter
  if (status === "unanswered") {
    query = query.is("answer", null);
  } else if (status === "answered") {
    query = query.not("answer", "is", null).is("cascaded_at", null);
  } else if (status === "cascaded") {
    query = query.not("cascaded_at", "is", null);
  }

  // Apply search filter
  if (search) {
    query = query.or(`query.ilike.%${search}%,ai_comment.ilike.%${search}%`);
  }

  // Apply pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error("Error fetching knowledge gaps:", error);
    return { gaps: [], total: 0, error: error.message };
  }

  return {
    gaps: data || [],
    total: count || 0,
    error: null,
  };
}

// Get summary stats for the dashboard
export async function getKnowledgeGapStats(): Promise<{
  unanswered: number;
  answered: number;
  cascaded: number;
  thisWeek: number;
  error: string | null;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      unanswered: 0,
      answered: 0,
      cascaded: 0,
      thisWeek: 0,
      error: "Not authenticated",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return {
      unanswered: 0,
      answered: 0,
      cascaded: 0,
      thisWeek: 0,
      error: "Profile not found",
    };
  }

  // Get counts using admin client
  const [unansweredRes, answeredRes, cascadedRes, thisWeekRes] =
    await Promise.all([
      supabaseAdmin
        .from("knowledge_gaps")
        .select("*", { count: "exact", head: true })
        .eq("college_id", profile.college_id)
        .is("answer", null),
      supabaseAdmin
        .from("knowledge_gaps")
        .select("*", { count: "exact", head: true })
        .eq("college_id", profile.college_id)
        .not("answer", "is", null)
        .is("cascaded_at", null),
      supabaseAdmin
        .from("knowledge_gaps")
        .select("*", { count: "exact", head: true })
        .eq("college_id", profile.college_id)
        .not("cascaded_at", "is", null),
      supabaseAdmin
        .from("knowledge_gaps")
        .select("*", { count: "exact", head: true })
        .eq("college_id", profile.college_id)
        .gte(
          "created_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        ),
    ]);

  return {
    unanswered: unansweredRes.count || 0,
    answered: answeredRes.count || 0,
    cascaded: cascadedRes.count || 0,
    thisWeek: thisWeekRes.count || 0,
    error: null,
  };
}
