-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds parent/child task hierarchy (Work Breakdown Structure). A task
-- with children becomes a "summary task" whose displayed dates/progress
-- are computed automatically from its children -- this column just
-- records the relationship.

alter table planner_tasks add column if not exists parent_id text references planner_tasks(id) on delete set null;
