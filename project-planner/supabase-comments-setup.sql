-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Per-task comment thread: unlike the single shared "Notizen" text field,
-- each comment is its own row with an author and timestamp, so everyone
-- can see who said what and reply to the discussion over time.

create table if not exists planner_comments (
  id text primary key,
  task_id text not null references planner_tasks(id) on delete cascade,
  author text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table planner_comments enable row level security;

drop policy if exists "authenticated select" on planner_comments;
drop policy if exists "editor insert" on planner_comments;
drop policy if exists "editor delete" on planner_comments;
create policy "authenticated select" on planner_comments for select using (auth.role() = 'authenticated');
create policy "editor insert" on planner_comments for insert with check (planner_is_editor());
create policy "editor delete" on planner_comments for delete using (planner_is_editor());

alter publication supabase_realtime add table planner_comments;
