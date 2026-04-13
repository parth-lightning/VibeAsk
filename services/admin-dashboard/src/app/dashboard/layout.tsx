import { redirect } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Debug: log if profile fetch failed
  if (error) {
    console.error("Profile fetch error:", error.message, "for user:", user.id);
  }

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <main className="w-full flex flex-col h-screen">
        <div className="p-4 shrink-0">
          <SidebarTrigger />
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </SidebarProvider>
  );
}
