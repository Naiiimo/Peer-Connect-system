import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Star, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/student/find-tutors")({ component: FindTutors });

function FindTutors() {
  const { user, profile } = useAuth();
  const [q, setQ] = useState("");
  const [tutors, setTutors] = useState<any[]>([]);
  const [conns, setConns] = useState<Record<string, { id: string; status: string; updated_at: string }>>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("profiles")
      .select("id,full_name,email,photo_url,avg_rating,tutor_programmes,specializations,bio")
      .not("tutor_programmes", "eq", "{}");
    if (profile?.programme) query = query.contains("tutor_programmes", [profile.programme]);
    const { data } = await query.limit(50);
    let list = data ?? [];
    if (q.trim()) {
      const lc = q.toLowerCase();
      list = list.filter((t: any) =>
        (t.full_name ?? "").toLowerCase().includes(lc) ||
        (t.email ?? "").toLowerCase().includes(lc) ||
        (t.specializations ?? []).some((s: string) => s.toLowerCase().includes(lc)) ||
        (t.tutor_programmes ?? []).some((s: string) => s.toLowerCase().includes(lc))
      );
    }
    list.sort((a: any, b: any) => Number(b.avg_rating ?? 0) - Number(a.avg_rating ?? 0));
    setTutors(list);
    setLoading(false);

    if (user) {
      const { data: cs } = await supabase.from("connections").select("id,tutor_id,status,updated_at").eq("student_id", user.id);
      setConns(Object.fromEntries((cs ?? []).map((c: any) => [c.tutor_id, c])));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.programme]);

  const request = async (tutorId: string) => {
    if (!user) return;
    const existing = conns[tutorId];
    if (existing && existing.status === "rejected") {
      const hoursSince = (Date.now() - new Date(existing.updated_at).getTime()) / 36e5;
      if (hoursSince < 24) {
        const hrsLeft = Math.ceil(24 - hoursSince);
        return toast.error(`You can re-request this tutor in ${hrsLeft} hour${hrsLeft === 1 ? "" : "s"}.`);
      }
      const { error } = await supabase.from("connections").update({ status: "pending" }).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else if (!existing) {
      const { error } = await supabase.from("connections").insert({ student_id: user.id, tutor_id: tutorId });
      if (error) return toast.error(error.message);
    } else {
      return;
    }
    await supabase.from("notifications").insert({ user_id: tutorId, kind: "connection_request", title: "New tutoring request", body: `${profile?.full_name ?? "A student"} would like your help.`, link: "/tutor/requests" });
    toast.success("Request sent");
    load();
  };

  return (
    <div>
      <PageHeader title="Find a tutor" description="Search by course, name or email — matched to your programme." />
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a course, tutor name or email…" className="pl-9" />
        </div>
        <Button type="submit" disabled={loading}>{loading ? "…" : "Search"}</Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {tutors.length === 0 && <p className="text-sm text-muted-foreground">No tutors found for your programme yet.</p>}
        {tutors.map((t) => {
          const c = conns[t.id];
          const status = c?.status;
          const hoursSince = c ? (Date.now() - new Date(c.updated_at).getTime()) / 36e5 : Infinity;
          const canReRequest = status === "rejected" && hoursSince >= 24;
          const disabled = status === "pending" || status === "accepted" || (status === "rejected" && !canReRequest);
          const label =
            status === "accepted" ? "Connected" :
            status === "pending" ? "Request sent" :
            status === "rejected" ? (canReRequest ? "Re-request" : `Wait ${Math.ceil(24 - hoursSince)}h`) :
            "Request tutor";
          return (
            <div key={t.id} className="card-elevated flex gap-4 p-5">
              <img src={t.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${t.full_name}`} alt="" className="h-14 w-14 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-medium">{t.full_name ?? "Tutor"}</h3>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-accent text-accent" />{Number(t.avg_rating ?? 0).toFixed(1)}</span>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.bio || (t.specializations ?? []).join(", ") || "USIU tutor"}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(t.specializations ?? []).slice(0,3).map((s: string) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
                <div className="mt-3">
                  <Button size="sm" onClick={() => request(t.id)} disabled={disabled} variant={disabled ? "outline" : "default"}>
                    <Send className="mr-1 h-3 w-3" />{label}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
