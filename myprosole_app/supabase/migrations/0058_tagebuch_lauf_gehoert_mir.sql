-- ============================================================
-- 0058: Ein Tagebucheintrag darf nur auf einen eigenen Lauf zeigen
-- ============================================================
-- Das Problem
-- -----------
-- `training_diary_entries.run_id` traegt seit 0008 einen echten
-- Fremdschluessel auf `runs (id)`. Die Zeilenrechte pruefen aber nur, wem
-- der EINTRAG gehoert, nicht, wem der LAUF gehoert:
--
--   0006:416-421  diary_entries_insert_own ... with check (user_id = auth.uid())
--   0006:424-429  diary_entries_update_own ... using/with check (user_id = auth.uid())
--
-- Ueber `run_id` sagt keine der beiden Regeln ein Wort.
--
-- Warum das mehr ist als Unordnung: **Fremdschluesselpruefungen umgehen die
-- Zeilenrechte.** Das ist keine Vermutung, es steht so im
-- PostgreSQL-Handbuch, Abschnitt CREATE POLICY / Notes:
--
--   "While policies will be applied for explicit queries against tables in
--    the database, they are not applied when the system is performing
--    internal referential integrity checks or validating constraints. This
--    means there are indirect ways to determine that a given value exists."
--
-- Daraus folgt ein Existenz-Orakel fuer fremde Lauf-Kennungen, und es ist
-- billig:
--
--   POST /rest/v1/training_diary_entries { user_id: <ich>, run_id: <geraten> }
--     -> 23503  : die Kennung existiert nicht
--     -> 201    : die Kennung existiert (bei irgendwem)
--
-- Ein Bit je Anfrage, ohne Datenaenderung und ohne Spur. Gefunden vom
-- Agenten `sicherheit` am 31.08.2026 waehrend der Pruefung einer ganz
-- anderen Frage (geraetevergebene `runs.id`).
--
-- Wie gross ist der Schaden wirklich
-- ----------------------------------
-- Klein, aber nicht null - und das gehoert dazugesagt, damit niemand die
-- Zahl fuer den Grund haelt, es zu lassen:
--
--   `crypto.randomUUID()` und `gen_random_uuid()` liefern beide UUID v4 mit
--   122 Zufallsbits, also 5,3e36 Werte. Bei 1.000 Anfragen je Sekunde ueber
--   ein volles Jahr (3,15e10 Anfragen) und hypothetischen 1e9 Laeufen liegt
--   die Trefferwahrscheinlichkeit bei etwa 6e-18.
--
-- Der Grund, es trotzdem zu schliessen, ist ein anderer: Es kostet zwei
-- Zeilen, und ein Eintrag, der auf einen fremden Lauf zeigt, ist auch ohne
-- Angreifer falsch. Heute kann die App ihn versehentlich erzeugen - die
-- Kennung kommt aus einem Adressparameter (`?lauf=`), und Adressen lassen
-- sich von Hand aendern.
--
-- Was diese Migration NICHT tut
-- -----------------------------
-- Sie schliesst das GLEICHE Orakel auf `runs` selbst nicht: Dort erlaubt
-- `0008:17` (`id uuid primary key default gen_random_uuid()` - ein Default,
-- kein `generated always`) zusammen mit dem tabellenweiten Grant aus
-- `0037:141` weiterhin, eine Kennung mitzuschicken und aus 201 gegen 23505
-- zu schliessen.
--
-- Das ist eine bewusste Risikoannahme, kein Uebersehen: Der einzige Weg
-- dorthin waere ein Spaltengrant, und der ist mit der geraetevergebenen
-- Lauf-Kennung unvereinbar, die am 31.08.2026 ausdruecklich freigegeben
-- wurde (siehe `docs/lauf-ohne-netz-entwurf.md`, F1/A2). Der Nutzen - ein
-- Bit weniger bei 6e-18 - steht in keinem Verhaeltnis zu dem, was dafuer
-- aufgegeben wuerde.
--
-- Vorbedingung
-- ------------
-- Keine. Die Regeln werden ersetzt, nicht ergaenzt; `drop policy if exists`
-- macht das Einspielen wiederholbar.
--
-- Ein Hinweis fuer den, der sie einspielt: Bestehende Eintraege werden NICHT
-- geprueft. Eine `update`-Regel wirkt erst beim naechsten Schreiben. Falls
-- es heute schon Eintraege gibt, die auf fremde Laeufe zeigen, findet die
-- letzte Nachweis-Abfrage sie.
--
--
-- Nachweis (nach dem Einspielen im SQL-Editor auszufuehren)
-- ---------------------------------------------------------
--
--   select policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public'
--     and tablename  = 'training_diary_entries'
--     and policyname in ('diary_entries_insert_own', 'diary_entries_update_own')
--   order by policyname;
--   -- erwartet: ZWEI Zeilen.
--   --   diary_entries_insert_own : cmd = INSERT, with_check enthaelt
--   --                              'run_id is null' UND 'from runs'
--   --   diary_entries_update_own : cmd = UPDATE, qual enthaelt
--   --                              'user_id = auth.uid()', with_check
--   --                              enthaelt 'run_id is null' UND 'from runs'
--
--   select count(*) as eintraege_auf_fremde_laeufe
--   from public.training_diary_entries t
--   where t.run_id is not null
--     and not exists (
--       select 1 from public.runs r
--       where r.id = t.run_id and r.user_id = t.user_id
--     );
--   -- erwartet: 0
--   -- Steht dort mehr als 0, gibt es Altbestand, der ab jetzt nicht mehr
--   -- aenderbar ist. Dann bitte melden, BEVOR etwas geloescht wird - die
--   -- Eintraege selbst sind echte Nutzerdaten.
--
-- ============================================================

-- ── Eintragen: der Lauf muss mir gehoeren, oder es ist keiner ──
drop policy if exists diary_entries_insert_own on public.training_diary_entries;
create policy diary_entries_insert_own
  on public.training_diary_entries
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    -- `run_id is null` bleibt ausdruecklich erlaubt: Ein Eintrag ohne Lauf
    -- ist der Normalfall (Krafttraining, Ruhetag) - und seit dem
    -- 31.08.2026 auch der Rueckfall, wenn die Lauf-Zeile beim Beenden noch
    -- nicht bestaetigt ist (`lib/nachLaufZiel.ts`).
    and (
      run_id is null
      or exists (
        select 1 from public.runs r
        where r.id = run_id and r.user_id = auth.uid()
      )
    )
  );

-- ── Aendern: dieselbe Bedingung, auf beiden Seiten ──
drop policy if exists diary_entries_update_own on public.training_diary_entries;
create policy diary_entries_update_own
  on public.training_diary_entries
  for update
  to authenticated
  using (user_id = auth.uid())
  -- Das `with check` steht hier ausdruecklich, obwohl Postgres ohne es die
  -- `using`-Klausel doppelt verwenden wuerde: Sonst duerfte ein Eintrag
  -- nachtraeglich auf einen fremden Lauf umgehaengt werden - dieselbe
  -- Luecke, nur eine Anfrage spaeter.
  with check (
    user_id = auth.uid()
    and (
      run_id is null
      or exists (
        select 1 from public.runs r
        where r.id = run_id and r.user_id = auth.uid()
      )
    )
  );
