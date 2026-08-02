-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds file attachments per task: a metadata table plus a private Storage
-- bucket to hold the actual file bytes. Only signed-in users can read,
-- upload, or delete -- same access model as the rest of the planner.

create table if not exists planner_attachments (
  id text primary key,
  task_id text not null references planner_tasks(id) on delete cascade,
  name text not null,
  storage_path text not null,
  content_type text,
  size bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

alter table planner_attachments enable row level security;

drop policy if exists "authenticated select" on planner_attachments;
drop policy if exists "authenticated insert" on planner_attachments;
drop policy if exists "authenticated delete" on planner_attachments;
create policy "authenticated select" on planner_attachments for select using (auth.role() = 'authenticated');
create policy "authenticated insert" on planner_attachments for insert with check (auth.role() = 'authenticated');
create policy "authenticated delete" on planner_attachments for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table planner_attachments;

insert into storage.buckets (id, name, public)
values ('planner-attachments', 'planner-attachments', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read attachments" on storage.objects;
drop policy if exists "authenticated upload attachments" on storage.objects;
drop policy if exists "authenticated delete attachments" on storage.objects;

create policy "authenticated read attachments" on storage.objects for select
  using (bucket_id = 'planner-attachments' and auth.role() = 'authenticated');
create policy "authenticated upload attachments" on storage.objects for insert
  with check (bucket_id = 'planner-attachments' and auth.role() = 'authenticated');
create policy "authenticated delete attachments" on storage.objects for delete
  using (bucket_id = 'planner-attachments' and auth.role() = 'authenticated');
