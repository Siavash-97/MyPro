-- Auto-generated from MyProSole_Gantt_Sia_KI_Export_1.md (v2: 2 Arbeitstage/Woche, PS2-PS4)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Ersetzt eine eventuell schon ausgefuehrte v1-Version vollstaendig (DELETE vor INSERT),
-- damit keine veralteten sia-* Zeilen (z.B. die alte S13/S14b-Verdrahtung) liegen bleiben.
-- Termine sind ein Ausgangspunkt (2 Arbeitstage/Woche angenommen Mo/Mi, Worst-Case-Dauer bei
-- Spannen) - werden bewusst manuell im Tool nachjustiert, siehe Chat-Verlauf.

delete from planner_dependencies where id like 'sia-%';
delete from planner_baseline where task_id like 'sia-%';
delete from planner_tasks where id like 'sia-%';

insert into planner_work_packages (id, name, color) values
  ('sia-wp-app', 'Spur 1: App und Technik', '#e11d48'),
  ('sia-wp-training', 'Spur 2: Trainingsplanung und Konzepte', '#f59e0b'),
  ('sia-wp-einlage', 'Spur 3: Einlage, Material, Struktur, Design', '#0891b2'),
  ('sia-wp-proto', 'Spur 4: Prototyping und Fertigungspartner', '#7c3aed'),
  ('sia-wp-marke', 'Spur 5: Markenrecherche und Patent', '#be185d'),
  ('sia-wp-foerderung', 'Spur 6: Foerderung, Alternativen ohne Foerderung', '#65a30d')
on conflict (id) do update set name = excluded.name, color = excluded.color;

