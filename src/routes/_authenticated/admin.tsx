import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/AppShell";
import { LayoutDashboard, Users, Flag, Trash2, Wallet, ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw redirect({ to: "/admin-login" });
    const uid = authData.user.id;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (data ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) throw redirect({ to: "/student" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const items = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/approvals", label: "Approvals", icon: ClipboardCheck },
    { to: "/admin/payments", label: "Fees & payments", icon: Wallet },
    { to: "/admin/reports", label: "Reports", icon: Flag },
    { to: "/admin/deletions", label: "Deletions", icon: Trash2 },
  ];
  return <DashboardShell items={items}><Outlet /></DashboardShell>;
}
