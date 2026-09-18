import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BadgeCheck, Wallet } from "lucide-react";

export type PayStatus = "unpaid" | "pending" | "paid" | "waived";

const LABEL: Record<PayStatus, string> = {
  unpaid: "Payment due",
  pending: "Payment sent",
  paid: "Paid",
  waived: "Free",
};

export function money(amount: number | null | undefined, currency = "KES") {
  if (!amount || Number(amount) <= 0) return "Free";
  return `${currency} ${Number(amount).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Payment strip for one session. Students confirm they have sent payment; tutors confirm receipt. */
export function SessionPayment({ session, role, onChange }: { session: any; role: "student" | "tutor"; onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState("M-Pesa");
  const [busy, setBusy] = useState(false);

  const amount = Number(session.amount ?? 0);
  const currency = session.currency ?? "KES";
  const status: PayStatus = (session.payment_status ?? (amount > 0 ? "unpaid" : "waived")) as PayStatus;
  const cancelled = !!session.cancelled_at || session.status === "cancelled";
  if (cancelled || amount <= 0) return null;

  const update = async (patch: any, msg: string) => {
    setBusy(true);
    const { error } = await supabase.from("sessions").update(patch).eq("id", session.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    setOpen(false);
    onChange?.();
  };

  const tone = status === "paid" ? "bg-mint text-foreground" : status === "pending" ? "bg-accent text-accent-foreground" : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={status === "unpaid" ? "outline" : "secondary"} className={`text-[10px] ${tone}`}>
        <Wallet className="mr-1 h-3 w-3" /> {money(amount, currency)} · {LABEL[status]}
      </Badge>

      {role === "student" && status === "unpaid" && (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>I've paid</Button>
      )}
      {role === "tutor" && (status === "pending" || status === "unpaid") && (
        <Button size="sm" variant="outline" disabled={busy}
          onClick={() => update({ payment_status: "paid", paid_at: new Date().toISOString() }, "Marked as received")}>
          <BadgeCheck className="mr-1 h-3 w-3" /> Confirm received
        </Button>
      )}
      {role === "tutor" && status !== "waived" && status !== "paid" && (
        <Button size="sm" variant="ghost" disabled={busy}
          onClick={() => update({ payment_status: "waived" }, "Session marked free")}>Waive</Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm your payment</DialogTitle>
            <DialogDescription>
              You pay your tutor directly. Tell us how you paid {money(amount, currency)} and your tutor will confirm it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>How did you pay?</Label>
              <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="M-Pesa, cash, bank transfer…" />
            </div>
            <Button className="w-full" disabled={busy}
              onClick={() => update({ payment_status: "pending", payment_method: method.trim() || "Other" }, "Your tutor has been notified")}>
              Send confirmation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
