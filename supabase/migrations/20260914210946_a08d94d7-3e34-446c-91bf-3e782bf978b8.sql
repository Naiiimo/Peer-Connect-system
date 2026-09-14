REVOKE EXECUTE ON FUNCTION public.notify(uuid, text, text, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_message() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_connection() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_session() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_review() FROM anon, authenticated, public;