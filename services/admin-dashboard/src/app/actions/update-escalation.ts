"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export interface UpdateEscalationParams {
  id: string;
  status?: "pending" | "in_progress" | "resolved";
  category?: "admission_dispute" | "financial_hardship" | "grievance";
  admin_response?: string | null;
  assigned_to?: string | null;
}

export interface UpdateEscalationResult {
  success: boolean;
  error: string | null;
}

export async function updateEscalation(
  params: UpdateEscalationParams
): Promise<UpdateEscalationResult> {
  const { id, ...updates } = params;

  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Get user's profile to verify they have access to this college
    const { data: profile } = await supabase
      .from("profiles")
      .select("college_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return { success: false, error: "Profile not found" };
    }

    // Verify the escalation belongs to the admin's college
    const { data: escalation } = await supabaseAdmin
      .from("human_escalations")
      .select("college_id")
      .eq("id", id)
      .single();

    if (!escalation) {
      return { success: false, error: "Escalation not found" };
    }

    if (escalation.college_id !== profile.college_id) {
      return { success: false, error: "Unauthorized" };
    }

    // Build the update object
    const updateData: Record<string, unknown> = {};

    if (updates.status !== undefined) {
      updateData.status = updates.status;
      // Auto-set resolved_at when status changes to resolved
      if (updates.status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      } else {
        // Clear resolved_at if status is changed away from resolved
        updateData.resolved_at = null;
      }
    }

    if (updates.category !== undefined) {
      updateData.category = updates.category;
    }

    if (updates.admin_response !== undefined) {
      updateData.admin_response = updates.admin_response;
    }

    if (updates.assigned_to !== undefined) {
      updateData.assigned_to = updates.assigned_to;
    }

    // Update the escalation
    const { error } = await supabaseAdmin
      .from("human_escalations")
      .update(updateData)
      .eq("id", id);

    if (error) {
      console.error("Error updating escalation:", error);
      return { success: false, error: error.message };
    }

    // Revalidate the escalations page
    revalidatePath("/dashboard/escalations");

    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred" };
  }
}
