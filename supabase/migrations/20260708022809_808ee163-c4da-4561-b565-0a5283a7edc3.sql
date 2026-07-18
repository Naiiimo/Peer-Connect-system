
-- Users may self-grant only the 'tutor' role (never admin)
DROP POLICY IF EXISTS "self grant tutor role" ON public.user_roles;
CREATE POLICY "self grant tutor role" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND role = 'tutor');

-- Backfill user_roles for anyone whose profile.role says tutor/admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
WHERE role IN ('tutor', 'admin')
ON CONFLICT DO NOTHING;

-- Only users with the tutor role can be the target of a connection request
DROP POLICY IF EXISTS "student creates connection" ON public.connections;
CREATE POLICY "student creates connection" ON public.connections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.has_role(tutor_id, 'tutor')
  );

-- Only users with the tutor role can create availability slots
DROP POLICY IF EXISTS "tutor manages availability" ON public.availability;
CREATE POLICY "tutor manages availability" ON public.availability
  FOR ALL TO authenticated
  USING (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'))
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));

-- Only tutors can create sessions on the tutor side
DROP POLICY IF EXISTS "tutor creates session" ON public.sessions;
CREATE POLICY "tutor creates session" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(), 'tutor'));
