-- ============================================================
-- 0057: Die drei Einstellungsspalten werden gesperrt
-- ============================================================
-- Die zweite Haelfte von 0056. Dort steht die vollstaendige Begruendung -
-- B17, der Befund des Agenten `sicherheit` vom 23.08.2026, die Abwaegung
-- Spaltenrechte gegen View, und warum `identitaet` und `show_stats`
-- lesbar bleiben. Hier steht nur der Handgriff.
--
--
-- WARUM ZWEI DATEIEN
-- ------------------
-- 0056 war urspruenglich eine Migration und in dieser Form nicht
-- ausliefbar, ohne dass etwas kaputtgeht:
--
--   Migration zuerst  -> Die ausgelieferte App liest `.select('*')`.
--                        `*` verlangt Leserecht auf JEDE Spalte. Die ganze
--                        Community-Profilseite stirbt fuer alle, sofort.
--
--   App zuerst        -> Die neue App ruft meine_profil_einstellungen(),
--                        die es noch nicht gibt. Einstellungen und
--                        ZusammenLauf-Schalter sind voruebergehend tot.
--
-- Die Funktionen aus 0056 sind rein ADDITIV. Nur DIESE Datei bricht die
-- alte Fassung. Deshalb die Trennung, und deshalb diese Reihenfolge:
--
--   1. 0056 einspielen      -> nichts aendert sich fuer irgendwen
--   2. App ausliefern       -> findet die Funktionen schon vor
--   3. DIESE Datei          -> B17 geschlossen, alte Fassung ist weg
--
--
-- DREI VORBEDINGUNGEN, die nicht uebersprungen werden duerfen
-- -----------------------------------------------------------
--
-- 1. **0056 ist VOLLSTAENDIG eingespielt.** Nicht nur "angefangen".
--
--    0056 legt VIER Funktionen an und tauscht EINE Policy. Bricht das
--    Einspielen dazwischen ab, ist der Zustand still halbfertig:
--
--      - `meine_profil_einstellungen_setzen` fehlt -> Speichern der
--        Einstellungen scheitert mit 42501.
--      - `meine_sichtbarkeit_setzen` fehlt -> ZusammenLauf-Schalter tot,
--        und zwar im Halbzustand, den diese Datei weiter unten beschreibt.
--      - Die Policy `kontakt_anfragen_anlegen` steht noch in der
--        0052-Fassung, liest die gesperrten Spalten direkt in ihrer
--        with-check-Unterabfrage -> nach DIESER Migration scheitert JEDE
--        Kontaktanfrage mit 42501. Genau die Bruchstelle, fuer die 0056
--        Teil 4 gebaut wurde.
--
--    Eine Zaehlung auf eine Funktion faengt das nicht. Pruefen mit dem
--    Nachweisblock aus 0056 - beides, Funktionen UND Policy:
--
--      select n.nspname as schema, p.proname as funktion
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where p.proname in ('meine_profil_einstellungen',
--                          'meine_profil_einstellungen_setzen',
--                          'meine_sichtbarkeit_setzen',
--                          'darf_ich_anfragen')
--      order by 1, 2;
--      -- erwartet: VIER Zeilen, drei in `public`, darf_ich_anfragen in `intern`
--
--      select policyname, with_check
--      from pg_policies
--      where schemaname = 'public' and policyname = 'kontakt_anfragen_anlegen';
--      -- erwartet: with_check enthaelt `intern.darf_ich_anfragen`
--
--    Der `join pg_namespace` ist kein Zierrat: Ohne ihn zaehlt auch eine
--    gleichnamige Funktion in einem fremden Schema mit.
--    Angestrichen vom Agenten `pruefung` am 26.08.2026 - die vorige Fassung
--    fragte eine einzige Funktion ab, ausgerechnet die erste im Ablauf.
--
-- 2. **Der Quelltext benutzt keinen Stern mehr.**
--
--      git grep -n -A 3 "from('community_profiles')" -- myprosole_web/src
--
--    Das `-A 3` ist noetig und kein Zierrat: Das `.select(...)` steht in
--    der Regel NICHT auf der Trefferzeile, sondern ein bis zwei Zeilen
--    darunter. Ohne den Kontext prueft man etwas, das man nicht sieht.
--    Das Kriterium ist NICHT "kein Stern". Es lautet: **keine der drei
--    gesperrten Spalten wird gelesen.** `.select('user_id, bio, zeigt_mir')`
--    ist ausgeschrieben und bricht trotzdem.
--
--    Und die Liste muss nicht woertlich dastehen: Die korrigierte App
--    benutzt die Konstante `OEFFENTLICHE_SPALTEN`
--    (`myprosole_web/src/store/communityProfile.ts`), mit eigener
--    Begruendung im Code. Wer hier nur nach einer Aufzaehlung sucht, sieht
--    einen Bezeichner und muss entweder faelschlich einen Verstoss melden
--    oder die Pruefung ungeprueft abhaken - beides der Fall aus CLAUDE.md
--    Regel 2. Also: dem Bezeichner folgen und SEINEN Inhalt gegen die
--    Spaltenliste unten halten.
--
--    Nicht verwechseln: `community_profile_photos` und
--    `community_kontakt_anfragen` sind ANDERE Tabellen; ein `select('*')`
--    dort ist von dieser Migration nicht betroffen.
--    Angestrichen vom Agenten `pruefung` am 26.08.2026, der den Befehl
--    ausgefuehrt und genau das gesehen hat.
--
-- 3. **Kein Geraet fuehrt die alte Fassung mehr aus.** Das ist die
--    Vorbedingung, die am leichtesten uebersehen wird, und die einzige,
--    die `git grep` NICHT beantwortet.
--
--    `git grep` misst das Repository. Eine installierte APK laeuft davon
--    unberuehrt weiter - OTA-Aktualisierung ist zurueckgestellt. Solange
--    irgendein Telefon `communityProfile.ts` (Stand `main`) ausfuehrt,
--    stirbt dort nach dieser Migration JEDE Community-Profilseite mit
--    42501, auch die eigene, auch fremde.
--
--    Anders als bei einer Web-Auslieferung gibt es keinen Zeitpunkt, an
--    dem "die App ist ausgeliefert" von selbst wahr wird. Was tatsaechlich
--    pruefbar ist: die Geraeteliste eines Feldtests, ein
--    Play-Console-Rollout auf 100 %, oder eine erzwungene Mindestversion.
--    Gefunden vom Agenten `pruefung` am 25.08.2026.
--
--
-- NICHT ZEILE FUER ZEILE AUSFUEHREN
-- ---------------------------------
-- Zwischen dem `revoke all` und dem `grant select (...)` weiter unten gibt
-- es ein Fenster ohne jedes Leserecht. Wird die Datei anweisungsweise
-- ausgefuehrt, bricht in dieser Zeit die Profilseite fuer alle. Als ein
-- Block markiert und ausgefuehrt laeuft sie in einer Transaktion, und das
-- Fenster ist von aussen nicht sichtbar.
--
--
-- EIN HALBZUSTAND AUF ALTEN GERAETEN, der hier benannt gehoert
-- -----------------------------------------------------------
-- In der alten Fassung schreibt `zusammenlauf.ts` beim Einschalten ZUERST
-- die Einwilligungszeile (Stand `main`, Zeile 172) und DANN den Schalter
-- (Zeile 189). Nach dieser Migration scheitert der zweite Schritt mit
-- 42501; die unveraenderliche Einwilligungszeile aus 0053 ist dann aber
-- schon geschrieben.
--
-- Jeder Einschaltversuch auf einem alten Geraet sammelt also einen
-- Einwilligungs-Nachweis ohne Wirkung. Das ist genau der Halbzustand, den
-- 0056 als "bei einer Datenschutzeinstellung der schlechteste Ausgang"
-- beschreibt - hier entsteht er in der ALTEN Fassung, und keine der beiden
-- Migrationen konnte ihn verhindern. Er ist der Preis dafuer, dass
-- Vorbedingung 3 nicht erzwingbar ist.
--
--
-- Nachweis (nach dem Einspielen im SQL-Editor)
-- --------------------------------------------
--   -- Genau 14 Spalten fuer authenticated, und die drei sind NICHT dabei.
--   select grantee, column_name
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'community_profiles'
--     and grantee in ('anon', 'authenticated') and privilege_type = 'SELECT'
--   order by grantee, column_name;
--
--   -- Kein tabellenweites SELECT mehr fuer authenticated.
--   select grantee, privilege_type
--   from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'community_profiles'
--     and grantee in ('anon', 'authenticated')
--   order by grantee, privilege_type;
--
--   -- Und die Probe aufs Exempel:
--   begin;
--     set local role authenticated;
--     select zeigt_mir from public.community_profiles limit 1;  -- 42501
--     select bio from public.community_profiles limit 1;        -- geht
--   rollback;
--
--
-- Rueckwaerts
-- -----------
--   revoke select (user_id, bio, running_years, sports, show_stats,
--                  created_at, updated_at, lauf_grund, km_woche, lieber,
--                  gelaende, im_verein, schoen_am_laufen, identitaet)
--     on public.community_profiles from authenticated;
--   grant select on public.community_profiles to authenticated;
--
-- Das `revoke` zuerst, obwohl es funktional nichts aendert - Spaltenrechte
-- sind additiv, das tabellenweite Grant deckt sie ohnehin. Aber ohne das
-- `revoke` bleiben die 14 Zeilen im Katalog stehen, und wer danach den
-- Nachweis oben faehrt, sieht sie und schliesst, der Rollback sei nicht
-- durchgelaufen. Dieselbe Bauart wie ein Nachweis, der das Gegenteil des
-- Erwarteten meldet. Angestrichen vom Agenten `pruefung` am 26.08.2026.
-- Es gehen keine Daten verloren; diese Datei aendert nur Rechte.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Erst alles entziehen
-- ------------------------------------------------------------
-- Ohne diesen Schritt bliebe das tabellenweite select aus 0037 (und ein
-- moegliches Auto-Grant) neben den Spaltenrechten stehen und wuerde sie
-- vollstaendig aushebeln. Begruendung im Kopf.
revoke all on public.community_profiles from anon, authenticated;


