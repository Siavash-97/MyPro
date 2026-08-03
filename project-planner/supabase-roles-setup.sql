-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds viewer vs. editor roles. Everyone signed in can still read
-- everything (Gantt chart, verlauf, attachments); only editors can
-- create/change/delete anything. Enforced at the database level via RLS,
-- not just hidden in the UI, so it's real access control.
--
-- Managing roles: this intentionally has no app UI. Manage it directly in
-- Supabase -> Table Editor -> planner_profiles: add a row with the
-- person's auth user id (Authentication -> Users -> copy the UID) and
-- role = 'viewer' to restrict someone to read-only. A user with no row
-- here defaults to 'editor' -- that's deliberate, so your existing
-- accounts keep full access after running this migration without needing
-- a row created for each of them first.

create table if not exists planner_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor', 'viewer')),
  updated_at timestamptz not null default now()
);

alter table planner_profiles enable row level security;

drop policy if exists "authenticated select" on planner_profiles;
create policy "authenticated select" on planner_profiles for select using (auth.role() = 'authenticated');

create or replace function planner_is_editor() returns boolean
language sql stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'editor' from planner_profiles where id = auth.uid()),
    true
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'planner_people', 'planner_work_packages', 'planner_tasks', 'planner_dependencies',
    'planner_ideas', 'planner_activity', 'planner_attachments', 'planner_baseline'
  ]
  loop
    execute format('drop policy if exists "authenticated insert" on %I', t);
    execute format('drop policy if exists "authenticated update" on %I', t);
    execute format('drop policy if exists "authenticated delete" on %I', t);
    execute format('create policy "editor insert" on %I for insert with check (planner_is_editor())', t);
    execute format('create policy "editor update" on %I for update using (planner_is_editor())', t);
    execute format('create policy "editor delete" on %I for delete using (planner_is_editor())', t);
  end loop;
end $$;

drop policy if exists "authenticated upload attachments" on storage.objects;
drop policy if exists "authenticated delete attachments" on storage.objects;
create policy "editor upload attachments" on storage.objects for insert
  with check (bucket_id = 'planner-attachments' and planner_is_editor());
create policy "editor delete attachments" on storage.objects for delete
  using (bucket_id = 'planner-attachments' and planner_is_editor());
