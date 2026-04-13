import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UploadsContent } from "./uploads-content";

export default async function UploadsPage() {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile to get their college_id
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("college_id")
    .eq("id", user.id)
    .single();

  if (error || !profile?.college_id) {
    console.error("Profile fetch error:", error?.message);
    // Redirect to login if no profile found
    redirect("/login");
  }

  return <UploadsContent collegeId={profile.college_id} />;
}
