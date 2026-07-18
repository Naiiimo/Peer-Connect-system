
-- Programmes: add optional code
ALTER TABLE public.programmes ADD COLUMN IF NOT EXISTS code text;
CREATE UNIQUE INDEX IF NOT EXISTS programmes_school_name_key ON public.programmes(school, name);

-- Courses catalogue
CREATE TABLE IF NOT EXISTS public.courses (
  code text PRIMARY KEY,
  title text NOT NULL,
  school text NOT NULL,
  programme_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Courses readable by everyone" ON public.courses;
CREATE POLICY "Courses readable by everyone" ON public.courses FOR SELECT USING (true);

-- Tutor extra courses
CREATE TABLE IF NOT EXISTS public.tutor_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_code text NOT NULL REFERENCES public.courses(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tutor_id, course_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_courses TO authenticated;
GRANT SELECT ON public.tutor_courses TO anon;
GRANT ALL ON public.tutor_courses TO service_role;
ALTER TABLE public.tutor_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tutor courses readable" ON public.tutor_courses;
CREATE POLICY "Tutor courses readable" ON public.tutor_courses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Tutors manage own courses" ON public.tutor_courses;
CREATE POLICY "Tutors manage own courses" ON public.tutor_courses FOR ALL USING (auth.uid() = tutor_id) WITH CHECK (auth.uid() = tutor_id);

-- Student extra courses (courses they need help with)
CREATE TABLE IF NOT EXISTS public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_code text NOT NULL REFERENCES public.courses(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_courses TO authenticated;
GRANT ALL ON public.student_courses TO service_role;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students manage own courses" ON public.student_courses;
CREATE POLICY "Students manage own courses" ON public.student_courses FOR ALL USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- Profile languages
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}';

-- Sessions: cancellation + slot tracking + reminder tracking
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS availability_slot_id uuid REFERENCES public.availability(id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS reminders_sent text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS sessions_start_at_idx ON public.sessions(start_at);

-- Realtime for live sync of connections + sessions + availability
ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.availability REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='connections') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='availability') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;
  END IF;
END $$;
