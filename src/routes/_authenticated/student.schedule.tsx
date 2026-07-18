import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Video } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/schedule")({ component: Schedule });

function Schedule() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("sessions").select("*, tutor:profiles!sessions_tutor_id_fkey(full_name)").eq("student_id", user.id).order("start_at");
    setSessions(data ?? []);
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

  const create = async () => {
    if (!user || !topic || !start || !end) return;
    const { error } = await supabase.from("sessions").insert({ tutor_id: user.id, student_id: user.id, topic, start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Added to schedule");
    setOpen(false); setTopic(""); setStart(""); setEnd(""); load();
  };

  return (
    <div>
      <PageHeader title="Schedule" description="Your upcoming study sessions." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
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

      <ul className="space-y-3">
        {sessions.length === 0 && <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>}
        {sessions.map((s) => (
          <li key={s.id} className="card-elevated flex items-center justify-between p-4">
            <div>
              <div className="text-sm font-medium">{s.topic ?? "Session"}</div>
              <div className="text-xs text-muted-foreground">{new Date(s.start_at).toLocaleString()} → {new Date(s.end_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</div>
              {s.tutor?.full_name && s.tutor_id !== s.student_id && <div className="text-xs text-muted-foreground">with {s.tutor.full_name}</div>}
            </div>
            {s.zoom_url && <a href={s.zoom_url} target="_blank" rel="noreferrer"><Button size="sm"><Video className="mr-1 h-3 w-3" /> Join meeting</Button></a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
