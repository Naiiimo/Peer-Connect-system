import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CourseSelect } from "./AcademicSelectors";
import { loadCourses, type Course } from "@/lib/curriculum";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

type Role = "tutor" | "student";

export function MyCourses({ role, programmeCode }: { role: Role; programmeCode: string | null }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<string[]>([]);
  const [all, setAll] = useState<Course[]>([]);
  const [picking, setPicking] = useState("");

  const load = async () => {
    if (!user) return;
    const q =
      role === "tutor"
        ? supabase.from("tutor_courses").select("course_code").eq("tutor_id", user.id)
        : supabase.from("student_courses").select("course_code").eq("student_id", user.id);
    const { data } = await q;
    setMine((data ?? []).map((r: any) => r.course_code));
  };
  useEffect(() => { loadCourses().then(setAll); load(); /* eslint-disable-next-line */ }, [user]);

  const add = async () => {
    if (!user || !picking) return;
    if (mine.includes(picking)) return toast.error("You already added this course.");
    const { error } =
      role === "tutor"
        ? await supabase.from("tutor_courses").insert({ tutor_id: user.id, course_code: picking })
        : await supabase.from("student_courses").insert({ student_id: user.id, course_code: picking });
    if (error) {
      if ((error as any).code === "23505") return toast.error("You already added this course.");
      return toast.error(error.message);
    }
    setPicking(""); load();
  };
  const remove = async (code: string) => {
    if (!user) return;
    const { error } =
      role === "tutor"
        ? await supabase.from("tutor_courses").delete().eq("tutor_id", user.id).eq("course_code", code)
        : await supabase.from("student_courses").delete().eq("student_id", user.id).eq("course_code", code);
    if (error) return toast.error(error.message);
    load();
  };

  const codeToCourse = Object.fromEntries(all.map((c) => [c.code, c]));

  return (
    <div className="space-y-3">
      <Label className="text-sm">
        {role === "tutor" ? "Courses you teach" : "Courses you need help with"}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          — pulled from your programme, plus any extras you add.
        </span>
      </Label>

      <div className="flex flex-wrap gap-2">
        {mine.length === 0 && <span className="text-xs text-muted-foreground">No courses added yet.</span>}
        {mine.map((code) => {
          const c = codeToCourse[code];
          return (
            <Badge key={code} variant="secondary" className="gap-1.5 pr-1">
              {code}{c ? ` · ${c.title}` : ""}
              <button aria-label={`Remove ${code}`} onClick={() => remove(code)} className="rounded-sm hover:bg-background/60">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <CourseSelect programmeCode={programmeCode} value={picking} onChange={setPicking} exclude={mine} />
        </div>
        <Button type="button" onClick={add} disabled={!picking} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add course
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Need a course from another programme? Change your programme temporarily, add the course, then switch back — the course stays on your list.
      </p>
    </div>
  );
}
