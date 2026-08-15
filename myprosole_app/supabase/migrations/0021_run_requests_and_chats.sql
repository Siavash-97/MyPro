-- ============================================================
-- 0021: Mitlaufen anfragen, zusagen, und der Chat dazu
-- ============================================================
-- Der Weg
-- -------
-- 1. Jemand sieht eine Verabredung und fragt an.
-- 2. Der Ersteller sagt zu oder ab.
-- 3. Bei einer Zusage entsteht ein Chat fuer genau diese zwei Personen.
-- 4. Erst dort wird der genaue Treffpunkt sichtbar.
--
-- Schritt 4 ist der Grund fuer die Aufteilung aus 0018. Die Leseregel fuer
-- community_run_meeting_points wird unten entsprechend erweitert - die Stelle
-- war dort markiert.
--
-- Warum der Chat zwei feste Spalten hat
-- -------------------------------------
-- Ein Chat gehoert immer genau zwei Personen: dem Ersteller der Verabredung
-- und einem Gast. Zwei Spalten statt einer Teilnehmertabelle machen die
-- Rechte zu einer einzigen Bedingung - auth.uid() ist entweder die eine oder
-- die andere. Sollte es spaeter Gruppenchats geben, braucht das eine eigene
-- Loesung; sie hier vorwegzunehmen waere Ballast.
--
-- Sprachnachrichten
-- -----------------
-- Liegen im Behaelter "chat-audio", der NICHT oeffentlich ist - anders als
-- die Feed-Bilder. Eine Sprachnachricht zwischen zwei Menschen geht niemanden
-- sonst etwas an. Die App holt zum Abspielen eine zeitlich begrenzte Adresse.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'run_request_status') then
    create type public.run_request_status as enum ('pending', 'accepted', 'declined');
  end if;
  if not exists (select 1 from pg_type where typname = 'chat_message_kind') then
    create type public.chat_message_kind as enum ('text', 'voice', 'location');
  end if;
end $$;


create table if not exists public.community_run_requests (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.community_runs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.run_request_status not null default 'pending',
  message    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint community_run_requests_message_length
    check (message is null or length(message) <= 500),
  constraint community_run_requests_uk unique (run_id, user_id)
);

create table if not exists public.community_chats (
  id         uuid primary key default gen_random_uuid(),
  run_id     uuid not null references public.community_runs (id) on delete cascade,
  -- Der Ersteller der Verabredung.
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  -- Wer angefragt hat und angenommen wurde.
  guest_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint community_chats_two_people check (owner_id <> guest_id),
  constraint community_chats_uk unique (run_id, guest_id)
);

create table if not exists public.community_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid not null references public.community_chats (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       public.chat_message_kind not null default 'text',
  -- Bei 'text' die Nachricht, bei 'location' die Ortsangabe als Text.
  body       text,
  -- Bei 'voice' der Pfad im Behaelter.
  audio_path text,
  created_at timestamptz not null default now(),

  constraint community_chat_messages_content check (
    (kind = 'voice' and audio_path is not null)
    or (kind in ('text', 'location') and btrim(coalesce(body, '')) <> '')
  ),
  constraint community_chat_messages_body_length
    check (body is null or length(body) <= 2000)
);

create index if not exists community_run_requests_run_idx
  on public.community_run_requests (run_id, status);
create index if not exists community_chats_owner_idx on public.community_chats (owner_id);
create index if not exists community_chats_guest_idx on public.community_chats (guest_id);
create index if not exists community_chat_messages_chat_idx
  on public.community_chat_messages (chat_id, created_at);

drop trigger if exists set_updated_at on public.community_run_requests;
create trigger set_updated_at before update on public.community_run_requests
  for each row execute function public.handle_updated_at();


-- Hilfsfunktion: Gehoert der Chat mir?
-- Wie bei den Gruppen mit security definer, damit die Regeln auf den
-- Nachrichten nicht ueber die Chat-Regeln stolpern.
create or replace function public.is_chat_participant(c uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_chats
    where id = c and (owner_id = auth.uid() or guest_id = auth.uid())
  );
$$;

revoke all on function public.is_chat_participant(uuid) from public;
grant execute on function public.is_chat_participant(uuid) to authenticated;


-- Zeilenrechte -------------------------------------------------

