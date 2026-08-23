-- ============================================================
-- 0052: ZusammenLauf - Sichtbarkeit wird echt, Wischen und Anfragen
-- ============================================================
-- Grundlage: die Entwurfsrunde vom 23.08.2026 (Q1-Q5, alle vom Nutzer
-- entschieden) und die Bringschuld aus 0049, woertlich: sichtbar_fuer "ist
-- bis dahin eine gespeicherte Absicht und kein Schutz. Wirksam wird sie
-- erst, wenn die Vorschlagsabfrage sie in den Zeilenregeln beruecksichtigt
-- - ein Filter in der App waere Bequemlichkeit, kein Schutz." Genau diese
-- Abfrage kommt hier.
--
-- Drei Dinge entstehen:
--
--   1. zusammenlauf_sichtbar   Der An/Aus-Schalter. Voreinstellung AUS.
--   2. zusammenlauf_weggewischt  "Nicht vorschlagen" - dauerhaft, einseitig.
--   3. community_kontakt_anfragen  Eine Anfrage von Person zu Person,
--      ohne Lauf - mit sichtbarem Absender.
--
-- Dazu die Vorschlagsabfrage als Funktion, damit ALLE Regeln in der
-- Datenbank liegen.
--
-- Warum ein eigener Schalter neben sichtbar_fuer
-- ----------------------------------------------
-- sichtbar_fuer (0049) ist eine Mehrfachauswahl nach Identitaet - "wem darf
-- ich gezeigt werden", leer heisst alle. Das ist kein An/Aus: Wer die Frage
-- nie beantwortet hat, hat damit nicht zugestimmt, Fremden vorgeschlagen zu
-- werden. Der Nutzer hat entschieden (Q4): Sichtbarkeit ist opt-in,
-- Voreinstellung aus. Also ein boolean mit default false, und sichtbar_fuer
-- filtert ZUSAETZLICH, wenn der Schalter an ist.
--
-- Was der Schalter schuetzt - und was nicht
-- -----------------------------------------
-- Er steuert das VORGESCHLAGEN-WERDEN, nicht die Geheimhaltung des Profils.
-- community_profiles ist seit 0023 fuer alle Angemeldeten lesbar
-- (`using (true)`) - das braucht der Community-Feed, der Namen und Bilder
-- zu Beitraegen zeigt. Wer das Profil einer Person kennt, kann es weiter
-- sehen. Neu ist allein: In den Vorschlagsstapel kommt nur, wer den
-- Schalter umgelegt hat. Das steht hier ausdruecklich, damit niemand dem
-- Schalter mehr zutraut, als er haelt.
--
-- Weggewischt ist NICHT blockiert
-- -------------------------------
-- Blockiert (0047) heisst beidseitig unsichtbar, ueberall. Weggewischt
-- heisst nur "nicht vorschlagen". Zwei Tabellen, zwei Bedeutungen - der
-- Nutzer hat das ausdruecklich so entschieden (Q1b), samt Dauerhaftigkeit:
-- kein Verfall, Rueckgaengig nur ueber eine spaetere Einstellung. Deshalb
-- gibt es hier auch ein delete-Recht auf die eigenen Zeilen, obwohl die
-- Oberflaeche es noch nicht benutzt.
--
-- Im VORSCHLAG wird trotzdem in beide Richtungen gefiltert: Wen ich
-- weggewischt habe, sehe ich nicht - und wer MICH weggewischt hat, dem
-- werde ich nicht gezeigt. Sonst laege eine Anfrage von genau der Person
-- nahe, die man gerade aussortiert hat.
--
-- Beim ANLEGEN einer Anfrage wird "weggewischt" dagegen bewusst NICHT
-- geprueft. Das ist kein Versehen, sondern ein Seitenkanal-Argument: Eine
-- Regel "du darfst nicht anfragen, wen du nicht sehen duerftest" wuerde
-- ueber ihren Fehlercode verraten, dass man weggewischt wurde. Der normale
-- Weg (der Stapel) zeigt solche Profile ohnehin nie; wer die Schnittstelle
-- von Hand bedient, erfaehrt durch den Erfolg nichts Persoenliches.
--
-- Die Anfrage traegt den Absender offen
-- -------------------------------------
-- Entscheidung des Nutzers (Q2): Die andere Person sieht, WER anfragt,
-- bevor sie zustimmt - es geht ums Laufen, nicht ums Daten. Deshalb darf
-- der Empfaenger die Zeile lesen, und die App darf zum von_id das Profil
-- zeigen (lesbar ist es ohnehin, siehe oben).
--
-- Warum text + check und kein enum fuer den Stand: dieselbe Abwaegung wie
-- 0051 - die Wertemenge aendern ist eine gewoehnliche Migration, und die
-- Tabelle bleibt klein. Beide Stile existieren im Projekt (0021 enum, 0010
-- und 0051 text); es wird keiner gebrochen.
--
-- Benachrichtigung (Q3): Die Anfrage STEHT IN EINER TABELLE, nicht in einer
-- gerechneten Liste. Das In-App-Abzeichen zaehlt offene Anfragen an mich;
-- eine spaetere Android-Systemmeldung haengt sich an dieselbe Tabelle, ohne
-- dass hier etwas umgebaut werden muss.
--
-- Was die Pruefung geaendert hat (Agenten datenbank und sicherheit, 23.08.)
-- --------------------------------------------------------------------------
-- 1. Die Funktion gibt eine FESTE Spaltenliste zurueck, nicht mehr
--    `setof community_profiles`. zeigt_mir und sichtbar_fuer sind
--    PRAEFERENZEN der Person ("wen will ich sehen") - in einem
--    Kontaktanbahnungs-Muster koennen sie eine Orientierung nahelegen und
--    wurden den Leuten in 0049 als Filter erklaert, nicht als Angabe, die
--    Fremde zu sehen bekommen. Und strukturell: Bei setof floesse jede
--    kuenftige Spalte automatisch mit - 0049 kuendigt ein Transstatus-Feld
--    an, das duerfte hier NIE hineinrutschen.
-- 2. ist_blockiert steht NICHT mehr in der Insert-Regel der Anfragen. Dort
--    war es ein Orakel: Ein Insert-Fehler bei nachweislich sichtbarem Ziel
--    hiess "du wurdest blockiert" - und 0047 verspricht woertlich, dass die
--    Gegenseitigkeit nicht verraet, wer blockiert hat. Stattdessen filtert
--    die LESE-Regel beidseitig: Die Zeile entsteht, aber keine Seite sieht
--    sie - fuer den Blockierten sieht es aus, als gaebe es die Person nicht
--    mehr. Das repariert zugleich die Glocke: Wer blockiert hat, bekommt
--    die Anfrage des Blockierten nicht mehr gezaehlt.
-- 3. Direkt nach jedem create table steht ein revoke all: Die
--    Supabase-Automatik "Automatically expose new tables" (0037, bis
--    30.10.2026 aktiv) vergibt sonst TABELLENWEITE Rechte daneben - und
--    Spaltenrechte sind additiv, ein tabellenweites update haette das
--    spaltenweise Update-Recht komplett ausgehebelt.
-- 4. Das Insert-Recht der Anfragen ist spaltenweise (von_id, an_id):
--    stand, created_at und beantwortet_am kommen aus der Datenbank, nicht
--    vom Absender.
-- 5. Die Insert-Regel prueft auch sichtbar_fuer des Ziels. Das
--    Seitenkanal-Argument traegt dort nicht: sichtbar_fuer ist ueber die
--    using-(true)-Leseregel ohnehin oeffentlich, ein Fehlschlag verraet
--    nichts Geheimes - anders als beim Weggewischt-Fall.
-- 6. Ein Check bindet beantwortet_am an den Stand: offen <-> null. Der
--    ZEITPUNKT bleibt ein Selbsteintrag des Empfaengers - er ist ein
--    Anzeigewert, kein Beweis, und das steht jetzt hier.
--
-- Bewusst hingenommene Restrisiken, benannt statt verschwiegen:
-- - Wer die Schnittstelle von Hand bedient, kann ueber viele Aufrufe und
--   die oeffentlich lesbare Tabelle STATISTISCH ableiten, dass er
--   weggewischt wurde (taucht nie auf, obwohl alle lesbaren Filter passen).
--   Der Fehlercode-Kanal ist zu; der Statistik-Kanal ist mit vertretbarem
--   Aufwand nicht schliessbar, solange community_profiles fuer alle lesbar
--   ist - siehe naechster Punkt.
-- - community_profiles ist seit 0023 fuer JEDEN Angemeldeten vollstaendig
--   lesbar (using (true)), einschliesslich identitaet, zeigt_mir und
--   sichtbar_fuer, auch bei Leuten mit ausgeschaltetem Schalter. Das ist
--   ein GEERBTER Riss aus 0049, kein neuer - aber 0052 macht ihn
--   relevanter. Er braucht eine eigene Entscheidung (Spaltenrechte oder
--   eine View fuer den Feed) und steht als Befund im Bericht.
-- - Race beim Ausschalten: Wer den Schalter umlegt, waehrend eine Anfrage
--   gerade eingefuegt wird, kann genau diese eine Anfrage noch bekommen.
--   Fenster: Millisekunden; Folge: eine Anfrage, die man ablehnen kann.
-- - order by random() wertet alle Kandidaten aus, samt ist_blockiert je
--   Zeile. Tragbar, solange die sichtbare Menge klein ist - NEU BEWERTEN
--   AB RUND 5.000 SICHTBAREN PROFILEN (dann tablesample oder gespeicherter
--   Zufallsschluessel).
--
-- Die Einwilligung (DSGVO) liegt in 0053: Der Schalter allein ist nach dem
-- eigenen Massstab des Projekts (0034: versionierter Wortlaut, Hash,
-- unveraenderliche Zeilen) KEIN Nachweis. Das Einschalten wird von einer
-- Einwilligungszeile begleitet; der Enum-Wert entsteht hier, der Wortlaut
-- in 0053 - getrennt, weil ein neuer Enum-Wert nicht in derselben
-- Transaktion benutzt werden darf, in der er entsteht.
--
-- Rueckwaertsstrategie
-- --------------------
-- drop function zusammenlauf_vorschlaege; drop table
-- community_kontakt_anfragen; drop table zusammenlauf_weggewischt;
-- alter table community_profiles drop column zusammenlauf_sichtbar.
-- Verloren gingen Wisch-Entscheidungen und Anfragen - beides nur in dieser
-- Funktion benutzt, keine fremden Abhaengigkeiten.
-- ============================================================

