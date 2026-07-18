import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tutor/requests")({ component: Requests });

function Requests() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    if (!user) return;
    const { data: conns } = await supabase
      .from("connections")
      .select("id,status,created_at,student_id")
      .eq("tutor_id", user.id)
      .order("created_at", { ascending: false });
    const list = conns ?? [];
    const ids = Array.from(new Set(list.map((c: any) => c.student_id)));
    let profMap: Record<string, any> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,full_name,photo_url,programme,year_of_study")
        .in("id", ids);
      profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
    }
    setRows(list.map((c: any) => ({ ...c, student: profMap[c.student_id] })));
  };
  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`tutor-requests-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections", filter: `tutor_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const decide = async (id: string, sid: string, status: "accepted"|"rejected") => {
    const { error } = await supabase.from("connections").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("notifications").insert({ user_id: sid, kind: `request_${status}`, title: status === "accepted" ? "Request accepted!" : "Request declined", body: status === "accepted" ? "You can now schedule sessions and message." : "The tutor declined your request.", link: "/student/tutors" });
    toast.success(status === "accepted" ? "Request accepted" : "Request declined");
    load();
  };

  return (
    <div>
      <PageHeader title="Tutoring requests" description="Accept or decline students who requested you." />
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No requests yet.</p>}
        {rows.map((r) => (
          <div key={r.id} className="card-elevated flex items-center gap-4 p-4">
            <img src={r.student?.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${r.student?.full_name}`} className="h-10 w-10 rounded-full object-cover" alt="" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.student?.full_name}</div>
              <div className="text-xs text-muted-foreground">{r.student?.programme} · Year {r.student?.year_of_study}</div>
            </div>
            <Badge variant={r.status === "accepted" ? "default" : r.status === "pending" ? "secondary" : "destructive"} className="capitalize">{r.status}</Badge>
            {r.status === "pending" && (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => decide(r.id, r.student_id, "accepted")}><Check className="mr-1 h-3 w-3" /> Accept</Button>
                <Button size="sm" variant="outline" onClick={() => decide(r.id, r.student_id, "rejected")}><X className="mr-1 h-3 w-3" /> Decline</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
