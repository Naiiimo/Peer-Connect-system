-- ENUMS
CREATE TYPE public.app_role AS ENUM ('student','tutor','admin','super_admin');
CREATE TYPE public.user_status AS ENUM ('active','suspended','banned');
CREATE TYPE public.gender AS ENUM ('male','female','other');
CREATE TYPE public.learning_style AS ENUM ('visual','auditory','reading','kinesthetic');
CREATE TYPE public.connection_status AS ENUM ('pending','accepted','rejected');
CREATE TYPE public.session_status AS ENUM ('scheduled','completed','cancelled');
CREATE TYPE public.report_status AS ENUM ('open','resolved','dismissed');

CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school text NOT NULL,
  name text NOT NULL,
  code text,
  UNIQUE (school, name)
);
GRANT SELECT ON public.programmes TO anon, authenticated;
GRANT ALL ON public.programmes TO service_role;
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programmes readable by all" ON public.programmes FOR SELECT USING (true);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'student',
  full_name text,
  email text,
  usiu_id text,
  photo_url text,
  bio text,
  gender public.gender,
  learning_style public.learning_style,
  school text,
  programme text,
  year_of_study int,
  tutor_schools text[] DEFAULT '{}',
  tutor_programmes text[] DEFAULT '{}',
  specializations text[] DEFAULT '{}',
  avg_rating numeric(3,2) DEFAULT 0,
  status public.user_status NOT NULL DEFAULT 'active',
  suspended_until timestamptz,
  deleted_at timestamptz,
  languages text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "self grant tutor role" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND role = 'tutor');

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student');
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), _role)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.connection_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, tutor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connections TO authenticated;
GRANT ALL ON public.connections TO service_role;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students and tutors view own connections" ON public.connections FOR SELECT TO authenticated
USING ((auth.uid() = student_id AND public.has_role(auth.uid(),'student')) OR (auth.uid() = tutor_id AND public.has_role(auth.uid(),'tutor')));
CREATE POLICY "students create tutor requests" ON public.connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(),'student') AND public.has_role(tutor_id,'tutor'));
CREATE POLICY "students re-request after cooldown" ON public.connections FOR UPDATE TO authenticated
USING (auth.uid() = student_id AND public.has_role(auth.uid(),'student') AND status='rejected' AND updated_at < now() - interval '24 hours')
WITH CHECK (auth.uid() = student_id AND public.has_role(auth.uid(),'student') AND status='pending' AND public.has_role(tutor_id,'tutor'));
CREATE POLICY "tutors decide own requests" ON public.connections FOR UPDATE TO authenticated
USING (auth.uid() = tutor_id AND public.has_role(auth.uid(),'tutor'))
WITH CHECK (auth.uid() = tutor_id AND public.has_role(auth.uid(),'tutor') AND public.has_role(student_id,'student'));

CREATE OR REPLACE FUNCTION public.touch_connection_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_connections_updated_at BEFORE UPDATE ON public.connections
FOR EACH ROW EXECUTE FUNCTION public.touch_connection_updated_at();

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachment_url text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own messages" ON public.messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "mark read" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "delete own messages" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, description text, topic text, school text, programme text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups visible to authenticated" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "creator updates group" ON public.groups FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE TABLE public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members visible" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "join self" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leave self" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE TABLE public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL, attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read group msgs" ON public.group_messages FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members send group msgs" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.is_group_member(group_id, auth.uid()));

CREATE TABLE public.group_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_documents TO authenticated;
GRANT ALL ON public.group_documents TO service_role;
ALTER TABLE public.group_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members see docs" ON public.group_documents FOR SELECT TO authenticated USING (public.is_group_member(group_id, auth.uid()));
CREATE POLICY "members upload docs" ON public.group_documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploader_id AND public.is_group_member(group_id, auth.uid()));

