import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Star, Inbox, Video } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/tutor/")({ component: Overview });

function Overview() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ students: 0, pending: 0, upcoming: 0 });
  const [chart, setChart] = useState<any[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ count: acc }, { count: pend }, { count: up }, { data: sess }] = await Promise.all([
      supabase.from("connections").select("id",{count:"exact",head:true}).eq("tutor_id",user.id).eq("status","accepted"),
      supabase.from("connections").select("id",{count:"exact",head:true}).eq("tutor_id",user.id).eq("status","pending"),
      supabase.from("sessions").select("id",{count:"exact",head:true}).eq("tutor_id",user.id).gte("start_at", new Date().toISOString()),
      supabase.from("sessions").select("start_at").eq("tutor_id",user.id).gte("start_at", new Date(Date.now() - 56 * 86400000).toISOString()),
    ]);
    setStats({ students: acc ?? 0, pending: pend ?? 0, upcoming: up ?? 0 });
    const buckets: Record<string, number> = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i * 7);
      buckets[weekKey(d)] = 0;
    }
    (sess ?? []).forEach((s: any) => {
      const k = weekKey(new Date(s.start_at));
      if (k in buckets) buckets[k]++;
    });
    setChart(Object.entries(buckets).map(([k, v]) => ({ week: k, sessions: v })));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`tutor-dashboard-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `tutor_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `tutor_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  return (
    <div>
      <PageHeader title={`Welcome, ${profile?.full_name?.split(" ")[0] ?? "Tutor"}`} description="Your teaching at a glance." />
      <div className="grid gap-4 md:grid-cols-4">
        <KPI icon={<Users className="h-4 w-4" />} label="Students taught" value={stats.students} />
        <KPI icon={<Inbox className="h-4 w-4" />} label="Pending requests" value={stats.pending} />
        <KPI icon={<Video className="h-4 w-4" />} label="Upcoming sessions" value={stats.upcoming} />
        <KPI icon={<Star className="h-4 w-4" />} label="Average rating" value={Number(profile?.avg_rating ?? 0).toFixed(1)} />
      </div>

      <section className="card-elevated mt-6 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Sessions — last 8 weeks</h2>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="week" fontSize={11} />
              <YAxis fontSize={11} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="sessions" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function weekKey(d: Date) {
  const day = new Date(d); day.setDate(day.getDate() - day.getDay());
  return `${day.getMonth()+1}/${day.getDate()}`;
}

function KPI({ icon, label, value }: any) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
