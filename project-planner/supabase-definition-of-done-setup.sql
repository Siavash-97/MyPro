-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run repeatedly.
-- Afterwards also run supabase-task-completion-guard.sql once so direct API
-- updates cannot bypass the Definition-of-Done completion rule.
--
-- Every Definition-of-Done item belongs to exactly one task. The five
-- standard items are created for every existing task by this migration and
-- automatically for every future task by the trigger below. Adding, editing,
-- deleting or checking an item can therefore never affect another task.

create table if not exists planner_dod_items (
  id text primary key,
  task_id text references planner_tasks(id) on delete cascade,
  text text not null check (char_length(trim(text)) > 0),
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade installations that used the former global or work-package DoD.
-- A former work_package_id column may remain for recovery, but the app no
-- longer reads it. Old shared custom items therefore disappear instead of
-- being copied into unrelated tasks.
alter table planner_dod_items
  add column if not exists task_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner_dod_items_task_id_fkey'
      and conrelid = 'planner_dod_items'::regclass
  ) then
    alter table planner_dod_items
      add constraint planner_dod_items_task_id_fkey
      foreign key (task_id) references planner_tasks(id) on delete cascade;
  end if;
end $$;

create index if not exists planner_dod_items_task_id_idx
  on planner_dod_items(task_id);

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

-- Checking a DoD point is an operational action, so every signed-in teammate
-- may change the state. Only editors may change the item text itself.
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

-- Five independent standard items for every existing task. Stable generated
-- ids and ON CONFLICT make this idempotent.
insert into planner_dod_items (id, task_id, text, sort_order, created_by)
select
  'dod-task-' || md5(task.id || ':' || standard.item_key),
  task.id,
  standard.text,
  standard.sort_order,
  'System'
from planner_tasks as task
cross join (
  values
    ('acceptance-criteria', 'Anforderungen und Akzeptanzkriterien erfüllt', 10),
    ('tested', 'Ergebnis getestet', 20),
    ('no-critical-errors', 'Keine offenen kritischen Fehler', 30),
    ('documentation', 'Dokumentation aktualisiert', 40),
    ('approved', 'Ergebnis geprüft und freigegeben', 50)
) as standard(item_key, text, sort_order)
on conflict (id) do nothing;

-- Preserve completion states from the former global and work-package standard
-- items. Custom shared items are intentionally not copied because the original
-- database cannot reliably tell in which single task they were created.
insert into planner_task_dod_checks (
  task_id,
  dod_item_id,
  done,
  updated_by,
  updated_at
)
select distinct on (task_check.task_id, legacy.item_key)
  task_check.task_id,
  'dod-task-' || md5(task_check.task_id || ':' || legacy.item_key),
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
) as legacy(global_id, item_key)
  on task_check.dod_item_id = legacy.global_id
  or task_check.dod_item_id = 'dod-' || md5(task.work_package_id || ':' || legacy.item_key)
order by task_check.task_id, legacy.item_key, task_check.updated_at desc
on conflict (task_id, dod_item_id) do nothing;

-- New tasks receive their own five standard items automatically.
create or replace function planner_seed_task_dod_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into planner_dod_items (id, task_id, text, sort_order, created_by)
  values
    ('dod-task-' || md5(new.id || ':acceptance-criteria'), new.id, 'Anforderungen und Akzeptanzkriterien erfüllt', 10, 'System'),
    ('dod-task-' || md5(new.id || ':tested'), new.id, 'Ergebnis getestet', 20, 'System'),
    ('dod-task-' || md5(new.id || ':no-critical-errors'), new.id, 'Keine offenen kritischen Fehler', 30, 'System'),
    ('dod-task-' || md5(new.id || ':documentation'), new.id, 'Dokumentation aktualisiert', 40, 'System'),
    ('dod-task-' || md5(new.id || ':approved'), new.id, 'Ergebnis geprüft und freigegeben', 50, 'System')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists planner_seed_task_dod_items_trigger on planner_tasks;
create trigger planner_seed_task_dod_items_trigger
  after insert on planner_tasks
  for each row execute function planner_seed_task_dod_items();

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
