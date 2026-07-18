import { supabase } from "@/integrations/supabase/client";

export const UNIVERSITY = "United States International University - Africa";

export type Programme = { id?: string; school: string; name: string; code: string | null };
export type Course = { code: string; title: string; school: string; programme_codes: string[] };

let _programmes: Programme[] | null = null;
let _courses: Course[] | null = null;

export async function loadProgrammes(): Promise<Programme[]> {
  if (_programmes) return _programmes;
  const { data } = await supabase.from("programmes").select("id,school,name,code").order("school").order("name");
  _programmes = (data ?? []) as Programme[];
  return _programmes;
}

export async function loadCourses(): Promise<Course[]> {
  if (_courses) return _courses;
  const { data } = await supabase.from("courses").select("code,title,school,programme_codes").order("code");
  _courses = (data ?? []) as Course[];
  return _courses;
}

export function coursesForProgrammeCode(all: Course[], programmeCode: string | null): Course[] {
  if (!programmeCode) return [];
  return all.filter((c) => c.programme_codes?.includes(programmeCode));
}

export function coursesForSchool(all: Course[], school: string | null): Course[] {
  if (!school) return [];
  return all.filter((c) => c.school === school);
}
