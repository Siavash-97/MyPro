-- Auto-generated from MyProSole_Pitch_Hardware_2026-10-05.md.
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Adds the new Pitch-Hardware plan (7 work packages, 29 tasks, 1 milestone
-- PH, its 13-point acceptance checklist) WITHOUT touching any existing
-- task, dependency, work package or milestone -- purely additive, matching
-- the "on conflict do nothing" pattern of the earlier gantt-import files.
--
-- Placeholder dates, on purpose: the source document explicitly forbids
-- inventing effort/duration ("Fehlende Werte sind NICHT 0" -- missing
-- values are NOT 0) until the three open questions in its final section
-- are answered (current implementation status, Sia's real weekly
-- capacity, who owns R01). Every new task below gets the same single
-- placeholder date, 2026-09-14 (the first day of the three available
-- work weeks named in the doc) -- not a schedule, just a valid non-null
-- date so the row can exist. Only the milestone PH keeps its real,
-- doc-given deadline (2026-10-05). No planner_baseline rows are inserted
-- for this import for the same reason: a baseline is a committed-schedule
-- snapshot, and there is deliberately no committed schedule yet.

insert into planner_work_packages (id, name, color) values
  ('ph-wp-ziel1', 'PH Ziel 1 - Zweiter Prototyp (linker Fuss)', '#b45309'),
  ('ph-wp-ziel2', 'PH Ziel 2 - Master-/Slave-Firmware und Kommunikation', '#1d4ed8'),
  ('ph-wp-grundlage', 'PH Gemeinsame Grundlage - Datenformat fuer Sia', '#0f766e'),
  ('ph-wp-ziel3', 'PH Ziel 3 - Auswertetool fuer die gemeinsame CSV', '#9333ea'),
  ('ph-wp-ziel4', 'PH Ziel 4 - Live-Plot beider Sohlen', '#c026d3'),
  ('ph-wp-redesign', 'PH Unabhaengig - Case-Redesign', '#78716c'),
  ('ph-wp-abnahme', 'PH Gemeinsame Pitch-Abnahme', '#dc2626')
on conflict (id) do nothing;

