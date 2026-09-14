ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

ALTER TABLE public.sessions
  DROP CONSTRAINT IF EXISTS sessions_payment_status_check;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_payment_status_check CHECK (payment_status IN ('unpaid','pending','paid','waived'));

CREATE OR REPLACE FUNCTION public.notify(_user uuid, _kind text, _title text, _body text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link)
  SELECT _user, _kind, _title, _body, _link WHERE _user IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.tg_notify_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n text;
BEGIN
  SELECT COALESCE(full_name,'Someone') INTO n FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.notify(NEW.recipient_id,'message', n || ' sent you a message', left(NEW.body, 120), NULL);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_message ON public.messages;
CREATE TRIGGER trg_notify_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.tg_notify_message();

CREATE OR REPLACE FUNCTION public.tg_notify_connection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sn text; tn text;
BEGIN
  SELECT COALESCE(full_name,'A student') INTO sn FROM public.profiles WHERE id = NEW.student_id;
  SELECT COALESCE(full_name,'A tutor') INTO tn FROM public.profiles WHERE id = NEW.tutor_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify(NEW.tutor_id,'connection', sn || ' wants to connect', 'New tutoring request', NULL);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.notify(NEW.student_id,'connection', tn || ' ' || NEW.status::text || ' your request', NULL, NULL);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_connection ON public.connections;
CREATE TRIGGER trg_notify_connection AFTER INSERT OR UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.tg_notify_connection();

CREATE OR REPLACE FUNCTION public.tg_notify_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sn text; tn text;
BEGIN
  SELECT COALESCE(full_name,'A student') INTO sn FROM public.profiles WHERE id = NEW.student_id;
  SELECT COALESCE(full_name,'Your tutor') INTO tn FROM public.profiles WHERE id = NEW.tutor_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify(NEW.tutor_id,'session', sn || ' booked a session', COALESCE(NEW.topic,'Session') || ' · ' || to_char(NEW.start_at AT TIME ZONE 'Africa/Nairobi','DD Mon HH24:MI'), NULL);
  ELSIF (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelled') OR (NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL) THEN
    PERFORM public.notify(NEW.student_id,'session','Session cancelled', COALESCE(NEW.topic,'Session') || ' with ' || tn, NULL);
    PERFORM public.notify(NEW.tutor_id,'session','Session cancelled', COALESCE(NEW.topic,'Session') || ' with ' || sn, NULL);
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'paid' THEN
    PERFORM public.notify(NEW.tutor_id,'payment','Payment marked as received', COALESCE(NEW.topic,'Session') || ' · ' || NEW.currency || ' ' || COALESCE(NEW.amount,0), NULL);
    PERFORM public.notify(NEW.student_id,'payment','Payment recorded', COALESCE(NEW.topic,'Session') || ' · ' || NEW.currency || ' ' || COALESCE(NEW.amount,0), NULL);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_session ON public.sessions;
CREATE TRIGGER trg_notify_session AFTER INSERT OR UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.tg_notify_session();

CREATE OR REPLACE FUNCTION public.tg_notify_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sn text;
BEGIN
  SELECT COALESCE(full_name,'A student') INTO sn FROM public.profiles WHERE id = NEW.student_id;
  PERFORM public.notify(NEW.tutor_id,'review', sn || ' left you a ' || NEW.rating || '-star review', NEW.comment, NULL);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_review ON public.reviews;
CREATE TRIGGER trg_notify_review AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.tg_notify_review();