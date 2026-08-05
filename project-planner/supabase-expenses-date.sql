-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run repeatedly.
--
-- Adds the business date used by the collapsible year/month expense archive.
-- Existing rows keep their original creation date.

alter table planner_expenses
  add column if not exists expense_date date;

update planner_expenses
set expense_date = (created_at at time zone 'Europe/Berlin')::date
where expense_date is null;

alter table planner_expenses
  alter column expense_date set default current_date;

alter table planner_expenses
  alter column expense_date set not null;

create index if not exists planner_expenses_expense_date_idx
  on planner_expenses(expense_date desc);

notify pgrst, 'reload schema';
