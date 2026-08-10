// Supabase Edge Function: send-task-notifications
//
// Two ways this gets invoked:
//
// 1. Database Webhook on planner_notification_queue INSERT (near-instant
//    "you've been assigned a task" e-mail). Supabase posts a payload like
//    { type: "INSERT", table: "planner_notification_queue", record: {...} }.
//
// 2. A daily schedule (configured in the Supabase Dashboard, see
//    project-planner/README section on notifications) calling this
//    function with body { "mode": "daily" }. That first runs the SQL
//    reminder sweep (planner_enqueue_due_reminders), then -- as a
//    catch-all -- processes every row still sitting in the queue,
//    including any assignment e-mails a webhook delivery might have
//    missed.
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
const APP_URL = Deno.env.get('PLANNER_APP_URL') ?? 'https://myprosole-planner.vercel.app';

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

function emailContentFor(kind: string, reminderDays: number | null, taskTitle: string, endDate: string) {
  if (kind === 'assignment') {
    return {
      subject: `Neue Aufgabe zugewiesen: ${taskTitle}`,
      html: `<p>Dir wurde im MyProSole-Projektplan eine neue Aufgabe zugewiesen:</p>
             <p><strong>${taskTitle}</strong><br/>Fällig: ${endDate}</p>
             <p><a href="${APP_URL}">Zum Projektplan</a></p>`,
    };
  }
  const dayWord = reminderDays === 1 ? 'morgen' : `in ${reminderDays} Tagen`;
  return {
    subject: `Erinnerung: "${taskTitle}" ist ${dayWord} fällig`,
    html: `<p>Erinnerung: Deine Aufgabe ist ${dayWord} fällig.</p>
           <p><strong>${taskTitle}</strong><br/>Fällig: ${endDate}</p>
           <p><a href="${APP_URL}">Zum Projektplan</a></p>`,
  };
}

async function processQueueRow(row: QueueRow): Promise<void> {
  const [{ data: task }, { data: person }] = await Promise.all([
    supabase.from('planner_tasks').select('title, end_date').eq('id', row.task_id).single(),
    supabase.from('planner_people').select('email').eq('id', row.person_id).single(),
  ]);

  if (!task || !person?.email) {
    await supabase.from('planner_notification_queue').delete().eq('id', row.id);
    return;
  }

  const { subject, html } = emailContentFor(row.kind, row.reminder_days, task.title, task.end_date);
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

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.mode === 'daily') {
      await supabase.rpc('planner_enqueue_due_reminders');
    } else if (body?.type === 'INSERT' && body?.table === 'planner_notification_queue' && body?.record) {
      await processQueueRow(body.record as QueueRow);
      return new Response('ok', { status: 200 });
    }

    // Catch-all: send whatever is still pending (covers the daily run,
    // and heals any assignment e-mail whose webhook delivery failed).
    const { data: pending } = await supabase.from('planner_notification_queue').select('*').limit(200);
    for (const row of pending ?? []) {
      await processQueueRow(row as QueueRow);
    }

    return new Response(`ok (${pending?.length ?? 0} processed)`, { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
});
