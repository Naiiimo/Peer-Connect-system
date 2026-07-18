import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/AppShell";
import { LayoutDashboard, Search, Users, MessageSquare, Calendar, Library, Star, Bell, User, Settings, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/student")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth/$role", params: { role: "student" } });
    const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (rs ?? []).map((r: any) => r.role as string);
    if (roles.includes("admin") && !roles.includes("student")) throw redirect({ to: "/admin" });
    if (!roles.includes("student")) {
      throw new Response("Forbidden", { status: 403, statusText: "Student role required" });
    }
  },
  component: StudentLayout,
});

function StudentLayout() {
  const items = [
    { to: "/student", label: "Overview", icon: LayoutDashboard },
    { to: "/student/find-tutors", label: "Find tutor", icon: Search },
    { to: "/student/tutors", label: "My tutors", icon: Users },
    { to: "/student/messages", label: "Messages", icon: MessageSquare },
    { to: "/student/schedule", label: "Schedule", icon: Calendar },
    { to: "/student/groups", label: "Groups", icon: Users },
    { to: "/student/library", label: "Library", icon: Library },
    { to: "/student/research", label: "Research", icon: BookOpen },
    { to: "/student/feedback", label: "Feedback", icon: Star },
    { to: "/student/notifications", label: "Notifications", icon: Bell },
    { to: "/student/profile", label: "Profile", icon: User },
    { to: "/student/settings", label: "Settings", icon: Settings },
  ];
  return <DashboardShell items={items}><Outlet /></DashboardShell>;
}
