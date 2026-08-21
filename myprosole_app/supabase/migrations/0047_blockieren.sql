-- ============================================================
-- 0047: Blockieren
-- ============================================================
-- Der Unterschied zu 0046
-- -----------------------
-- Verbergen betrifft EINEN Beitrag und ist eine Vorliebe. Blockieren
-- betrifft EINEN MENSCHEN und ist ein Schutz. Deshalb wird hier nicht in
-- der App gefiltert, sondern in den Zeilenregeln: Ein Schutz, den man
-- umgehen kann, indem man die Abfrage selbst stellt, ist keiner.
--
-- Warum es in beide Richtungen wirkt
-- ----------------------------------
-- Blockiert A die Person B, dann sieht A nichts von B - und B nichts von
-- A. Einseitiges Blockieren waere ein Fenster: Wer jemanden loswerden
-- will, will nicht weiter beobachtet werden. Zugleich verraet die
-- Gegenseitigkeit nicht, wer blockiert hat; fuer B sieht es aus, als
-- gaebe es A nicht mehr.
--
-- Was Blockieren NICHT tut
-- ------------------------
-- Es meldet nichts. Wer eine Meldung will, meldet - die beiden sind
-- getrennt, weil sie Verschiedenes bedeuten: "Ich will das nicht sehen"
-- gegen "hier stimmt etwas nicht, seht es euch an".

create table if not exists public.blockierungen (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blockiert_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blockiert_id),

  -- Sich selbst zu blockieren ergibt keinen Sinn und wuerde den eigenen
  -- Feed leeren.
  constraint blockierung_nicht_selbst check (blocker_id <> blockiert_id)
);

-- Der Primaerschluessel bedient die Suche "wen habe ich blockiert".
-- Fuer die Gegenrichtung - "wer hat mich blockiert" - braucht es einen
-- eigenen Index, sonst kostet jede Pruefung einen vollen Durchlauf.
create index if not exists blockierungen_umgekehrt_idx
  on public.blockierungen (blockiert_id, blocker_id);

alter table public.blockierungen enable row level security;

-- Nur die eigenen Blockierungen anlegen, sehen und aufheben.
drop policy if exists blockierungen_eigene_anlegen on public.blockierungen;
create policy blockierungen_eigene_anlegen
  on public.blockierungen
  for insert
  to authenticated
  with check ((select auth.uid()) = blocker_id);

drop policy if exists blockierungen_eigene_lesen on public.blockierungen;
create policy blockierungen_eigene_lesen
  on public.blockierungen
  for select
  to authenticated
  using ((select auth.uid()) = blocker_id);

-- Aufheben ist erlaubt: Menschen versoehnen sich.
drop policy if exists blockierungen_eigene_loeschen on public.blockierungen;
create policy blockierungen_eigene_loeschen
  on public.blockierungen
  for delete
  to authenticated
  using ((select auth.uid()) = blocker_id);

grant insert, select, delete on public.blockierungen to authenticated;

-- ------------------------------------------------------------
-- Die Pruefung
-- ------------------------------------------------------------
-- security definer, weil die Zeilenregeln oben nur die EIGENEN Zeilen
-- freigeben - die Frage "hat mich jemand blockiert" liesse sich sonst
-- nicht beantworten. Genau das ist gewollt: Die Antwort darf die
-- Sichtbarkeit steuern, aber niemand darf die Liste lesen.
--
-- stable, damit Postgres den Aufruf je Person einmal auswertet und nicht
-- je Zeile.
create or replace function public.ist_blockiert(anderer uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blockierungen b
    where (b.blocker_id = (select auth.uid()) and b.blockiert_id = anderer)
       or (b.blocker_id = anderer and b.blockiert_id = (select auth.uid()))
  );
$$;

revoke all on function public.ist_blockiert(uuid) from public;
grant execute on function public.ist_blockiert(uuid) to authenticated;

-- ------------------------------------------------------------
-- Die Beitragsregel bekommt eine Bedingung dazu
-- ------------------------------------------------------------
-- Die bisherige Bedingung bleibt Wort fuer Wort erhalten (0032): oeffentlich
-- oder Mitglied der Gruppe. Neu ist allein der Ausschluss blockierter
-- Personen.
drop policy if exists community_posts_select_all on public.community_posts;
create policy community_posts_select_all
  on public.community_posts for select
  to authenticated
  using (
    (group_id is null or public.is_group_member(group_id))
    and not public.ist_blockiert(user_id)
  );
