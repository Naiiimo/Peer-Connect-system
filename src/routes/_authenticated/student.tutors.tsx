import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Calendar, MessageSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ProfileDialog } from "@/components/ProfileDialog";
import { formatConflict } from "@/lib/scheduling";

export const Route = createFileRoute("/_authenticated/student/tutors")({ component: MyTutors });

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

type Slot = { id: string; tutor_id: string; weekday: number; start_time: string; end_time: string };
type Session = { id: string; tutor_id: string; availability_slot_id: string | null; start_at: string; status: string; cancelled_at: string | null };
type Course = { code: string; title: string };

function nextDateForWeekday(weekday: number, time: string) {
  const now = new Date();
  const d = new Date(now);
  const diff = (weekday - now.getDay() + 7) % 7 || 7; // next occurrence, never today past
  d.setDate(now.getDate() + diff);
  const [h, m] = time.split(":");
  d.setHours(Number(h), Number(m), 0, 0);
  return d;
}

function MyTutors() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [avail, setAvail] = useState<Record<string, Slot[]>>({});
  const [courses, setCourses] = useState<Record<string, Course[]>>({});
  const [bookedSlotIds, setBookedSlotIds] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState<{ tutorId: string; tutorName: string } | null>(null);
  const [topic, setTopic] = useState("");
  const [pickedSlot, setPickedSlot] = useState<Slot | null>(null);
  const [viewProfile, setViewProfile] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data: connections } = await supabase
      .from("connections")
      .select("id,status,tutor_id,updated_at")
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false });
    const list = connections ?? [];
    const allTutorIds = Array.from(new Set(list.map((r: any) => r.tutor_id)));
    let tutorMap: Record<string, any> = {};
    if (allTutorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,photo_url,school,programme,tutor_schools,tutor_programmes,avg_rating,hourly_rate,languages,bio")
        .in("id", allTutorIds);
      tutorMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    }
    const hydratedRows = list.map((r: any) => ({ ...r, tutor: tutorMap[r.tutor_id] }));
    setRows(hydratedRows);
    const tutorIds = list.filter((r: any) => r.status === "accepted").map((r: any) => r.tutor_id);
    setAvail({});
    setCourses({});
    setBookedSlotIds(new Set());
    if (tutorIds.length) {
      const { data: av } = await supabase.from("availability").select("*").in("tutor_id", tutorIds);
      const map: Record<string, Slot[]> = {};
      (av ?? []).forEach((a: any) => { (map[a.tutor_id] ||= []).push(a as Slot); });
      setAvail(map);

      const { data: tutorCourses } = await supabase.from("tutor_courses").select("tutor_id,course_code").in("tutor_id", tutorIds);
      const courseCodes = Array.from(new Set((tutorCourses ?? []).map((c: any) => c.course_code)));
      const { data: courseRows } = courseCodes.length
        ? await supabase.from("courses").select("code,title").in("code", courseCodes)
        : { data: [] as any[] };
      const courseMap = Object.fromEntries((courseRows ?? []).map((c: any) => [c.code, c.title]));
      const tutorCourseMap: Record<string, Course[]> = {};
      (tutorCourses ?? []).forEach((c: any) => {
        (tutorCourseMap[c.tutor_id] ||= []).push({ code: c.course_code, title: courseMap[c.course_code] ?? c.course_code });
      });
      setCourses(tutorCourseMap);

      const { data: booked } = await (supabase.rpc as any)("get_booked_availability_slots", { _tutor_ids: tutorIds });
      setBookedSlotIds(new Set((booked ?? []).map((b: any) => b.availability_slot_id).filter(Boolean)));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Live sync: refresh when a connection or session changes for me
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`student-tutors-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `student_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "availability" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => load(), booking ? 8000 : 20000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line
  }, [user, booking]);

  const bookableSlots = booking ? (avail[booking.tutorId] ?? []) : [];

  const confirmBook = async () => {
    if (!user || !booking || !pickedSlot) return;
    if (pickedSlot.end_time <= pickedSlot.start_time) {
      return toast.error("This slot has an invalid time range. Ask the tutor to fix it.");
    }
    const start = nextDateForWeekday(pickedSlot.weekday, pickedSlot.start_time);
    const end = nextDateForWeekday(pickedSlot.weekday, pickedSlot.end_time);
    if (start.getTime() < Date.now()) {
      return toast.error("That slot is in the past. Please pick a later time.");
    }
    // Conflict check: overlapping session for this student OR tutor
    const { data: clashes } = await supabase
      .from("sessions")
      .select("id,tutor_id,student_id,start_at,end_at,status,topic")
      .or(`tutor_id.eq.${booking.tutorId},student_id.eq.${user.id}`)
      .lt("start_at", end.toISOString())
      .gt("end_at", start.toISOString());
    const active = (clashes ?? []).filter((c: any) => c.status !== "cancelled");
    if (active.length > 0) {
      const conflict = active.find((c: any) => c.student_id === user.id) ?? active[0];
      return toast.error(formatConflict(conflict, user.id));
    }
    const { error } = await supabase.from("sessions").insert({
      tutor_id: booking.tutorId,
      student_id: user.id,
      topic: topic || "Tutoring session",
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      availability_slot_id: pickedSlot.id,
      status: "scheduled",
    });
    if (error) {
      if (error.code === "23505") return toast.error("That time slot was just booked by someone else. Please choose another slot.");
      return toast.error(error.message);
    }
    await supabase.from("notifications").insert({
      user_id: booking.tutorId,
      kind: "session_booked",
      title: "New booking",
      body: `${profile?.full_name ?? "A student"} booked ${DAYS[pickedSlot.weekday]} ${pickedSlot.start_time.slice(0,5)}`,
      link: "/tutor/sessions",
    });
    toast.success(`Session booked for ${DAYS[pickedSlot.weekday]} ${pickedSlot.start_time.slice(0,5)} — added to your Schedule.`);
    setBooking(null); setTopic(""); setPickedSlot(null); load();
  };

  return (
    <div>
      <PageHeader title="My tutors" description="Your connection requests and accepted tutors. Book directly from an open slot." />
      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No tutors yet. <Link to="/student/find-tutors" className="text-primary hover:underline">Find one</Link>.</p>}
        {rows.map((r) => {
          const slots = avail[r.tutor_id] ?? [];
          const taughtCourses = courses[r.tutor_id] ?? [];
          return (
            <div key={r.id} className="card-elevated p-5">
              <div className="flex items-center gap-3">
                <button onClick={() => setViewProfile(r.tutor_id)} className="shrink-0">
                  <img src={r.tutor?.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${r.tutor?.full_name}`} className="h-12 w-12 rounded-full object-cover ring-2 ring-transparent hover:ring-primary/40" alt="" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setViewProfile(r.tutor_id)} className="truncate font-medium hover:underline">{r.tutor?.full_name}</button>
                    <Badge variant={r.status === "accepted" ? "default" : r.status === "pending" ? "secondary" : "destructive"} className="capitalize text-[10px]">{r.status}</Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{(r.tutor?.tutor_schools ?? [r.tutor?.school]).filter(Boolean).join(" · ") || "School not set"}</span>
                    <span>•</span>
                    <span>{(r.tutor?.tutor_programmes ?? [r.tutor?.programme]).filter(Boolean).slice(0, 2).join(" · ") || "Programme not set"}</span>
                    <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" />{Number(r.tutor?.avg_rating ?? 0).toFixed(1)}</span>
                    <Badge variant="secondary" className="text-[10px]">{r.tutor?.hourly_rate ? `KES ${Number(r.tutor.hourly_rate).toLocaleString()}/hr` : "Free"}</Badge>

                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.tutor?.bio || "USIU tutor"}</p>
                  {r.tutor?.languages?.length ? (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Speaks: {r.tutor.languages.join(", ")}</p>
                  ) : null}
                </div>
              </div>

              {r.status === "accepted" && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Courses taught</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {taughtCourses.length === 0 && <span className="text-xs text-muted-foreground">Not listed</span>}
                      {taughtCourses.map((c) => <Badge key={c.code} variant="secondary" className="text-[10px]">{c.code} · {c.title}</Badge>)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">Availability</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {slots.length === 0 && <span className="text-xs text-muted-foreground">Not set</span>}
                    {slots.map((s) => {
                       const taken = bookedSlotIds.has(s.id);
                       const nextDate = nextDateForWeekday(s.weekday, s.start_time);
                      return (
                        <span
                          key={s.id}
                          className={`rounded-md px-2 py-0.5 text-[10px] ${taken ? "bg-muted text-muted-foreground line-through" : "bg-secondary"}`}
                           title={taken ? "Already booked" : `Next opening: ${nextDate.toLocaleDateString([], { month: "short", day: "numeric" })}`}
                        >
                           {DAYS[s.weekday]} {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)} · {taken ? "Booked" : "Open"}
                        </span>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewProfile(r.tutor_id)}>View profile</Button>
                <Link to="/student/messages"><Button size="sm" variant="outline"><MessageSquare className="mr-1 h-3 w-3" /> Message</Button></Link>
                {r.status === "accepted" && (
                  <Button size="sm" onClick={() => setBooking({ tutorId: r.tutor_id, tutorName: r.tutor?.full_name ?? "Tutor" })}>
                    <Calendar className="mr-1 h-3 w-3" /> Book session
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ProfileDialog userId={viewProfile} open={!!viewProfile} onOpenChange={(o) => !o && setViewProfile(null)} />

      <Dialog open={!!booking} onOpenChange={(o) => { if (!o) { setBooking(null); setPickedSlot(null); setTopic(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book a session with {booking?.tutorName}</DialogTitle>
            <DialogDescription>Choose one of the tutor's open slots; it will appear on your schedule after booking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Topic</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Calculus II revision" /></div>
            <div>
              <Label>Choose a time slot</Label>
              {bookableSlots.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">This tutor hasn't published any availability yet. Message them to arrange a time.</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {bookableSlots.map((s) => {
                  const taken = bookedSlotIds.has(s.id);
                  const selected = pickedSlot?.id === s.id;
                  const nextDate = nextDateForWeekday(s.weekday, s.start_time);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={taken}
                      onClick={() => setPickedSlot(s)}
                      className={`rounded-md border px-3 py-1.5 text-xs transition ${
                        taken ? "cursor-not-allowed border-border bg-muted text-muted-foreground line-through" :
                        selected ? "border-primary bg-primary text-primary-foreground" :
                        "border-border bg-background hover:bg-secondary"
                      }`}
                    >
                      <span className="block font-medium">{DAYS[s.weekday]} {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</span>
                      <span className="block text-[10px] opacity-75">{taken ? "Already booked" : `Next: ${nextDate.toLocaleDateString([], { month: "short", day: "numeric" })}`}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <Button className="w-full" onClick={confirmBook} disabled={!pickedSlot}>Confirm booking</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
