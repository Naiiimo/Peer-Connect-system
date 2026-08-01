CREATE POLICY "authenticated users upload own avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "authenticated users read avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "users update own avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "authenticated users upload own library files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users and group members read library files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'library' AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.group_documents gd
      WHERE gd.path = storage.objects.name
        AND public.is_group_member(gd.group_id, auth.uid())
    )
  )
);

CREATE POLICY "users update own library files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "users delete own library files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.validate_availability_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'Availability end time must be after start time';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.tutor_id = NEW.tutor_id
      AND a.weekday = NEW.weekday
      AND a.id <> COALESCE(NEW.id, gen_random_uuid())
      AND a.start_time < NEW.end_time
      AND a.end_time > NEW.start_time
  ) THEN
    RAISE EXCEPTION 'This availability overlaps an existing slot';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_availability_slot_trigger ON public.availability;
CREATE TRIGGER validate_availability_slot_trigger
BEFORE INSERT OR UPDATE ON public.availability
FOR EACH ROW EXECUTE FUNCTION public.validate_availability_slot();

CREATE OR REPLACE FUNCTION public.validate_session_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  slot public.availability%ROWTYPE;
BEGIN
  IF NEW.status = 'cancelled' OR NEW.cancelled_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'Session end time must be after start time';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.start_at <= now() THEN
    RAISE EXCEPTION 'Sessions cannot be scheduled in the past';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id <> COALESCE(NEW.id, gen_random_uuid())
      AND s.status <> 'cancelled'
      AND s.cancelled_at IS NULL
      AND s.start_at < NEW.end_at
      AND s.end_at > NEW.start_at
      AND (s.tutor_id = NEW.tutor_id OR s.student_id = NEW.student_id)
  ) THEN
    RAISE EXCEPTION 'This time conflicts with another active session';
  END IF;
  IF NEW.availability_slot_id IS NOT NULL THEN
    SELECT * INTO slot FROM public.availability WHERE id = NEW.availability_slot_id;
    IF NOT FOUND OR slot.tutor_id <> NEW.tutor_id THEN
      RAISE EXCEPTION 'The selected availability slot is no longer valid';
    END IF;
    IF EXTRACT(DOW FROM NEW.start_at AT TIME ZONE 'Africa/Nairobi')::integer <> slot.weekday
      OR (NEW.start_at AT TIME ZONE 'Africa/Nairobi')::time < slot.start_time
      OR (NEW.end_at AT TIME ZONE 'Africa/Nairobi')::time > slot.end_time THEN
      RAISE EXCEPTION 'The session must fit inside the tutor availability slot';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_session_schedule_trigger ON public.sessions;
CREATE TRIGGER validate_session_schedule_trigger
BEFORE INSERT OR UPDATE OF tutor_id, student_id, start_at, end_at, status, cancelled_at, availability_slot_id
ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.validate_session_schedule();

CREATE INDEX IF NOT EXISTS sessions_tutor_time_idx ON public.sessions (tutor_id, start_at, end_at) WHERE cancelled_at IS NULL;
CREATE INDEX IF NOT EXISTS sessions_student_time_idx ON public.sessions (student_id, start_at, end_at) WHERE cancelled_at IS NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;