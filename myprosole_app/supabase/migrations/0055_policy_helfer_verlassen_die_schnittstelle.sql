-- ============================================================
-- 0055: Policy-Hilfsfunktionen verlassen die Schnittstelle
-- ============================================================
-- Der Befund (Agent `sicherheit`, 24.08.2026, beim Prueflauf ueber den
-- Entwurf 0056; vom Nutzer in 0047 und config.toml selbst nachgelesen)
-- --------------------------------------------------------------------------
-- `public.ist_blockiert(uuid)` ist seit 0047:
--
--   - `security definer`  (laeuft mit erhoehten Rechten)
--   - in Schema `public`
--   - `grant execute ... to authenticated`
--
-- `public` steht in den exponierten Schemas (supabase/config.toml Zeile 13).
-- PostgREST macht aus JEDER ausfuehrbaren Funktion eines exponierten Schemas
-- einen Endpunkt. Weil die Funktion `stable` ist, sogar per GET:
--
--   GET /rest/v1/rpc/ist_blockiert?anderer=<uuid>   ->   true | false
--
-- Die Funktion prueft BEIDE Richtungen (0047:90-91). Wer B ist und weiss,
-- dass er A nicht blockiert hat, liest aus einem `true` die vollstaendige
-- Auskunft: **A hat mich blockiert.**
--
-- Damit ist die Zusicherung aus 0047:15-17 gegenstandslos - woertlich dort:
-- "die Gegenseitigkeit verraet nicht, wer blockiert hat; fuer B sieht es
-- aus, als gaebe es A nicht mehr." Sie steht seit dem Tag im Kopf jener
-- Migration und war nie eingeloest.
--
-- Und der Aufwand aus 0052 (dort Punkt 2: `ist_blockiert` wurde eigens aus
-- der Insert-Regel der Anfragen entfernt, damit ein Fehlschlag nicht
-- verraet, wer blockiert hat) schuetzt gegen einen Kanal, der einen
-- HTTP-Aufruf weiter offensteht. Die Policy war dicht. Das System nicht.
--
--
-- Die Regel, die daraus folgt
-- ---------------------------
-- **Hilfspraedikate fuer Zeilenregeln gehoeren nicht in ein exponiertes
-- Schema.** Sie sind dafuer gebaut, INNERHALB einer Regel eine Frage zu
-- beantworten, die der Aufrufer selbst nicht stellen darf. Steht so eine
-- Funktion in `public`, ist genau diese Frage direkt stellbar - und die
-- erhoehten Rechte, die sie in der Regel braucht, beantworten sie.
--
-- Der Unterschied zu den Funktionen, die bleiben duerfen:
--
--   public.community_stats(uuid)       SOLL ein Endpunkt sein (0025)
--   public.zusammenlauf_vorschlaege()  SOLL ein Endpunkt sein (0052)
--   intern.ist_blockiert(uuid)         soll es NICHT sein - sie ist ein
--                                      Praedikat, kein Dienst
--
--
-- Warum ein Schema und kein Entzug des Ausfuehrungsrechts
-- ------------------------------------------------------
-- `revoke execute ... from authenticated` waere der naheliegende Griff und
-- ist falsch: Postgres prueft das Ausfuehrungsrecht zur Laufzeit gegen den
-- AUFRUFER, auch wenn der Aufruf aus einer gespeicherten Zeilenregel kommt.
-- Ohne `execute` fuer `authenticated` scheitert dann jede Regel, die die
-- Funktion benutzt - also das Lesen von Beitraegen, von Kontaktanfragen und
-- der ganze Vorschlagsstapel.
--
-- Das Ausfuehrungsrecht bleibt deshalb. Was sich aendert, ist der ORT: Ein
-- Schema, das nicht in `config.toml` unter `schemas` steht, erzeugt keine
-- Endpunkte. Die Regel findet die Funktion weiterhin, die Schnittstelle
-- nicht mehr.
--
--
-- Was mit den drei abhaengigen Regeln geschieht
-- ---------------------------------------------
-- `alter function ... set schema` behaelt die OID. Postgres speichert in
-- einer Policy den geparsten Ausdruck mit OIDs, nicht den Namen - die drei
-- Regeln zeigen danach also weiter auf dieselbe Funktion, ohne dass sie
-- angefasst werden muessten.
--
-- Sie werden hier trotzdem neu geschrieben, aus zwei Gruenden. Erstens ist
-- "die OID bleibt" eine Annahme ueber Postgres, die diese Datei nicht
-- beweisen kann; ein `create policy` mit ausgeschriebenem Schema haengt von
-- ihr nicht ab. Zweitens liest der naechste Mensch die Migrationen, nicht
-- den Katalog: Steht dort `public.ist_blockiert`, sucht er an der falschen
-- Stelle.
--
-- Wortgleich uebernommen aus:
--   community_posts_select_all       0047:104-113
--   kontakt_anfragen_lesen           0052:289-297
--   zusammenlauf_vorschlaege         0052 (nur die eine Zeile, 399)
--
-- Die Vorschlagsfunktion wird NICHT neu geschrieben. Sie ist selbst
-- `security definer` und ruft `ist_blockiert` in ihrem Rumpf auf; dort
-- greift dieselbe OID-Bindung, und ihr `search_path = ''` zwingt ohnehin zu
-- ausgeschriebenen Namen. Sie steht damit auf der Liste der Dinge, die
-- 0057 (die Nachfuehrung des Namens) anfassen sollte - hier waere es eine
-- 90-Zeilen-Kopie fuer eine geaenderte Zeile, und Kopien laufen
-- auseinander.
--
--
-- Was diese Migration NICHT tut
-- -----------------------------
-- - Sie aendert kein Verhalten. Wer heute blockiert ist, ist es danach
--   genauso, und alle drei Regeln entscheiden wie zuvor.
-- - Sie beruehrt keine Daten, keine Spalte, keine Tabelle.
-- - Sie schliesst NICHT den statistischen Kanal ueber
--   `zusammenlauf_vorschlaege`: Wer ein Profil aus dem Stapel fallen sieht,
--   kann daraus weiterhin schliessen, dass etwas dazwischensteht - er
--   erfaehrt nur nicht mehr, WAS. Das ist die Zusicherung aus 0047, und
--   mehr hat sie nie versprochen.
--
--
-- Nachweis (vor und nach dem Einspielen, vergleichen)
-- ---------------------------------------------------
--   -- 1. Liegt die Funktion noch in einem exponierten Schema?
--   select n.nspname, p.proname, p.prosecdef
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.proname in ('ist_blockiert', 'darf_ich_anfragen');
--   -- erwartet nachher: nspname = 'intern'
--
--   -- 2. Wer darf sie ausfuehren?
--   select grantee, privilege_type
--   from information_schema.routine_privileges
--   where routine_name = 'ist_blockiert';
--   -- erwartet: nur authenticated (und der Eigentuemer), execute
--
--   -- 3. Zeigen die drei Regeln auf die verschobene Funktion?
--   select polname, pg_get_expr(polqual, polrelid) as bedingung
--   from pg_policy
--   where polname in ('community_posts_select_all', 'kontakt_anfragen_lesen');
--   -- erwartet: 'intern.ist_blockiert(...)' im Text
--
--   -- 4. Und der eigentliche Beweis, gegen die laufende Schnittstelle,
--   --    mit einem gueltigen Nutzer-Token:
--   --      GET {URL}/rest/v1/rpc/ist_blockiert?anderer=<fremde-uuid>
--   --    vorher: 200 mit true/false     nachher: 404 (PGRST202)
--
--
-- Rueckwaerts
-- -----------
--   alter function intern.ist_blockiert(uuid) set schema public;
--   -- und die drei Regeln aus 0047/0052 woertlich wiederherstellen.
-- Es gehen keine Daten verloren; die Migration aendert nur den Ort einer
-- Funktion und den Wortlaut dreier Regeln.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Das Schema, das die Schnittstelle nicht kennt
-- ------------------------------------------------------------
-- Der Name ist bewusst kurz und unspezifisch: Hier landet kuenftig jedes
-- Hilfspraedikat, nicht nur dieses eine.
--
-- WICHTIG fuer den, der das Projekt aufsetzt: Dieses Schema darf NIE in
-- supabase/config.toml unter `schemas` auftauchen und nie im Dashboard
-- unter "Exposed schemas". Steht es dort, ist diese ganze Migration
-- wirkungslos - und zwar lautlos.
create schema if not exists intern;

