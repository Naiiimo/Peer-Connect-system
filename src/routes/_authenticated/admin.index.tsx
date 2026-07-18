import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, GraduationCap, ShieldCheck, Trash2 } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminOverview });

const COLORS = ["var(--color-chart-1)","var(--color-chart-2)","var(--color-chart-3)","var(--color-chart-4)","var(--color-chart-5)"];

function AdminOverview() {
  const [kpi, setKpi] = useState({ total: 0, students: 0, tutors: 0, deleted: 0 });
  const [monthly, setMonthly] = useState<any[]>([]);
  const [gender, setGender] = useState<any[]>([]);

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
