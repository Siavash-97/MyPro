-- ============================================================
-- 0045: Meldungen
-- ============================================================
-- Warum
-- -----
-- Sobald Menschen einander etwas schreiben oder zeigen koennen, braucht es
-- einen Weg, Uebergriffe zu melden. Fuer Anbieter mit Nutzerinhalten ist
-- das in der EU nicht Kuer, sondern gefordert (Digital Services Act,
-- Melde- und Abhilfeverfahren).
--
-- Praktisch: Ohne Meldeweg ist der erste ernste Vorfall zugleich der erste
-- Vorfall ohne Handhabe.
--
-- Was hier NICHT steht
-- --------------------
-- Das Blockieren. Es gehoert fachlich dazu und kommt als eigene Migration,
-- sobald es gebaut wird. Eine leere Tabelle auf Vorrat waere eine
-- Abstraktion ohne Anforderung - siehe Entwicklungsstandards.
--
-- Warum eine Meldung unveraenderlich ist
-- -------------------------------------
-- Sie ist ein Nachweis. Es gibt bewusst keine Regel fuer update und keine
-- fuer delete: Ein Nachweis, den die meldende Person nachtraeglich aendern
-- kann, ist keiner - und einer, den die gemeldete Person loeschen koennte,
-- erst recht nicht.
--
-- Wer was sehen darf
-- ------------------
-- Die meldende Person sieht ihre eigenen Meldungen. Sonst niemand ueber die
-- Schnittstelle - auch nicht die gemeldete Person. Die Bearbeitung
-- geschieht mit dem Dienstschluessel, der die Zeilenregeln umgeht.
--
-- Das ist Absicht: "Wer meldet, bleibt der gemeldeten Person gegenueber
-- ungenannt" ist keine Zusage der Oberflaeche, sondern eine der Datenbank.

create table if not exists public.meldungen (
  id uuid primary key default gen_random_uuid(),

  -- Wer meldet. Loescht die Person ihr Konto, geht die Meldung mit: Ein
  -- Hinweis ohne erreichbaren Absender laesst sich nicht mehr pruefen.
  melder_id uuid not null references auth.users (id) on delete cascade,

  -- Was gemeldet wird.
  art text not null check (art in ('beitrag', 'kommentar', 'profil', 'support')),

  -- Worauf sich die Meldung bezieht. Bei 'support' gibt es kein Ziel:
  -- Dann wendet sich jemand an uns, nicht gegen jemanden.
  ziel_id uuid,

  grund text not null check (
    grund in (
      -- Gegen Menschen wie gegen Beitraege
      'beschimpfung',
      'belaestigung',
      'gewalt',
      'spam',
      'gefaelschtes_konto',
      -- Nur gegen Beitraege - Inhalte, die wir verbreiten
      'gewaltdarstellung',
      'terror',
      'nicht_jugendfrei',
      'selbstgefaehrdung',
      'urheberrecht',
      'anderes'
    )
  ),

  -- Freitext ist immer erlaubt und bei 'anderes' der eigentliche Inhalt.
  -- Begrenzt, damit niemand die Tabelle als Ablage benutzt.
  freitext text check (freitext is null or char_length(freitext) <= 1000),

  -- Bearbeitungsstand. Wird nur mit dem Dienstschluessel gesetzt; ueber die
  -- Schnittstelle gibt es keine Regel dafuer.
  stand text not null default 'offen'
    check (stand in ('offen', 'in_arbeit', 'erledigt', 'abgelehnt')),

  created_at timestamptz not null default now(),

  -- Ein Ziel ist Pflicht, ausser man wendet sich an den Support.
  constraint meldung_hat_ziel check (
    (art = 'support' and ziel_id is null) or (art <> 'support' and ziel_id is not null)
  )
);

-- Wer meldet, sieht seine eigenen Meldungen - danach wird sortiert gesucht.
create index if not exists meldungen_melder_idx
  on public.meldungen (melder_id, created_at desc);

-- Die Bearbeitung fragt nach offenen Meldungen, nicht nach allen.
create index if not exists meldungen_stand_idx
  on public.meldungen (stand, created_at)
  where stand = 'offen';

-- Mehrfachmeldungen desselben Ziels sind ein Signal, keine Stoerung: Sie
-- sagen, dass es nicht bei einer Person geblieben ist.
create index if not exists meldungen_ziel_idx
  on public.meldungen (art, ziel_id)
  where ziel_id is not null;

alter table public.meldungen enable row level security;

-- Anlegen: nur fuer sich selbst, und nur angemeldet.
drop policy if exists meldungen_anlegen on public.meldungen;
create policy meldungen_anlegen
  on public.meldungen
  for insert
  to authenticated
  with check ((select auth.uid()) = melder_id);

-- Lesen: nur die eigenen.
drop policy if exists meldungen_eigene_lesen on public.meldungen;
create policy meldungen_eigene_lesen
  on public.meldungen
  for select
  to authenticated
  using ((select auth.uid()) = melder_id);

-- Kein update, kein delete. Absichtlich.

grant insert, select on public.meldungen to authenticated;
