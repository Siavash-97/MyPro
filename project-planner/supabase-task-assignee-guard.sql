-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Makes at least one assigned person mandatory for tasks. Milestones are
-- deliberately exempt. Safe to run repeatedly.
--
-- NOT VALID preserves legacy tasks that currently have no assignee instead
-- of inventing an incorrect responsible person. PostgreSQL still enforces the
-- rule for every new or updated row, so a legacy task must be assigned the
-- next time it is edited. Once all legacy rows are fixed, the constraint can
-- optionally be validated with:
--   alter table planner_tasks validate constraint planner_tasks_assignee_required;

alter table planner_tasks
  drop constraint if exists planner_tasks_assignee_required;

alter table planner_tasks
  add constraint planner_tasks_assignee_required
  check (
    type = 'milestone'
    or coalesce(cardinality(assignee_ids), 0) > 0
  ) not valid;

notify pgrst, 'reload schema';
