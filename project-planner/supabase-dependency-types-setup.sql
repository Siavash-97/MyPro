-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds a relationship type (Finish-to-Start / Start-to-Start / Finish-to-
-- Finish / Start-to-Finish) and lag/lead days to each dependency. Existing
-- rows default to Finish-to-Start with 0 lag, which is exactly the
-- behavior the app had before this column existed.

alter table planner_dependencies add column if not exists type text not null default 'FS';
alter table planner_dependencies add column if not exists lag_days integer not null default 0;
