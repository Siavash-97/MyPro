-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run repeatedly.
--
-- Lets an expense be marked as a recurring subscription (monthly, yearly,
-- or a custom number of months) instead of a one-off cost. The app expands
-- each subscription into virtual occurrences up to today at read time, so
-- no scheduled job is needed here -- this migration only adds the two
-- columns that record the recurrence itself.

alter table planner_expenses
  add column if not exists is_subscription boolean not null default false;

alter table planner_expenses
  add column if not exists recurrence_interval_months integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'planner_expenses_recurrence_interval_months_check'
      and conrelid = 'planner_expenses'::regclass
  ) then
    alter table planner_expenses
      add constraint planner_expenses_recurrence_interval_months_check
      check (recurrence_interval_months is null or recurrence_interval_months >= 1);
  end if;
end $$;

notify pgrst, 'reload schema';
