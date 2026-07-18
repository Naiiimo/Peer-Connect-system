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
    const { error } = await supabase.from("availability").insert({ tutor_id: user.id, weekday: Number(weekday), start_time: start, end_time: end });
    if (error) return toast.error(error.message);
    load();
  };

  const del = async (id: string) => { await supabase.from("availability").delete().eq("id", id); load(); };

  return (
    <div>
      <PageHeader title="Availability" description="Set the times students can book you." />
      <div className="card-elevated mb-6 grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div><Label>Day</Label>
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Start</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div><Label>End</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" /> Add slot</Button>
      </div>

      <ul className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No slots set.</p>}
        {rows.map((r) => (
          <li key={r.id} className="card-elevated flex items-center justify-between p-3">
            <div className="text-sm"><span className="font-medium">{DAYS[r.weekday]}</span> · {r.start_time.slice(0,5)} – {r.end_time.slice(0,5)}</div>
            <Button size="icon" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
