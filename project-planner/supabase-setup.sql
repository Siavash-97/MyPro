-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Creates a single-row table that holds the entire project plan as JSON,
-- with public read/write access (no login) so anyone with the deployed
-- link can view and edit it. Do not use this table for sensitive data.

create table if not exists project_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table project_state enable row level security;

create policy "Public read access"
  on project_state for select
  using (true);

create policy "Public write access"
  on project_state for insert
  with check (true);

create policy "Public update access"
  on project_state for update
  using (true);

-- Realtime: make sure this table broadcasts changes to subscribed clients.
alter publication supabase_realtime add table project_state;
