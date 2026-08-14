-- ============================================================
-- Migration 0013: Wochenplan fuer das Lauftraining
-- ============================================================
-- Der manuell eingetragene Wochenplan (laufplan.html) lag bisher nur im
-- Browser-Speicher des jeweiligen Geraets. Damit ging er beim Geraetewechsel
-- verloren und stand der Plan-Zuordnung nach dem Lauf nicht zuverlaessig zur
-- Verfuegung.
--
-- Aufbau in dritter Normalform: ein Plan pro Person, sieben Tageszeilen dazu.
-- Ein einzelner Datensatz mit sieben Spalten waere denormalisiert und muesste
-- fuer jede spaetere Angabe pro Tag (Einheitenart wie "Tempolauf" oder
-- "Langer Lauf", siehe uebungen.html) erneut geaendert werden.
--
-- Aufbewahrung: Der Plan ist der aktuelle Stand, keine Historie. Es gibt
-- deshalb kein Soft-Delete; wird das Konto geloescht, faellt der Plan ueber
-- den Fremdschluessel mit weg. Eine Historie frueherer Wochen ist bewusst
-- nicht vorgesehen - die tatsaechlich gelaufenen Kilometer stehen in runs.
--
-- Datenschutz: Trainingsumfang ist kein Gesundheitsdatum nach DSGVO Art. 9;
-- es gilt dieselbe Owner-only-Regel wie fuer runs. Export und Loeschung
-- laufen ueber dieselben Wege wie die uebrigen Nutzerdaten.
--
-- RLS: Owner-only auf beiden Tabellen.
-- ============================================================

-- ── Tabelle: running_plans ──────────────────────────────────
-- Genau ein Plan pro Person; deshalb ist user_id eindeutig.
create table if not exists public.running_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references public.profiles (id) on delete cascade,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_running_plans_user_id on public.running_plans (user_id);

-- ── Tabelle: running_plan_days ──────────────────────────────
-- weekday: 0 = Montag … 6 = Sonntag. Ruhetage stehen mit 0.0 km drin und
-- werden nicht weggelassen, damit die Woche als Ganzes lesbar bleibt.
create table if not exists public.running_plan_days (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.running_plans (id) on delete cascade,
  weekday     smallint not null check (weekday >= 0 and weekday <= 6),
  distance_km numeric(4,1) not null default 0
              check (distance_km >= 0 and distance_km <= 300),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint running_plan_days_unique unique (plan_id, weekday)
);

create index if not exists idx_running_plan_days_plan_id on public.running_plan_days (plan_id);

-- ── Auto-update Trigger ─────────────────────────────────────
-- handle_updated_at() stammt aus 0008 und wird hier wiederverwendet.
do $$ begin
  create trigger set_running_plans_updated_at
    before update on public.running_plans
    for each row execute function public.handle_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger set_running_plan_days_updated_at
    before update on public.running_plan_days
    for each row execute function public.handle_updated_at();
exception when duplicate_object then null;
end $$;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.running_plans enable row level security;
alter table public.running_plan_days enable row level security;

-- running_plans: Owner-only
do $$ begin
  create policy "running_plans_select_own" on public.running_plans
    for select using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plans_insert_own" on public.running_plans
    for insert with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plans_update_own" on public.running_plans
    for update using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plans_delete_own" on public.running_plans
    for delete using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- running_plan_days: ueber die Zugehoerigkeit zum Plan
do $$ begin
  create policy "running_plan_days_select_own" on public.running_plan_days
    for select using (
      exists (select 1 from public.running_plans p where p.id = plan_id and p.user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plan_days_insert_own" on public.running_plan_days
    for insert with check (
      exists (select 1 from public.running_plans p where p.id = plan_id and p.user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plan_days_update_own" on public.running_plan_days
    for update using (
      exists (select 1 from public.running_plans p where p.id = plan_id and p.user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy "running_plan_days_delete_own" on public.running_plan_days
    for delete using (
      exists (select 1 from public.running_plans p where p.id = plan_id and p.user_id = auth.uid())
    );
exception when duplicate_object then null;
end $$;
