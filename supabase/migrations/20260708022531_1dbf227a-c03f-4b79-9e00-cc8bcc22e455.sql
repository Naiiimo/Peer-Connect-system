
-- Allow students to insert sessions when they have an accepted connection with the tutor
DROP POLICY IF EXISTS "student books session" ON public.sessions;
CREATE POLICY "student books session" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.connections c
      WHERE c.student_id = auth.uid()
        AND c.tutor_id = sessions.tutor_id
        AND c.status = 'accepted'
    )
  );

-- Allow students to re-request (rejected -> pending) but only after 24h cooldown
DROP POLICY IF EXISTS "student re-requests after 24h" ON public.connections;
CREATE POLICY "student re-requests after 24h" ON public.connections
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = student_id
    AND status = 'rejected'
    AND updated_at < (now() - interval '24 hours')
  )
  WITH CHECK (
    auth.uid() = student_id
    AND status = 'pending'
  );

-- Enable cron extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule reminder job every 5 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('session-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'session-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--d52b73e1-0b65-4c42-a89c-28edd51b0f86.lovable.app/api/public/hooks/session-reminders',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjcWlieWZ6dmFib3BrbXZpd2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTIzNDMsImV4cCI6MjA5ODQ4ODM0M30.aguODQiSyDMDjD4nHNzzBPBbPl7nOtOQ999EmBfs8Zk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