insert into planner_tasks (id, type, title, start_date, end_date, assignee_ids, work_package_id, color, progress, status, notes) values
  ('H01', 'task', 'Bauteile, Platine, Kabellaengen, Pinbelegung, Sensorpositionen und vorhandenen Case-Stand pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Vollstaendige Baugrundlage; fehlendes Material und Lieferzeiten sind sichtbar. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H02', 'task', 'Kabel und Sensorleitungen herstellen, beschriften und elektrisch pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Passende Kabel mit geprueften Durchgang und Anschlussbelegung liegen vor. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H03', 'task', 'Platine mit Komponenten bestuecken und elektrisch in Betrieb nehmen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Versorgung und Anschluesse sind geprueft; der Controller ist programmierbar. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H04', 'task', 'Vorhandenes Case drucken und Passform pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Verwendbares Case passend zur linken Baugruppe liegt vor; Druckzeit ist als Maschinenlaufzeit gesondert zu erfassen. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H05', 'task', 'Sensoren vor dem Verkleben mit Platine und Leitungen auf Funktion pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Alle vorgesehenen Sensoren liefern plausible Werte. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H06', 'task', 'Sohle aufbauen, Sensoren einkleben und Leitungen verlegen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Sensorpositionen und Kabelfuehrung sind fixiert; Aushaertezeit des Klebers ist bei Bedarf als Wartezeit zu erfassen. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('H07', 'task', 'Elektronik und Case montieren, Zugentlastung herstellen und linken Prototyp pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel1', '#b45309', 0, 'not_started', 'Fertiger linker Prototyp mit dokumentierter Sensorzuordnung und geprueftem Sitz. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F01', 'task', 'Gemeinsame Codebasis fuer Master- und Slave-Build konfigurieren', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Getrennte Builds; Rolle, Fussseite und Geraetekennung sind eindeutig konfiguriert. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F02', 'task', 'Flashen und Diagnose fuer zwei angeschlossene Controller einrichten', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Beide Geraete sind ueber feste Port-/Geraetezuordnung gezielt flashbar; getrennte Logs sind nutzbar. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F03', 'task', 'BLE-Verbindung und Handshake mit Testcontrollern implementieren', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Geraete erkennen ihren Partner, pruefen Kennung/Protokollversion und melden Bereit- bzw. Fehlerstatus. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F04', 'task', 'Nummerierte Testdatenpakete uebertragen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Master empfaengt Testdaten mit Quelle, Zeitstempel und Sequenznummer; Sensorhardware ist dafuer noch nicht erforderlich. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F05', 'task', 'Gemeinsamen Messstart, Messstopp und Messungs-ID umsetzen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Beide Geraete quittieren eine gemeinsame Messung; fehlende Bereitschaft und Verbindungsabbruch fuehren zu definiertem Verhalten. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F06', 'task', 'Zeitbasis synchronisieren und Abweichung bestimmen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Slave-Zeitstempel werden auf die Master-Zeitbasis bezogen; Offset und Drift werden ueber die vereinbarte Demodauer gemessen. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F07', 'task', 'Kurzen RAM-Puffer, Nachforderung und Dublettenerkennung integrieren', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Fehlende Pakete werden im Pufferfenster erneut uebertragen; dauerhafte Luecken und Ueberlaeufe bleiben sichtbar. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('F08', 'task', 'Reale Daten beider Sohlen integrieren und gemeinsam als CSV speichern', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel2', '#1d4ed8', 0, 'not_started', 'Reale FSR-/IMU-Daten beider Fuesse mit Zeit- und Quellenzuordnung liegen in einer CSV auf der Master-SD vor. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('D01', 'task', 'CSV- und Live-Datenfelder festlegen und synthetische Beispieldaten erstellen', '2026-09-14', '2026-09-14', ARRAY['p-bastian', 'p-siavash'], 'ph-wp-grundlage', '#0f766e', 0, 'not_started', 'Formatversion, Messungs-ID, Geraetekennung, Fussseite, Zeitbasis, Einheiten, Achsen, Sequenznummern und Status/Luecken sind definiert; Beispielwerte enthalten beide Fuesse und einen Verlustfall. Bastian fuehrt, Sia prueft. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('A01', 'task', 'CSV-Import und Feldpruefung auf das vereinbarte Format anpassen', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel3', '#9333ea', 0, 'not_started', 'Beispieldaten lassen sich laden; fehlende/ungueltige Felder werden verstaendlich gemeldet. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('A02', 'task', 'Linken und rechten Fuss zeitlich korrekt zuordnen und darstellen', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel3', '#9333ea', 0, 'not_started', 'Beide Datenstroeme werden nach Messzeit auf gemeinsamer Zeitachse angezeigt; Einheiten und Achsen sind beschriftet. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('A03', 'task', 'Paketluecken, Dubletten und verspaetete Datensaetze behandeln', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel3', '#9333ea', 0, 'not_started', 'Luecken bleiben sichtbar; Dubletten werden nicht als neue Messwerte ausgewertet. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('A04', 'task', 'Auswertung mit realer gemeinsamer Messdatei pruefen', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel3', '#9333ea', 0, 'not_started', 'Darstellung und vorhandene Auswertung stimmen mit Quellenkennung, Zeitstempeln und Referenzwerten ueberein. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('L01', 'task', 'Seriellen Datenausgang am Master bereitstellen und mit Testdaten pruefen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel4', '#c026d3', 0, 'not_started', 'Rechner empfaengt gerahmte Datensaetze; Debug-Logs vermischen sich nicht mit Messdaten. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('L02', 'task', 'Seriellen Anschluss und Live-Datenleser mit Testdaten implementieren', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel4', '#c026d3', 0, 'not_started', 'Portwahl, Paketparser, Empfangspuffer und Fehleranzeige funktionieren mit simuliertem Datenstrom. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('L03', 'task', 'Laufenden Plot fuer beide Fuesse implementieren', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel4', '#c026d3', 0, 'not_started', 'Gemeinsame Zeitachse, Quellen-/Kanalauswahl und laufende Aktualisierung ohne Blockieren der Oberflaeche funktionieren. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('L04', 'task', 'Beide realen Datenstroeme ueber den Master an den Rechner ausgeben', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-ziel4', '#c026d3', 0, 'not_started', 'Ein Kabel am Master transportiert beide Datenstroeme; Ausgabe stoert BLE-Empfang und die geplante SD-Aufzeichnung nicht. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('L05', 'task', 'Live-Plot mit beiden realen Sohlen testen', '2026-09-14', '2026-09-14', ARRAY['p-siavash'], 'ph-wp-ziel4', '#c026d3', 0, 'not_started', 'Darstellung, Verzoegerung, Kabelabziehen/Wiederverbinden und sichtbare Verbindungszustaende sind geprueft. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('R01', 'task', 'Case ueberarbeiten: Form, Einbauraum, Montage, Kabelausgaenge und Druckbarkeit pruefen; neuen CAD-/Druckstand ablegen', '2026-09-14', '2026-09-14', ARRAY['p-bastian'], 'ph-wp-redesign', '#78716c', 0, 'not_started', 'Zustaendigkeit noch zu bestaetigen (Vorschlag im Plan: Bastian). Spaet einplanbar; eigenstaendige optionale Ergaenzung, vorlaeufig kein Abnahmekriterium von PH. Keine Abhaengigkeit zu H04 (verwendet den vorhandenen Case-Stand). [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('Q01', 'task', 'Pitch-Demo unter realistischen Bedingungen vollstaendig proben und Stand festhalten', '2026-09-14', '2026-09-14', ARRAY['p-bastian', 'p-siavash'], 'ph-wp-abnahme', '#dc2626', 0, 'not_started', 'Mehrere vollstaendige Start-/Stopp-Durchlaeufe mit beiden Sohlen, gemeinsamer CSV und Live-Plot; Versionsstand, Bedienfolge und funktionierende Beispielmessung liegen vor. Demodauer, zulaessige Synchronisationsabweichung und akzeptable Verzoegerung sind vor dieser Aufgabe ausdruecklich festzulegen. [Termin vorlaeufig, Aufwand noch offen -- siehe Pitch-Hardware-Plan.]'),
  ('PH', 'milestone', 'Pitch Hardware', '2026-10-05', '2026-10-05', ARRAY['p-bastian', 'p-siavash'], 'ph-wp-abnahme', '#7f1d1d', 0, 'not_started', 'Deadline 05.10.2026 Tagesende, vor dem Pitch am 12.10.2026. Abnahme-Checkliste liegt direkt an dieser Aufgabe (Reiter Checkliste).')
on conflict (id) do nothing;

insert into planner_dependencies (id, from_id, to_id, type, lag_days) values
  ('ph-dep-1', 'H01', 'H02', 'FS', 0),
  ('ph-dep-2', 'H01', 'H03', 'FS', 0),
  ('ph-dep-3', 'H01', 'H04', 'FS', 0),
  ('ph-dep-4', 'H02', 'H05', 'FS', 0),
  ('ph-dep-5', 'H03', 'H05', 'FS', 0),
  ('ph-dep-6', 'H05', 'H06', 'FS', 0),
  ('ph-dep-7', 'H04', 'H07', 'FS', 0),
  ('ph-dep-8', 'H06', 'H07', 'FS', 0),
  ('ph-dep-9', 'F01', 'F02', 'FS', 0),
  ('ph-dep-10', 'F02', 'F03', 'FS', 0),
  ('ph-dep-11', 'F03', 'F04', 'FS', 0),
  ('ph-dep-12', 'D01', 'F04', 'FS', 0),
  ('ph-dep-13', 'F04', 'F05', 'FS', 0),
  ('ph-dep-14', 'F05', 'F06', 'FS', 0),
  ('ph-dep-15', 'F04', 'F07', 'FS', 0),
  ('ph-dep-16', 'H07', 'F08', 'FS', 0),
  ('ph-dep-17', 'F06', 'F08', 'FS', 0),
  ('ph-dep-18', 'F07', 'F08', 'FS', 0),
  ('ph-dep-19', 'F01', 'D01', 'FS', 0),
  ('ph-dep-20', 'D01', 'A01', 'FS', 0),
  ('ph-dep-21', 'A01', 'A02', 'FS', 0),
  ('ph-dep-22', 'A02', 'A03', 'FS', 0),
  ('ph-dep-23', 'A03', 'A04', 'FS', 0),
  ('ph-dep-24', 'F08', 'A04', 'FS', 0),
  ('ph-dep-25', 'D01', 'L01', 'FS', 0),
  ('ph-dep-26', 'F02', 'L01', 'FS', 0),
  ('ph-dep-27', 'D01', 'L02', 'FS', 0),
  ('ph-dep-28', 'L02', 'L03', 'FS', 0),
  ('ph-dep-29', 'A02', 'L03', 'FS', 0),
  ('ph-dep-30', 'L01', 'L04', 'FS', 0),
  ('ph-dep-31', 'F08', 'L04', 'FS', 0),
  ('ph-dep-32', 'L03', 'L05', 'FS', 0),
  ('ph-dep-33', 'L04', 'L05', 'FS', 0),
  ('ph-dep-34', 'A04', 'Q01', 'FS', 0),
  ('ph-dep-35', 'L05', 'Q01', 'FS', 0),
  ('ph-dep-36', 'Q01', 'PH', 'FS', 0)
on conflict (id) do nothing;

insert into planner_checklist_items (id, task_id, text, done, created_by) values
  ('ph-cl-1', 'PH', 'Der zweite Prototyp fuer den linken Fuss ist vollstaendig aufgebaut und funktionsfaehig.', false, 'Claude'),
  ('ph-cl-2', 'PH', 'Kabel, bestueckte Platine, eingeklebte Sensoren und gedrucktes Case sind geprueft und montiert.', false, 'Claude'),
  ('ph-cl-3', 'PH', 'Master- und Slave-Firmware koennen aus derselben Codebasis gezielt gebaut und geflasht werden.', false, 'Claude'),
  ('ph-cl-4', 'PH', 'Rolle, Fussseite und Geraetekennung sind eindeutig zugeordnet.', false, 'Claude'),
  ('ph-cl-5', 'PH', 'Beide Sohlen verbinden sich und durchlaufen den Handshake zuverlaessig.', false, 'Claude'),
  ('ph-cl-6', 'PH', 'Messstart, Messstopp und Messungs-ID sind zwischen beiden Geraeten abgestimmt.', false, 'Claude'),
  ('ph-cl-7', 'PH', 'Beide Datenstroeme besitzen eine gemeinsame auswertbare Zeitbasis; gemessene Abweichung und Drift erfuellen die vereinbarte Demo-Anforderung.', false, 'Claude'),
  ('ph-cl-8', 'PH', 'Paketluecken werden erkannt; noch gepufferte Daten werden nachgefordert; dauerhafte Luecken sind sichtbar.', false, 'Claude'),
  ('ph-cl-9', 'PH', 'Die gemeinsame CSV auf dem Master enthaelt die realen Daten beider Sohlen.', false, 'Claude'),
  ('ph-cl-10', 'PH', 'Sias Tool liest diese CSV ein und wertet beide Fuesse mit korrekten Zeitstempeln und Einheiten aus.', false, 'Claude'),
  ('ph-cl-11', 'PH', 'Ueber die Kabelverbindung am Master zeigt Sias Tool beide Sohlen live an.', false, 'Claude'),
  ('ph-cl-12', 'PH', 'Der Live-Plot erfuellt die vereinbarte Verzoegerungsanforderung und zeigt Verbindungsunterbrechungen erkennbar an.', false, 'Claude'),
  ('ph-cl-13', 'PH', 'Die komplette Demo wurde wiederholt erfolgreich durchgefuehrt; funktionsfaehige Versionen und Beispielmessung sind gesichert.', false, 'Claude')
on conflict (id) do nothing;

insert into planner_activity (id, ts, message, actor) values
  ('ph-act-import', now(), 'Pitch-Hardware-Plan aus MyProSole_Pitch_Hardware_2026-10-05.md importiert: 29 Einzelvorgaenge + 1 Meilenstein (PH, Deadline 05.10.2026) in 7 Arbeitspaketen, 36 FS-Abhaengigkeiten, 13 Abnahme-Checklistenpunkte. Termine sind bewusst Platzhalter (14.09.2026) -- der Plan verbietet erfundene Aufwands-/Tagesschaetzungen, bis Umsetzungsstand und Sias Kapazitaet geklaert sind. Keine Baseline gesetzt.', 'Claude')
on conflict (id) do nothing;
