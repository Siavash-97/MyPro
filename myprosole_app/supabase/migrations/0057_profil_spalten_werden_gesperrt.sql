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
-- VORBEDINGUNG, die nicht uebersprungen werden darf
-- -------------------------------------------------
-- Die ausgelieferte App darf `select('*')` auf community_profiles NICHT
-- mehr benutzen. Vor dem Einspielen pruefen:
--
--   git grep -n "from('community_profiles')" -- myprosole_web/src
--
-- Jede Trefferzeile muss eine ausgeschriebene Spaltenliste haben, keinen
-- Stern und kein argumentloses `.select()`. Steht dort noch ein Stern,
-- bricht diese Migration die Profilseite.
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
--   grant select on public.community_profiles to authenticated;
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


