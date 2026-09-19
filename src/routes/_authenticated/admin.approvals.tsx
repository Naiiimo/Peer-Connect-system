import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Clock, X } from "lucide-react";
import { money } from "@/components/SessionPayment";

export const Route = createFileRoute("/_authenticated/admin/approvals")({ component: Approvals });

type Filter = "pending" | "approved" | "rejected";

function Approvals() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select("id,tutor_id,student_id,topic,start_at,end_at,status,cancelled_at,amount,currency,payment_status,approval_status,approved_at,review_note")
      .order("start_at", { ascending: false })
      .limit(300);
    if (error) return toast.error(error.message);
    const ids = Array.from(new Set((data ?? []).flatMap((s: any) => [s.tutor_id, s.student_id])));
    const { data: people } = ids.length
      ? await supabase.from("profiles").select("id,full_name,photo_url").in("id", ids)
      : { data: [] as any[] };
    const map = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
    setRows((data ?? []).filter((s: any) => s.tutor_id !== s.student_id).map((s: any) => ({ ...s, tutor: map[s.tutor_id], student: map[s.student_id] })));
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const list = useMemo(() => rows.filter((r) => (r.approval_status ?? "pending") === filter), [rows, filter]);
  const counts = useMemo(() => ({
    pending: rows.filter((r) => (r.approval_status ?? "pending") === "pending").length,
    approved: rows.filter((r) => r.approval_status === "approved").length,
    rejected: rows.filter((r) => r.approval_status === "rejected").length,
  }), [rows]);

  const decide = async (row: any, approval_status: Filter, review_note?: string) => {
    setBusy(true);
    const { error } = await supabase.from("sessions").update({
      approval_status,
      approved_by: user?.id ?? null,
      approved_at: new Date().toISOString(),
      review_note: review_note ?? null,
      ...(approval_status === "rejected" ? { status: "cancelled" as const, cancelled_at: new Date().toISOString() } : {}),
    }).eq("id", row.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(approval_status === "approved" ? "Session approved" : "Session rejected");
    setRejecting(null);
    setNote("");
    load();
  };

  return (
    <div>
      <PageHeader title="Session approvals" description="Review every booking before it goes ahead. Both people are notified of your decision." />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f} · {counts[f]}
          </Button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">Nothing {filter} right now.</p>}
        {list.map((r) => (
          <li key={r.id} className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{r.topic ?? "Session"}</div>
              <div className="text-xs text-muted-foreground">
                {r.tutor?.full_name ?? "Tutor"} → {r.student?.full_name ?? "Student"} · {new Date(r.start_at).toLocaleString()}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">{money(Number(r.amount ?? 0), r.currency ?? "KES")}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{r.payment_status ?? "unpaid"}</Badge>
                {r.approval_status === "pending" && <Badge className="bg-accent text-[10px] text-accent-foreground"><Clock className="mr-1 h-3 w-3" />Awaiting review</Badge>}
                {r.approval_status === "rejected" && r.review_note && <span className="text-[11px] text-muted-foreground">Reason: {r.review_note}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {r.approval_status !== "approved" && (
                <Button size="sm" disabled={busy} onClick={() => decide(r, "approved")}><Check className="mr-1 h-3 w-3" /> Approve</Button>
              )}
              {r.approval_status !== "rejected" && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setRejecting(r); setNote(""); }}>
                  <X className="mr-1 h-3 w-3" /> Reject
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this session</DialogTitle>
            <DialogDescription>The tutor and student both see your reason.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this session not going ahead?" />
            </div>
            <Button className="w-full" disabled={busy} onClick={() => rejecting && decide(rejecting, "rejected", note.trim() || undefined)}>
              Reject session
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
