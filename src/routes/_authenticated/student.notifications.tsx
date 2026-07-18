import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/notifications")({ component: Notifications });

function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at",{ascending:false}).limit(100);
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("notif").on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user?.id}` }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  };

  const open = async (n: any) => {
    if (!n.read_at) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    const to = n.link || (n.kind === "message" ? "/student/messages" : "/student");
    navigate({ to });
  };

  return (
    <div>
      <PageHeader title="Notifications" actions={<Button size="sm" variant="outline" onClick={markAll}><Check className="mr-1 h-3 w-3" /> Mark all read</Button>} />
      <ul className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">You're all caught up.</p>}
        {rows.map((n) => (
          <li key={n.id}>
            <button onClick={() => open(n)} className={`card-elevated flex w-full gap-3 p-4 text-left transition hover:bg-secondary/40 ${n.read_at ? "opacity-60" : ""}`}>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary"><Bell className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-medium">{n.title}</div>
                {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

