import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Video } from "lucide-react";
import { toast } from "sonner";
import { ProfileDialog } from "@/components/ProfileDialog";

export const Route = createFileRoute("/_authenticated/tutor/students")({ component: Students });

function Students() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [scheduleFor, setScheduleFor] = useState<any | null>(null);
  const [topic, setTopic] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [zoom, setZoom] = useState("");
  const [viewProfile, setViewProfile] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("connections").select("student_id,student:profiles!connections_student_id_fkey(id,full_name,photo_url,programme,year_of_study)").eq("tutor_id", user.id).eq("status", "accepted");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const schedule = async () => {
    if (!user || !scheduleFor) return;
    const { error } = await supabase.from("sessions").insert({ tutor_id: user.id, student_id: scheduleFor.student_id, topic, start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString(), zoom_url: zoom || null });
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: scheduleFor.student_id, kind: "session_scheduled", title: "New session scheduled", body: `${topic} on ${new Date(start).toLocaleString()}`, link: zoom || null });
    toast.success("Session scheduled"); setScheduleFor(null); setTopic(""); setStart(""); setEnd(""); setZoom("");
  };

  return (
    <div>
      <PageHeader title="My students" description="Message them or schedule a session." />
      <div className="grid gap-3 md:grid-cols-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No accepted students yet.</p>}
        {rows.map((r) => (
          <div key={r.student_id} className="card-elevated flex items-center gap-3 p-4">
            <img src={r.student?.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${r.student?.full_name}`} className="h-10 w-10 rounded-full object-cover" alt="" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{r.student?.full_name}</div>
              <div className="text-xs text-muted-foreground">{r.student?.programme} · Y{r.student?.year_of_study}</div>
            </div>
            <Link to="/tutor/messages"><Button size="icon" variant="outline"><MessageSquare className="h-4 w-4" /></Button></Link>
            <Button size="sm" onClick={() => setScheduleFor(r)}><Video className="mr-1 h-3 w-3" /> Schedule</Button>
          </div>
        ))}
      </div>

      <Dialog open={!!scheduleFor} onOpenChange={(o) => !o && setScheduleFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule session</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            </div>
            <div><Label>Zoom meeting URL (optional)</Label><Input value={zoom} onChange={(e) => setZoom(e.target.value)} placeholder="https://zoom.us/j/..." /></div>
            <Button onClick={schedule} className="w-full">Send invite</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
