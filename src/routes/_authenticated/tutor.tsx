import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/AppShell";
import { LayoutDashboard, Inbox, Users, MessageSquare, Calendar, Video, Library, Bell, User, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tutor")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth/$role", params: { role: "tutor" } });
    const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (rs ?? []).map((r: any) => r.role as string);
    if (roles.includes("admin") && !roles.includes("tutor")) throw redirect({ to: "/admin" });
    if (!roles.includes("tutor")) {
      throw new Response("Forbidden", { status: 403, statusText: "Tutor role required" });
    }
  },
  component: TutorLayout,
});

function TutorLayout() {
  const items = [
    { to: "/tutor", label: "Overview", icon: LayoutDashboard },
    { to: "/tutor/requests", label: "Requests", icon: Inbox },
    { to: "/tutor/students", label: "My students", icon: Users },
    { to: "/tutor/messages", label: "Messages", icon: MessageSquare },
    { to: "/tutor/availability", label: "Availability", icon: Calendar },
    { to: "/tutor/sessions", label: "Sessions", icon: Video },
    { to: "/tutor/library", label: "Library", icon: Library },
    { to: "/tutor/notifications", label: "Notifications", icon: Bell },
    { to: "/tutor/profile", label: "Profile", icon: User },
    { to: "/tutor/settings", label: "Settings", icon: Settings },
  ];
  return <DashboardShell items={items}><Outlet /></DashboardShell>;
}
