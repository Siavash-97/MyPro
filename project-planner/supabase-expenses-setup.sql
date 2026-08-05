-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds per-task expense/invoice tracking: a line-item table (description,
-- amount, optional invoice number) plus a private Storage bucket for the
-- actual invoice files. Written with editor-only mutation policies directly
-- (like planner_comments), since this table postdates supabase-roles-setup.sql
-- and is not covered by that migration's retroactive policy loop.

create table if not exists planner_expenses (
  id text primary key,
  task_id text not null references planner_tasks(id) on delete cascade,
  description text not null,
  amount numeric not null,
  currency text not null default 'EUR',
  invoice_number text,
  invoice_storage_path text,
  expense_date date not null default current_date,
  created_by text,
  created_at timestamptz not null default now()
);

alter table planner_expenses enable row level security;

drop policy if exists "authenticated select" on planner_expenses;
drop policy if exists "editor insert" on planner_expenses;
drop policy if exists "editor update" on planner_expenses;
drop policy if exists "editor delete" on planner_expenses;
create policy "authenticated select" on planner_expenses for select using (auth.role() = 'authenticated');
create policy "editor insert" on planner_expenses for insert with check (planner_is_editor());
create policy "editor update" on planner_expenses for update using (planner_is_editor());
create policy "editor delete" on planner_expenses for delete using (planner_is_editor());

alter publication supabase_realtime add table planner_expenses;

insert into storage.buckets (id, name, public, file_size_limit)
values ('planner-invoices', 'planner-invoices', false, 20971520)
on conflict (id) do nothing;

drop policy if exists "authenticated read invoices" on storage.objects;
drop policy if exists "editor upload invoices" on storage.objects;
drop policy if exists "editor delete invoices" on storage.objects;

create policy "authenticated read invoices" on storage.objects for select
  using (bucket_id = 'planner-invoices' and auth.role() = 'authenticated');
create policy "editor upload invoices" on storage.objects for insert
  with check (bucket_id = 'planner-invoices' and planner_is_editor());
create policy "editor delete invoices" on storage.objects for delete
  using (bucket_id = 'planner-invoices' and planner_is_editor());