insert into planner_tasks (id, type, title, start_date, end_date, assignee_ids, work_package_id, color, progress, status, notes) values
  ('sia-s1', 'task', 'Markenfarbe, Design, Platzierung App/Plattform', '2026-08-17', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', '3 bis 5 Tage geschaetzt (Best/Worst Case), hier Worst Case eingeplant, da iterativ.'),
  ('sia-s2', 'task', 'Anforderungen App/Plattform definieren', '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', ''),
  ('sia-s3', 'task', 'Tech Stack im Team entscheiden', '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', ''),
  ('sia-s4', 'task', 'CSV-Format mit Bastian abstimmen', '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', 'Direkt an Bastians V1.2 (Master-CSV und Messverwaltung) gekoppelt - Format muss uebereinstimmen. Keine harte Ablaufreihenfolge im Quelldokument angegeben, daher nur als Hinweis, nicht als Abhaengigkeit hinterlegt.'),
  ('sia-s5', 'task', 'Server-Entscheidung', '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', ''),
  ('sia-s6', 'task', 'Sicherheitskonzept', '2026-08-31', '2026-09-02', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', '1 bis 2 Tage geschaetzt, Worst Case eingeplant.'),
  ('sia-s7', 'task', 'Bluetooth-MVP App: Empfang, Speicherung, Anzeige', '2026-09-02', '2026-10-21', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', '10 bis 15 Tage geschaetzt, Worst Case eingeplant. Direkt an Bastians V1.4/ZM2 gekoppelt (BLE-Transport-Nachweis) - keine harte Ablaufreihenfolge im Quelldokument angegeben, daher nur als Hinweis.'),
  ('sia-sdb', 'task', 'Datenbank fuer Testdaten aufbauen', '2026-09-02', '2026-09-14', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', '3 bis 4 Tage geschaetzt, Worst Case eingeplant.'),
  ('sia-ps1', 'task', 'Puffer: technische Unsicherheiten (Bluetooth-MVP/Datenbank)', '2026-10-21', '2026-10-28', ARRAY['p-siavash'], 'sia-wp-app', '#78716c', 0, 'not_started', '2 bis 3 Tage geschaetzt, Worst Case eingeplant. Kein fachlicher Vorgang, reine Kapazitaetsreserve.'),
  ('sia-as1', 'task', 'Funktionstest App inklusive Datenbank', '2026-10-28', '2026-10-28', ARRAY['p-siavash'], 'sia-wp-app', '#e11d48', 0, 'not_started', 'Abnahme.'),
  ('sia-smb', 'milestone', 'App inklusive Datenbank fertig', '2026-10-28', '2026-10-28', ARRAY['p-siavash'], 'sia-wp-app', '#9f1239', 0, 'not_started', 'Muss vor Bastians ZM2 (BLE-Transport nachgewiesen, 19.10.2026) erreicht sein - sonst liegen ab dann Daten vor, die niemand empfangen/auswerten kann. Siehe echte Abhaengigkeit auf g-zm2.'),
  ('sia-ps2', 'task', 'Puffer: Verzoegerungen bei Bastian und Nacharbeiten an der App', '2026-10-28', '2026-11-11', ARRAY['p-siavash'], 'sia-wp-app', '#78716c', 0, 'not_started', '2 Wochen (fixer Wert, keine Spanne im Quelldokument). Reiner Wartepuffer, keine aktive Arbeit - daher in Kalenderzeit statt Arbeitstagen gerechnet.'),
  ('sia-s8', 'task', 'Katalog der Auffaelligkeiten definieren', '2026-08-17', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-training', '#f59e0b', 0, 'not_started', ''),
  ('sia-s9', 'task', 'Datenquellen und Logik je Auffaelligkeit', '2026-08-19', '2026-08-26', ARRAY['p-siavash'], 'sia-wp-training', '#f59e0b', 0, 'not_started', ''),
  ('sia-s10', 'task', 'Uebungsempfehlungen je Auffaelligkeit sammeln', '2026-08-19', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-training', '#f59e0b', 0, 'not_started', ''),
  ('sia-s11', 'task', 'Hierarchie der Regeln festlegen', '2026-08-31', '2026-08-31', ARRAY['p-siavash'], 'sia-wp-training', '#f59e0b', 0, 'not_started', ''),
  ('sia-s12', 'task', 'Feedback von Trainern und Laeufern einholen', '2026-08-31', '2026-09-02', ARRAY['p-siavash'], 'sia-wp-training', '#f59e0b', 0, 'not_started', ''),
  ('sia-smc', 'milestone', 'Trainingsplanung und Konzepte stehen', '2026-09-02', '2026-09-02', ARRAY['p-siavash'], 'sia-wp-training', '#b45309', 0, 'not_started', ''),
  ('sia-s13', 'task', 'Material fuer Einlage recherchieren, inklusive Kosten', '2026-11-11', '2026-11-16', ARRAY['p-siavash'], 'sia-wp-einlage', '#0891b2', 0, 'not_started', ''),
  ('sia-s14a', 'task', '3D-Design Einlage: Grobkonzept, Struktur', '2026-11-16', '2026-11-25', ARRAY['p-siavash'], 'sia-wp-einlage', '#0891b2', 0, 'not_started', '3 bis 4 Tage geschaetzt, Worst Case eingeplant.'),
  ('sia-ps3', 'task', 'Wartepuffer bis Bastians V1.7 abgeschlossen ist', '2026-11-25', '2026-12-30', ARRAY['p-siavash'], 'sia-wp-einlage', '#78716c', 0, 'not_started', '4 bis 5 Wochen geschaetzt, Worst Case eingeplant. Keine aktive Arbeit an S14b vorher sinnvoll (Quelldokument). Reiner Wartepuffer, in Kalenderzeit gerechnet.'),
  ('sia-s14b', 'task', '3D-Design Einlage: Feinschliff, Batterie-/Sensor-Platzierung', '2026-12-30', '2027-01-06', ARRAY['p-siavash'], 'sia-wp-einlage', '#0891b2', 0, 'not_started', '2 bis 3 Tage geschaetzt, Worst Case eingeplant. Darf laut Quelldokument erst nach Bastians V1.7 (Verbrauchs-, Energie- und Bauraumanalyse, Ende ca. 21.12.2026) starten - echte Abhaengigkeit auf g-v17 zusaetzlich zum geschaetzten Wartepuffer PS3 hinterlegt (je nachdem, was spaeter eintrifft).'),
  ('sia-smd3', 'milestone', 'Einlagen-Design finalisiert', '2027-01-06', '2027-01-06', ARRAY['p-siavash'], 'sia-wp-einlage', '#155e75', 0, 'not_started', 'Nach Bastians V1.7 (Bauraumanalyse).'),
  ('sia-s15', 'task', 'Firmen kontaktieren: Bunnert, Spanrit nachfassen, weitere suchen', '2026-11-16', '2026-11-18', ARRAY['p-siavash'], 'sia-wp-proto', '#7c3aed', 0, 'not_started', '1 bis 2 Tage geschaetzt, Worst Case eingeplant.'),
  ('sia-s16', 'task', 'Fertigungspartner auswaehlen', '2026-11-25', '2026-11-30', ARRAY['p-siavash'], 'sia-wp-proto', '#7c3aed', 0, 'not_started', '1 bis 2 Tage geschaetzt, Worst Case eingeplant.'),
  ('sia-sp1', 'task', 'Prototyp mit integrierten Sensoren beauftragen und begleiten', '2027-01-06', '2027-01-13', ARRAY['p-siavash'], 'sia-wp-proto', '#7c3aed', 0, 'not_started', '2 bis 3 Tage aktive Arbeit geschaetzt, Worst Case eingeplant. Zusaetzlich externe Wartezeit beim Hersteller, die hier nicht als Arbeitstage von Sia eingeplant ist.'),
  ('sia-smp', 'milestone', 'Prototyp mit integrierten Sensoren beauftragt', '2027-01-13', '2027-01-13', ARRAY['p-siavash'], 'sia-wp-proto', '#5b21b6', 0, 'not_started', 'Aktive Arbeit von Sia abgeschlossen; die eigentliche Fertigung laeuft extern weiter (nicht in Arbeitstagen planbar).'),
  ('sia-s35', 'task', 'Patentrecherche, bestehende Schutzrechte', '2026-08-17', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-marke', '#be185d', 0, 'not_started', ''),
  ('sia-s36', 'task', 'Schutzform festlegen', '2026-08-19', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-marke', '#be185d', 0, 'not_started', ''),
  ('sia-s17', 'task', 'Markenrecht pruefen und anmelden', '2026-08-19', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-marke', '#be185d', 0, 'not_started', ''),
  ('sia-smm', 'milestone', 'Marke und Patent geklaert', '2026-08-19', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-marke', '#831843', 0, 'not_started', ''),
  ('sia-s30', 'task', 'Recherche Alternativen ohne Foerderung, andere Foerdermoeglichkeiten, Investoren', '2026-08-17', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-foerderung', '#65a30d', 0, 'not_started', ''),
  ('sia-smf', 'milestone', 'Alternativen ohne Foerderung geklaert', '2026-08-19', '2026-08-19', ARRAY['p-siavash'], 'sia-wp-foerderung', '#3f6212', 0, 'not_started', ''),
  ('sia-ps4', 'task', 'Generalpuffer vor Zieltermin: Verzoegerungen, unerwartete Aufgaben, Rueckmeldungen von aussen', '2027-01-13', '2027-02-03', ARRAY['p-siavash'], NULL, '#78716c', 0, 'not_started', '2 bis 3 Wochen geschaetzt, Worst Case eingeplant. Reiner Wartepuffer, in Kalenderzeit gerechnet. Keiner Spur zugeordnet (Quelldokument: "Spur: -"), haengt von allen drei verbleibenden Meilensteinen ab.')
;

insert into planner_dependencies (id, from_id, to_id, type, lag_days) values
  ('sia-dep-1', 'sia-s1', 'sia-s2', 'FS', 0),
  ('sia-dep-2', 'sia-s2', 'sia-s3', 'FS', 0),
  ('sia-dep-3', 'sia-s3', 'sia-s4', 'FS', 0),
  ('sia-dep-4', 'sia-s3', 'sia-s5', 'FS', 0),
  ('sia-dep-5', 'sia-s4', 'sia-s6', 'FS', 0),
  ('sia-dep-6', 'sia-s6', 'sia-s7', 'FS', 0),
  ('sia-dep-7', 'sia-s6', 'sia-sdb', 'FS', 0),
  ('sia-dep-8', 'sia-s7', 'sia-ps1', 'FS', 0),
  ('sia-dep-9', 'sia-sdb', 'sia-ps1', 'FS', 0),
  ('sia-dep-10', 'sia-ps1', 'sia-as1', 'FS', 0),
  ('sia-dep-11', 'sia-as1', 'sia-smb', 'FS', 0),
  ('sia-dep-12', 'sia-smb', 'sia-ps2', 'FS', 0),
  ('sia-dep-13', 'sia-s8', 'sia-s9', 'FS', 0),
  ('sia-dep-14', 'sia-s8', 'sia-s10', 'FS', 0),
  ('sia-dep-15', 'sia-s9', 'sia-s11', 'FS', 0),
  ('sia-dep-16', 'sia-s10', 'sia-s11', 'FS', 0),
  ('sia-dep-17', 'sia-s11', 'sia-s12', 'FS', 0),
  ('sia-dep-18', 'sia-s12', 'sia-smc', 'FS', 0),
  ('sia-dep-19', 'sia-ps2', 'sia-s13', 'FS', 0),
  ('sia-dep-20', 'sia-s13', 'sia-s14a', 'FS', 0),
  ('sia-dep-21', 'sia-s14a', 'sia-ps3', 'FS', 0),
  ('sia-dep-22', 'sia-ps3', 'sia-s14b', 'FS', 0),
  ('sia-dep-23', 'g-v17', 'sia-s14b', 'FS', 0),
  ('sia-dep-24', 'sia-s14b', 'sia-smd3', 'FS', 0),
  ('sia-dep-25', 'sia-s13', 'sia-s15', 'FS', 0),
  ('sia-dep-26', 'sia-s15', 'sia-s16', 'FS', 0),
  ('sia-dep-27', 'sia-s14a', 'sia-s16', 'FS', 0),
  ('sia-dep-28', 'sia-s16', 'sia-sp1', 'FS', 0),
  ('sia-dep-29', 'sia-s14b', 'sia-sp1', 'FS', 0),
  ('sia-dep-30', 'sia-sp1', 'sia-smp', 'FS', 0),
  ('sia-dep-31', 'sia-s35', 'sia-s36', 'FS', 0),
  ('sia-dep-32', 'sia-s36', 'sia-s17', 'FS', 0),
  ('sia-dep-33', 'sia-s17', 'sia-smm', 'FS', 0),
  ('sia-dep-34', 'sia-s30', 'sia-smf', 'FS', 0),
  ('sia-dep-35', 'sia-smp', 'sia-ps4', 'FS', 0),
  ('sia-dep-36', 'sia-smm', 'sia-ps4', 'FS', 0),
  ('sia-dep-37', 'sia-smf', 'sia-ps4', 'FS', 0),
  ('sia-dep-38', 'sia-smb', 'g-zm2', 'FS', 0)
;

insert into planner_baseline (task_id, start_date, end_date) values
  ('sia-s1', '2026-08-17', '2026-08-31'),
  ('sia-s2', '2026-08-31', '2026-08-31'),
  ('sia-s3', '2026-08-31', '2026-08-31'),
  ('sia-s4', '2026-08-31', '2026-08-31'),
  ('sia-s5', '2026-08-31', '2026-08-31'),
  ('sia-s6', '2026-08-31', '2026-09-02'),
  ('sia-s7', '2026-09-02', '2026-10-21'),
  ('sia-sdb', '2026-09-02', '2026-09-14'),
  ('sia-ps1', '2026-10-21', '2026-10-28'),
  ('sia-as1', '2026-10-28', '2026-10-28'),
  ('sia-smb', '2026-10-28', '2026-10-28'),
  ('sia-ps2', '2026-10-28', '2026-11-11'),
  ('sia-s8', '2026-08-17', '2026-08-19'),
  ('sia-s9', '2026-08-19', '2026-08-26'),
  ('sia-s10', '2026-08-19', '2026-08-31'),
  ('sia-s11', '2026-08-31', '2026-08-31'),
  ('sia-s12', '2026-08-31', '2026-09-02'),
  ('sia-smc', '2026-09-02', '2026-09-02'),
  ('sia-s13', '2026-11-11', '2026-11-16'),
  ('sia-s14a', '2026-11-16', '2026-11-25'),
  ('sia-ps3', '2026-11-25', '2026-12-30'),
  ('sia-s14b', '2026-12-30', '2027-01-06'),
  ('sia-smd3', '2027-01-06', '2027-01-06'),
  ('sia-s15', '2026-11-16', '2026-11-18'),
  ('sia-s16', '2026-11-25', '2026-11-30'),
  ('sia-sp1', '2027-01-06', '2027-01-13'),
  ('sia-smp', '2027-01-13', '2027-01-13'),
  ('sia-s35', '2026-08-17', '2026-08-19'),
  ('sia-s36', '2026-08-19', '2026-08-19'),
  ('sia-s17', '2026-08-19', '2026-08-19'),
  ('sia-smm', '2026-08-19', '2026-08-19'),
  ('sia-s30', '2026-08-17', '2026-08-19'),
  ('sia-smf', '2026-08-19', '2026-08-19'),
  ('sia-ps4', '2027-01-13', '2027-02-03')
on conflict (task_id) do update set start_date = excluded.start_date, end_date = excluded.end_date, saved_at = now();

insert into planner_activity (id, ts, message, actor) values
  ('sia-act-import-v2', now(), 'Sia-Gantt-Plan aktualisiert (v2): 34 Vorgaenge/Meilensteine/Puffer, 38 Abhaengigkeiten, 6 Spuren + 1 spurenloser Generalpuffer (PS4), Kapazitaet auf 2 Arbeitstage/Woche gesenkt, drei neue Pufferbloecke (PS2/PS3/PS4) ergaenzt. Ersetzt v1 vollstaendig.', 'Claude')
on conflict (id) do nothing;
