-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Assignment e-mails used to queue themselves automatically and silently
-- the instant a task gained a new assignee who wanted them (see
-- supabase-notifications-setup.sql's trg_planner_enqueue_assignment
-- trigger). Changed on 2026-08-12: after saving a task, the app now asks
-- "<Person> benachrichtigen?" for anyone newly assigned who has an e-mail
-- and wants assignment notifications -- only queued (planner_notification_
-- queue, kind='assignment') if that's confirmed, from TaskEditModal via
-- queueAssignmentNotification() in lib/db.ts. This migration removes the
-- automatic trigger so the two paths can't both queue the same e-mail.
--
-- Reminder e-mails (planner_enqueue_due_reminders, the daily sweep) are
-- untouched -- only the assignment path changed.

drop trigger if exists trg_planner_enqueue_assignment on planner_tasks;
drop function if exists planner_enqueue_assignment_notifications();

notify pgrst, 'reload schema';
