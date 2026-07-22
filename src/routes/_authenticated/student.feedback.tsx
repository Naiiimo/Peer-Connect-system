import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/student/feedback")({ component: Feedback });

function Feedback() {
  const { user } = useAuth();
  const [tutors, setTutors] = useState<any[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; comment: string }>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: conns } = await supabase.from("connections").select("tutor_id").eq("student_id", user.id).eq("status", "accepted");
      const tutorIds = Array.from(new Set((conns ?? []).map((c: any) => c.tutor_id)));
      const { data: ts } = tutorIds.length
        ? await supabase.from("profiles").select("id,full_name,photo_url,avg_rating").in("id", tutorIds)
        : { data: [] as any[] };
      setTutors(ts ?? []);
      const { data: revs } = await supabase.from("reviews").select("*").eq("student_id", user.id);
      const map: any = {};
      (revs ?? []).forEach((r: any) => { map[r.tutor_id] = { rating: r.rating, comment: r.comment ?? "" }; });
      setRatings(map);
    })();
  }, [user]);

  const set = (tid: string, k: "rating"|"comment", v: any) => setRatings((prev) => ({ ...prev, [tid]: { ...(prev[tid] ?? { rating: 0, comment: "" }), [k]: v } }));

  const submit = async (tid: string) => {
    if (!user) return;
    const r = ratings[tid];
    if (!r?.rating) return toast.error("Pick a rating");
    const { error } = await supabase.from("reviews").upsert({ student_id: user.id, tutor_id: tid, rating: r.rating, comment: r.comment }, { onConflict: "tutor_id,student_id" });
    if (error) return toast.error(error.message);
    toast.success("Review saved");
  };

  return (
    <div>
      <PageHeader title="Feedback" description="Rate your tutors — great tutors get suggested more." />
      <div className="space-y-4">
        {tutors.length === 0 && <p className="text-sm text-muted-foreground">Once tutors accept you, you can review them here.</p>}
        {tutors.map((t) => {
          const r = ratings[t.id] ?? { rating: 0, comment: "" };
          return (
            <div key={t.id} className="card-elevated p-5">
              <div className="mb-3 flex items-center gap-3">
                <img src={t.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${t.full_name}`} className="h-10 w-10 rounded-full object-cover" alt="" />
                <div>
                  <div className="font-medium">{t.full_name}</div>
                  <div className="text-xs text-muted-foreground">Current avg: {Number(t.avg_rating ?? 0).toFixed(1)}</div>
                </div>
              </div>
              <div className="mb-2 flex gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => set(t.id, "rating", n)}>
                    <Star className={`h-5 w-5 ${n <= r.rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
              <Textarea rows={2} value={r.comment} onChange={(e) => set(t.id, "comment", e.target.value)} placeholder="What did you like? What could be better?" />
              <div className="mt-3"><Button size="sm" onClick={() => submit(t.id)}>Save review</Button></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
