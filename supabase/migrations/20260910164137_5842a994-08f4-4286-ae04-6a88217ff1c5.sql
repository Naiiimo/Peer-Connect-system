CREATE POLICY "admins view all sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));