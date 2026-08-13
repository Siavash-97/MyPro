// Supabase Edge Function: send-task-notifications
//
// Two ways this gets invoked:
//
// 1. Database Webhook on planner_notification_queue INSERT. Supabase posts
//    a payload like { type: "INSERT", table: ..., record: {...} }. Only
//    reminder rows are sent from here, near-instantly -- assignment rows
//    are deliberately left queued (see 2) so a person assigned several
//    tasks the same day gets one e-mail, not one per task.
//
// 2. A daily schedule (configured in the Supabase Dashboard, see
//    project-planner/README section on notifications) calling this
//    function with body { "mode": "daily" }. That first runs the SQL
//    reminder sweep (planner_enqueue_due_reminders), then processes every
//    row still sitting in the queue: reminders individually (same as the
//    webhook path, and a safety net for any that failed then), assignment
//    rows grouped by person into a single digest e-mail per person.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically
// into every Edge Function by Supabase; only RESEND_API_KEY (and
// optionally RESEND_FROM) need to be set manually via
// `supabase secrets set`.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'MyProSole Planner <onboarding@resend.dev>';
const APP_URL = Deno.env.get('PLANNER_APP_URL') ?? 'https://my-pro-my-pro9.vercel.app';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface QueueRow {
  id: string;
  task_id: string;
  person_id: string;
  kind: 'assignment' | 'reminder';
  reminder_days: number | null;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
  }
  return res.ok;
}

/** ISO 'yyyy-MM-dd' -> 'DD.MM.YYYY', the date format German recipients
 * actually expect. Falls back to the raw string if it doesn't parse. */
function formatGermanDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : isoDate;
}

/** Wraps a message body in a small, consistent layout (logo-free but
 * branded header/footer, a real button instead of a bare link) so every
 * notification looks like it comes from the same place, not an
 * unstyled system e-mail. */
function emailWrapper(bodyHtml: string, ctaLabel: string): string {
  return `
    <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <div style="padding: 20px 0 12px; border-bottom: 2px solid #2563eb;">
        <span style="font-size: 15px; font-weight: 700; color: #2563eb; letter-spacing: 0.02em;">MyProSole Projektplaner</span>
      </div>
      <div style="padding: 24px 0; font-size: 14px; line-height: 1.6;">
        ${bodyHtml}
        <div style="margin-top: 24px;">
          <a href="${APP_URL}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600;">
            ${ctaLabel}
          </a>
        </div>
      </div>
      <div style="padding: 16px 0; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
        Diese Benachrichtigung wurde automatisch von eurem MyProSole-Projektplaner verschickt. Erinnerungszeiten kannst du jederzeit unter "Personen/AP verwalten" anpassen.
      </div>
    </div>`;
}

function reminderEmailFor(reminderDays: number | null, taskTitle: string, endDate: string) {
  const dueDate = formatGermanDate(endDate);
  const isUrgent = reminderDays === 1;
  const dayPhrase = isUrgent ? 'morgen' : `in ${reminderDays} Tagen`;
  const intro = isUrgent
    ? 'kurzer Reminder: Diese Aufgabe ist <strong>morgen fällig</strong>.'
    : `nur zur Vorbereitung: Diese Aufgabe wird ${dayPhrase} fällig.`;

  return {
    subject: isUrgent ? `Morgen fällig: ${taskTitle}` : `In ${reminderDays} Tagen fällig: ${taskTitle}`,
    html: emailWrapper(
      `<p>Hallo,</p>
       <p>${intro}</p>
       <p style="margin: 16px 0; padding: 12px 16px; background: ${isUrgent ? '#fef2f2' : '#eff6ff'}; border-radius: 8px;">
         <strong style="font-size: 15px;">${taskTitle}</strong><br/>
         <span style="color: #6b7280;">Fällig am ${dueDate}</span>
       </p>
       ${isUrgent ? '<p>Falls noch etwas offen ist, jetzt ein guter Moment, es abzuschließen.</p>' : ''}`,
      'Zur Aufgabe im Projektplan',
    ),
  };
}

/** One assignment e-mail per person, listing every task queued for them --
 * not one e-mail per task. This is what keeps a person who gets assigned
 * three tasks in a row from getting three separate e-mails; see
 * processAssignmentDigestForPerson, the only caller. */
