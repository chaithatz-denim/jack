create index if not exists audit_logs_action_created_at_idx
on public.audit_logs (action, created_at desc);

create index if not exists audit_logs_login_failed_username_created_idx
on public.audit_logs ((metadata ->> 'username'), created_at desc)
where action = 'LOGIN_FAILED';

create or replace function public.system_usage_metrics()
returns table (
  database_bytes bigint,
  storage_bytes bigint
)
language sql
security definer
set search_path = pg_catalog, public, storage
as $$
  select
    pg_database_size(current_database())::bigint as database_bytes,
    coalesce((
      select sum(coalesce((metadata ->> 'size')::bigint, 0))
      from storage.objects
    ), 0)::bigint as storage_bytes;
$$;

revoke all on function public.system_usage_metrics() from public;
revoke all on function public.system_usage_metrics() from anon;
revoke all on function public.system_usage_metrics() from authenticated;
grant execute on function public.system_usage_metrics() to service_role;