comment on schema intern is
  'Hilfspraedikate fuer Zeilenregeln. NICHT exponieren - siehe 0055. '
  'Was hier liegt, laeuft mit erhoehten Rechten und beantwortet Fragen, '
  'die der Aufrufer selbst nicht stellen darf.';

-- Niemand ausser der Datenbank selbst betritt das Schema von aussen.
-- `usage` ist noetig, damit `authenticated` die Funktionen darin AUFRUFEN
-- kann - ohne es scheitern die drei Regeln unten mit 42501.
revoke all on schema intern from public, anon;
grant usage on schema intern to authenticated, service_role;


-- ------------------------------------------------------------
-- 2. Die Funktion zieht um
-- ------------------------------------------------------------
alter function public.ist_blockiert(uuid) set schema intern;

-- Der Suchpfad wird bei dieser Gelegenheit dichtgemacht. 0047 setzte
-- `search_path = public`; der Rumpf schreibt `public.blockierungen`
-- ohnehin aus, also aendert `''` am Verhalten nichts - es nimmt nur die
-- Moeglichkeit, ueber eine eigene Tabelle im Suchpfad zu steuern, welche
-- Tabelle eine Funktion mit erhoehten Rechten tatsaechlich liest.
alter function intern.ist_blockiert(uuid) set search_path = '';

