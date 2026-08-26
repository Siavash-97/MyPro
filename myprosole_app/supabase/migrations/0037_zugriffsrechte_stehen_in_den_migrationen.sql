-- ============================================================
-- 0037: Die Zugriffsrechte stehen jetzt in den Migrationen
-- ============================================================
-- Was fehlte
-- ----------
-- In PostgreSQL braucht ein Zugriff zweierlei: ein Recht auf der Tabelle
-- (grant) und die Erlaubnis der Zeilenregeln (row level security). Die
-- Regeln sind da – 135 Stueck ueber 43 Tabellen, sorgfaeltig geschrieben.
-- Die Rechte fehlten vollstaendig.
--
-- Nachgemessen an einer Datenbank, die nur aus den Migrationen aufgebaut
-- wurde (19.08.2026):
--
--   Tabellen in public ............................. 43
--   davon mit eingeschalteten Zeilenregeln ......... 43
--   davon mit Zugriffsrechten fuer authenticated ....  0
--
-- Eine solche Datenbank ist fuer die App vollstaendig unbenutzbar. Kein
-- Profil laesst sich lesen, kein Lauf speichern.
--
-- Warum es trotzdem lief
-- ----------------------
-- Supabase hat eine Einstellung "Automatically expose new tables". Ist sie
-- an, bekommt jede neu angelegte Tabelle in public automatisch Rechte fuer
-- die Rollen der Datenschnittstelle. In der produktiven Datenbank ist sie
-- an – deshalb funktioniert dort alles.
--
-- Das ist aus zwei Gruenden keine Grundlage:
--
-- 1. Es steht nirgends im Projekt. Wer die Datenbank aus den Migrationen
--    neu aufbaut – nach einem Ausfall, bei einem Umzug, fuer eine zweite
--    Umgebung –, bekommt eine tote App und keinen Hinweis worauf.
--
-- 2. Supabase schafft die Einstellung ab. In der eigenen Konfiguration
--    steht dazu woertlich: "this is deprecated and the field is removed on
--    2026-10-30 once the always-revoked behaviour is permanent."
--
-- Wie die Rechte hier bestimmt werden
-- -----------------------------------
-- Nicht von Hand, sondern aus den Zeilenregeln abgeleitet. Fuer jede Regel,
-- die einer Tabelle fuer `authenticated` etwas erlaubt, wird genau das
-- passende Recht vergeben – nicht mehr.
--
-- Das ist kein Kunstgriff, sondern die richtige Quelle: Die Regeln sind die
-- ausformulierte Absicht ("wer darf hier was"). Eine Liste danebenzulegen
-- hiesse, dieselbe Absicht zweimal zu pflegen, und die zweite Fassung
-- veraltet. So kann sie nicht abweichen.
--
-- Ein Beispiel: art9_consents hat seit 0027 nur Regeln fuer select und
-- insert. Also bekommt sie auch nur diese beiden Rechte – update und delete
-- sind dort damit doppelt verschlossen, durch fehlende Regel und fehlendes
-- Recht.
--
-- Warum anon nichts bekommt
-- -------------------------
-- Weil keine einzige der 135 Regeln die Rolle anon nennt. Ein Recht ohne
-- Regel waere wirkungslos, aber es waere eine unnoetige Angriffsflaeche und
-- ein falsches Signal an den naechsten Leser.
--
-- Warum es nichts kaputt macht
-- ----------------------------
-- In der Produktion sind diese Rechte durch die Automatik bereits vorhanden
-- oder weiter gefasst. Ein grant auf ein bestehendes Recht aendert nichts.
-- Die Migration ist damit wiederholbar und in beide Richtungen gefahrlos.
--
-- ACHTUNG, NACHGETRAGEN AM 24.08.2026: Der letzte Satz gilt seit Migration
-- 0056 NICHT MEHR.
-- --------------------------------------------------------------------------
-- Die Schleife weiter unten leitet die Rechte aus den ZEILENREGELN ab und
-- vergibt fuer jede select-Regel ein TABELLENWEITES `grant select`.
--
-- 0056 entzieht der Rolle `authenticated` das Leserecht auf drei Spalten von
-- `public.community_profiles` (zeigt_mir, sichtbar_fuer,
-- zusammenlauf_sichtbar) und vergibt danach spaltenweise wieder, was gelten
-- soll. Die Zeilenregel `community_profiles_select` bleibt dabei
-- unveraendert `using (true)` - sie MUSS bleiben, weil der Feed fremde
-- Profile lesen koennen soll.
--
-- Ein erneuter Lauf DIESER Migration sieht also weiterhin eine select-Regel,
-- vergibt `grant select on public.community_profiles to authenticated` -
-- und hebelt damit die ganze Spaltenliste aus 0056 aus. Lautlos, ohne
-- Fehler, ohne Spur.
--
-- Ein Wiederaufbau in Migrationsreihenfolge ist unkritisch: 0037 laeuft vor
-- 0056, und 0056 raeumt danach auf. Gefaehrlich ist der REPARATURLAUF VON
-- HAND, zu dem der Satz oben einlaedt - "gefahrlos, lauf es einfach nochmal".
--
-- Wer diese Migration einzeln nachfaehrt, MUSS danach 0056 ebenfalls
-- nachfahren. Der Nachweis steht im Kopf von 0056 (Probe 2: genau 14
-- Spalten fuer authenticated, die drei gesperrten nicht darunter).
--
-- Gefunden vom Agenten `sicherheit` am 24.08.2026 beim Prueflauf ueber den
-- Entwurf von 0056.
--
-- Regel ab hier
-- -------------
-- Jede Migration, die eine Tabelle anlegt, vergibt auch deren Rechte. Nicht
-- die Automatik – die ist bald weg. Wer eine Zeilenregel schreibt, schreibt
-- das passende grant dazu. 0034 macht es fuer das Schema einwilligung
-- bereits so.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select
      c.relname as tabelle,
      string_agg(distinct
        case p.polcmd
          when 'r' then 'select'
          when 'a' then 'insert'
          when 'w' then 'update'
          when 'd' then 'delete'
          -- '*' steht fuer "alle Befehle" (create policy ... for all)
          when '*' then 'select, insert, update, delete'
        end, ', ') as befehle
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        -- Regel nennt die Rolle ausdruecklich: "... to authenticated"
        exists (
          select 1 from pg_roles ro
          where ro.oid = any (p.polroles) and ro.rolname = 'authenticated'
        )
        -- oder sie nennt gar keine: dann gilt sie fuer alle Rollen.
        --
        -- In pg_policy steht dafuer die Kennung 0 (PUBLIC). Ohne diesen
        -- zweiten Fall blieben fuenf Tabellen ohne Rechte – runs,
        -- run_points, run_splits, running_plans, running_plan_days. Ihre
        -- Regeln sind ohne "to" geschrieben und gelten deshalb sehr wohl
        -- fuer angemeldete Nutzer, nur eben nicht namentlich. Gemessen und
        -- korrigiert, nicht vermutet.
        or 0 = any (p.polroles)
      )
    group by c.relname
  loop
    execute format('grant %s on public.%I to authenticated', r.befehle, r.tabelle);
  end loop;
end $$;

-- service_role ist der Wartungsweg: Der Schluessel dazu ist geheim, wird nie
-- an ein Geraet ausgeliefert und umgeht die Zeilenregeln ohnehin. Ohne
-- Rechte hier bliebe jede serverseitige Aufraeumarbeit ausgesperrt – siehe
-- die Skripte unter supabase/wartung/.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Bewusst KEINE default privileges auf public.
--
-- Sie waeren dieselbe Automatik noch einmal, nur an anderer Stelle: Eine
-- kuenftige Tabelle bekaeme ihre Rechte, ohne dass es jemand aufschreibt –
-- und der naechste Leser stuende wieder vor einer Datenbank, deren
-- Verhalten nicht in den Migrationen steht. Genau das soll diese Migration
-- beenden.
