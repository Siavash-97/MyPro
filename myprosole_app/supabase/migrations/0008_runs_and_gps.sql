-- ============================================================
-- Migration 0008: Lauftracking – runs, GPS-Punkte, Splits
-- ============================================================
-- Erstellt die Tabellen für GPS-basierte Laufaufzeichnung.
-- Fügt den FK von training_diary_entries.run_id → runs.id hinzu.
-- RLS: Owner-only auf allen Tabellen.
-- ============================================================

-- ── Enum: Laufstatus ────────────────────────────────────────
do $$ begin
  create type public.run_status as enum ('tracking', 'paused', 'completed', 'abandoned');
exception when duplicate_object then null;
end $$;

-- ── Tabelle: runs ───────────────────────────────────────────
create table if not exists public.runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  status           public.run_status not null default 'tracking',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  paused_duration_s integer not null default 0,

  distance_km      numeric(7,3),
  duration_s       integer,
  avg_pace_s_per_km integer,
  elevation_gain_m numeric(6,1),

  score            smallint check (score is null or (score >= 0 and score <= 100)),
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint runs_ended_after_started check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_runs_user_id on public.runs (user_id);
create index if not exists idx_runs_user_started on public.runs (user_id, started_at desc);

-- ── Tabelle: run_points (GPS-Daten) ────────────────────────
create table if not exists public.run_points (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.runs (id) on delete cascade,
  recorded_at timestamptz not null default now(),

  latitude    double precision not null,
  longitude   double precision not null,
  altitude_m  double precision,
  accuracy_m  double precision,
  speed_mps   double precision,

  created_at  timestamptz not null default now()
);

create index if not exists idx_run_points_run_id on public.run_points (run_id);
create index if not exists idx_run_points_run_recorded on public.run_points (run_id, recorded_at);

-- ── Tabelle: run_splits (Kilometer-Abschnitte) ─────────────
create table if not exists public.run_splits (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid not null references public.runs (id) on delete cascade,
  split_number    smallint not null,
  distance_km     numeric(5,3) not null,
  duration_s      integer not null,
  pace_s_per_km   integer not null,
  elevation_gain_m numeric(5,1),

  created_at      timestamptz not null default now(),

  constraint run_splits_unique unique (run_id, split_number)
);

create index if not exists idx_run_splits_run_id on public.run_splits (run_id);

-- ── FK: training_diary_entries.run_id → runs.id ─────────────
-- Die Spalte existiert bereits (0006), aber ohne FK-Constraint.
do $$ begin
  alter table public.training_diary_entries
    add constraint fk_diary_run
    foreign key (run_id) references public.runs (id) on delete set null;
exception when duplicate_object then null;
end $$;

-- ── Auto-update Trigger ─────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger set_runs_updated_at
    before update on public.runs
    for each row execute function public.handle_updated_at();
exception when duplicate_object then null;
end $$;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.runs enable row level security;
alter table public.run_points enable row level security;
alter table public.run_splits enable row level security;

-- runs: Owner-only
create policy "runs_select_own" on public.runs
  for select using (auth.uid() = user_id);
create policy "runs_insert_own" on public.runs
  for insert with check (auth.uid() = user_id);
create policy "runs_update_own" on public.runs
  for update using (auth.uid() = user_id);
create policy "runs_delete_own" on public.runs
  for delete using (auth.uid() = user_id);

-- run_points: via run ownership
create policy "run_points_select_own" on public.run_points
  for select using (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );
create policy "run_points_insert_own" on public.run_points
  for insert with check (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );
create policy "run_points_delete_own" on public.run_points
  for delete using (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );

-- run_splits: via run ownership
create policy "run_splits_select_own" on public.run_splits
  for select using (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );
create policy "run_splits_insert_own" on public.run_splits
  for insert with check (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );
create policy "run_splits_delete_own" on public.run_splits
  for delete using (
    exists (select 1 from public.runs r where r.id = run_id and r.user_id = auth.uid())
  );
