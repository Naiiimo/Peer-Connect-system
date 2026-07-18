CREATE OR REPLACE FUNCTION public.get_booked_availability_slots(_tutor_ids uuid[])
RETURNS TABLE (availability_slot_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT s.availability_slot_id
  FROM public.sessions s
  WHERE s.availability_slot_id IS NOT NULL
    AND s.cancelled_at IS NULL
    AND s.status <> 'cancelled'
    AND s.tutor_id = ANY(_tutor_ids)
    AND public.has_role(auth.uid(), 'student')
    AND EXISTS (
      SELECT 1
      FROM public.connections c
      WHERE c.student_id = auth.uid()
        AND c.tutor_id = s.tutor_id
        AND c.status = 'accepted'
    );
$$;

REVOKE ALL ON FUNCTION public.get_booked_availability_slots(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_availability_slots(uuid[]) TO authenticated;

DROP POLICY IF EXISTS "students book accepted tutors" ON public.sessions;

CREATE POLICY "students book accepted tutor availability"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND public.has_role(auth.uid(), 'student')
  AND public.has_role(tutor_id, 'tutor')
  AND availability_slot_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.availability a
    WHERE a.id = sessions.availability_slot_id
      AND a.tutor_id = sessions.tutor_id
  )
  AND EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.student_id = auth.uid()
      AND c.tutor_id = sessions.tutor_id
      AND c.status = 'accepted'
  )
);