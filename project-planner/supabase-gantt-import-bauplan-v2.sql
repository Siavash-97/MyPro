-- Auto-generated from MyProSole Bauplan v2
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Idempotent: safe to re-run, uses ON CONFLICT DO NOTHING / DO UPDATE on 'v2-' prefixed ids.
-- All tasks assigned to Siavash. Start: 2026-08-17. Includes Phase 4b (Anamnese & Tagebuch).

insert into planner_people (id, name, color) values
  ('p-siavash', 'Siavash', '#2563eb')
on conflict (id) do nothing;

insert into planner_work_packages (id, name, color) values
  ('v2-wp-0', 'Phase 0 · Fundament', '#7eb89a'),
  ('v2-wp-1', 'Phase 1 · Registrierung & Login', '#5fa07e'),
  ('v2-wp-2', 'Phase 2 · Lauftracking', '#3f8862'),
  ('v2-wp-3', 'Phase 3 · Auswertung & Teilen', '#6a9fba'),
  ('v2-wp-4', 'Phase 4 · Uebungen & Gym-Plan', '#c57d3e'),
  ('v2-wp-4b', 'Phase 4b · Anamnese & Tagebuch', '#2e8b7a'),
  ('v2-wp-5', 'Phase 5 · Community', '#8b6dae'),
  ('v2-wp-6', 'Phase 6 · Smartwatch', '#5a8fa0'),
  ('v2-wp-7', 'Phase 7 · Testrunde', '#a08b6d')
on conflict (id) do nothing;

