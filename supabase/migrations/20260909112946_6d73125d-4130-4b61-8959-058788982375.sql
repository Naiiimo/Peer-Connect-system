ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'Only administrators can change roles';
  END IF;
  IF _role IN ('admin','super_admin') AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only a super administrator can grant administrator roles';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, _role)
    ON CONFLICT DO NOTHING;
  UPDATE public.profiles SET role = _role WHERE id = _user_id;

  INSERT INTO public.admin_actions (admin_id, target_id, action, reason)
  VALUES (auth.uid(), _user_id, 'role_change', _role::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.app_role) TO authenticated;