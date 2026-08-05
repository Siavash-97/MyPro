-- Run once after supabase-definition-of-done-setup.sql:
-- Supabase Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run repeatedly.
--
-- This migration also upgrades databases created before the Kanban status
-- column existed. Existing tasks are classified from their progress before
-- the completion guard is installed.
--
-- The UI already exposes only one guarded completion button. This database
-- trigger is the final system-boundary protection: a direct API request or an
-- outdated client cannot set a task to 100%/completed while its task-specific
-- Definition of Done is incomplete.

alter table planner_tasks
  add column if not exists status text;

-- Repair only missing or invalid legacy values. Valid workflow states such
-- as "waiting" must survive when this migration is run again.
update planner_tasks
set status = case
  when progress >= 100 then 'completed'
  when progress > 0 then 'in_progress'
  else 'not_started'
end
where status is null
   or status not in ('not_started', 'in_progress', 'waiting', 'completed');

alter table planner_tasks
  alter column status set default 'not_started',
  alter column status set not null;

alter table planner_tasks
  drop constraint if exists planner_tasks_status_check;

alter table planner_tasks
  add constraint planner_tasks_status_check
  check (status in ('not_started', 'in_progress', 'waiting', 'completed'));

create or replace function planner_require_complete_dod()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  dod_total integer;
  dod_completed integer;
begin
  if
    (new.status = 'completed' or new.progress >= 100)
    and not (old.status = 'completed' and old.progress >= 100)
  then
    select
      count(*)::integer,
      count(*) filter (where coalesce(task_check.done, false))::integer
    into dod_total, dod_completed
    from planner_dod_items as dod_item
    left join planner_task_dod_checks as task_check
      on task_check.task_id = new.id
      and task_check.dod_item_id = dod_item.id
    where dod_item.task_id = new.id;

    if dod_total = 0 or dod_completed <> dod_total then
      raise exception using
        errcode = '23514',
        message = 'Die Aufgabe kann erst nach vollständiger Definition of Done abgeschlossen werden.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists planner_require_complete_dod_trigger on planner_tasks;
create trigger planner_require_complete_dod_trigger
  before update of status, progress on planner_tasks
  for each row execute function planner_require_complete_dod();

notify pgrst, 'reload schema';
