import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CalendarClock, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatConflict, validateTimeRange } from "@/lib/scheduling";
import { ReminderControls } from "@/components/ReminderControls";

export const Route = createFileRoute("/_authenticated/tutor/sessions")({ component: Sessions });

function Sessions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [rescheduling, setRescheduling] = useState<any | null>(null);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

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

  const openReschedule = (session: any) => {
    const local = (value: string) => {
      const date = new Date(value);
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    };
    setRescheduling(session);
    setNewStart(local(session.start_at));
    setNewEnd(local(session.end_at));
  };

  const saveReschedule = async () => {
    if (!user || !rescheduling) return;
    const validation = validateTimeRange(newStart, newEnd);
    if (validation) return toast.error(validation);
    const start = new Date(newStart);
    const end = new Date(newEnd);
    const { data: clashes, error: clashError } = await supabase.from("sessions")
      .select("id,topic,start_at,end_at,tutor_id,student_id,status,cancelled_at")
      .neq("id", rescheduling.id)
      .or(`tutor_id.eq.${user.id},student_id.eq.${rescheduling.student_id}`)
      .lt("start_at", end.toISOString()).gt("end_at", start.toISOString());
    if (clashError) return toast.error(clashError.message);
    const conflict = (clashes ?? []).find((item: any) => item.status !== "cancelled" && !item.cancelled_at);
    if (conflict) return toast.error(formatConflict(conflict, user.id));
    const { error } = await supabase.from("sessions").update({ start_at: start.toISOString(), end_at: end.toISOString(), availability_slot_id: null, reminders_sent: [] }).eq("id", rescheduling.id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: rescheduling.student_id, kind: "session_rescheduled", title: "Session rescheduled", body: `${rescheduling.topic ?? "Your session"} moved to ${start.toLocaleString()}`, link: "/student/schedule" });
    toast.success("Session rescheduled");
    setRescheduling(null);
    load();
  };

  const Row = ({ s, canCancel }: { s: any; canCancel: boolean }) => (
    <li className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <img src={s.student?.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${s.student?.full_name}`} className="h-9 w-9 rounded-full object-cover" alt="" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{s.topic ?? "Session"} · {s.student?.full_name}</div>
          <div className="text-xs text-muted-foreground">{new Date(s.start_at).toLocaleString()}</div>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {s.cancelled_at && <Badge variant="destructive">Cancelled</Badge>}
        {s.zoom_url && !s.cancelled_at && (
          <a href={s.zoom_url} target="_blank" rel="noreferrer"><Button size="sm"><Video className="mr-1 h-3 w-3" /> Open</Button></a>
        )}
        {canCancel && !s.cancelled_at && (
          <Button size="sm" variant="outline" onClick={() => openReschedule(s)}>
            <CalendarClock className="mr-1 h-3 w-3" /> Reschedule
          </Button>
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
      <ReminderControls sessions={rows} />
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
      <Dialog open={!!rescheduling} onOpenChange={(open) => !open && setRescheduling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule session</DialogTitle>
            <DialogDescription>The student will be notified and reminder timing will reset.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Start</Label><Input type="datetime-local" value={newStart} onChange={(event) => setNewStart(event.target.value)} /></div>
            <div><Label>End</Label><Input type="datetime-local" value={newEnd} onChange={(event) => setNewEnd(event.target.value)} /></div>
          </div>
          <Button onClick={saveReschedule}>Save new time</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
