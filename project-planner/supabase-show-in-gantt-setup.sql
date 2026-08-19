-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Lets each task/milestone opt out of the Gantt chart while staying in the
-- To-Do list -- so the Gantt can stay a high-level overview while task
-- detail (checklist, comments, attachments, ...) lives on the To-Do page.
-- Existing rows default to true (visible), which is exactly the behavior
-- the app had before this column existed -- nothing disappears from the
-- Gantt on upgrade.

alter table planner_tasks add column if not exists show_in_gantt boolean not null default true;
