"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { colleges } from "@/lib/colleges";

export type AuthState = {
  error?: string;
  success?: boolean;
};

export async function login(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(
  prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const fullName = formData.get("name") as string;
  const collegeSlug = formData.get("college") as string;

  if (!email || !password || !fullName || !collegeSlug) {
    return { error: "All fields are required" };
  }

  // Validate college slug exists
  const college = colleges.find((c) => c.slug === collegeSlug);
  if (!college) {
    return { error: "Invalid college selected" };
  }

  // Sign up the user with metadata
  // The database trigger handle_new_user() will automatically create the profile
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        college_id: collegeSlug,
        role: "admin",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Profile is created automatically by the database trigger
  // Redirect to login since email confirmation may be required
  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