-- Der Einwilligungszweck entsteht hier, sein Wortlaut in 0053 (Begruendung
-- im Kopf).
alter type einwilligung.zweck add value if not exists 'zusammenlauf';

-- ------------------------------------------------------------
-- 1. Der Schalter
-- ------------------------------------------------------------

alter table public.community_profiles
  add column if not exists zusammenlauf_sichtbar boolean not null default false;

comment on column public.community_profiles.zusammenlauf_sichtbar is
  'Opt-in: Erst wenn true, erscheint dieses Profil im Vorschlagsstapel von '
  'ZusammenLauf. Steuert das Vorgeschlagen-Werden, nicht die Lesbarkeit des '
  'Profils - die ist seit 0023 fuer Angemeldete offen (Community-Feed). '
  'Voreinstellung false: Entscheidung des Nutzers vom 23.08.2026, opt-in.';

-- ------------------------------------------------------------
-- 2. Weggewischt
-- ------------------------------------------------------------

create table if not exists public.zusammenlauf_weggewischt (
  wischer_id     uuid not null references public.profiles (id) on delete cascade,
  weggewischt_id uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),

  primary key (wischer_id, weggewischt_id),

  -- Sich selbst wegzuwischen ergibt keinen Sinn.
  constraint weggewischt_nicht_selbst check (wischer_id <> weggewischt_id)
);

