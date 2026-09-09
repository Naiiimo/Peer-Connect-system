import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

type CourseDetail = { code: string; title: string };

export function ProfileDialog({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [p, setP] = useState<any | null>(null);
  const [courses, setCourses] = useState<CourseDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setP(prof);
      const isTutor = (prof?.tutor_programmes ?? []).length > 0 || prof?.role === "tutor";
      if (isTutor) {
        const { data: tc } = await supabase.from("tutor_courses").select("course_code").eq("tutor_id", userId);
        const codes = (tc ?? []).map((c: any) => c.course_code);
        const { data: details } = codes.length ? await supabase.from("courses").select("code,title").in("code", codes) : { data: [] as any[] };
        const titleMap = Object.fromEntries((details ?? []).map((c: any) => [c.code, c.title]));
        setCourses(codes.map((code: string) => ({ code, title: titleMap[code] ?? code })));
      } else {
        const { data: sc } = await supabase.from("student_courses").select("course_code").eq("student_id", userId);
        const codes = (sc ?? []).map((c: any) => c.course_code);
        const { data: details } = codes.length ? await supabase.from("courses").select("code,title").in("code", codes) : { data: [] as any[] };
        const titleMap = Object.fromEntries((details ?? []).map((c: any) => [c.code, c.title]));
        setCourses(codes.map((code: string) => ({ code, title: titleMap[code] ?? code })));
      }
      setLoading(false);
    })();
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription>Full profile details and courses.</DialogDescription>
        </DialogHeader>
        {loading || !p ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img src={p.photo_url ?? `https://api.dicebear.com/9.x/initials/svg?seed=${p.full_name}`} className="h-20 w-20 rounded-full object-cover" alt="" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-semibold">{p.full_name}</h3>
                  {p.role && <Badge variant="secondary" className="capitalize text-[10px]">{p.role}</Badge>}
                </div>
                {p.email && <p className="truncate text-xs text-muted-foreground">{p.email}</p>}
                {p.role === "tutor" && (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-accent text-accent" /> {Number(p.avg_rating ?? 0).toFixed(1)}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {p.hourly_rate ? `KES ${Number(p.hourly_rate).toLocaleString()} / hour` : "Free tutoring"}
                    </Badge>
                  </div>
                )}

              </div>
            </div>

            {p.bio && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">About</div>
                <p className="mt-1 text-sm">{p.bio}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              {p.school && <Info label="School" value={p.school} />}
              {p.programme && <Info label="Programme" value={p.programme} />}
              {p.year_of_study && <Info label="Year" value={String(p.year_of_study)} />}
              {p.gender && <Info label="Gender" value={p.gender} />}
              {p.learning_style && <Info label="Learning style" value={p.learning_style} />}
              {p.usiu_id && <Info label="USIU ID" value={p.usiu_id} />}
            </div>

            {(p.tutor_schools ?? []).length > 0 && (
              <ListRow label="Tutors in schools" items={p.tutor_schools} />
            )}
            {(p.tutor_programmes ?? []).length > 0 && (
              <ListRow label="Tutors in programmes" items={p.tutor_programmes} />
            )}
            {(p.languages ?? []).length > 0 && (
              <ListRow label="Languages" items={p.languages} />
            )}
            {courses.length > 0 && (
              <CourseList label={p.role === "tutor" ? "Courses taught" : "Courses needed"} items={courses} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function ListRow({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
      </div>
    </div>
  );
}

function CourseList({ label, items }: { label: string; items: CourseDetail[] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((c) => <Badge key={c.code} variant="secondary" className="text-[10px]">{c.code} · {c.title}</Badge>)}
      </div>
    </div>
  );
}
