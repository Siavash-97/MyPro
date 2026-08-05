-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Definition of Done is split into two normalized tables:
--   1. planner_dod_items contains one editable template per work package.
--      A new template item therefore appears automatically on every task
--      in that same work package, but never in a different package.
--   2. planner_task_dod_checks stores only the completion state per task.
--      Text is never copied into every task, so package template edits stay consistent.

create table if not exists planner_dod_items (
  id text primary key,
  work_package_id text references planner_work_packages(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade installations that already used the former project-wide DoD.
alter table planner_dod_items
  add column if not exists work_package_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner_dod_items_work_package_id_fkey'
      and conrelid = 'planner_dod_items'::regclass
  ) then
    alter table planner_dod_items
      add constraint planner_dod_items_work_package_id_fkey
      foreign key (work_package_id) references planner_work_packages(id) on delete cascade;
  end if;
end $$;

create index if not exists planner_dod_items_work_package_id_idx
  on planner_dod_items(work_package_id);

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

-- Initial template per work package. Stable generated ids and ON CONFLICT
-- make this safe to rerun without overwriting later edits made in the app.
-- Rows from the former global list remain in the database for recovery, but
-- have no work_package_id and are no longer displayed by the application.
insert into planner_dod_items (id, work_package_id, text, sort_order, created_by)
select
  'dod-' || md5(work_package.id || ':' || template.item_key),
  work_package.id,
  template.text,
  template.sort_order,
  'System'
from planner_work_packages as work_package
cross join (
  values
    ('acceptance-criteria', 'Anforderungen und Akzeptanzkriterien erfüllt', 10),
    ('tested', 'Ergebnis getestet', 20),
    ('no-critical-errors', 'Keine offenen kritischen Fehler', 30),
    ('documentation', 'Dokumentation aktualisiert', 40),
    ('approved', 'Ergebnis geprüft und freigegeben', 50)
) as template(item_key, text, sort_order)
on conflict (id) do nothing;

-- Preserve completion states from the former five global System items. The
-- matching package-specific check is inserted once and never overwrites a
-- later status change when this migration is rerun.
insert into planner_task_dod_checks (
  task_id,
  dod_item_id,
  done,
  updated_by,
  updated_at
)
select
  task_check.task_id,
  'dod-' || md5(task.work_package_id || ':' || legacy.item_key),
  task_check.done,
  task_check.updated_by,
  task_check.updated_at
from planner_task_dod_checks as task_check
join planner_tasks as task on task.id = task_check.task_id
join (
  values
    ('dod-acceptance-criteria', 'acceptance-criteria'),
    ('dod-tested', 'tested'),
    ('dod-no-critical-errors', 'no-critical-errors'),
    ('dod-documentation', 'documentation'),
    ('dod-approved', 'approved')
) as legacy(old_id, item_key) on legacy.old_id = task_check.dod_item_id
where task.work_package_id is not null
on conflict (task_id, dod_item_id) do nothing;

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

notify pgrst, 'reload schema';
