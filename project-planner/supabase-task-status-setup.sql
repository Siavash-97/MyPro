-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Adds the persistent workflow state used by the To-Do Kanban board.
-- Safe to run repeatedly. Existing tasks are classified from progress only
-- when the column is created for the first time.

do $$
declare
  status_exists boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planner_tasks'
      and column_name = 'status'
  ) into status_exists;

  if not status_exists then
    alter table planner_tasks
      add column status text not null default 'not_started';

    update planner_tasks
    set status = case
      when progress >= 100 then 'completed'
      when progress > 0 then 'in_progress'
      else 'not_started'
    end;
  end if;
end $$;

alter table planner_tasks
  drop constraint if exists planner_tasks_status_check;

alter table planner_tasks
  add constraint planner_tasks_status_check
  check (status in ('not_started', 'in_progress', 'waiting', 'completed'));

notify pgrst, 'reload schema';
