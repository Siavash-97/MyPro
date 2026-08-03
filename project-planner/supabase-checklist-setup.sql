-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Per-task checklist: small sub-steps inside a task/to-do that anyone can
-- tick off (e.g. "call supplier", "upload draft"). Unlike comments and
-- attachments, this is intentionally NOT gated by planner_is_editor() --
-- every signed-in user, including viewer-role accounts, can add, check off,
-- and delete checklist items, since this is meant as each person's own
-- lightweight step tracker rather than a plan-editing action.

create table if not exists planner_checklist_items (
  id text primary key,
  task_id text not null references planner_tasks(id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

alter table planner_checklist_items enable row level security;

drop policy if exists "authenticated select" on planner_checklist_items;
drop policy if exists "authenticated insert" on planner_checklist_items;
drop policy if exists "authenticated update" on planner_checklist_items;
drop policy if exists "authenticated delete" on planner_checklist_items;
create policy "authenticated select" on planner_checklist_items for select using (auth.role() = 'authenticated');
create policy "authenticated insert" on planner_checklist_items for insert with check (auth.role() = 'authenticated');
create policy "authenticated update" on planner_checklist_items for update using (auth.role() = 'authenticated');
create policy "authenticated delete" on planner_checklist_items for delete using (auth.role() = 'authenticated');

alter publication supabase_realtime add table planner_checklist_items;
