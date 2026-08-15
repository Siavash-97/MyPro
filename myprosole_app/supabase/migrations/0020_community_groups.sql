-- ============================================================
-- 0020: Laufgruppen
-- ============================================================
-- Was hier entsteht
-- -----------------
-- community_groups           die Gruppe samt Ziel und Beitrittsregel
-- community_group_members    wer drin ist und in welcher Rolle
-- community_group_questions  Fragen, die der Admin Beitrittswilligen stellt
-- community_group_requests   Beitrittsanfragen
-- community_group_answers    die Antworten dazu
--
-- Beitritt
-- --------
-- Jede Gruppe hat eine Einladungs-Kennung fuer den Link zum Teilen. Der Admin
-- entscheidet, was damit passiert:
--   join_policy = 'open'     wer den Link hat, ist sofort drin
--   join_policy = 'request'  der Link fuehrt zur Anfrage, der Admin entscheidet
-- Zusaetzlich kann er einen Fragebogen verlangen (requires_questionnaire).
--
-- Warum Hilfsfunktionen fuer die Rechte
-- -------------------------------------
-- Eine Regel auf community_group_members, die selbst community_group_members
-- abfragt, ruft sich endlos auf - Postgres bricht das mit einem Fehler ab.
-- Die beiden Funktionen unten laufen mit den Rechten ihres Erstellers
-- (security definer) und umgehen die Zeilenrechte, deshalb entsteht keine
-- Schleife. Sie geben nur wahr oder falsch zurueck, verraten also nichts.
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'group_join_policy') then
    create type public.group_join_policy as enum ('open', 'request');
  end if;
  if not exists (select 1 from pg_type where typname = 'group_member_role') then
    create type public.group_member_role as enum ('admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'group_request_status') then
    create type public.group_request_status as enum ('pending', 'accepted', 'declined');
  end if;
end $$;


create table if not exists public.community_groups (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  name          text not null,
  description   text,
  -- Das Ziel der Gruppe. Bewusst ein Pflichtfeld: Eine Laufgruppe ohne
  -- erkennbares Ziel zieht die Falschen an.
  goal          text not null,
  join_policy   public.group_join_policy not null default 'request',
  requires_questionnaire boolean not null default false,
  -- Kennung fuer den Einladungslink. Zufaellig, damit sie nicht zu erraten
  -- ist; austauschbar, falls sie einmal zu weit gestreut wurde.
  invite_token  uuid not null default gen_random_uuid() unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint community_groups_name_not_blank check (btrim(name) <> ''),
  constraint community_groups_goal_not_blank check (btrim(goal) <> ''),
  constraint community_groups_name_length check (length(name) <= 80),
  constraint community_groups_goal_length check (length(goal) <= 300)
);

create table if not exists public.community_group_members (
  group_id   uuid not null references public.community_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.group_member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.community_group_questions (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.community_groups (id) on delete cascade,
  question   text not null,
  position   smallint not null,
  created_at timestamptz not null default now(),

  constraint community_group_questions_not_blank check (btrim(question) <> ''),
  constraint community_group_questions_length check (length(question) <= 300),
  constraint community_group_questions_position_uk unique (group_id, position)
);

create table if not exists public.community_group_requests (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.community_groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.group_request_status not null default 'pending',
  message    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint community_group_requests_message_length
    check (message is null or length(message) <= 1000),
  -- Eine offene Anfrage je Person und Gruppe reicht.
  constraint community_group_requests_uk unique (group_id, user_id)
);

create table if not exists public.community_group_answers (
  request_id  uuid not null references public.community_group_requests (id) on delete cascade,
  question_id uuid not null references public.community_group_questions (id) on delete cascade,
  answer      text not null,
  created_at  timestamptz not null default now(),
  primary key (request_id, question_id),

  constraint community_group_answers_not_blank check (btrim(answer) <> ''),
  constraint community_group_answers_length check (length(answer) <= 1000)
);

create index if not exists community_group_members_user_idx
  on public.community_group_members (user_id);
create index if not exists community_group_requests_group_idx
  on public.community_group_requests (group_id, status);

drop trigger if exists set_updated_at on public.community_groups;
create trigger set_updated_at before update on public.community_groups
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.community_group_requests;
create trigger set_updated_at before update on public.community_group_requests
  for each row execute function public.handle_updated_at();


-- Hilfsfunktionen ----------------------------------------------
-- Siehe Erklaerung im Kopf: ohne sie drehen sich die Regeln im Kreis.

create or replace function public.is_group_member(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_group_members
    where group_id = g and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(g uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.community_group_members
    where group_id = g and user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;


-- Zeilenrechte -------------------------------------------------

alter table public.community_groups enable row level security;
alter table public.community_group_members enable row level security;
alter table public.community_group_questions enable row level security;
alter table public.community_group_requests enable row level security;
alter table public.community_group_answers enable row level security;

-- Gruppen: fuer alle Angemeldeten sichtbar. Wer einen Einladungslink bekommt,
-- muss sehen koennen, worum es geht, bevor er beitritt.
drop policy if exists community_groups_select_all on public.community_groups;
create policy community_groups_select_all
  on public.community_groups for select to authenticated using (true);

drop policy if exists community_groups_insert_own on public.community_groups;
create policy community_groups_insert_own
  on public.community_groups for insert to authenticated
  with check (owner_id = auth.uid());

-- Aendern und aufloesen nur durch einen Admin der Gruppe.
drop policy if exists community_groups_update_admin on public.community_groups;
create policy community_groups_update_admin
  on public.community_groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));

drop policy if exists community_groups_delete_admin on public.community_groups;
create policy community_groups_delete_admin
  on public.community_groups for delete to authenticated
  using (public.is_group_admin(id));


-- Mitglieder: sichtbar fuer die Gruppe selbst.
drop policy if exists community_group_members_select on public.community_group_members;
create policy community_group_members_select
  on public.community_group_members for select to authenticated
  using (public.is_group_member(group_id) or user_id = auth.uid());

-- Eintragen darf man sich selbst - aber nur in eine offene Gruppe, oder als
-- Gruender. Der Beitritt nach angenommener Anfrage laeuft ueber den Admin,
-- siehe die Regel darunter.
drop policy if exists community_group_members_insert_self on public.community_group_members;
create policy community_group_members_insert_self
  on public.community_group_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.community_groups g
        where g.id = group_id and (g.join_policy = 'open' or g.owner_id = auth.uid())
      )
    )
  );