-- Der Primaerschluessel bedient "wen habe ich weggewischt". Die Gegenrichtung
-- - "wer hat mich weggewischt" - braucht der beidseitige Vorschlagsfilter.
create index if not exists zusammenlauf_weggewischt_umgekehrt_idx
  on public.zusammenlauf_weggewischt (weggewischt_id, wischer_id);

-- Gegen die Supabase-Automatik (Kopf, Punkt 3): erst alles entziehen, dann
-- gezielt vergeben. Idempotent und in beiden Umgebungen gefahrlos.
revoke all on public.zusammenlauf_weggewischt from anon, authenticated;

alter table public.zusammenlauf_weggewischt enable row level security;

drop policy if exists weggewischt_eigene_anlegen on public.zusammenlauf_weggewischt;
create policy weggewischt_eigene_anlegen
  on public.zusammenlauf_weggewischt for insert
  to authenticated
  with check (wischer_id = (select auth.uid()));

drop policy if exists weggewischt_eigene_lesen on public.zusammenlauf_weggewischt;
create policy weggewischt_eigene_lesen
  on public.zusammenlauf_weggewischt for select
  to authenticated
  using (wischer_id = (select auth.uid()));

-- Fuer eine spaetere "Rueckgaengig"-Einstellung (Q1b: dauerhaft, aber
-- aufhebbar). Nur die eigenen.
drop policy if exists weggewischt_eigene_loeschen on public.zusammenlauf_weggewischt;
create policy weggewischt_eigene_loeschen
  on public.zusammenlauf_weggewischt for delete
  to authenticated
  using (wischer_id = (select auth.uid()));

