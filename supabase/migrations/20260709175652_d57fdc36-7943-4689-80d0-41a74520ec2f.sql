-- Strict role-aware policies for portal data
DROP POLICY IF EXISTS "view own connections" ON public.connections;
DROP POLICY IF EXISTS "student creates connection" ON public.connections;
DROP POLICY IF EXISTS "student re-requests after 24h" ON public.connections;
DROP POLICY IF EXISTS "tutor updates connection" ON public.connections;

CREATE POLICY "students and tutors view own connections"
ON public.connections
FOR SELECT
TO authenticated
USING (
  (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'))
  OR
  (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
);

CREATE POLICY "students create tutor requests"
ON public.connections
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
  AND public.has_role(tutor_id, 'tutor')
);

CREATE POLICY "students re-request after cooldown"
ON public.connections
FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
  AND status = 'rejected'
  AND updated_at < now() - interval '24 hours'
)
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
  AND status = 'pending'
  AND public.has_role(tutor_id, 'tutor')
);

CREATE POLICY "tutors decide own requests"
ON public.connections
FOR UPDATE
TO authenticated
USING (
  auth.uid() = tutor_id
  AND public.has_role(auth.uid(), 'tutor')
)
WITH CHECK (
  auth.uid() = tutor_id
  AND public.has_role(auth.uid(), 'tutor')
  AND public.has_role(student_id, 'student')
);

DROP POLICY IF EXISTS "availability visible" ON public.availability;
DROP POLICY IF EXISTS "tutor manages availability" ON public.availability;

CREATE POLICY "accepted students and owner tutors view availability"
ON public.availability
FOR SELECT
TO authenticated
USING (
  (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
  OR
  (
    public.has_role(auth.uid(), 'student')
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.student_id = auth.uid()
        AND c.tutor_id = availability.tutor_id
        AND c.status = 'accepted'
    )
  )
);

CREATE POLICY "tutors manage own availability"
ON public.availability
FOR ALL
TO authenticated
USING (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));

DROP POLICY IF EXISTS "session parties view" ON public.sessions;
DROP POLICY IF EXISTS "student books session" ON public.sessions;
DROP POLICY IF EXISTS "tutor creates session" ON public.sessions;
DROP POLICY IF EXISTS "parties update session" ON public.sessions;

CREATE POLICY "role-verified session parties view"
ON public.sessions
FOR SELECT
TO authenticated
USING (
  (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'))
  OR
  (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
);

CREATE POLICY "students book accepted tutors"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
  AND public.has_role(tutor_id, 'tutor')
  AND EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.student_id = auth.uid()
      AND c.tutor_id = sessions.tutor_id
      AND c.status = 'accepted'
  )
);

CREATE POLICY "tutors create accepted student sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = tutor_id
  AND public.has_role(auth.uid(), 'tutor')
  AND public.has_role(student_id, 'student')
  AND EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.student_id = sessions.student_id
      AND c.tutor_id = auth.uid()
      AND c.status = 'accepted'
  )
);

CREATE POLICY "role-verified parties update sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'))
  OR
  (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
)
WITH CHECK (
  (auth.uid() = student_id AND public.has_role(auth.uid(), 'student'))
  OR
  (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session_per_availability_slot
ON public.sessions (availability_slot_id)
WHERE availability_slot_id IS NOT NULL AND cancelled_at IS NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.touch_connection_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_connections_updated_at ON public.connections;
CREATE TRIGGER trg_connections_updated_at
BEFORE UPDATE ON public.connections
FOR EACH ROW
EXECUTE FUNCTION public.touch_connection_updated_at();