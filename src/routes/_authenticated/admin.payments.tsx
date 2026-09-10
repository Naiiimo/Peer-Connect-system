import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Wallet, Percent, Receipt } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({ component: Payments });

const hours = (a: string, b: string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000);

function Payments() {
  const [fee, setFee] = useState("10");
  const [currency, setCurrency] = useState("KES");
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data: settings } = await supabase.from("platform_settings").select("*").maybeSingle();
    if (settings) { setFee(String(settings.service_fee_percent)); setCurrency(settings.currency); }

    const { data: sessions, error } = await supabase
      .from("sessions").select("id,tutor_id,student_id,topic,start_at,end_at,status,cancelled_at")
      .order("start_at", { ascending: false }).limit(500);
    if (error) return toast.error(error.message);

    const ids = Array.from(new Set((sessions ?? []).flatMap((s: any) => [s.tutor_id, s.student_id])));
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id,full_name,hourly_rate").in("id", ids)
      : { data: [] as any[] };
    const map = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
    setRows((sessions ?? [])
      .filter((s: any) => s.tutor_id !== s.student_id)
      .map((s: any) => {
        const rate = Number(map[s.tutor_id]?.hourly_rate ?? 0);
        const gross = rate * hours(s.start_at, s.end_at);
        return { ...s, tutor: map[s.tutor_id], student: map[s.student_id], gross };
      }));
  };
  useEffect(() => { load(); }, []);

  const saveFee = async () => {
    const value = Number(fee);
    if (!Number.isFinite(value) || value < 0 || value > 100) return toast.error("Enter a service fee between 0 and 100 percent.");
    setSaving(true);
    const { error } = await supabase.from("platform_settings").update({ service_fee_percent: value, currency }).eq("id", true);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fee settings saved");
    load();
  };

  const feeRate = Number(fee) / 100;
  const billable = rows.filter((r) => !r.cancelled_at && r.status !== "cancelled");
  const gross = billable.reduce((sum, r) => sum + r.gross, 0);
  const fees = gross * feeRate;
  const money = (n: number) => `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div>
      <PageHeader title="Fees & payments" description="Set the platform service fee and review what tutoring has earned." />

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={<Wallet />} label="Tutoring value (billable)" value={money(gross)} />
        <Stat icon={<Percent />} label={`Platform fee at ${fee}%`} value={money(fees)} />
        <Stat icon={<Receipt />} label="Paid to tutors" value={money(gross - fees)} />
      </div>

      <section className="card-elevated mt-6 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Fee settings</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Service fee (%)</Label>
            <Input type="number" min={0} max={100} step={0.5} value={fee} onChange={(e) => setFee(e.target.value)} className="w-32" />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 6))} className="w-28" />
          </div>
          <Button onClick={saveFee} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Applied to every paid session based on the tutor's hourly rate and the session length.</p>
      </section>

      <section className="card-elevated mt-6 overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-xs text-muted-foreground">
            <tr><th className="p-3 text-left">Session</th><th className="p-3 text-left">Tutor</th><th className="p-3 text-left">Student</th><th className="p-3 text-left">Hours</th><th className="p-3 text-left">Value</th><th className="p-3 text-left">Fee</th><th className="p-3 text-left">Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-muted-foreground">No booked sessions yet.</td></tr>}
            {rows.map((r) => {
              const cancelled = !!r.cancelled_at || r.status === "cancelled";
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-3">{r.topic ?? "Session"}<div className="text-[11px] text-muted-foreground">{new Date(r.start_at).toLocaleString()}</div></td>
                  <td className="p-3">{r.tutor?.full_name ?? "—"}</td>
                  <td className="p-3">{r.student?.full_name ?? "—"}</td>
                  <td className="p-3">{hours(r.start_at, r.end_at).toFixed(1)}</td>
                  <td className="p-3">{r.gross > 0 ? money(r.gross) : "Free"}</td>
                  <td className="p-3">{cancelled || r.gross === 0 ? "—" : money(r.gross * feeRate)}</td>
                  <td className="p-3 capitalize">{cancelled ? "Cancelled" : r.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: any) {
  return (
    <div className="card-elevated p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
    </div>
  );
}
