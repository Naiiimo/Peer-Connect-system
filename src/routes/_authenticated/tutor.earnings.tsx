import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Wallet, Clock, BadgeCheck, Percent } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { SessionPayment, money } from "@/components/SessionPayment";

export const Route = createFileRoute("/_authenticated/tutor/earnings")({ component: Earnings });

function Earnings() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [feePercent, setFeePercent] = useState(0);

  const load = async () => {
    if (!user) return;
    const [{ data: sessions }, { data: settings }] = await Promise.all([
      supabase.from("sessions")
        .select("id,student_id,topic,start_at,end_at,status,cancelled_at,amount,currency,payment_status,payment_method,paid_at,approval_status")
        .eq("tutor_id", user.id).order("start_at", { ascending: false }).limit(300),
      supabase.from("platform_settings").select("service_fee_percent").maybeSingle(),
    ]);
    setFeePercent(Number(settings?.service_fee_percent ?? 0));
    const ids = Array.from(new Set((sessions ?? []).map((s: any) => s.student_id)));
    const { data: students } = ids.length ? await supabase.from("profiles").select("id,full_name,photo_url").in("id", ids) : { data: [] as any[] };
    const map = Object.fromEntries((students ?? []).map((s: any) => [s.id, s]));
    setRows((sessions ?? []).filter((s: any) => s.student_id !== user.id).map((s: any) => ({ ...s, student: map[s.student_id] })));
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`tutor-earnings-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `tutor_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const live = useMemo(() => rows.filter((r) => !r.cancelled_at && r.status !== "cancelled"), [rows]);
  const paid = live.filter((r) => r.payment_status === "paid");
  const awaiting = live.filter((r) => r.payment_status === "pending");
  const due = live.filter((r) => (r.payment_status ?? "unpaid") === "unpaid" && Number(r.amount ?? 0) > 0);
  const sum = (list: any[]) => list.reduce((total, r) => total + Number(r.amount ?? 0), 0);
  const earned = sum(paid);
  const fee = earned * (feePercent / 100);

  const chart = useMemo(() => {
    const buckets: { key: string; label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }), total: 0 });
    }
    paid.forEach((r) => {
      const d = new Date(r.paid_at ?? r.start_at);
      const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.total += Number(r.amount ?? 0);
    });
    return buckets;
  }, [paid]);

  return (
    <div>
      <PageHeader title="Earnings" description="What your students owe, what they've sent, and what has landed." />

      <div className="grid gap-4 md:grid-cols-4">
        <KPI icon={<BadgeCheck className="h-4 w-4" />} label="Received" value={money(earned)} />
        <KPI icon={<Clock className="h-4 w-4" />} label="Awaiting your confirmation" value={money(sum(awaiting))} />
        <KPI icon={<Wallet className="h-4 w-4" />} label="Still due" value={money(sum(due))} />
        <KPI icon={<Percent className="h-4 w-4" />} label={`Platform fee at ${feePercent}%`} value={money(fee)} />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Your hourly rate is {profile?.hourly_rate ? money(Number(profile.hourly_rate)) : "not set yet"} — update it on your profile. Students pay you directly and you confirm each payment here.
      </p>

      <section className="card-elevated mt-6 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Received — last 6 months</h2>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v: any) => money(Number(v))} />
              <Bar dataKey="total" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Payments</h2>
        <ul className="space-y-2">
          {live.length === 0 && <p className="text-sm text-muted-foreground">No paid sessions yet.</p>}
          {live.map((s) => (
            <li key={s.id} className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{s.topic ?? "Session"} · {s.student?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.start_at).toLocaleString()}
                  {s.payment_method ? ` · paid by ${s.payment_method}` : ""}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SessionPayment session={s} role="tutor" onChange={load} />
                  {s.approval_status === "pending" && <Badge className="bg-accent text-[10px] text-accent-foreground">Awaiting admin approval</Badge>}
                  {s.approval_status === "rejected" && <Badge variant="destructive" className="text-[10px]">Not approved</Badge>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KPI({ icon, label, value }: any) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
