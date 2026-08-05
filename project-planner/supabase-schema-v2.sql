-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Replaces the single "project_state" JSON-blob row with one table per
-- entity. Reason: with one shared blob, two people editing at nearly the
-- same time would each push their own full copy of the plan back, and
-- whoever saved last silently overwrote the other person's change (a
-- newly created task could vanish with no trace). Separate rows mean two
-- people creating two different tasks are two independent inserts, so
-- neither can clobber the other. Editing the exact same task at the exact
-- same moment can still have one edit win over the other -- that's normal
-- for concurrent editing and much rarer than the old bug.
--
-- All tables are prefixed "planner_" to avoid clashing with anything else
-- in this Supabase project. Primary keys are plain text, not uuid, because
-- the app's seed data and existing rows use ids like "tk-1" / "wp-hw".

create table if not exists planner_people (
  id text primary key,
  name text not null,
  color text not null
);

create table if not exists planner_work_packages (
  id text primary key,
  name text not null,
  color text not null
);

create table if not exists planner_tasks (
  id text primary key,
  type text not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  assignee_ids text[] not null default '{}',
  constraint planner_tasks_assignee_required
    check (type = 'milestone' or cardinality(assignee_ids) > 0),
  work_package_id text references planner_work_packages(id) on delete set null,
  color text not null,
  progress int not null default 0,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'waiting', 'completed')),
  notes text not null default ''
);

create table if not exists planner_dependencies (
  id text primary key,
  from_id text not null,
  to_id text not null
);

create table if not exists planner_ideas (
  id text primary key,
  title text not null,
  body text not null default '',
  created_at date not null
);

create table if not exists planner_activity (
  id text primary key,
  ts timestamptz not null,
  message text not null,
  actor text
);

alter table planner_people enable row level security;
alter table planner_work_packages enable row level security;
alter table planner_tasks enable row level security;
alter table planner_dependencies enable row level security;
alter table planner_ideas enable row level security;
alter table planner_activity enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['planner_people', 'planner_work_packages', 'planner_tasks', 'planner_dependencies', 'planner_ideas', 'planner_activity']
  loop
    execute format('drop policy if exists "authenticated select" on %I', t);
    execute format('drop policy if exists "authenticated insert" on %I', t);
    execute format('drop policy if exists "authenticated update" on %I', t);
    execute format('drop policy if exists "authenticated delete" on %I', t);
    execute format('create policy "authenticated select" on %I for select using (auth.role() = ''authenticated'')', t);
    execute format('create policy "authenticated insert" on %I for insert with check (auth.role() = ''authenticated'')', t);
    execute format('create policy "authenticated update" on %I for update using (auth.role() = ''authenticated'')', t);
    execute format('create policy "authenticated delete" on %I for delete using (auth.role() = ''authenticated'')', t);
  end loop;
end $$;

alter publication supabase_realtime add table planner_people;
alter publication supabase_realtime add table planner_work_packages;
alter publication supabase_realtime add table planner_tasks;
alter publication supabase_realtime add table planner_dependencies;
alter publication supabase_realtime add table planner_ideas;
alter publication supabase_realtime add table planner_activity;
