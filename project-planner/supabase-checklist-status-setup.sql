-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Gives checklist items the same four-state Kanban status tasks already
-- have, so a step can be dragged to "In Bearbeitung" or "In Wartestellung"
-- on the To-Do board instead of only toggling done/not done. `done` stays
-- the authoritative "is this checked off" flag; a run of this script never
-- overwrites a status the app already set correctly.
-- Safe to run repeatedly.

alter table planner_checklist_items
  add column if not exists status text;

update planner_checklist_items
set status = case when done then 'completed' else 'not_started' end
where status is null
   or status not in ('not_started', 'in_progress', 'waiting', 'completed')
   or (done and status <> 'completed')
   or (not done and status = 'completed');

alter table planner_checklist_items
  alter column status set default 'not_started',
  alter column status set not null;

alter table planner_checklist_items
  drop constraint if exists planner_checklist_items_status_check;

alter table planner_checklist_items
  add constraint planner_checklist_items_status_check
  check (status in ('not_started', 'in_progress', 'waiting', 'completed'));

notify pgrst, 'reload schema';
