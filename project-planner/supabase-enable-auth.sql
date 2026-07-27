-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Tightens access to project_state: only a signed-in session may read/write
-- it, replacing the earlier "anyone with the anon key" policies.

drop policy if exists "Public read access" on project_state;
drop policy if exists "Public write access" on project_state;
drop policy if exists "Public update access" on project_state;

create policy "Authenticated read access"
  on project_state for select
  using (auth.role() = 'authenticated');

create policy "Authenticated insert access"
  on project_state for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated update access"
  on project_state for update
  using (auth.role() = 'authenticated');
