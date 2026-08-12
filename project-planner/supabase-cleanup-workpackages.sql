-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Cleans up the work package (Arbeitspaket) mix that grew from three
-- separate planning rounds -- the original seed data (Hardware-Sprint,
-- AP1-AP4), Bastian's later hardware-referenzsystem import (Referenzsystem
-- bis MS1, Hardware-Vorauswahl bis MS2), and the Sia Gantt import (Spur
-- 1-6). No task content, dates, dependencies or assignees change here --
-- only which work package a task belongs to (for the one confirmed
-- duplicate) and every work package's display name (unified onto the
-- original "APn Name" scheme). Decided in chat on 2026-08-12:
--
--   - AP1 Sensorik & Material duplicated Spur 3 (Einlage/Material/Design,
--     the newer, more detailed breakdown) -- merged, Spur 3's structure
--     wins, AP1's two tasks move over, AP1 itself is deleted.
--   - Hardware-Sprint vs. Referenzsystem bis MS1 / Hardware-Vorauswahl bis
--     MS2: kept separate (not merged), just renamed.
--   - AP2 Software/App/Backend vs. Spur 1 App und Technik: different
--     people, different actual tasks -- kept separate, just renamed.
--
-- Idempotent: safe to re-run. The wp-ap1 delete and its reassignment only
-- have an effect the first time; every rename is a plain UPDATE. If
-- Hardware-Sprint (wp-hw) no longer exists in this database, its rename
-- below simply affects zero rows.

-- 1. Merge AP1 into the Spur-3 work package (its structure wins).
update planner_tasks set work_package_id = 'sia-wp-einlage' where work_package_id = 'wp-ap1';
delete from planner_work_packages where id = 'wp-ap1';

-- 2. Unify every remaining work package's name onto "APn Name".
-- AP2, AP3, AP4 already match the scheme and are left untouched.
update planner_work_packages set name = 'AP1 Einlage, Material, Struktur, Design' where id = 'sia-wp-einlage';
update planner_work_packages set name = 'AP5 Hardware-Sprint' where id = 'wp-hw';
update planner_work_packages set name = 'AP6 Referenzsystem bis MS1' where id = 'g-wp-ref';
update planner_work_packages set name = 'AP7 Hardware-Vorauswahl bis MS2' where id = 'g-wp-hw';
update planner_work_packages set name = 'AP8 App und Technik' where id = 'sia-wp-app';
update planner_work_packages set name = 'AP9 Trainingsplanung und Konzepte' where id = 'sia-wp-training';
update planner_work_packages set name = 'AP10 Prototyping und Fertigungspartner' where id = 'sia-wp-proto';
update planner_work_packages set name = 'AP11 Markenrecherche und Patent' where id = 'sia-wp-marke';
update planner_work_packages set name = 'AP12 Förderung, Alternativen ohne Förderung' where id = 'sia-wp-foerderung';

insert into planner_activity (id, ts, message, actor) values
  ('act-wp-cleanup', now(), 'Arbeitspakete aufgeraeumt: AP1 (Sensorik & Material) mit Spur 3 (Einlage/Material/Design) zusammengelegt, alle Namen auf das APn-Schema vereinheitlicht. Keine Aufgabeninhalte, Termine oder Abhaengigkeiten geaendert.', 'Claude')
on conflict (id) do nothing;