-- ------------------------------------------------------------
-- 2. Und genau das wieder vergeben, was gelten soll
-- ------------------------------------------------------------
-- Lesen: spaltenweise, ausgeschrieben. Die Liste ist absichtlich lang und
-- langweilig - sie ist die einzige Stelle, an der steht, was ein Fremder
-- von einem Profil sehen darf.
--
-- Nebenwirkung, die ausdruecklich gewollt ist: Eine kuenftige Spalte ist
-- damit zunaechst fuer NIEMANDEN lesbar, bis eine Migration sie hier
-- eintraegt. Das dreht den Fehler von 0048/0049 um - aus "erbt versehentlich
-- Oeffentlichkeit" wird "muss ausdruecklich freigegeben werden". Der
-- Transstatus, den 0049 ankuendigt, laeuft damit nicht mehr Gefahr,
-- unbemerkt oeffentlich zu werden.
grant select (
  user_id,           -- Schluessel; wird auch zum Filtern gebraucht
  bio,
  running_years,
  sports,
  show_stats,        -- bleibt lesbar, offene Stelle - siehe Kopf
  created_at,
  updated_at,
  lauf_grund,        -- 0048: die sechs Fragen sind Anzeige, kein Filter
  km_woche,
  lieber,
  gelaende,
  im_verein,
  schoen_am_laufen,
  identitaet         -- 0049: bleibt oeffentlich, Entscheidung des Nutzers
) on public.community_profiles to authenticated;

