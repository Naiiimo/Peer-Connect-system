CREATE POLICY "students create personal schedule events"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND tutor_id = student_id
  AND availability_slot_id IS NULL
  AND public.has_role(auth.uid(), 'student')
);