import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Users, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/student/")({ component: Overview });

function Overview() {
  const { profile, user } = useAuth();
  const [tutors, setTutors] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [connections, setConnections] = useState(0);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { data: s }, { count: uc }, { count: cc }] = await Promise.all([
      supabase.from("profiles")
        .select("id,full_name,photo_url,avg_rating,tutor_programmes,specializations")
        .not("tutor_programmes", "eq", "{}")
        .order("avg_rating", { ascending: false })
        .limit(4),
      supabase.from("sessions").select("*").eq("student_id", user.id).gte("start_at", new Date().toISOString()).order("start_at").limit(3),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
      supabase.from("connections").select("id", { count: "exact", head: true }).eq("student_id", user.id).eq("status","accepted"),
    ]);
    setTutors(t ?? []);
    setSessions(s ?? []);
    setUnread(uc ?? 0);
    setConnections(cc ?? 0);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`student-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  return (
    <div>
      <PageHeader title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "Student"} 👋`} description={`${profile?.programme ?? "Your programme"} · Year ${profile?.year_of_study ?? "-"}`} />

      <div className="grid gap-4 md:grid-cols-4">
        <KPI icon={<Users className="h-4 w-4" />} label="Connected tutors" value={connections} />
        <KPI icon={<MessageSquare className="h-4 w-4" />} label="Unread messages" value={unread} />
        <KPI icon={<Calendar className="h-4 w-4" />} label="Upcoming sessions" value={sessions.length} />
        <KPI icon={<Star className="h-4 w-4" />} label="Rating you gave" value={"—"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recommended tutors</h2>
            <Link to="/student/find-tutors" className="text-sm text-primary hover:underline">Browse all →</Link>
          </div>
          <ul className="space-y-3">
            {tutors.length === 0 && <li className="text-sm text-muted-foreground">No tutors yet — check back soon.</li>}
            {tutors.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-md p-2 hover:bg-secondary/60">
                <img src={t.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${t.full_name}`} className="h-10 w-10 rounded-full object-cover" alt="" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.full_name ?? "Tutor"}</div>
                  <div className="truncate text-xs text-muted-foreground">{(t.specializations ?? []).slice(0,3).join(" · ") || "USIU tutor"}</div>
                </div>
                <div className="flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-accent text-accent" />{Number(t.avg_rating ?? 0).toFixed(1)}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Upcoming sessions</h2>
            <Link to="/student/schedule" className="text-sm text-primary hover:underline">Open schedule →</Link>
          </div>
          <ul className="space-y-3">
            {sessions.length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing scheduled yet. <Link to="/student/find-tutors" className="text-primary hover:underline">Find a tutor</Link>.</li>
            )}
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="text-sm font-medium">{s.topic ?? "Session"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(s.start_at).toLocaleString()}</div>
                </div>
                {s.zoom_url && <a href={s.zoom_url} target="_blank" rel="noreferrer"><Button size="sm">Join</Button></a>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
