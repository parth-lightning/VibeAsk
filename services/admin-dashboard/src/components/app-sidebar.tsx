"use client";

import * as React from "react";
import {
  Building,
  Home,
  Upload,
  HelpCircle,
  Ticket,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { colleges } from "@/lib/colleges";
import Image from "next/image";

// Navigation data
const navData = {
  navMain: [
    {
      title: "Home",
      url: "/dashboard",
      icon: Home,
      isActive: true,
    },
    {
      title: "Uploads",
      url: "/dashboard/uploads",
      icon: Upload,
    },
    {
      title: "Escalations",
      url: "/dashboard/escalations",
      icon: Ticket,
    },
    {
      title: "Knowledge Gaps",
      url: "/dashboard/knowledge-gaps",
      icon: HelpCircle,
    },
  ],
};

type UserProfile = {
  id: string;
  full_name: string;
  email: string;
  college_id: string;
  role: string;
};

export function AppSidebar({
  profile,
  ...props
}: React.ComponentProps<typeof Sidebar> & { profile: UserProfile | null }) {
  // Get college name from slug
  const college = colleges.find((c) => c.slug === profile?.college_id);
  const collegeName = college?.name || "Unknown College";

  const user = {
    name: profile?.full_name || "Admin User",
    email: profile?.email || "admin@college.edu",
  };

  const teams = [
    {
      name: collegeName,
      logo: Building,
      plan: profile?.role === "admin" ? "Admin" : "Volunteer",
    },
  ];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground border-t">
          <Image
            src="/chatbot-avatar.webp"
            alt="Campus Setu Logo"
            width={25}
            height={25}
            className="h-6 w-6 rounded-full"
          />
          <span>Powered by Campus Setu</span>
        </div>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