-- Schreiben: tabellenweit, nicht spaltenweise. Bewusst anders als in 0052.
--
-- Dort war spaltenweises insert/update ein Schutz (stand und created_at
-- sollten aus der Datenbank kommen, nicht vom Absender). Hier gaebe es
-- nichts zu schuetzen, was die Zeilenregeln aus 0023 nicht schon halten:
-- insert und update pruefen `user_id = auth.uid()`, niemand kann eine
-- fremde Zeile anfassen und niemand seine eigene weggeben. Eine zweite,
-- spaltenweise Liste waere dafuer nur eine weitere Stelle, die beim
-- naechsten `add column` vergessen wird - und dann bricht das Speichern des
-- Profils mit 42501, ohne dass jemand den Zusammenhang sieht. Der Befund
-- dieser Migration betrifft das LESEN; nur dort wird es eng gemacht.
grant insert, update, delete on public.community_profiles to authenticated;

-- Der Wartungsweg. 0037 hat ihn ueber `grant all on all tables` vergeben -
-- das haben die revokes oben nicht angetastet (sie nennen nur anon und
-- authenticated), aber es steht hier, damit die Datei fuer sich allein
-- vollstaendig ist und ein Wiederaufbau aus den Migrationen nichts
-- vermisst. Derselbe Handgriff wie in 0054.
grant all on public.community_profiles to service_role;


