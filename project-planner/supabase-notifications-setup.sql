-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds e-mail task notifications: on assignment (near-instant, via a
-- Database Webhook on planner_notification_queue) and reminders N days
-- before a task's end_date (via a daily call to enqueue_due_reminders()).
-- Each person controls their own e-mail address and timing in the app
-- (Personen & Arbeitspakete panel) -- reminder_days_before is an int array
-- so "1 week before" and "1 day before" are just {7,1}, and anyone can add
-- e.g. {14,7,1} without a schema change.
--
-- This migration only adds columns/tables; it does not send anything by
-- itself. Sending happens in the "send-task-notifications" Edge Function,
-- triggered by a Database Webhook (assignment) and a daily schedule
-- (reminders) -- see project-planner/supabase/functions/send-task-notifications.

alter table planner_people add column if not exists email text;
alter table planner_people add column if not exists notify_on_assignment boolean not null default true;
alter table planner_people add column if not exists reminder_days_before int[] not null default '{7,1}';

-- Outbox: rows here are "please send this e-mail". The Edge Function
-- deletes a row once it has actually sent (or permanently failed) it, so
-- this table is meant to stay small/transient. planner_notification_log
-- below is the permanent, deduplicating record of what was sent.
create table if not exists planner_notification_queue (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references planner_tasks(id) on delete cascade,
  person_id text not null references planner_people(id) on delete cascade,
  kind text not null check (kind in ('assignment', 'reminder')),
  reminder_days int,
  created_at timestamptz not null default now()
);

-- Permanent log, and the dedup key: enqueue_due_reminders() checks this
-- before queuing a reminder so a person never gets the same "7 days
-- before" (or "1 day before") e-mail for the same task twice, even if the
-- daily job runs more than once on the same day.
create table if not exists planner_notification_log (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references planner_tasks(id) on delete cascade,
  person_id text not null references planner_people(id) on delete cascade,
  kind text not null check (kind in ('assignment', 'reminder')),
  reminder_days int,
  sent_at timestamptz not null default now(),
  unique (task_id, person_id, kind, reminder_days)
);

alter table planner_notification_queue enable row level security;
alter table planner_notification_log enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['planner_notification_queue', 'planner_notification_log']
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

-- The Edge Function itself connects with the service-role key, which
-- bypasses RLS entirely -- these policies only govern what the browser
-- app (signed-in users) may read/write directly, e.g. so the app could
-- show "notification sent" state later if desired.

-- On assignment: whenever a task's assignee_ids gains a person who wants
-- to be notified, queue one 'assignment' e-mail for them. Only reacts to
-- *added* ids, so re-saving a task with the same assignees (or removing
-- someone) never re-sends anything.
create or replace function planner_enqueue_assignment_notifications()
returns trigger
language plpgsql
as $$
declare
  added text[];
  pid text;
  wants_notify boolean;
  has_email boolean;
begin
  if tg_op = 'INSERT' then
    added := new.assignee_ids;
  else
    select array_agg(x) into added
    from unnest(new.assignee_ids) x
    where x <> all (coalesce(old.assignee_ids, '{}'));
  end if;

  if added is null or new.type = 'milestone' then
    return new;
  end if;

  foreach pid in array added
  loop
    select notify_on_assignment, (email is not null and email <> '')
      into wants_notify, has_email
    from planner_people where id = pid;

    if coalesce(wants_notify, false) and coalesce(has_email, false) then
      insert into planner_notification_queue (task_id, person_id, kind)
      values (new.id, pid, 'assignment');
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_planner_enqueue_assignment on planner_tasks;
create trigger trg_planner_enqueue_assignment
  after insert or update of assignee_ids on planner_tasks
  for each row
  execute function planner_enqueue_assignment_notifications();

-- Daily reminder sweep. Call this once a day (the Edge Function does this
-- as part of its scheduled "daily" invocation) -- it is safe to call more
-- than once on the same day, planner_notification_log's unique constraint
-- plus the "not exists" check below prevent duplicate reminders.
create or replace function planner_enqueue_due_reminders()
returns void
language plpgsql
as $$
begin
  insert into planner_notification_queue (task_id, person_id, kind, reminder_days)
  select t.id, p.id, 'reminder', d
  from planner_tasks t
  join lateral unnest(t.assignee_ids) as a(person_id) on true
  join planner_people p on p.id = a.person_id
  join lateral unnest(p.reminder_days_before) as r(d) on true
  where t.type = 'task'
    and t.status <> 'completed'
    and t.end_date = current_date + r.d
    and p.email is not null and p.email <> ''
    and not exists (
      select 1 from planner_notification_log l
      where l.task_id = t.id and l.person_id = p.id and l.kind = 'reminder' and l.reminder_days = r.d
    )
    and not exists (
      select 1 from planner_notification_queue q
      where q.task_id = t.id and q.person_id = p.id and q.kind = 'reminder' and q.reminder_days = r.d
    );
end;
$$;

notify pgrst, 'reload schema';
