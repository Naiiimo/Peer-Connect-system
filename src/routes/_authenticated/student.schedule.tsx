import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video, Calendar as CalendarIcon, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/schedule")({ component: Schedule });

function fmtDay(d: Date) {
  return d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Schedule() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("sessions").select("*").eq("student_id", user.id).order("start_at");
    if (error) return toast.error(error.message);
    const tutorIds = Array.from(new Set((data ?? []).map((s: any) => s.tutor_id).filter((id: string) => id && id !== user.id)));
    const { data: tutors } = tutorIds.length ? await supabase.from("profiles").select("id,full_name,photo_url").in("id", tutorIds) : { data: [] as any[] };
    const tutorMap = Object.fromEntries((tutors ?? []).map((t: any) => [t.id, t]));
    setSessions((data ?? []).map((s: any) => ({ ...s, tutor: tutorMap[s.tutor_id] })));
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`student-schedule-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `student_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const now = Date.now();
  const { upcoming, past } = useMemo(() => {
    const up: any[] = []; const pa: any[] = [];
    for (const s of sessions) {
      const t = new Date(s.start_at).getTime();
      if (!s.cancelled_at && t >= now - 30 * 60 * 1000) up.push(s); else pa.push(s);
    }
    return { upcoming: up, past: pa.reverse() };
  }, [sessions, now]);

  const create = async () => {
    if (!user || !topic || !start || !end) return;
    const startD = new Date(start), endD = new Date(end);
    if (endD <= startD) return toast.error("End time must be after start time.");
    if (startD.getTime() < Date.now()) return toast.error("Start time is in the past.");
    const { data: clashes } = await supabase
      .from("sessions").select("id,topic,start_at,status")
      .eq("student_id", user.id)
      .lt("start_at", endD.toISOString())
      .gt("end_at", startD.toISOString());
    const conflict = (clashes ?? []).find((c: any) => c.status !== "cancelled");
    if (conflict) return toast.error(`Conflicts with "${conflict.topic ?? "another event"}" at ${new Date(conflict.start_at).toLocaleString()}.`);
    const { error } = await supabase.from("sessions").insert({ tutor_id: user.id, student_id: user.id, topic, start_at: startD.toISOString(), end_at: endD.toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Added to schedule");
    setOpen(false); setTopic(""); setStart(""); setEnd(""); load();
  };

  const Row = ({ s, isPast }: { s: any; isPast: boolean }) => {
    const startD = new Date(s.start_at);
    const endD = new Date(s.end_at);
    const withTutor = s.tutor?.full_name && s.tutor_id !== s.student_id;
    return (
      <li className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <CalendarIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium">{s.topic ?? "Session"}</span>
              {s.cancelled_at ? <Badge variant="destructive" className="text-[10px]">Cancelled</Badge>
                : isPast ? <Badge variant="secondary" className="text-[10px]">Completed</Badge>
                : <Badge className="bg-mint text-foreground text-[10px]">Upcoming</Badge>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{fmtDay(startD)}</div>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {fmtTime(startD)} – {fmtTime(endD)}
            </div>
            {withTutor && <div className="mt-0.5 text-xs text-muted-foreground">with {s.tutor.full_name}</div>}
          </div>
        </div>
        {s.zoom_url && !s.cancelled_at && (
          <a href={s.zoom_url} target="_blank" rel="noreferrer" className="sm:shrink-0">
            <Button size="sm" className="w-full sm:w-auto"><Video className="mr-1 h-3 w-3" /> Join meeting</Button>
          </a>
        )}
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Schedule" description="Your upcoming study sessions — booked sessions and personal events appear here live." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New event</DialogTitle>
              <DialogDescription>Add a personal study event to your schedule.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
                <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              </div>
              <Button onClick={create} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      } />

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Upcoming</h2>
        <ul className="space-y-2">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled yet. Book a session from My Tutors.</p>}
          {upcoming.map((s) => <Row key={s.id} s={s} isPast={false} />)}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Past</h2>
        <ul className="space-y-2">
          {past.length === 0 && <p className="text-sm text-muted-foreground">No past sessions.</p>}
          {past.map((s) => <Row key={s.id} s={s} isPast />)}
        </ul>
      </section>
    </div>
  );
}
