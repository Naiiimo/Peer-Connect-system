import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { loadCourses, loadProgrammes, coursesForProgrammeCode, UNIVERSITY, type Course, type Programme } from "@/lib/curriculum";

/** University → School → Programme cascading. Course is a separate component below. */
export function AcademicPath({
  school, programme, onChange, disabled,
}: {
  school: string;
  programme: string;
  onChange: (v: { school: string; programme: string; programmeCode: string | null }) => void;
  disabled?: boolean;
}) {
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  useEffect(() => { loadProgrammes().then(setProgrammes); }, []);
  const schools = useMemo(() => Array.from(new Set(programmes.map((p) => p.school))).sort(), [programmes]);
  const inSchool = useMemo(() => programmes.filter((p) => p.school === school), [programmes, school]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label>University</Label>
        <Input value={UNIVERSITY} disabled readOnly />
      </div>
      <div className="space-y-1.5">
        <Label>School</Label>
        <Select disabled={disabled} value={school} onValueChange={(v) => onChange({ school: v, programme: "", programmeCode: null })}>
          <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
          <SelectContent>{schools.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Programme</Label>
        <Select
          disabled={disabled || !school}
          value={programme}
          onValueChange={(v) => {
            const p = inSchool.find((x) => x.name === v);
            onChange({ school, programme: v, programmeCode: p?.code ?? null });
          }}
        >
          <SelectTrigger><SelectValue placeholder={school ? "Select programme" : "Pick a school first"} /></SelectTrigger>
          <SelectContent>
            {inSchool.map((p) => <SelectItem key={p.name} value={p.name}>{p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Course dropdown filtered by programme code. */
export function CourseSelect({
  programmeCode, value, onChange, exclude = [], placeholder = "Select a course",
}: {
  programmeCode: string | null;
  value: string;
  onChange: (courseCode: string) => void;
  exclude?: string[];
  placeholder?: string;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  useEffect(() => { loadCourses().then(setCourses); }, []);
  const available = coursesForProgrammeCode(courses, programmeCode).filter((c) => !exclude.includes(c.code));

  return (
    <Select value={value} onValueChange={onChange} disabled={!programmeCode}>
      <SelectTrigger><SelectValue placeholder={programmeCode ? placeholder : "Pick a programme first"} /></SelectTrigger>
      <SelectContent>
        {available.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No courses left for this programme.</div>}
        {available.map((c) => (
          <SelectItem key={c.code} value={c.code}>{c.code} — {c.title}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
