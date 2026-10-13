-- Resolve Supabase Security Advisor warnings without exposing privileged helpers.
-- The application uses its own server-side session and the service role for data access.

alter function public.touch_updated_at()
set search_path = public, pg_temp;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
revoke all on function public.current_user_role() from authenticated;
grant execute on function public.current_user_role() to service_role;
