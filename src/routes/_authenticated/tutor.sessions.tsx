import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Video, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tutor/sessions")({ component: Sessions });

function Sessions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("tutor_id", user.id)
      .order("start_at", { ascending: true });
    const studentIds = Array.from(new Set((data ?? []).map((s: any) => s.student_id).filter(Boolean)));
    const { data: students } = studentIds.length ? await supabase.from("profiles").select("id,full_name,photo_url").in("id", studentIds) : { data: [] as any[] };
    const studentMap = Object.fromEntries((students ?? []).map((s: any) => [s.id, s]));
    setRows((data ?? []).map((s: any) => ({ ...s, student: studentMap[s.student_id] })));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Realtime sync — refetch on any change to my sessions
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`tutor-sessions-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `tutor_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const now = Date.now();
  const upcoming = useMemo(() => rows.filter((s) => !s.cancelled_at && new Date(s.start_at).getTime() >= now - 30 * 60 * 1000), [rows, now]);
  const past = useMemo(() => rows.filter((s) => s.cancelled_at || new Date(s.start_at).getTime() < now - 30 * 60 * 1000).reverse(), [rows, now]);

  const cancel = async (id: string, studentId: string) => {
    const { error } = await supabase.from("sessions").update({ cancelled_at: new Date().toISOString(), status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: studentId, kind: "session_cancelled", title: "Session cancelled", body: "Your tutor cancelled the session.", link: "/student/schedule" });
    toast.success("Session cancelled");
  };

  const Row = ({ s, canCancel }: { s: any; canCancel: boolean }) => (
    <li className="card-elevated flex items-center justify-between gap-3 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <img src={s.student?.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${s.student?.full_name}`} className="h-9 w-9 rounded-full object-cover" alt="" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{s.topic ?? "Session"} · {s.student?.full_name}</div>
          <div className="text-xs text-muted-foreground">{new Date(s.start_at).toLocaleString()}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {s.cancelled_at && <Badge variant="destructive">Cancelled</Badge>}
        {s.zoom_url && !s.cancelled_at && (
          <a href={s.zoom_url} target="_blank" rel="noreferrer"><Button size="sm"><Video className="mr-1 h-3 w-3" /> Open</Button></a>
        )}
        {canCancel && !s.cancelled_at && (
          <Button size="sm" variant="outline" onClick={() => cancel(s.id, s.student_id)}>
            <X className="mr-1 h-3 w-3" /> Cancel
          </Button>
        )}
      </div>
    </li>
  );

  return (
    <div>
      <PageHeader title="Sessions" description="Upcoming and past sessions — updates live as students book." />
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Upcoming</h2>
        <ul className="space-y-2">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming sessions.</p>}
          {upcoming.map((s) => <Row key={s.id} s={s} canCancel />)}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Past</h2>
        <ul className="space-y-2">
          {past.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          {past.map((s) => <Row key={s.id} s={s} canCancel={false} />)}
        </ul>
      </section>
    </div>
  );
}
