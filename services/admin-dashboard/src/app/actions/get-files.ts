"use server";

import { supabaseAdmin } from "@/lib/supabase";

export async function getFiles(collegeId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("college_id", collegeId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return { success: true, data };
  } catch (error: any) {
    console.error("Fetch files error:", error);
    return { success: false, error: error.message };
  }
}
