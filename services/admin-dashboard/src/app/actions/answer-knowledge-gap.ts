"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

interface AnswerKnowledgeGapParams {
  id: string;
  answer: string;
}

interface AnswerKnowledgeGapResult {
  success: boolean;
  error: string | null;
}

export async function answerKnowledgeGap({
  id,
  answer,
}: AnswerKnowledgeGapParams): Promise<AnswerKnowledgeGapResult> {
  const supabase = await createClient();

  // Verify the user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Get the user's profile to verify college access
  const { data: profile } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { success: false, error: "Profile not found" };
  }

  // Verify the knowledge gap belongs to the user's college
  const { data: gap } = await supabaseAdmin
    .from("knowledge_gaps")
    .select("college_id")
    .eq("id", id)
    .single();

  if (!gap) {
    return { success: false, error: "Knowledge gap not found" };
  }

  if (gap.college_id !== profile.college_id) {
    return {
      success: false,
      error: "Unauthorized: This knowledge gap belongs to a different college",
    };
  }

  // Update the knowledge gap with the answer
  // This will trigger the database webhook → edge function → cascade to RAG + send email
  const { error } = await supabaseAdmin
    .from("knowledge_gaps")
    .update({
      answer: answer.trim(),
      answered_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Error answering knowledge gap:", error);
    return { success: false, error: error.message };
  }

  // Revalidate the page to show updated data
  revalidatePath("/dashboard/knowledge-gaps");

  return { success: true, error: null };
}