function assignmentDigestEmailFor(tasks: { title: string; end_date: string }[]) {
  const subject =
    tasks.length === 1 ? `Neue Aufgabe für dich: ${tasks[0].title}` : `${tasks.length} neue Aufgaben für dich`;
  const intro =
    tasks.length === 1
      ? 'dir wurde im Projektplan eine neue Aufgabe zugewiesen:'
      : `dir wurden im Projektplan ${tasks.length} neue Aufgaben zugewiesen:`;
  const rows = tasks
    .map(
      (t) => `
       <p style="margin: 12px 0; padding: 12px 16px; background: #eff6ff; border-radius: 8px;">
         <strong style="font-size: 15px;">${t.title}</strong><br/>
         <span style="color: #6b7280;">Fällig am ${formatGermanDate(t.end_date)}</span>
       </p>`,
    )
    .join('');

  return {
    subject,
    html: emailWrapper(
      `<p>Hallo,</p>
       <p>${intro}</p>
       ${rows}
       <p>Du kannst dir den Kontext und alle Details direkt im Planer ansehen.</p>`,
      'Zum Projektplan',
    ),
  };
}

async function processReminderRow(row: QueueRow): Promise<void> {
  const [{ data: task }, { data: person }] = await Promise.all([
    supabase.from('planner_tasks').select('title, end_date').eq('id', row.task_id).single(),
    supabase.from('planner_people').select('email').eq('id', row.person_id).single(),
  ]);

  if (!task || !person?.email) {
    await supabase.from('planner_notification_queue').delete().eq('id', row.id);
    return;
  }

  const { subject, html } = reminderEmailFor(row.reminder_days, task.title, task.end_date);
  const ok = await sendEmail(person.email, subject, html);

  if (ok) {
    await supabase.from('planner_notification_log').insert({
      task_id: row.task_id,
      person_id: row.person_id,
      kind: row.kind,
      reminder_days: row.reminder_days,
    });
    await supabase.from('planner_notification_queue').delete().eq('id', row.id);
  }
  // On failure the row is left in the queue and picked up again by the
  // next daily catch-all run (or the next webhook delivery retry).
}

/** Sends everything a single person has queued as assignment notifications
 * as ONE e-mail, then clears all of those rows -- so being assigned several
 * tasks the same day (whether one at a time or via a batch reassignment)
 * still means at most one "you were assigned a task" e-mail, not several. */
async function processAssignmentDigestForPerson(personId: string, rows: QueueRow[]): Promise<void> {
  const rowIds = rows.map((r) => r.id);
  const { data: person } = await supabase.from('planner_people').select('email').eq('id', personId).single();
  if (!person?.email) {
    await supabase.from('planner_notification_queue').delete().in('id', rowIds);
    return;
  }

  const taskIds = [...new Set(rows.map((r) => r.task_id))];
  const { data: taskRows } = await supabase.from('planner_tasks').select('id, title, end_date').in('id', taskIds);
  const tasks = taskRows ?? [];
  if (tasks.length === 0) {
    await supabase.from('planner_notification_queue').delete().in('id', rowIds);
    return;
  }

  const { subject, html } = assignmentDigestEmailFor(tasks);
  const ok = await sendEmail(person.email, subject, html);

  if (ok) {
    await supabase.from('planner_notification_log').insert(
      rows.map((r) => ({ task_id: r.task_id, person_id: personId, kind: 'assignment', reminder_days: null })),
    );
    await supabase.from('planner_notification_queue').delete().in('id', rowIds);
  }
  // On failure every row stays queued and is retried whole in the next
  // daily run, same as processReminderRow's failure path.
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.mode === 'daily') {
      await supabase.rpc('planner_enqueue_due_reminders');
    } else if (body?.type === 'INSERT' && body?.table === 'planner_notification_queue' && body?.record) {
      const record = body.record as QueueRow;
      // Reminders still go out the instant they're queued. Assignment
      // e-mails do not -- they're batched into the once-a-day digest below
      // (processAssignmentDigestForPerson) so a person assigned several
      // tasks in one day gets one e-mail, not one per task. The row simply
      // stays queued here and is picked up by the next daily run.
      if (record.kind === 'reminder') {
        await processReminderRow(record);
      }
      return new Response('ok', { status: 200 });
    }

    // Catch-all / daily run: reminders individually as before; assignments
    // grouped by person into a single digest e-mail each.
    const { data: pending } = await supabase.from('planner_notification_queue').select('*').limit(200);
    const rows = (pending ?? []) as QueueRow[];

    for (const row of rows.filter((r) => r.kind === 'reminder')) {
      await processReminderRow(row);
    }

    const assignmentsByPerson = new Map<string, QueueRow[]>();
    for (const row of rows.filter((r) => r.kind === 'assignment')) {
      const forPerson = assignmentsByPerson.get(row.person_id) ?? [];
      forPerson.push(row);
      assignmentsByPerson.set(row.person_id, forPerson);
    }
    for (const [personId, personRows] of assignmentsByPerson) {
      await processAssignmentDigestForPerson(personId, personRows);
    }

    return new Response(`ok (${rows.length} processed)`, { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
