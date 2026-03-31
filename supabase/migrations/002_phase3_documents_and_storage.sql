-- Phase 3: Add content_text to documents for AI context injection
alter table documents add column if not exists content_text text;

-- Create storage bucket for meeting documents
insert into storage.buckets (id, name, public)
values ('meeting-documents', 'meeting-documents', true)
on conflict (id) do nothing;

-- RLS policies for meeting-documents storage bucket
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_insert_meeting_docs'
  ) then
    execute 'create policy "authenticated_insert_meeting_docs"
      on storage.objects for insert to authenticated
      with check (bucket_id = ''meeting-documents'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_select_meeting_docs'
  ) then
    execute 'create policy "authenticated_select_meeting_docs"
      on storage.objects for select to authenticated
      using (bucket_id = ''meeting-documents'')';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
    and policyname = 'authenticated_delete_meeting_docs'
  ) then
    execute 'create policy "authenticated_delete_meeting_docs"
      on storage.objects for delete to authenticated
      using (bucket_id = ''meeting-documents'')';
  end if;
end $$;
