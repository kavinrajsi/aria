-- Create storage bucket for meeting audio recordings (private)
insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;

-- RLS: authenticated users can upload recordings
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_insert_meeting_recordings'
  ) then
    execute 'create policy "authenticated_insert_meeting_recordings"
      on storage.objects for insert to authenticated
      with check (bucket_id = ''meeting-recordings'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_select_meeting_recordings'
  ) then
    execute 'create policy "authenticated_select_meeting_recordings"
      on storage.objects for select to authenticated
      using (bucket_id = ''meeting-recordings'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_delete_meeting_recordings'
  ) then
    execute 'create policy "authenticated_delete_meeting_recordings"
      on storage.objects for delete to authenticated
      using (bucket_id = ''meeting-recordings'')';
  end if;
end $$;
