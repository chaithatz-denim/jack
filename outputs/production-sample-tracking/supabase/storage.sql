insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('sample-images', 'sample-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('sample-files', 'sample-files', false, 52428800, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/octet-stream'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sample_images_read_authenticated" on storage.objects;
create policy "sample_images_read_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'sample-images');

drop policy if exists "sample_images_write_roles" on storage.objects;
create policy "sample_images_write_roles"
on storage.objects for all
to authenticated
using (bucket_id = 'sample-images' and public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'))
with check (bucket_id = 'sample-images' and public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'));

drop policy if exists "sample_files_read_authenticated" on storage.objects;
create policy "sample_files_read_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'sample-files');

drop policy if exists "sample_files_write_roles" on storage.objects;
create policy "sample_files_write_roles"
on storage.objects for all
to authenticated
using (bucket_id = 'sample-files' and public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'))
with check (bucket_id = 'sample-files' and public.current_user_role() in ('Admin', 'Pattern', 'Cutting', 'Mer'));