CREATE TABLE public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL, end_time time NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO authenticated;
GRANT ALL ON public.availability TO service_role;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accepted students and owner tutors view availability" ON public.availability FOR SELECT TO authenticated
USING ((auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor')) OR (public.has_role(auth.uid(),'student') AND EXISTS (SELECT 1 FROM public.connections c WHERE c.student_id=auth.uid() AND c.tutor_id=availability.tutor_id AND c.status='accepted')));
CREATE POLICY "tutors manage own availability" ON public.availability FOR ALL TO authenticated
USING (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor'))
WITH CHECK (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor'));

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic text,
  start_at timestamptz NOT NULL, end_at timestamptz NOT NULL,
  zoom_url text,
  status public.session_status NOT NULL DEFAULT 'scheduled',
  cancelled_at timestamptz,
  availability_slot_id uuid REFERENCES public.availability(id) ON DELETE SET NULL,
  reminders_sent text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_start_at_idx ON public.sessions(start_at);
CREATE UNIQUE INDEX one_active_session_per_availability_slot ON public.sessions (availability_slot_id)
WHERE availability_slot_id IS NOT NULL AND cancelled_at IS NULL AND status <> 'cancelled';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT ALL ON public.sessions TO service_role;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role-verified session parties view" ON public.sessions FOR SELECT TO authenticated
USING ((auth.uid()=student_id AND public.has_role(auth.uid(),'student')) OR (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor')));
CREATE POLICY "students book accepted tutor availability" ON public.sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid()=student_id AND public.has_role(auth.uid(),'student') AND public.has_role(tutor_id,'tutor')
  AND availability_slot_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.availability a WHERE a.id=sessions.availability_slot_id AND a.tutor_id=sessions.tutor_id)
  AND EXISTS (SELECT 1 FROM public.connections c WHERE c.student_id=auth.uid() AND c.tutor_id=sessions.tutor_id AND c.status='accepted'));
CREATE POLICY "students create personal schedule events" ON public.sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid()=student_id AND tutor_id=student_id AND availability_slot_id IS NULL AND public.has_role(auth.uid(),'student'));
CREATE POLICY "tutors create accepted student sessions" ON public.sessions FOR INSERT TO authenticated
WITH CHECK (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor') AND public.has_role(student_id,'student')
  AND EXISTS (SELECT 1 FROM public.connections c WHERE c.student_id=sessions.student_id AND c.tutor_id=auth.uid() AND c.status='accepted'));
CREATE POLICY "role-verified parties update sessions" ON public.sessions FOR UPDATE TO authenticated
USING ((auth.uid()=student_id AND public.has_role(auth.uid(),'student')) OR (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor')))
WITH CHECK ((auth.uid()=student_id AND public.has_role(auth.uid(),'student')) OR (auth.uid()=tutor_id AND public.has_role(auth.uid(),'tutor')));

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tutor_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews visible" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "student writes review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "student edits review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = student_id);
CREATE POLICY "student deletes review" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = student_id);

CREATE OR REPLACE FUNCTION public.recalc_tutor_rating() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET avg_rating = COALESCE((SELECT AVG(rating)::numeric(3,2) FROM public.reviews WHERE tutor_id = COALESCE(NEW.tutor_id, OLD.tutor_id)), 0)
  WHERE id = COALESCE(NEW.tutor_id, OLD.tutor_id);
  RETURN NULL;
END; $$;
CREATE TRIGGER trg_reviews_rating AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recalc_tutor_rating();

CREATE TABLE public.library_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, path text NOT NULL,
  tags text[] DEFAULT '{}', source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_documents TO authenticated;
GRANT ALL ON public.library_documents TO service_role;
ALTER TABLE public.library_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own library" ON public.library_documents FOR ALL TO authenticated USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL, title text NOT NULL, body text, link text,
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update own notif" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL, details text,
  status public.report_status NOT NULL DEFAULT 'open',
  resolution text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporter reads own" ON public.reports FOR SELECT TO authenticated USING (auth.uid()=reporter_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "anyone reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid()=reporter_id);
CREATE POLICY "admin resolves" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL, reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_actions TO authenticated;
GRANT ALL ON public.admin_actions TO service_role;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins see actions" ON public.admin_actions FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins insert actions" ON public.admin_actions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND auth.uid()=admin_id);

CREATE TABLE public.courses (
  code text PRIMARY KEY,
  title text NOT NULL,
  school text NOT NULL,
  programme_codes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.courses TO anon, authenticated;
GRANT ALL ON public.courses TO service_role;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses readable by everyone" ON public.courses FOR SELECT USING (true);

CREATE TABLE public.tutor_courses (
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
CREATE POLICY "Tutor courses readable" ON public.tutor_courses FOR SELECT USING (true);
CREATE POLICY "Tutors manage own courses" ON public.tutor_courses FOR ALL USING (auth.uid()=tutor_id) WITH CHECK (auth.uid()=tutor_id);

CREATE TABLE public.student_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_code text NOT NULL REFERENCES public.courses(code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, course_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_courses TO authenticated;
GRANT ALL ON public.student_courses TO service_role;
ALTER TABLE public.student_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own courses" ON public.student_courses FOR ALL USING (auth.uid()=student_id) WITH CHECK (auth.uid()=student_id);

CREATE OR REPLACE FUNCTION public.get_booked_availability_slots(_tutor_ids uuid[])
RETURNS TABLE (availability_slot_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT s.availability_slot_id FROM public.sessions s
  WHERE s.availability_slot_id IS NOT NULL AND s.cancelled_at IS NULL AND s.status <> 'cancelled'
    AND s.tutor_id = ANY(_tutor_ids) AND public.has_role(auth.uid(),'student')
    AND EXISTS (SELECT 1 FROM public.connections c WHERE c.student_id=auth.uid() AND c.tutor_id=s.tutor_id AND c.status='accepted');
$$;
REVOKE ALL ON FUNCTION public.get_booked_availability_slots(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_booked_availability_slots(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_booked_availability_slots(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

ALTER TABLE public.connections REPLICA IDENTITY FULL;
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.availability REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.availability;

INSERT INTO public.programmes (school, name) VALUES
('School of Pharmacy and Health Sciences','Bachelor of Pharmacy'),
('School of Pharmacy and Health Sciences','Bachelor of Science in Nursing'),
('School of Pharmacy and Health Sciences','Bachelor of Science in Public Health'),
('Chandaria School of Business','Bachelor of Science in International Business Administration'),
('Chandaria School of Business','Bachelor of Science in Finance'),
('Chandaria School of Business','Bachelor of Science in Accounting'),
('Chandaria School of Business','Bachelor of Science in Marketing'),
('School of Humanities & Social Sciences','Bachelor of Arts in International Relations'),
('School of Humanities & Social Sciences','Bachelor of Arts in Psychology'),
('School of Humanities & Social Sciences','Bachelor of Arts in Criminal Justice'),
('School of Communication, Cinematic and Creative Arts','Bachelor of Arts in Journalism'),
('School of Communication, Cinematic and Creative Arts','Bachelor of Arts in Film Production'),
('School of Communication, Cinematic and Creative Arts','Bachelor of Arts in Animation'),
('School of Science and Technology','Bachelor of Science in Applied Computer Technology'),
('School of Science and Technology','Bachelor of Science in Information Systems and Technology'),
('School of Science and Technology','Bachelor of Science in Software Engineering');

CREATE POLICY "avatars readable" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "library readable" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'library');
CREATE POLICY "library upload own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "library delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'library' AND (storage.foldername(name))[1] = auth.uid()::text);