grant insert, select, delete on public.zusammenlauf_weggewischt to authenticated;

-- ------------------------------------------------------------
-- 3. Anfragen
-- ------------------------------------------------------------

create table if not exists public.community_kontakt_anfragen (
  id             uuid primary key default gen_random_uuid(),
  von_id         uuid not null references public.profiles (id) on delete cascade,
  an_id          uuid not null references public.profiles (id) on delete cascade,
  stand          text not null default 'offen',
  created_at     timestamptz not null default now(),
  beantwortet_am timestamptz,

  constraint kontakt_anfrage_nicht_selbst check (von_id <> an_id),
  -- Hoechstens eine Anfrage je Richtung und Paar. Eine abgelehnte bleibt
  -- stehen und sperrt damit auch das erneute Anfragen - bewusst: "Nein"
  -- heisst nicht "frag morgen nochmal".
  constraint kontakt_anfrage_einmalig unique (von_id, an_id),
  constraint kontakt_anfrage_stand_bekannt
    check (stand in ('offen', 'angenommen', 'abgelehnt')),
  -- Offen heisst unbeantwortet, beantwortet heisst nicht mehr offen. Der
  -- ZEITPUNKT selbst bleibt ein Selbsteintrag des Empfaengers - ein
  -- Anzeigewert, kein Beweis.
  constraint kontakt_anfrage_antwortzeit_passt
    check ((stand = 'offen') = (beantwortet_am is null))
);

-- (an_id, stand) statt eines partiellen Index nur auf offene: Derselbe
-- Index bedient die Glocke ("offene an mich"), eine kuenftige Liste aller
-- Anfragen an mich UND die Fremdschluessel-Pruefung beim Loeschen eines
-- Profils - die muss alle Staende finden, nicht nur offene.
create index if not exists kontakt_anfragen_an_idx
  on public.community_kontakt_anfragen (an_id, stand);

-- Gegen die Supabase-Automatik (Kopf, Punkt 3).
revoke all on public.community_kontakt_anfragen from anon, authenticated;

alter table public.community_kontakt_anfragen enable row level security;

