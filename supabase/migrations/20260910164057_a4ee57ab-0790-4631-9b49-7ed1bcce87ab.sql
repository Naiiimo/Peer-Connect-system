CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  service_fee_percent numeric(5,2) NOT NULL DEFAULT 10 CHECK (service_fee_percent >= 0 AND service_fee_percent <= 100),
  currency text NOT NULL DEFAULT 'KES',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone signed in can read platform settings" ON public.platform_settings;
CREATE POLICY "Anyone signed in can read platform settings"
  ON public.platform_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

GRANT UPDATE ON public.platform_settings TO authenticated;

CREATE TRIGGER trg_platform_settings_updated BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.platform_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;