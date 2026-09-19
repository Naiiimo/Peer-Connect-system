ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_approval_status_check') THEN
    ALTER TABLE public.sessions ADD CONSTRAINT sessions_approval_status_check
      CHECK (approval_status IN ('pending','approved','rejected'));
  END IF;
END $$;

UPDATE public.sessions SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending';

DROP POLICY IF EXISTS "admins update sessions" ON public.sessions;
CREATE POLICY "admins update sessions" ON public.sessions FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.tg_notify_session_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    IF NEW.approval_status = 'approved' THEN
      PERFORM public.notify(NEW.student_id, 'session', 'Session approved', COALESCE(NEW.topic,'Your session') || ' was approved by the admin team.', '/student/schedule');
      PERFORM public.notify(NEW.tutor_id, 'session', 'Session approved', COALESCE(NEW.topic,'Your session') || ' was approved by the admin team.', '/tutor/sessions');
    ELSIF NEW.approval_status = 'rejected' THEN
      PERFORM public.notify(NEW.student_id, 'session_cancelled', 'Session not approved', COALESCE(NEW.review_note, 'The admin team did not approve this session.'), '/student/schedule');
      PERFORM public.notify(NEW.tutor_id, 'session_cancelled', 'Session not approved', COALESCE(NEW.review_note, 'The admin team did not approve this session.'), '/tutor/sessions');
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.tg_notify_session_approval() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_notify_session_approval ON public.sessions;
CREATE TRIGGER trg_notify_session_approval
AFTER UPDATE OF approval_status ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_session_approval();