import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export const Route = createFileRoute("/_authenticated/tutor/availability")({ component: Availability });

function Availability() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("availability").select("*").eq("tutor_id", user.id).order("weekday").order("start_time");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [user]);

  const add = async () => {
    if (!user) return;
    if (end <= start) return toast.error("End time must be after start time.");
    const overlap = rows.find((row) => Number(row.weekday) === Number(weekday) && row.start_time < end && row.end_time > start);
    if (overlap) return toast.error(`This overlaps your ${DAYS[overlap.weekday]} ${overlap.start_time.slice(0,5)}–${overlap.end_time.slice(0,5)} slot.`);
    const { error } = await supabase.from("availability").insert({ tutor_id: user.id, weekday: Number(weekday), start_time: start, end_time: end });
    if (error) return toast.error(error.message);
    toast.success("Availability added");
    load();
  };

  const del = async (id: string) => { await supabase.from("availability").delete().eq("id", id); load(); };

  return (
    <div>
      <PageHeader title="Availability" description="Set the times students can book you." />
      <div className="card-elevated mb-6 grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div><Label>Day</Label>
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button onClick={add} className="sm:col-span-2 md:col-span-1"><Plus className="mr-1 h-4 w-4" /> Add slot</Button>
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No slots set.</p>}
        {rows.map((r) => (
          <li key={r.id} className="card-elevated flex items-center justify-between gap-3 p-3">
            <div className="min-w-0 text-sm"><span className="font-medium">{DAYS[r.weekday]}</span><span className="block text-xs text-muted-foreground sm:inline sm:before:content-['·'] sm:before:mx-2">{r.start_time.slice(0,5)}–{r.end_time.slice(0,5)}</span></div>
            <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