-- Die Rechte wandern nicht automatisch mit; der Umzug erzeugt ausserdem im
-- neuen Schema die Standardrechte. Also wieder ausdruecklich setzen -
-- dieselbe Reihenfolge wie in 0052 und 0054.
revoke all on function intern.ist_blockiert(uuid) from public, anon;
grant execute on function intern.ist_blockiert(uuid) to authenticated, service_role;

comment on function intern.ist_blockiert(uuid) is
  'Steht zwischen dem angemeldeten Konto und `anderer` eine Blockierung - '
  'in EINER der beiden Richtungen? Aus 0047, dort ausfuehrlich begruendet. '
  'Liegt seit 0055 in `intern` statt `public`: In einem exponierten Schema '
  'war sie ein Endpunkt, und ein Endpunkt, der "wurdest du blockiert" '
  'beantwortet, hebt die Zusicherung aus 0047 auf.';


-- ------------------------------------------------------------
-- 3. Die abhaengigen Regeln, schemaqualifiziert
-- ------------------------------------------------------------
-- Beide wortgleich uebernommen, geaendert ist nur `public.` -> `intern.`.

-- Aus 0047:104-113. Die erste Bedingung ist die aus 0032.
drop policy if exists community_posts_select_all on public.community_posts;
create policy community_posts_select_all
  on public.community_posts for select
  to authenticated
  using (
    (group_id is null or public.is_group_member(group_id))
    and not intern.ist_blockiert(user_id)
  );

-- Aus 0052:289-297. Mit einer Blockierung verschwindet die Zeile fuer
-- BEIDE Seiten; die Zeile selbst bleibt bestehen und ist nach dem Aufheben
-- wieder da.
drop policy if exists kontakt_anfragen_lesen on public.community_kontakt_anfragen;
create policy kontakt_anfragen_lesen
  on public.community_kontakt_anfragen for select
  to authenticated
  using (
    (von_id = (select auth.uid()) and not intern.ist_blockiert(an_id))
    or (an_id = (select auth.uid()) and not intern.ist_blockiert(von_id))
  );