-- Phase summary tasks (parents for hierarchy)
insert into planner_tasks (id, type, title, start_date, end_date, assignee_ids, work_package_id, color, progress, status, notes, parent_id) values
  ('v2-ph-0', 'task', 'Phase 0: Fundament',              '2026-08-17', '2026-08-18', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', 'Supabase, Design-System, App-Shell und erstes Deployment.', null),
  ('v2-ph-1', 'task', 'Phase 1: Registrierung & Login',   '2026-08-19', '2026-08-22', ARRAY['p-siavash'], 'v2-wp-1', '#5fa07e', 0, 'not_started', 'Supabase Auth, Profil-Einrichtung, geschlossene Testrunde.', null),
  ('v2-ph-2', 'task', 'Phase 2: Lauftracking',            '2026-08-23', '2026-08-28', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', 'GPS, Timer, Karte, Lauf speichern, Zusammenfassung.', null),
  ('v2-ph-3', 'task', 'Phase 3: Auswertung & Teilen',     '2026-08-29', '2026-09-01', ARRAY['p-siavash'], 'v2-wp-3', '#6a9fba', 0, 'not_started', 'GPS-Kennzahlen, Pace-Engine, Sharing als PNG.', null),
  ('v2-ph-4', 'task', 'Phase 4: Uebungen & Gym-Plan',     '2026-08-19', '2026-08-28', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', 'wger-Import, Uebungskatalog, Gym-Plan-Editor, Trainingseinheit, Workout-Log. Kann parallel zu Phase 2-3 und 5 laufen.', null),
  ('v2-ph-4b', 'task', 'Phase 4b: Anamnese & Tagebuch',  '2026-08-19', '2026-08-23', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', 'Strukturierte Speicherung: Anamnese-Fragebogen (EAV) + Lauf-Tagebuch + Schmerzprotokoll. Nur speichern, keine Interpretation. Art. 9 DSGVO.', null),
  ('v2-ph-5', 'task', 'Phase 5: Community',               '2026-08-23', '2026-09-01', ARRAY['p-siavash'], 'v2-wp-5', '#8b6dae', 0, 'not_started', 'Feed, Gruppen, ZusammenLauf, Melden & Blockieren.', null),
  ('v2-ph-6', 'task', 'Phase 6: Smartwatch',              '2026-08-23', '2026-08-27', ARRAY['p-siavash'], 'v2-wp-6', '#5a8fa0', 0, 'not_started', 'Google OAuth, Google Fit Import, Verbindungsstatus.', null),
  ('v2-ph-7', 'task', 'Phase 7: Testrunde',               '2026-08-29', '2026-08-31', ARRAY['p-siavash'], 'v2-wp-7', '#a08b6d', 0, 'not_started', 'PWA-Test, Datenschutzerklaerung, Feedback-Kanal.', null)
on conflict (id) do nothing;

-- Individual tasks
insert into planner_tasks (id, type, title, start_date, end_date, assignee_ids, work_package_id, color, progress, status, notes, parent_id) values
  -- Phase 0: Fundament
  ('v2-t01', 'task', 'Supabase-Projekt anlegen (EU-Region)',              '2026-08-17', '2026-08-17', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', '', 'v2-ph-0'),
  ('v2-t02', 'task', 'myprosole_web/ + Design-System uebernehmen',       '2026-08-17', '2026-08-17', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', '', 'v2-ph-0'),
  ('v2-t03', 'task', 'Migration 0001_profiles.sql + RLS',                '2026-08-18', '2026-08-18', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', '', 'v2-ph-0'),
  ('v2-t04', 'task', 'Cloudflare Pages Projekt (2. Deployment)',          '2026-08-18', '2026-08-18', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', '', 'v2-ph-0'),
  ('v2-t05', 'task', 'App-Shell (Navigation, Chat-FAB)',                  '2026-08-18', '2026-08-18', ARRAY['p-siavash'], 'v2-wp-0', '#7eb89a', 0, 'not_started', '', 'v2-ph-0'),

  -- Phase 1: Registrierung & Login
  ('v2-t11', 'task', 'Registrierung (Supabase Auth, Bestaetigungs-Mail)', '2026-08-19', '2026-08-20', ARRAY['p-siavash'], 'v2-wp-1', '#5fa07e', 0, 'not_started', '', 'v2-ph-1'),
  ('v2-t12', 'task', 'Login + Passwort vergessen',                        '2026-08-21', '2026-08-21', ARRAY['p-siavash'], 'v2-wp-1', '#5fa07e', 0, 'not_started', '', 'v2-ph-1'),
  ('v2-t13', 'task', 'Profil-Einrichtung (Name, Level, Wochenziel)',      '2026-08-21', '2026-08-21', ARRAY['p-siavash'], 'v2-wp-1', '#5fa07e', 0, 'not_started', '', 'v2-ph-1'),
  ('v2-t14', 'task', 'Geschlossene Testrunde (Einladungen)',              '2026-08-22', '2026-08-22', ARRAY['p-siavash'], 'v2-wp-1', '#5fa07e', 0, 'not_started', '', 'v2-ph-1'),

  -- Phase 2: Lauftracking
  ('v2-t21', 'task', 'GPS-Aufzeichnung + Timer + Haversine',              '2026-08-23', '2026-08-24', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', '', 'v2-ph-2'),
  ('v2-t22', 'task', 'Pausieren / Fortsetzen',                            '2026-08-25', '2026-08-25', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', '', 'v2-ph-2'),
  ('v2-t23', 'task', 'Live-Karte (MapLibre GL + OSM)',                    '2026-08-25', '2026-08-26', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', '', 'v2-ph-2'),
  ('v2-t24', 'task', 'Lauf speichern (runs + points + splits)',            '2026-08-26', '2026-08-26', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', '', 'v2-ph-2'),
  ('v2-t25', 'task', 'Zusammenfassung + Verlauf anbinden',                '2026-08-27', '2026-08-28', ARRAY['p-siavash'], 'v2-wp-2', '#3f8862', 0, 'not_started', '', 'v2-ph-2'),

  -- Phase 3: Auswertung & Teilen
  ('v2-t31', 'task', 'Analyse-Ergebnis (GPS-Kennzahlen)',                  '2026-08-29', '2026-08-30', ARRAY['p-siavash'], 'v2-wp-3', '#6a9fba', 0, 'not_started', '', 'v2-ph-3'),
  ('v2-t32', 'task', 'Pace-Auffaelligkeiten (Regel-Engine)',               '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'v2-wp-3', '#6a9fba', 0, 'not_started', '', 'v2-ph-3'),
  ('v2-t33', 'task', 'Strecke+Werte als Bild (Canvas-PNG)',                '2026-08-31', '2026-09-01', ARRAY['p-siavash'], 'v2-wp-3', '#6a9fba', 0, 'not_started', '', 'v2-ph-3'),

  -- Phase 4: Uebungen & Gym-Plan (parallel zu Phase 2-3)
  ('v2-t41', 'task', 'wger-Sync-Skript (Uebungen, Muskeln, Equipment)',   '2026-08-19', '2026-08-20', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', 'Datenquelle: wger.de (CC-BY-SA 4.0)', 'v2-ph-4'),
  ('v2-t42', 'task', 'Migration 0005 anwenden + Seed-Daten',              '2026-08-21', '2026-08-21', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', '', 'v2-ph-4'),
  ('v2-t43', 'task', 'Uebungskatalog-UI (Browse, Filter, Detail)',         '2026-08-22', '2026-08-23', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', '', 'v2-ph-4'),
  ('v2-t44', 'task', 'Gym-Plan-Editor (erstellen, reorder, speichern)',    '2026-08-24', '2026-08-25', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', '', 'v2-ph-4'),
  ('v2-t45', 'task', 'Gefuehrte Trainingseinheit (Schritt-fuer-Schritt)', '2026-08-26', '2026-08-27', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', '', 'v2-ph-4'),
  ('v2-t46', 'task', 'Workout-Protokoll (Log + Verlauf)',                  '2026-08-28', '2026-08-28', ARRAY['p-siavash'], 'v2-wp-4', '#c57d3e', 0, 'not_started', '', 'v2-ph-4'),

  -- Phase 4b: Anamnese & Tagebuch (parallel zu Phase 4)
  ('v2-t4b1', 'task', 'Migration 0006 anwenden (Art. 9, Anamnese, Tagebuch)',  '2026-08-19', '2026-08-19', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', '', 'v2-ph-4b'),
  ('v2-t4b2', 'task', 'Art. 9 Einwilligungsfluss (Consent-Screen)',           '2026-08-20', '2026-08-20', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', '', 'v2-ph-4b'),
  ('v2-t4b3', 'task', 'Anamnese-Fragebogen UI (Block A + B)',                 '2026-08-21', '2026-08-22', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', 'Block A: Pflicht (10 Schritte + Verletzungsdetails). Block B: freiwillig (2 Schritte).', 'v2-ph-4b'),
  ('v2-t4b4', 'task', 'Trainingstagebuch-Eintrag UI',                         '2026-08-21', '2026-08-22', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', '4 Taps: Gefuehl, Schmerz, Distanz, Dauer. Schmerzprotokoll mit Koerperstellen.', 'v2-ph-4b'),
  ('v2-t4b5', 'task', 'Tagebuch-Verlauf (einfache Historie)',                  '2026-08-23', '2026-08-23', ARRAY['p-siavash'], 'v2-wp-4b', '#2e8b7a', 0, 'not_started', '', 'v2-ph-4b'),

  -- Phase 5: Community (parallel zu Phase 4)
  ('v2-t51', 'task', 'Feed (Beitraege, Likes, Kommentare)',               '2026-08-23', '2026-08-26', ARRAY['p-siavash'], 'v2-wp-5', '#8b6dae', 0, 'not_started', '', 'v2-ph-5'),
  ('v2-t52', 'task', 'Gruppen (gruenden, beitreten, Fokus-Filter)',       '2026-08-27', '2026-08-29', ARRAY['p-siavash'], 'v2-wp-5', '#8b6dae', 0, 'not_started', '', 'v2-ph-5'),
  ('v2-t53', 'task', 'ZusammenLauf (Matching, Anfragen)',                  '2026-08-30', '2026-09-01', ARRAY['p-siavash'], 'v2-wp-5', '#8b6dae', 0, 'not_started', '', 'v2-ph-5'),
  ('v2-t54', 'task', 'Melden & Blockieren',                               '2026-08-27', '2026-08-28', ARRAY['p-siavash'], 'v2-wp-5', '#8b6dae', 0, 'not_started', '', 'v2-ph-5'),

  -- Phase 6: Smartwatch (parallel zu Phase 2-5)
  ('v2-t61', 'task', 'Google-OAuth-Verbindung (Edge Function)',            '2026-08-23', '2026-08-24', ARRAY['p-siavash'], 'v2-wp-6', '#5a8fa0', 0, 'not_started', '', 'v2-ph-6'),
  ('v2-t62', 'task', 'Google Fit Daten importieren',                       '2026-08-25', '2026-08-26', ARRAY['p-siavash'], 'v2-wp-6', '#5a8fa0', 0, 'not_started', '', 'v2-ph-6'),
  ('v2-t63', 'task', 'Verbindungsstatus-Screen',                          '2026-08-27', '2026-08-27', ARRAY['p-siavash'], 'v2-wp-6', '#5a8fa0', 0, 'not_started', '', 'v2-ph-6'),

  -- Phase 7: Testrunde
  ('v2-t71', 'task', 'PWA-Installation testen',                           '2026-08-29', '2026-08-29', ARRAY['p-siavash'], 'v2-wp-7', '#a08b6d', 0, 'not_started', 'Abhaengig von T5.4, T6.3 und T4.6.', 'v2-ph-7'),
  ('v2-t72', 'task', 'Datenschutzerklaerung veroeffentlichen',            '2026-08-30', '2026-08-30', ARRAY['p-siavash'], 'v2-wp-7', '#a08b6d', 0, 'not_started', '', 'v2-ph-7'),
  ('v2-t73', 'task', 'Testaufgaben + Feedback-Kanal',                     '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'v2-wp-7', '#a08b6d', 0, 'not_started', '', 'v2-ph-7'),

  -- Meilensteine
  ('v2-ms-go', 'milestone', 'Go-Live Testrunde',                          '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'v2-wp-7', '#6b5b3d', 0, 'not_started', 'Alle Phasen abgeschlossen, PWA installierbar, Datenschutzerklaerung live.', null)
on conflict (id) do nothing;

-- Dependencies (FS = Finish-to-Start)
insert into planner_dependencies (id, from_id, to_id, type, lag_days) values
  -- Phase 0 internal
  ('v2-dep-01', 'v2-t01', 'v2-t03', 'FS', 0),
  ('v2-dep-02', 'v2-t02', 'v2-t04', 'FS', 0),
  ('v2-dep-03', 'v2-t02', 'v2-t05', 'FS', 0),

  -- Phase 0 -> Phase 1
  ('v2-dep-04', 'v2-t03', 'v2-t11', 'FS', 0),

  -- Phase 1 internal
  ('v2-dep-05', 'v2-t11', 'v2-t12', 'FS', 0),
  ('v2-dep-06', 'v2-t11', 'v2-t13', 'FS', 0),
  ('v2-dep-07', 'v2-t12', 'v2-t14', 'FS', 0),

  -- Phase 1 -> Phase 2
  ('v2-dep-08', 'v2-t14', 'v2-t21', 'FS', 0),

  -- Phase 2 internal
  ('v2-dep-09', 'v2-t21', 'v2-t22', 'FS', 0),
  ('v2-dep-10', 'v2-t21', 'v2-t23', 'FS', 0),
  ('v2-dep-11', 'v2-t22', 'v2-t24', 'FS', 0),
  ('v2-dep-12', 'v2-t24', 'v2-t25', 'FS', 0),

  -- Phase 2 -> Phase 3
  ('v2-dep-13', 'v2-t25', 'v2-t31', 'FS', 0),

  -- Phase 3 internal
  ('v2-dep-14', 'v2-t31', 'v2-t32', 'FS', 0),
  ('v2-dep-15', 'v2-t31', 'v2-t33', 'FS', 0),

  -- Phase 0 -> Phase 4 (parallel branch)
  ('v2-dep-16', 'v2-t03', 'v2-t41', 'FS', 0),

  -- Phase 4 internal
  ('v2-dep-17', 'v2-t41', 'v2-t42', 'FS', 0),
  ('v2-dep-18', 'v2-t42', 'v2-t43', 'FS', 0),
  ('v2-dep-19', 'v2-t05', 'v2-t43', 'FS', 0),
  ('v2-dep-20', 'v2-t43', 'v2-t44', 'FS', 0),
  ('v2-dep-21', 'v2-t44', 'v2-t45', 'FS', 0),
  ('v2-dep-22', 'v2-t45', 'v2-t46', 'FS', 0),

  -- Phase 0 -> Phase 4b (parallel branch)
  ('v2-dep-36', 'v2-t03', 'v2-t4b1', 'FS', 0),

  -- Phase 4b internal
  ('v2-dep-37', 'v2-t4b1', 'v2-t4b2', 'FS', 0),
  ('v2-dep-38', 'v2-t05', 'v2-t4b2', 'FS', 0),
  ('v2-dep-39', 'v2-t4b2', 'v2-t4b3', 'FS', 0),
  ('v2-dep-40', 'v2-t4b2', 'v2-t4b4', 'FS', 0),
  ('v2-dep-41', 'v2-t4b4', 'v2-t4b5', 'FS', 0),

  -- Phase 1 -> Phase 5 (parallel branch)
  ('v2-dep-23', 'v2-t14', 'v2-t51', 'FS', 0),

  -- Phase 5 internal
  ('v2-dep-24', 'v2-t51', 'v2-t52', 'FS', 0),
  ('v2-dep-25', 'v2-t52', 'v2-t53', 'FS', 0),
  ('v2-dep-26', 'v2-t51', 'v2-t54', 'FS', 0),

  -- Phase 1 -> Phase 6 (parallel branch)
  ('v2-dep-27', 'v2-t14', 'v2-t61', 'FS', 0),

  -- Phase 6 internal
  ('v2-dep-28', 'v2-t61', 'v2-t62', 'FS', 0),
  ('v2-dep-29', 'v2-t62', 'v2-t63', 'FS', 0),

  -- Phase 4+4b+5+6 -> Phase 7
  ('v2-dep-30', 'v2-t54', 'v2-t71', 'FS', 0),
  ('v2-dep-31', 'v2-t63', 'v2-t71', 'FS', 0),
  ('v2-dep-32', 'v2-t46', 'v2-t71', 'FS', 0),
  ('v2-dep-42', 'v2-t4b5', 'v2-t71', 'FS', 0),

  -- Phase 7 internal
  ('v2-dep-33', 'v2-t71', 'v2-t72', 'FS', 0),
  ('v2-dep-34', 'v2-t72', 'v2-t73', 'FS', 0),

  -- Phase 7 -> Meilenstein
  ('v2-dep-35', 'v2-t73', 'v2-ms-go', 'FS', 0)
on conflict (id) do nothing;

-- Baseline snapshot
insert into planner_baseline (task_id, start_date, end_date) values
  ('v2-t01', '2026-08-17', '2026-08-17'),
  ('v2-t02', '2026-08-17', '2026-08-17'),
  ('v2-t03', '2026-08-18', '2026-08-18'),
  ('v2-t04', '2026-08-18', '2026-08-18'),
  ('v2-t05', '2026-08-18', '2026-08-18'),
  ('v2-t11', '2026-08-19', '2026-08-20'),
  ('v2-t12', '2026-08-21', '2026-08-21'),
  ('v2-t13', '2026-08-21', '2026-08-21'),
  ('v2-t14', '2026-08-22', '2026-08-22'),
  ('v2-t21', '2026-08-23', '2026-08-24'),
  ('v2-t22', '2026-08-25', '2026-08-25'),
  ('v2-t23', '2026-08-25', '2026-08-26'),
  ('v2-t24', '2026-08-26', '2026-08-26'),
  ('v2-t25', '2026-08-27', '2026-08-28'),
  ('v2-t31', '2026-08-29', '2026-08-30'),
  ('v2-t32', '2026-08-31', '2026-08-31'),
  ('v2-t33', '2026-08-31', '2026-09-01'),
  ('v2-t41', '2026-08-19', '2026-08-20'),
  ('v2-t42', '2026-08-21', '2026-08-21'),
  ('v2-t43', '2026-08-22', '2026-08-23'),
  ('v2-t44', '2026-08-24', '2026-08-25'),
  ('v2-t45', '2026-08-26', '2026-08-27'),
  ('v2-t46', '2026-08-28', '2026-08-28'),
  ('v2-t4b1', '2026-08-19', '2026-08-19'),
  ('v2-t4b2', '2026-08-20', '2026-08-20'),
  ('v2-t4b3', '2026-08-21', '2026-08-22'),
  ('v2-t4b4', '2026-08-21', '2026-08-22'),
  ('v2-t4b5', '2026-08-23', '2026-08-23'),
  ('v2-t51', '2026-08-23', '2026-08-26'),
  ('v2-t52', '2026-08-27', '2026-08-29'),
  ('v2-t53', '2026-08-30', '2026-09-01'),
  ('v2-t54', '2026-08-27', '2026-08-28'),
  ('v2-t61', '2026-08-23', '2026-08-24'),
  ('v2-t62', '2026-08-25', '2026-08-26'),
  ('v2-t63', '2026-08-27', '2026-08-27'),
  ('v2-t71', '2026-08-29', '2026-08-29'),
  ('v2-t72', '2026-08-30', '2026-08-30'),
  ('v2-t73', '2026-08-31', '2026-08-31'),
  ('v2-ms-go', '2026-08-31', '2026-08-31')
on conflict (task_id) do update set start_date = excluded.start_date, end_date = excluded.end_date, saved_at = now();

insert into planner_activity (id, ts, message, actor) values
  ('v2-act-import', now(), 'Bauplan v2 importiert: 35 Aufgaben + 1 Meilenstein, 42 Abhaengigkeiten, 9 Arbeitspakete (Phase 0-4b-7), Ressource Siavash, Start 17.08.2026. Phasen 4/4b/5/6 parallel moeglich. Phase 4b: Anamnese + Trainingstagebuch (Art. 9 DSGVO, nur Speicherung).', 'Claude')
on conflict (id) do nothing;
