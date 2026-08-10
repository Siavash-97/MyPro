-- Auto-generated from MyProSole_Gantt_KI_Export_10Prozent.md
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Idempotent: safe to re-run, uses ON CONFLICT DO NOTHING / DO UPDATE on new 'g-' prefixed ids
-- that do not clash with any existing rows.

insert into planner_work_packages (id, name, color) values
  ('g-wp-ref', 'Referenzsystem bis MS1', '#059669'),
  ('g-wp-hw', 'Hardware-Vorauswahl bis MS2', '#4338ca')
on conflict (id) do nothing;

insert into planner_tasks (id, type, title, start_date, end_date, assignee_ids, work_package_id, color, progress, status, notes) values
  ('g-v11', 'task', 'IMU-Integration', '2026-08-17', '2026-09-01', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'I2C-Kommunikation und Bibliothek integrieren (5,4h); BMI270 konfigurieren und Sensordaten auslesen (5,4h); gleichzeitige FSR-/IMU-Erfassung und gemeinsame Zeitstempel umsetzen (7,2h); Messfrequenz pruefen, Achsen dokumentieren und Testmessungen durchfuehren (7,2h). Ergebnis: Ein Prototyp erfasst drei FSR-Kanaele sowie Beschleunigung und Gyroskop des BMI270 mit gemeinsamen Zeitstempeln.'),
  ('g-v12', 'task', 'Master-CSV und Messverwaltung', '2026-09-01', '2026-09-15', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Gemeinsame CSV-Struktur im Langformat und Metadaten festlegen (3,6h); automatische Messungsnummer und Dateiverwaltung implementieren (5,4h); Start-/Stopp-Ablauf, Datenpuffer und korrektes Dateischliessen umsetzen (7,2h); Verhalten bei fehlender/voller/fehlerhafter SD-Karte definieren (3,6h); zehn aufeinanderfolgende Messungen testen und dokumentieren (5,4h). Ergebnis: Der Master legt pro Messung eine neue Datei wie M0001.csv an, ueberschreibt keine Messungen, schliesst jede Messung definiert ab; Format ist auf zusaetzliche Slave-Zeilen vorbereitet.'),
  ('g-v13', 'task', 'RGBW-LED', '2026-09-15', '2026-09-22', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Genauen WS281x-/RGBW-Typ und geeignete Bibliothek bestimmen (2,7h); Grundansteuerung und RGBW-Kanalreihenfolge testen (2,7h); nicht blockierende Status- und Fehlermuster implementieren (3,6h); Funktionstest und Dokumentation (1,8h). Ergebnis: Die RGBW-LED zeigt definierte Betriebs- und Fehlerzustaende zuverlaessig an.'),
  ('g-a1', 'task', 'Abnahmetest Einzelprototyp', '2026-09-22', '2026-09-24', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Gemeinsamen Funktionstest von IMU, drei FSR-Kanaelen, SD-Aufzeichnung, Messverwaltung und RGBW-LED durchfuehren.'),
  ('g-zm1', 'milestone', 'Einzelprototyp funktionsfaehig', '2026-09-24', '2026-09-24', ARRAY['p-bastian'], 'g-wp-ref', '#047857', 0, 'not_started', 'Erreicht, wenn der einzelne Master drei FSR-Sensoren und den BMI270 erfasst, mehrere Messungen ohne Ueberschreiben speichert, eine definierte Start-/Stopp-Logik besitzt und die RGBW-LED zuverlaessig ansteuert.'),
  ('g-v14', 'task', 'BLE, RAM-Puffer und Wiederholungsuebertragung', '2026-09-24', '2026-10-17', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'BLE-Architektur, Service, Characteristics und Paketformat festlegen (5,4h); Central-/Peripheral-Verbindung und Befehle implementieren (7,2h); synthetische Daten uebertragen und Paketnummerierung implementieren (5,4h); Ringpuffer, Wiederholungsanforderung und Dublettenerkennung implementieren (12,6h); kuenstliche Paketverluste sowie Ueberlauf und Stabilitaet testen (9,0h). Ergebnis: Zwei Controller bauen eine BLE-Verbindung auf, uebertragen Befehle und synthetische Daten und koennen noch gepufferte fehlende Pakete erneut uebertragen.'),
  ('g-a2', 'task', 'Abnahmetest BLE-Transport', '2026-10-17', '2026-10-19', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Verbindungsaufbau, Befehlsuebertragung, Paketverlust, Wiederholungsuebertragung, Dublettenerkennung und Pufferueberlauf pruefen.'),
  ('g-zm2', 'milestone', 'BLE-Transport nachgewiesen', '2026-10-19', '2026-10-19', ARRAY['p-bastian'], 'g-wp-ref', '#047857', 0, 'not_started', 'Erreicht, wenn der Master Befehle senden, der Slave synthetische nummerierte Datenpakete uebertragen und das System fehlende bzw. doppelte Pakete korrekt behandeln kann.'),
  ('g-v15', 'task', 'Slave-Hardware und Buildvarianten', '2026-10-19', '2026-11-03', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Slave-Hardware ohne SD-Karte aufbauen (7,2h); Stromversorgung, drei FSR-Sensoren, BMI270 und RGBW-LED in Betrieb nehmen (7,2h); gemeinsame Codebasis mit getrenntem Master-/Slave-Build strukturieren (7,2h); Geraete-ID, Seitenzuordnung und Hardwarestand dokumentieren (3,6h). Ergebnis: Eine zweite, bis auf die fehlende SD-Karte baugleiche Referenzhardware ist als Slave betriebsbereit; Master/Slave aus derselben Codebasis baubar.'),
  ('g-v16', 'task', 'Synchronisation und gemeinsame CSV', '2026-11-03', '2026-12-04', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Reale FSR-/IMU-Daten paketieren und mehrere Samples pro BLE-Paket buendeln (10,8h); gemeinsamen Messstart, Messstopp und Messungs-ID umsetzen (5,4h); Zeitoffset, Clock-Drift und korrigierte Zeitstempel umsetzen und untersuchen (14,4h); Master-/Slave-Daten in eine gemeinsame CSV im Langformat schreiben (7,2h); Wiederholungen, verspaetete Pakete, Reihenfolge und Dubletten behandeln (5,4h); Datenraten-, Langzeit- und Belastungstests durchfuehren und dokumentieren (10,8h). Ergebnis: Der Slave uebertraegt reale Sensordaten an den Master; der Master speichert beide Datenstroeme in einer gemeinsamen CSV mit Quellenkennung und korrigiertem Zeitstempel.'),
  ('g-v17', 'task', 'Verbrauchs-, Energie- und Bauraumanalyse', '2026-12-04', '2026-12-21', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Messaufbau und Messplan vorbereiten (3,6h); Master-/Slave-Betriebszustaende inkl. BLE/SD/LED vermessen (10,8h); Energie pro typischer Messung und grobe Akkulaufzeit bestimmen (4,5h); Komponenten und verfuegbaren physischen Bauraum vermessen (4,5h); Hauptverbraucher, Stromspitzen, Einsparpotenziale und Bauraumgrenzen auswerten und dokumentieren (5,4h). Ergebnis: Messbericht mit mittlerer Stromaufnahme, Stromspitzen, Energiebedarf pro Messung, grober Akkulaufzeit, Hauptverbrauchern, energieintensiven Softwareereignissen und Bauraumgrenzen.'),
  ('g-p1', 'task', 'Technischer Risikopuffer', '2026-12-21', '2027-01-03', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Kapazitaetsreserve fuer BLE-Verbindungsprobleme, unzureichende Datenrate, Synchronisationsfehler, parallele BLE-/SD-Probleme sowie unerwartete Hardware-/Bibliotheksprobleme. Der Puffer ist keine zusaetzliche fachliche Aufgabe.'),
  ('g-a3', 'task', 'Systemabnahme MS1', '2027-01-03', '2027-01-07', ARRAY['p-bastian'], 'g-wp-ref', '#059669', 0, 'not_started', 'Vollstaendige Master-/Slave-Messung durchfuehren; gemeinsame CSV kontrollieren; Synchronisationsabweichung und Drift auswerten; Wiederholungsuebertragung gezielt testen; Strom-, Energie- und Bauraumergebnisse pruefen; Firmware- und Hardwarestand festhalten; offene Fehler dokumentieren.'),
  ('g-ms1', 'milestone', 'Synchronisiertes Referenzsystem erreicht', '2027-01-07', '2027-01-07', ARRAY['p-bastian'], 'g-wp-ref', '#047857', 0, 'not_started', 'MS1 ist erreicht, wenn: 1) Master und Slave je drei FSR-Sensoren und eine IMU erfassen; 2) nur der Master eine SD-Karte besitzt; 3) der Slave seine Sensordaten per BLE an den Master ueberträgt; 4) der Master eigene und empfangene Daten in einer gemeinsamen CSV speichert; 5) Messungen eindeutig nummeriert und ohne Ueberschreiben angelegt werden; 6) Messstart/-stopp vom Master gesteuert werden; 7) Zeitoffset und Clock-Drift bekannt sind; 8) Paketluecken erkannt und, solange im RAM vorhanden, erneut uebertragen werden; 9) nicht wiederherstellbare Luecken und Pufferueberlaeufe dokumentiert werden; 10) Master-/Slave-Firmware aus derselben Codebasis gebaut werden; 11) Master/Slave, links/rechts und Geraete-ID getrennt konfigurierbar sind; 12) die RGBW-LED auf beiden Geraeten funktioniert; 13) Stromaufnahme, Stromspitzen, Hauptverbraucher und energieintensive Softwareereignisse bekannt sind; 14) Hardwareabmessungen und verfuegbarer Bauraum dokumentiert sind.'),
  ('g-z1', 'task', 'Anforderungen naechste Hardwaregeneration', '2027-01-07', '2027-01-13', ARRAY['p-bastian'], 'g-wp-hw', '#4338ca', 0, 'not_started', 'Technische Anforderungen aus MS1 ableiten (7,2h); Bewertungskriterien und Gewichtung festlegen (3,6h). Ergebnis: Abgestimmter Anforderungssatz fuer die vollstaendige Hardware-Vorauswahl.'),
  ('g-z2', 'task', 'Vollstaendige Hardwareuntersuchung', '2027-01-13', '2027-02-03', ARRAY['p-bastian'], 'g-wp-hw', '#4338ca', 0, 'not_started', 'Controller und BLE-Plattform untersuchen (7,2h); FSR, Analog-Frontend und ADC untersuchen (7,2h); BMI270 und alternative IMUs untersuchen (5,4h); Speicher, Akku, Laden und Spannungsversorgung untersuchen (7,2h); Bauform, Steckverbinder und flexible Leiterplatten untersuchen (5,4h); Kosten, Verfuegbarkeit und technische Risiken bewerten (3,6h). Ergebnis: Vergleich der relevanten Komponenten und Systemansaetze fuer die naechste Hardwaregeneration.'),
  ('g-z3', 'task', 'Plattformvarianten und Entscheidungsmatrix', '2027-02-03', '2027-02-14', ARRAY['p-bastian'], 'g-wp-hw', '#4338ca', 0, 'not_started', 'Zwei bis drei vollstaendige Systemvarianten ausarbeiten (7,2h); gewichtete Entscheidungsmatrix erstellen (5,4h); Vorzugsvariante, Rueckfallvariante und notwendige Tests dokumentieren (5,4h). Ergebnis: Bewertete Hardware-Shortlist mit Vorzugs- und Rueckfallvariante.'),
  ('g-a4', 'task', 'Abnahme Hardware-Shortlist', '2027-02-14', '2027-02-16', ARRAY['p-bastian'], 'g-wp-hw', '#4338ca', 0, 'not_started', 'Ergebnisse pruefen; Shortlist festhalten; offene Machbarkeitstests fuer die Foerderphase definieren.'),
  ('g-ms2', 'milestone', 'Hardwarekandidaten eingegrenzt', '2027-02-16', '2027-02-16', ARRAY['p-bastian'], 'g-wp-hw', '#3730a3', 0, 'not_started', 'Erreicht, wenn die Anforderungen dokumentiert, alle wesentlichen Hardwarebereiche untersucht, zwei bis drei vollstaendige Varianten bewertet, Risiken benannt und eine Vorzugs- sowie Rueckfallvariante festgelegt sind.')
on conflict (id) do nothing;

insert into planner_dependencies (id, from_id, to_id, type, lag_days) values
  ('g-dep-1', 'g-v11', 'g-v12', 'FS', 0),
  ('g-dep-2', 'g-v12', 'g-v13', 'FS', 0),
  ('g-dep-3', 'g-v13', 'g-a1', 'FS', 0),
  ('g-dep-4', 'g-a1', 'g-zm1', 'FS', 0),
  ('g-dep-5', 'g-zm1', 'g-v14', 'FS', 0),
  ('g-dep-6', 'g-v14', 'g-a2', 'FS', 0),
  ('g-dep-7', 'g-a2', 'g-zm2', 'FS', 0),
  ('g-dep-8', 'g-zm2', 'g-v15', 'FS', 0),
  ('g-dep-9', 'g-v15', 'g-v16', 'FS', 0),
  ('g-dep-10', 'g-v16', 'g-v17', 'FS', 0),
  ('g-dep-11', 'g-v17', 'g-p1', 'FS', 0),
  ('g-dep-12', 'g-p1', 'g-a3', 'FS', 0),
  ('g-dep-13', 'g-a3', 'g-ms1', 'FS', 0),
  ('g-dep-14', 'g-ms1', 'g-z1', 'FS', 0),
  ('g-dep-15', 'g-z1', 'g-z2', 'FS', 0),
  ('g-dep-16', 'g-z2', 'g-z3', 'FS', 0),
  ('g-dep-17', 'g-z3', 'g-a4', 'FS', 0),
  ('g-dep-18', 'g-a4', 'g-ms2', 'FS', 0)
on conflict (id) do nothing;

insert into planner_baseline (task_id, start_date, end_date) values
  ('g-v11', '2026-08-17', '2026-09-01'),
  ('g-v12', '2026-09-01', '2026-09-15'),
  ('g-v13', '2026-09-15', '2026-09-22'),
  ('g-a1', '2026-09-22', '2026-09-24'),
  ('g-zm1', '2026-09-24', '2026-09-24'),
  ('g-v14', '2026-09-24', '2026-10-17'),
  ('g-a2', '2026-10-17', '2026-10-19'),
  ('g-zm2', '2026-10-19', '2026-10-19'),
  ('g-v15', '2026-10-19', '2026-11-03'),
  ('g-v16', '2026-11-03', '2026-12-04'),
  ('g-v17', '2026-12-04', '2026-12-21'),
  ('g-p1', '2026-12-21', '2027-01-03'),
  ('g-a3', '2027-01-03', '2027-01-07'),
  ('g-ms1', '2027-01-07', '2027-01-07'),
  ('g-z1', '2027-01-07', '2027-01-13'),
  ('g-z2', '2027-01-13', '2027-02-03'),
  ('g-z3', '2027-02-03', '2027-02-14'),
  ('g-a4', '2027-02-14', '2027-02-16'),
  ('g-ms2', '2027-02-16', '2027-02-16')
on conflict (task_id) do update set start_date = excluded.start_date, end_date = excluded.end_date, saved_at = now();

insert into planner_activity (id, ts, message, actor) values
  ('g-act-import', now(), 'Gantt-Plan aus MyProSole_Gantt_KI_Export_10Prozent.md importiert: 19 Vorgaenge/Meilensteine, 18 Abhaengigkeiten, 2 Arbeitspakete (Referenzsystem bis MS1 / Hardware-Vorauswahl bis MS2), Ressource Bastian, 12h/Woche, Start 17.08.2026.', 'Claude')
on conflict (id) do nothing;
