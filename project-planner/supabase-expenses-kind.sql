-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Distinguishes estimated costs (from the funding application's AZA cost
-- plan) from real/actual costs entered later, so the two can be compared
-- side by side once real invoices start coming in.

alter table planner_expenses add column if not exists kind text not null default 'actual';
alter table planner_expenses drop constraint if exists planner_expenses_kind_check;
alter table planner_expenses add constraint planner_expenses_kind_check check (kind in ('estimate', 'actual'));

-- The AZA cost-plan rows already entered were all estimates -- mark them
-- retroactively so the comparison report is correct from the start.
update planner_expenses set kind = 'estimate' where created_by = 'AZA-Kostenplanung (Anlage 3.14)';