alter table public.community_run_requests enable row level security;
alter table public.community_chats enable row level security;
alter table public.community_chat_messages enable row level security;

-- Anfragen: sichtbar fuer den Anfragenden und den Ersteller der Verabredung.
drop policy if exists community_run_requests_select on public.community_run_requests;
create policy community_run_requests_select
  on public.community_run_requests for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.community_runs r where r.id = run_id and r.user_id = auth.uid())
  );

drop policy if exists community_run_requests_insert_own on public.community_run_requests;
create policy community_run_requests_insert_own
  on public.community_run_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Entscheiden darf nur der Ersteller der Verabredung.
drop policy if exists community_run_requests_update_owner on public.community_run_requests;
create policy community_run_requests_update_owner
  on public.community_run_requests for update to authenticated
  using (exists (select 1 from public.community_runs r where r.id = run_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.community_runs r where r.id = run_id and r.user_id = auth.uid()));

-- Zurueckziehen darf der Anfragende, ablehnen und entfernen der Ersteller.
drop policy if exists community_run_requests_delete on public.community_run_requests;
create policy community_run_requests_delete
  on public.community_run_requests for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.community_runs r where r.id = run_id and r.user_id = auth.uid())
  );


-- Chats: nur die beiden Beteiligten.
drop policy if exists community_chats_select on public.community_chats;
create policy community_chats_select
  on public.community_chats for select to authenticated
  using (owner_id = auth.uid() or guest_id = auth.uid());

-- Anlegen darf nur der Ersteller der Verabredung, und nur fuer sich selbst
-- als Eigentuemer. Sonst koennte jemand Chats in fremdem Namen oeffnen.
drop policy if exists community_chats_insert_owner on public.community_chats;
create policy community_chats_insert_owner
  on public.community_chats for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.community_runs r where r.id = run_id and r.user_id = auth.uid())
  );

drop policy if exists community_chats_delete on public.community_chats;
create policy community_chats_delete
  on public.community_chats for delete to authenticated
  using (owner_id = auth.uid() or guest_id = auth.uid());


-- Nachrichten: lesen beide, schreiben jeder fuer sich, loeschen nur die
-- eigenen.
drop policy if exists community_chat_messages_select on public.community_chat_messages;
create policy community_chat_messages_select
  on public.community_chat_messages for select to authenticated
  using (public.is_chat_participant(chat_id));

drop policy if exists community_chat_messages_insert_own on public.community_chat_messages;
create policy community_chat_messages_insert_own
  on public.community_chat_messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_chat_participant(chat_id));

drop policy if exists community_chat_messages_delete_own on public.community_chat_messages;
create policy community_chat_messages_delete_own
  on public.community_chat_messages for delete to authenticated
  using (user_id = auth.uid());


-- Genauer Treffpunkt: jetzt auch fuer den Chatpartner ------------
-- Die in 0018 markierte Erweiterung. Wer eine Zusage hat, hat einen Chat -
-- und damit ein Recht auf den Treffpunkt.

drop policy if exists community_run_meeting_points_select_own
  on public.community_run_meeting_points;
create policy community_run_meeting_points_select_own
  on public.community_run_meeting_points for select
  to authenticated
  using (
    exists (
      select 1 from public.community_runs r
      where r.id = run_id and r.user_id = auth.uid()
    )
    or exists (
      select 1 from public.community_chats c
      where c.run_id = run_id and (c.owner_id = auth.uid() or c.guest_id = auth.uid())
    )
  );


-- Sprachnachrichten ---------------------------------------------
-- Nicht oeffentlich, anders als die Feed-Bilder.

insert into storage.buckets (id, name, public)
values ('chat-audio', 'chat-audio', false)
on conflict (id) do nothing;

-- Der erste Pfadteil ist die Chat-Kennung. Lesen und schreiben darf, wer an
-- diesem Chat beteiligt ist.
drop policy if exists chat_audio_select on storage.objects;
create policy chat_audio_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-audio'
    and public.is_chat_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists chat_audio_insert on storage.objects;
create policy chat_audio_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-audio'
    and public.is_chat_participant(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists chat_audio_delete on storage.objects;
create policy chat_audio_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-audio'
    and public.is_chat_participant(((storage.foldername(name))[1])::uuid)
  );
