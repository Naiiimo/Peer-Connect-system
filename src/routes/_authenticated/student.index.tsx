import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, Users, MessageSquare, Calendar, Clock, Wallet, Bell, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/student/")({ component: Overview });

const hoursBetween = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000);

function Overview() {
  const { profile, user } = useAuth();
  const [tutors, setTutors] = useState<any[]>([]);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [tutorMap, setTutorMap] = useState<Record<string, any>>({});
  const [unread, setUnread] = useState(0);
  const [connections, setConnections] = useState(0);
  const [activity, setActivity] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: t }, { data: s }, { count: uc }, { count: cc }, { data: acts }] = await Promise.all([
      supabase.from("profiles")
        .select("id,full_name,photo_url,avg_rating,tutor_programmes,bio,hourly_rate")
        .not("tutor_programmes", "eq", "{}")
        .order("avg_rating", { ascending: false })
        .limit(4),
      supabase.from("sessions").select("*").eq("student_id", user.id).order("start_at"),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null),
      supabase.from("connections").select("id", { count: "exact", head: true }).eq("student_id", user.id).eq("status", "accepted"),
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
    ]);
    const list = s ?? [];
    const ids = Array.from(new Set(list.map((x: any) => x.tutor_id).filter((id: string) => id && id !== user.id)));
    const { data: profs } = ids.length ? await supabase.from("profiles").select("id,full_name,photo_url").in("id", ids) : { data: [] as any[] };
    setTutorMap(Object.fromEntries((profs ?? []).map((p: any) => [p.id, p])));
    setTutors(t ?? []);
    setAllSessions(list);
    setUnread(uc ?? 0);
    setConnections(cc ?? 0);
    setActivity(acts ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`student-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const stats = useMemo(() => {
    const now = Date.now();
    const active = allSessions.filter((s: any) => !s.cancelled_at && s.status !== "cancelled");
    const upcoming = active.filter((s: any) => new Date(s.start_at).getTime() >= now);
    const done = active.filter((s: any) => new Date(s.end_at).getTime() < now);
    const studied = done.reduce((sum: number, s: any) => sum + hoursBetween(s.start_at, s.end_at), 0);
    const due = active.filter((s: any) => (s.payment_status ?? "unpaid") === "unpaid").reduce((sum: number, s: any) => sum + Number(s.amount ?? 0), 0);
    const spent = active.filter((s: any) => s.payment_status === "paid").reduce((sum: number, s: any) => sum + Number(s.amount ?? 0), 0);

    const buckets: Record<string, { month: string; hours: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      buckets[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { month: d.toLocaleDateString(undefined, { month: "short" }), hours: 0 };
    }
    done.forEach((s: any) => {
      const k = String(s.start_at).slice(0, 7);
      if (buckets[k]) buckets[k].hours += hoursBetween(s.start_at, s.end_at);
    });
    return {
      upcoming, studied, due, spent,
      trend: Object.values(buckets).map((b) => ({ ...b, hours: Math.round(b.hours * 10) / 10 })),
    };
  }, [allSessions]);

  const money = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  return (
    <div>
      <PageHeader
        title={`Hi, ${profile?.full_name?.split(" ")[0] ?? "Student"} 👋`}
        description={`${profile?.programme ?? "Your programme"} · Year ${profile?.year_of_study ?? "-"}`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI icon={<Users className="h-4 w-4" />} label="Connected tutors" value={connections} />
        <KPI icon={<Calendar className="h-4 w-4" />} label="Upcoming sessions" value={stats.upcoming.length} />
        <KPI icon={<Clock className="h-4 w-4" />} label="Hours studied" value={stats.studied.toFixed(1)} />
        <KPI icon={<MessageSquare className="h-4 w-4" />} label="Unread messages" value={unread} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KPI icon={<Wallet className="h-4 w-4" />} label="Outstanding payments" value={money(stats.due)} />
        <KPI icon={<Wallet className="h-4 w-4" />} label="Paid to tutors" value={money(stats.spent)} />
        <KPI icon={<Star className="h-4 w-4" />} label="Sessions completed" value={allSessions.filter((s: any) => !s.cancelled_at && new Date(s.end_at).getTime() < Date.now()).length} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Next up</h2>
            <Link to="/student/schedule" className="text-sm text-primary hover:underline">Open schedule →</Link>
          </div>
          <ul className="space-y-3">
            {stats.upcoming.length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing scheduled yet. <Link to="/student/find-tutors" className="text-primary hover:underline">Find a tutor</Link>.</li>
            )}
            {stats.upcoming.slice(0, 3).map((s: any) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.topic ?? "Session"}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.start_at).toLocaleString()}
                    {tutorMap[s.tutor_id]?.full_name ? ` · with ${tutorMap[s.tutor_id].full_name}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {Number(s.amount ?? 0) > 0 && (
                    <Badge variant={s.payment_status === "paid" ? "secondary" : "outline"} className="text-[10px]">
                      {money(Number(s.amount))} · {s.payment_status ?? "unpaid"}
                    </Badge>
                  )}
                  {s.zoom_url && <a href={s.zoom_url} target="_blank" rel="noreferrer"><Button size="sm">Join</Button></a>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card-elevated p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Study hours (last 6 months)</h2>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={stats.trend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="hours" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-elevated p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Recent activity</h2>
            <Link to="/student/notifications" className="text-sm text-primary hover:underline">See all →</Link>
          </div>
          <ul className="space-y-2">
            {activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            {activity.map((n) => (
              <li key={n.id} className="flex items-start gap-2 border-b border-border/60 pb-2 last:border-0">
                <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm">{n.title}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>

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
                  <div className="truncate text-xs text-muted-foreground">{t.bio || "USIU tutor"}</div>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-1 text-xs"><Star className="h-3 w-3 fill-accent text-accent" />{Number(t.avg_rating ?? 0).toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">{t.hourly_rate ? `KES ${Number(t.hourly_rate).toLocaleString()}/hr` : "Free"}</div>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/student/library" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <BookOpen className="h-3.5 w-3.5" /> Open your library
          </Link>
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