-- Anlegen: nur als ich selbst, nur an Menschen, die teilnehmen UND deren
-- sichtbar_fuer meine Identitaet zulaesst. Beides haelt die Regeln auch
-- gegen handgebaute Anfragen dicht - sonst waeren sie nur eine Bitte an
-- die Oberflaeche. Beide Bedingungen sind ueber die offene Leseregel von
-- community_profiles ohnehin ablesbar; ein Fehlschlag verraet also nichts.
--
-- ist_blockiert steht hier ausdruecklich NICHT (Kopf, Punkt 2): Ein
-- Insert-Fehler bei nachweislich sichtbarem Ziel waere das Orakel "du
-- wurdest blockiert". Die Zeile entsteht - gesehen wird sie nicht.
drop policy if exists kontakt_anfragen_anlegen on public.community_kontakt_anfragen;
create policy kontakt_anfragen_anlegen
  on public.community_kontakt_anfragen for insert
  to authenticated
  with check (
    von_id = (select auth.uid())
    and stand = 'offen'
    and exists (
      select 1 from public.community_profiles cp
      where cp.user_id = an_id
        and cp.zusammenlauf_sichtbar
        and (
          cp.sichtbar_fuer = '{}'
          or coalesce(
               (select me.identitaet from public.community_profiles me
                 where me.user_id = (select auth.uid())),
               'keine_angabe'
             ) = any (cp.sichtbar_fuer)
        )
    )
  );