-- Der Admin darf Mitglieder aufnehmen (nach angenommener Anfrage).
drop policy if exists community_group_members_insert_admin on public.community_group_members;
create policy community_group_members_insert_admin
  on public.community_group_members for insert to authenticated
  with check (public.is_group_admin(group_id));

-- Austreten darf jeder selbst, entfernen darf der Admin.
drop policy if exists community_group_members_delete on public.community_group_members;
create policy community_group_members_delete
  on public.community_group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists community_group_members_update_admin on public.community_group_members;
create policy community_group_members_update_admin
  on public.community_group_members for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));


-- Fragen: sichtbar fuer alle Angemeldeten - man muss sie lesen koennen, um
-- sie zu beantworten. Pflegen darf nur der Admin.
drop policy if exists community_group_questions_select on public.community_group_questions;
create policy community_group_questions_select
  on public.community_group_questions for select to authenticated using (true);

drop policy if exists community_group_questions_write_admin on public.community_group_questions;
create policy community_group_questions_write_admin
  on public.community_group_questions for all to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));


-- Anfragen: der Antragsteller sieht seine eigene, der Admin alle seiner Gruppe.
drop policy if exists community_group_requests_select on public.community_group_requests;
create policy community_group_requests_select
  on public.community_group_requests for select to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

drop policy if exists community_group_requests_insert_own on public.community_group_requests;
create policy community_group_requests_insert_own
  on public.community_group_requests for insert to authenticated
  with check (user_id = auth.uid());

-- Ueber eine Anfrage entscheidet der Admin. Der Antragsteller darf sie nur
-- zurueckziehen, das laeuft ueber das Loeschen.
drop policy if exists community_group_requests_update_admin on public.community_group_requests;
create policy community_group_requests_update_admin
  on public.community_group_requests for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists community_group_requests_delete on public.community_group_requests;
create policy community_group_requests_delete
  on public.community_group_requests for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));


-- Antworten: dieselben Augen wie die Anfrage, zu der sie gehoeren.
drop policy if exists community_group_answers_select on public.community_group_answers;
create policy community_group_answers_select
  on public.community_group_answers for select to authenticated
  using (
    exists (
      select 1 from public.community_group_requests r
      where r.id = request_id
        and (r.user_id = auth.uid() or public.is_group_admin(r.group_id))
    )
  );

drop policy if exists community_group_answers_insert_own on public.community_group_answers;
create policy community_group_answers_insert_own
  on public.community_group_answers for insert to authenticated
  with check (
    exists (
      select 1 from public.community_group_requests r
      where r.id = request_id and r.user_id = auth.uid()
    )
  );
