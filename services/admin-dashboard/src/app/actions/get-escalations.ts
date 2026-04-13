"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface Escalation {
  id: string;
  user_id: string;
  college_id: string;
  query: string;
  category: "admission_dispute" | "financial_hardship" | "grievance";
  ai_comment: string;
  status: "pending" | "in_progress" | "resolved";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  assigned_to: string | null;
  // Joined from users table
  user_email: string;
  user_phone: string | null;
}

export interface GetEscalationsResult {
  escalations: Escalation[];
  total: number;
  error: string | null;
}

export interface GetEscalationsParams {
  page?: number;
  pageSize?: number;
  status?: "all" | "pending" | "in_progress" | "resolved";
  search?: string;
}

export async function getEscalations(
  params: GetEscalationsParams = {}
): Promise<GetEscalationsResult> {
  const { page = 1, pageSize = 10, status = "all", search = "" } = params;

  try {
    const supabase = await createClient();

    // Get current user's profile to filter by college_id
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { escalations: [], total: 0, error: "Not authenticated" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("college_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { escalations: [], total: 0, error: "Profile not found" };
    }

    // Use admin client to bypass RLS (we already verified auth above)
    // Build query
    let query = supabaseAdmin
      .from("human_escalations")
      .select(
        `
        id,
        user_id,
        college_id,
        query,
        category,
        ai_comment,
        status,
        admin_response,
        created_at,
        resolved_at,
        assigned_to,
        users!inner(email, phone)
      `,
        { count: "exact" }
      )
      .eq("college_id", profile.college_id)
      .order("created_at", { ascending: false });

    // Apply status filter
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // Apply search filter (search in query text)
    if (search.trim()) {
      query = query.ilike("query", `%${search.trim()}%`);
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching escalations:", error);
      return { escalations: [], total: 0, error: error.message };
    }

    // Transform data to flatten user info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const escalations: Escalation[] = (data || []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      college_id: row.college_id,
      query: row.query,
      category: row.category,
      ai_comment: row.ai_comment,
      status: row.status,
      admin_response: row.admin_response,
      created_at: row.created_at,
      resolved_at: row.resolved_at,
      assigned_to: row.assigned_to,
      user_email: row.users?.email || "Unknown",
      user_phone: row.users?.phone || null,
    }));

    return {
      escalations,
      total: count || 0,
      error: null,
    };
  } catch (err) {
    console.error("Unexpected error:", err);
    return {
      escalations: [],
      total: 0,
      error: "An unexpected error occurred",
    };
  }
}