-- Lesen: beide Seiten - solange keine Blockierung dazwischensteht. Mit ihr
-- verschwindet die Zeile fuer BEIDE: Fuer den Blockierten sieht es aus, als
-- haette es die Anfrage nie gegeben (0047-Linie "als gaebe es A nicht
-- mehr"), und wer blockiert hat, bekommt sie nicht mehr in die Glocke
-- gezaehlt. Die Zeile bleibt bestehen - wird die Blockierung aufgehoben,
-- ist sie wieder da.
drop policy if exists kontakt_anfragen_lesen on public.community_kontakt_anfragen;
create policy kontakt_anfragen_lesen
  on public.community_kontakt_anfragen for select
  to authenticated
  using (
    (von_id = (select auth.uid()) and not public.ist_blockiert(an_id))
    or (an_id = (select auth.uid()) and not public.ist_blockiert(von_id))
  );

-- Antworten: nur der Empfaenger, nur solange offen, nur zu einer Antwort.
-- Dass von_id/an_id dabei unveraendert bleiben, erzwingt nicht die Policy
-- (RLS sieht alt und neu nicht nebeneinander), sondern das SPALTENWEISE
-- Update-Recht unten: authenticated darf nur stand und beantwortet_am
-- schreiben.
drop policy if exists kontakt_anfragen_antworten on public.community_kontakt_anfragen;
create policy kontakt_anfragen_antworten
  on public.community_kontakt_anfragen for update
  to authenticated
  using (an_id = (select auth.uid()) and stand = 'offen')
  with check (an_id = (select auth.uid()) and stand in ('angenommen', 'abgelehnt'));

-- Insert spaltenweise (Kopf, Punkt 4): stand, created_at und beantwortet_am
-- kommen aus der Datenbank, nicht vom Absender.
grant insert (von_id, an_id) on public.community_kontakt_anfragen to authenticated;
grant select on public.community_kontakt_anfragen to authenticated;
grant update (stand, beantwortet_am) on public.community_kontakt_anfragen to authenticated;

-- ------------------------------------------------------------
-- 4. Die Vorschlagsabfrage - alle Regeln an einem Ort
-- ------------------------------------------------------------
-- security definer, damit die Funktion die Wisch-Zeilen ANDERER lesen darf
-- (fuer den beidseitigen Filter) - die Tabelle selbst gibt jedem nur die
-- eigenen. Der Preis ist bekannt: Die Funktion muss selbst pruefen, was RLS
-- sonst pruefen wuerde. Deshalb steht (select auth.uid()) in jeder
-- Bedingung, und search_path ist festgenagelt (dasselbe Muster wie
-- ist_blockiert aus 0047).
--
-- Was hier ausdruecklich NICHT gilt: Gegenseitigkeit. Wer selbst
-- unsichtbar ist, kann trotzdem stoebern und anfragen - seine Identitaet
-- wird mit der Anfrage ohnehin offen (Q2). Ob Sichtbarkeit Voraussetzung
-- fuers Stoebern sein soll, ist eine offene Produktfrage und steht im
-- Bericht, nicht heimlich in dieser Funktion.

create or replace function public.zusammenlauf_vorschlaege(hoechstens int default 20)
returns table (
  user_id          uuid,
  bio              text,
  running_years    smallint,
  sports           text[],
  km_woche         text,
  lauf_grund       text,
  lieber           text,
  gelaende         text,
  im_verein        boolean,
  schoen_am_laufen text,
  identitaet       text
)
language sql
stable
security definer
set search_path = ''
as $$
  -- FESTE Spaltenliste, kein p.* (Kopf, Punkt 1): Was hier nicht steht,
  -- verlaesst die Funktion nicht - auch keine kuenftige Spalte. identitaet
  -- ist dabei, weil sie zum freiwillig gezeigten Profil gehoert;
  -- zeigt_mir, sichtbar_fuer, show_stats und der Schalter selbst sind
  -- Einstellungen der Person und gehen Fremde nichts an.
  select
    p.user_id, p.bio, p.running_years, p.sports,
    p.km_woche, p.lauf_grund, p.lieber, p.gelaende,
    p.im_verein, p.schoen_am_laufen, p.identitaet
  from public.community_profiles p
  where p.user_id <> (select auth.uid())

    -- Der Schalter. Opt-in, sonst nichts.
    and p.zusammenlauf_sichtbar

    -- Identitaet, beidseitig (0049): "Wem darf p gezeigt werden" muss zu
    -- meiner Identitaet passen, und "wen will ich sehen" zu p. Leer heisst
    -- alle; keine Angabe zaehlt als 'keine_angabe'.
    and (
      p.sichtbar_fuer = '{}'
      or coalesce(
           (select me.identitaet from public.community_profiles me
             where me.user_id = (select auth.uid())),
           'keine_angabe'
         ) = any (p.sichtbar_fuer)
    )
    and (
      coalesce(
        (select me.zeigt_mir from public.community_profiles me
          where me.user_id = (select auth.uid())),
        '{}'
      ) = '{}'
      -- Das coalesce ist hier TRAGEND, nicht kosmetisch: "= any (...)" hat
      -- zwei Formen. Eine nackte Unterabfrage in den Klammern gilt als
      -- Zeilenmenge, und deren Zeilenwert ist text[] - das ergab beim
      -- Einspielen "operator does not exist: text = text[]" (42883).
      -- Erst der coalesce-Mantel macht daraus einen ARRAY-Ausdruck, den
      -- any elementweise vergleicht.
      or coalesce(p.identitaet, 'keine_angabe') = any (
        coalesce(
          (select me.zeigt_mir from public.community_profiles me
            where me.user_id = (select auth.uid())),
          '{}'
        )
      )
    )

    -- Blockiert: beidseitig, ueber die bestehende Funktion aus 0047.
    and not public.ist_blockiert(p.user_id)

    -- Weggewischt: beidseitig (Begruendung und Restrisiko im Kopf).
    and not exists (
      select 1 from public.zusammenlauf_weggewischt w
      where (w.wischer_id = (select auth.uid()) and w.weggewischt_id = p.user_id)
         or (w.wischer_id = p.user_id and w.weggewischt_id = (select auth.uid()))
    )

    -- Schon eine Anfrage in irgendeiner Richtung, egal mit welchem Stand:
    -- nicht erneut vorschlagen.
    and not exists (
      select 1 from public.community_kontakt_anfragen a
      where (a.von_id = (select auth.uid()) and a.an_id = p.user_id)
         or (a.von_id = p.user_id and a.an_id = (select auth.uid()))
    )

  -- Durchmischt, nicht nach Beitrittsdatum. Kostengrenze: siehe Kopf.
  order by random()
  limit least(greatest(coalesce(hoechstens, 20), 1), 50)
$$;

revoke all on function public.zusammenlauf_vorschlaege(int) from public, anon;
grant execute on function public.zusammenlauf_vorschlaege(int) to authenticated;
