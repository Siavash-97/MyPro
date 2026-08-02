-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- One row per task holding its start/end at the moment the baseline was
-- last saved, so the UI can show "planned vs. actual" against the
-- originally committed dates. Saving a new baseline replaces the old one
-- entirely (that's a deliberate full overwrite, not a history of baselines).

create table if not exists planner_baseline (
  task_id text primary key references planner_tasks(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  saved_at timestamptz not null default now()
);

alter table planner_baseline enable row level security;

drop policy if exists "authenticated select" on planner_baseline;
drop policy if exists "authenticated insert" on planner_baseline;
drop policy if exists "authenticated update" on planner_baseline;
drop policy if exists "authenticated delete" on planner_baseline;
create policy "authenticated select" on planner_baseline for select using (auth.role() = 'authenticated');
create policy "authenticated insert" on planner_baseline for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on planner_baseline for update using (auth.role() = 'authenticated');
create policy "authenticated delete" on planner_baseline for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table planner_baseline;
