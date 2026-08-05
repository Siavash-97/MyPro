-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Definition of Done is split into two normalized tables:
--   1. planner_dod_items contains the central, editable template. A new
--      template item therefore appears automatically on every task.
--   2. planner_task_dod_checks stores only the completion state per task.
--      Text is never copied into every task, so global edits stay consistent.

create table if not exists planner_dod_items (
  id text primary key,
  text text not null check (char_length(trim(text)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists planner_task_dod_checks (
  task_id text not null references planner_tasks(id) on delete cascade,
  dod_item_id text not null references planner_dod_items(id) on delete cascade,
  done boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (task_id, dod_item_id)
);

alter table planner_dod_items enable row level security;
alter table planner_task_dod_checks enable row level security;

drop policy if exists "authenticated select" on planner_dod_items;
drop policy if exists "editor insert" on planner_dod_items;
drop policy if exists "editor update" on planner_dod_items;
drop policy if exists "editor delete" on planner_dod_items;
create policy "authenticated select" on planner_dod_items
  for select using (auth.role() = 'authenticated');
create policy "editor insert" on planner_dod_items
  for insert with check (planner_is_editor());
create policy "editor update" on planner_dod_items
  for update using (planner_is_editor());
create policy "editor delete" on planner_dod_items
  for delete using (planner_is_editor());

-- Checking a DoD point is an operational checklist action, like the existing
-- per-task checklist, so every signed-in teammate may change it. Only editors
-- may change the central template itself (policies above).
drop policy if exists "authenticated select" on planner_task_dod_checks;
drop policy if exists "authenticated insert" on planner_task_dod_checks;
drop policy if exists "authenticated update" on planner_task_dod_checks;
drop policy if exists "authenticated delete" on planner_task_dod_checks;
create policy "authenticated select" on planner_task_dod_checks
  for select using (auth.role() = 'authenticated');
create policy "authenticated insert" on planner_task_dod_checks
  for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on planner_task_dod_checks
  for update using (auth.role() = 'authenticated');
create policy "authenticated delete" on planner_task_dod_checks
  for delete using (auth.role() = 'authenticated');

-- Initial template. Stable ids and ON CONFLICT make this migration safe to
-- run again without overwriting later edits made in the app.
insert into planner_dod_items (id, text, sort_order, created_by)
values
  ('dod-acceptance-criteria', 'Anforderungen und Akzeptanzkriterien erfüllt', 10, 'System'),
  ('dod-tested', 'Ergebnis getestet', 20, 'System'),
  ('dod-no-critical-errors', 'Keine offenen kritischen Fehler', 30, 'System'),
  ('dod-documentation', 'Dokumentation aktualisiert', 40, 'System'),
  ('dod-approved', 'Ergebnis geprüft und freigegeben', 50, 'System')
on conflict (id) do nothing;

-- Realtime registration, guarded so rerunning the migration stays idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'planner_dod_items'
  ) then
    alter publication supabase_realtime add table planner_dod_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'planner_task_dod_checks'
  ) then
    alter publication supabase_realtime add table planner_task_dod_checks;
  end if;
end $$;
