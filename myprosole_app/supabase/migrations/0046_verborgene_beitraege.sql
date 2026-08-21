-- ============================================================
-- 0046: Verborgene Beitraege
-- ============================================================
-- Warum
-- -----
-- Wer einen Beitrag nicht mehr sehen will, soll ihn wegtun koennen - ohne
-- zu melden und ohne jemanden zu blockieren. Das ist der haeufigste Fall
-- und der leiseste: "gefaellt mir nicht" statt "hier stimmt etwas nicht".
--
-- Warum es in der Datenbank steht und nicht nur im Speicher der App
-- ----------------------------------------------------------------
-- Ein Verbergen, das den naechsten Programmstart nicht ueberlebt, ist
-- keines. Der Beitrag waere beim naechsten Oeffnen wieder da, und der
-- Knopf haette gelogen.
--
-- Verbergen ist eine Vorliebe, kein Schutz
-- ----------------------------------------
-- Wichtige Unterscheidung, weil sie darueber entscheidet, wo gefiltert
-- wird. Bei einem Schutz muessten die Zeilenregeln filtern - sonst
-- umginge man ihn, indem man die Abfrage selbst stellt.
--
-- Hier ist das nicht so: Niemand kommt zu Schaden, wenn ein verborgener
-- Beitrag doch sichtbar wuerde. Es ist die eigene Ansicht, die man sich
-- aufraeumt. Deshalb darf die App filtern, und die Beitragsregeln bleiben
-- unangetastet - was das Risiko dieser Migration auf null senkt.
--
-- Beim Blockieren wird das anders sein. Das ist ein Schutz, und dann
-- entscheidet die Datenbank.

create table if not exists public.verborgene_beitraege (
  -- Wer verbirgt.
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Was verborgen wird. Verschwindet der Beitrag, verschwindet auch der
  -- Eintrag - eine Notiz ueber etwas, das es nicht mehr gibt, waere Muell.
  post_id uuid not null references public.community_posts (id) on delete cascade,

  created_at timestamptz not null default now(),

  -- Zweimal verbergen ist einmal verbergen.
  primary key (user_id, post_id)
);

-- Der Feed fragt beim Laden: was hat diese Person verborgen? Der
-- Primaerschluessel beginnt mit user_id und bedient das bereits.

alter table public.verborgene_beitraege enable row level security;

-- Alles nur fuer sich selbst - anlegen, lesen, rueckgaengig machen.
drop policy if exists verborgene_eigene_anlegen on public.verborgene_beitraege;
create policy verborgene_eigene_anlegen
  on public.verborgene_beitraege
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists verborgene_eigene_lesen on public.verborgene_beitraege;
create policy verborgene_eigene_lesen
  on public.verborgene_beitraege
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Anders als bei einer Meldung ist Zuruecknehmen hier richtig: Verbergen
-- ist eine Ansichtssache und kein Nachweis.
drop policy if exists verborgene_eigene_loeschen on public.verborgene_beitraege;
create policy verborgene_eigene_loeschen
  on public.verborgene_beitraege
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant insert, select, delete on public.verborgene_beitraege to authenticated;
