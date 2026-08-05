-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Adds the persistent workflow state used by the To-Do Kanban board.
-- Safe to run repeatedly. Missing or invalid legacy states are classified
-- from progress; valid states such as "waiting" are preserved.

alter table planner_tasks
  add column if not exists status text;

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

notify pgrst, 'reload schema';
