-- ============================================================
-- 0054: Rechte-Nachzug fuer alle Tabellen seit 0037
-- ============================================================
-- Der Befund (systemisch, nicht einzeln)
-- --------------------------------------
-- 0037 dokumentiert, dass Supabases "Automatically expose new tables"
-- (aktiv bis 30.10.2026) beim Anlegen neuer Tabellen TABELLENWEITE Rechte
-- an anon/authenticated vergeben kann - additiv zu allem, was die Migration
-- selbst vergibt. Bei der Pruefung von 0052 fiel das zuerst fuer die neuen
-- Tabellen auf; der Nutzer hat daraus zu Recht einen Prueflauf ueber ALLE
-- Migrationen seit 0037 gemacht.
--
-- Ergebnis: Sechs Tabellen entstanden seit 0037. Nur die beiden aus 0052
-- tragen den defensiven Revoke. Vier nicht:
--
--   0040  exercise_groups        vorgesehen: select
--   0045  meldungen              vorgesehen: insert, select
--   0046  verborgene_beitraege   vorgesehen: insert, select, delete
--   0047  blockierungen          vorgesehen: insert, select, delete
--
-- **Am schwersten wiegt blockierungen:** Das Fehlen von update ist dort ein
-- bewusstes Sicherheitsmerkmal - niemand soll eine Blockierung nachtraeglich
-- veraendern koennen. Ein unsichtbarer Auto-Grant koennte genau dieses Recht
-- wieder oeffnen, ohne dass es in irgendeiner Migrationsdatei stuende.
--
-- Was diese Migration tut
-- -----------------------
-- Fuer jede der vier Tabellen: erst ALLES entziehen, dann exakt die
-- urspruenglich vorgesehenen Rechte wieder vergeben - dieselbe Reihenfolge,
-- die 0052 vorgemacht hat. Idempotent: Ein zweiter Lauf stellt denselben
-- Zustand her.
--
-- Wichtig zum Verstaendnis: Ob die Automatik zum jeweiligen Anlegezeitpunkt
-- wirklich zu breite Rechte vergeben hat, liess sich aus dem Repository
-- nicht feststellen - nur das Risikomuster. Diese Migration macht die Frage
-- gegenstandslos: Nach ihr ist der Zustand der, den die Migrationen
-- behaupten, egal was vorher galt.
--
-- Dazu service_role: 0037 vergab `grant all ... to service_role` nur an
-- damals existierende Tabellen; von den sechs neuen hat es nur 0040 selbst
-- getan. In einer rein aus Migrationen aufgebauten Datenbank stuenden die
-- Wartungsskripte sonst vor Tabellen ohne Rechte.
--
-- Nachweis
-- --------
-- Vor und nach dem Einspielen im SQL-Editor ausfuehren und vergleichen:
--
--   select table_name, grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_schema = 'public'
--     and table_name in ('exercise_groups', 'meldungen',
--                        'verborgene_beitraege', 'blockierungen',
--                        'zusammenlauf_weggewischt',
--                        'community_kontakt_anfragen')
--     and grantee in ('anon', 'authenticated')
--   order by table_name, grantee, privilege_type;
--
-- Vorher zeigt die Abfrage, ob die Automatik wirklich zu breit vergeben
-- hat (der Live-Beleg, der aus dem Repository nicht zu holen war).
-- Nachher muss exakt die Liste aus dieser Datei herauskommen - und fuer
-- blockierungen insbesondere KEIN update.
-- ============================================================

-- 0040: Uebungsgruppen - reine Nachschlagetabelle.
revoke all on public.exercise_groups from anon, authenticated;
grant select on public.exercise_groups to authenticated;
grant all on public.exercise_groups to service_role;

-- 0045: Meldungen - anlegen und die eigenen sehen; nie aendern, nie
-- loeschen (eine Meldung ist eine Aussage, keine Einstellung).
revoke all on public.meldungen from anon, authenticated;
grant insert, select on public.meldungen to authenticated;
grant all on public.meldungen to service_role;

-- 0046: Verborgene Beitraege - eigene Liste, frei fuehrbar.
revoke all on public.verborgene_beitraege from anon, authenticated;
grant insert, select, delete on public.verborgene_beitraege to authenticated;
grant all on public.verborgene_beitraege to service_role;

-- 0047: Blockierungen - anlegen, sehen, aufheben. AUSDRUECKLICH kein
-- update: Eine Blockierung wird gesetzt oder aufgehoben, nie umgebogen.
revoke all on public.blockierungen from anon, authenticated;
grant insert, select, delete on public.blockierungen to authenticated;
grant all on public.blockierungen to service_role;

-- Die beiden 0052-Tabellen tragen ihren Revoke schon selbst; hier fehlt
-- ihnen nur service_role (dieselbe Luecke, gleich mitgeschlossen).
grant all on public.zusammenlauf_weggewischt to service_role;
grant all on public.community_kontakt_anfragen to service_role;
