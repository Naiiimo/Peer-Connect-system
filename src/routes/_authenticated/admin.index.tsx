import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, ShieldCheck, Trash2, CalendarCheck, Wallet } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminOverview });

const COLORS = ["var(--color-chart-1)","var(--color-chart-2)","var(--color-chart-3)","var(--color-chart-4)","var(--color-chart-5)"];

function AdminOverview() {
  const [kpi, setKpi] = useState({ total: 0, students: 0, tutors: 0, deleted: 0 });
  const [monthly, setMonthly] = useState<any[]>([]);
  const [gender, setGender] = useState<any[]>([]);
  const [sessionKpi, setSessionKpi] = useState({ upcoming: 0, total: 0, fees: 0, currency: "KES" });
  const [live, setLive] = useState<any[]>([]);

  const loadSessions = async () => {
    const { data: settings } = await supabase.from("platform_settings").select("service_fee_percent,currency").maybeSingle();
    const { data: sessions } = await supabase
      .from("sessions").select("id,tutor_id,student_id,topic,start_at,end_at,status,cancelled_at")
      .order("start_at", { ascending: false }).limit(500);
    const booked = (sessions ?? []).filter((s: any) => s.tutor_id !== s.student_id);
    const tutorIds = Array.from(new Set(booked.map((s: any) => s.tutor_id)));
    const { data: tutors } = tutorIds.length
      ? await supabase.from("profiles").select("id,full_name,hourly_rate").in("id", tutorIds)
      : { data: [] as any[] };
    const map = Object.fromEntries((tutors ?? []).map((t: any) => [t.id, t]));
    const rate = Number(settings?.service_fee_percent ?? 10) / 100;
    const fees = booked
      .filter((s: any) => !s.cancelled_at && s.status !== "cancelled")
      .reduce((sum: number, s: any) => {
        const h = Math.max(0, (new Date(s.end_at).getTime() - new Date(s.start_at).getTime()) / 3_600_000);
        return sum + Number(map[s.tutor_id]?.hourly_rate ?? 0) * h * rate;
      }, 0);
    setSessionKpi({
      upcoming: booked.filter((s: any) => !s.cancelled_at && new Date(s.start_at).getTime() > Date.now()).length,
      total: booked.length,
      fees,
      currency: settings?.currency ?? "KES",
    });
    setLive(booked.slice(0, 8).map((s: any) => ({ ...s, tutor: map[s.tutor_id] })));
  };

  useEffect(() => {
    loadSessions();
    const ch = supabase.channel("admin-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => loadSessions())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    (async () => {
      const { data: all } = await supabase.from("profiles").select("role,gender,created_at,deleted_at");
      const rows = all ?? [];
      setKpi({
        total: rows.length,
        students: rows.filter((r: any) => r.role === "student").length,
        tutors: rows.filter((r: any) => r.role === "tutor").length,
        deleted: rows.filter((r: any) => r.deleted_at).length,
      });
      // Monthly registrations vs deletions (last 6 months)
      const buckets: Record<string, { month: string; students: number; tutors: number; deleted: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        buckets[k] = { month: d.toLocaleDateString(undefined, { month: "short" }), students: 0, tutors: 0, deleted: 0 };
      }
      rows.forEach((r: any) => {
        const k = (r.created_at ?? "").slice(0,7);
        if (buckets[k]) { if (r.role === "student") buckets[k].students++; if (r.role === "tutor") buckets[k].tutors++; }
        if (r.deleted_at) {
          const dk = r.deleted_at.slice(0,7);
          if (buckets[dk]) buckets[dk].deleted++;
        }
      });
      setMonthly(Object.values(buckets));
      const g: any = { male: 0, female: 0, other: 0, unspecified: 0 };
      rows.forEach((r: any) => { g[r.gender ?? "unspecified"] = (g[r.gender ?? "unspecified"] ?? 0) + 1; });
      setGender(Object.entries(g).map(([k,v]) => ({ name: k, value: v })));
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Admin overview" description="Platform health at a glance." />
      <div className="grid gap-4 md:grid-cols-4">
        <KPI icon={<Users />} label="Total users" value={kpi.total} />
        <KPI icon={<GraduationCap />} label="Students" value={kpi.students} />
        <KPI icon={<ShieldCheck />} label="Tutors" value={kpi.tutors} />
        <KPI icon={<Trash2 />} label="Deleted" value={kpi.deleted} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <KPI icon={<CalendarCheck />} label="Upcoming sessions" value={sessionKpi.upcoming} />
        <KPI icon={<CalendarCheck />} label="Sessions booked (all time)" value={sessionKpi.total} />
        <KPI icon={<Wallet />} label="Platform fees earned" value={`${sessionKpi.currency} ${Math.round(sessionKpi.fees).toLocaleString()}`} />
      </div>

      <section className="card-elevated mt-6 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Latest bookings <span className="text-xs font-normal text-muted-foreground">· live</span></h2>
        <ul className="space-y-2 text-sm">
          {live.length === 0 && <li className="text-muted-foreground">No sessions booked yet.</li>}
          {live.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0">
              <span className="truncate">{s.topic ?? "Session"} · {s.tutor?.full_name ?? "Tutor"}</span>
              <span className="text-xs text-muted-foreground">{new Date(s.start_at).toLocaleString()} · {s.cancelled_at ? "cancelled" : s.status}</span>
            </li>
          ))}
        </ul>
      </section>


      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card-elevated p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Registrations & deletions (6 mo)</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip /><Legend />
                <Bar dataKey="students" fill="var(--color-chart-1)" />
                <Bar dataKey="tutors" fill="var(--color-chart-2)" />
                <Bar dataKey="deleted" fill="var(--color-destructive)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-elevated p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Gender split</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={gender} dataKey="value" nameKey="name" outerRadius={90} label>
                  {gender.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

function KPI({ icon, label, value }: any) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
    </div>
  );
}
