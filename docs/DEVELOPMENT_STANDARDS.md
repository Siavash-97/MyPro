# MyProSole – verbindliche Entwicklungsstandards

Diese Regeln gelten für **jede Code- und Datenbankänderung** in `project-planner`,
`myprosole_app` und `myprosole_web` – unabhängig davon, ob sie von einem Menschen,
Codex, Claude, GitHub Copilot, einer IDE-Automation oder einem anderen KI-Modell
erstellt wird.

Wenn eine Anforderung diesen Regeln widerspricht, muss der Konflikt vor der
Umsetzung ausdrücklich benannt werden. Eine Regel darf weder stillschweigend
umgangen noch durch Zeitdruck aufgehoben werden.

## Sicherheit

- Niemals Secrets, API-Keys oder Passwörter im Code, in Testdaten, Logs oder
  Commits speichern. Lokale `.env`-Dateien oder einen geeigneten Secret-Manager
  verwenden; nur bereinigte `.example`-Dateien dürfen versioniert werden.
- Jede Eingabe an einer Systemgrenze validieren: User-Input, API-Nachrichten,
  Datei-Uploads, Datenbankantworten und Sensordaten. Client-Daten nie blind
  vertrauen.
- Biometrische und Gesundheitsdaten sind besonders sensible Daten nach
  DSGVO Art. 9. Sie müssen bei Speicherung und Übertragung verschlüsselt sein;
  der Zugriff benötigt einen klaren, dokumentierten Zweck und minimale Rechte.
- Authentifizierung und Kryptografie nicht selbst implementieren. Etablierte,
  geprüfte Bibliotheken und Plattformfunktionen verwenden.
- Fehlermeldungen an Clients enthalten keine Stacktraces, Secrets,
  Datenbankdetails oder internen Pfade. Interne Diagnoseinformationen gehören
  ausschließlich in geschützte Logs.

## Datenbank

- Das Schema wird mindestens bis zur dritten Normalform (3NF) normalisiert.
  Denormalisierung ist nur mit dokumentierter fachlicher und technischer
  Begründung zulässig.
- Jede Schemaänderung erfolgt über eine versionierte, wiederholbar ausführbare
  Migration im Repository. Manuelle Änderungen, die nicht als Migration
  dokumentiert sind, sind unzulässig.
- Primär- und Fremdschlüssel werden als echte Constraints angelegt. Häufig
  abgefragte, sortierte und verknüpfte Spalten erhalten passende Indizes.
- Bei neuen Tabellen werden `created_at`, `updated_at` und die fachliche
  Notwendigkeit von Soft-Delete geprüft und die Entscheidung dokumentiert.
- Für hochvolumige Daten wie Sensorzeitreihen muss vor der produktiven
  Speicherung eine Retention-, Archivierungs- und Partitionierungsstrategie
  festgelegt werden.

## Code-Struktur

- UI, Business-/Domain-Logik, Datenzugriff und externe Services bleiben klar
  getrennt.
- Für `myprosole_app` ist die Kern-/Modul-Trennung aus
  [`MODULE.md`](../myprosole_app/MODULE.md) verbindlich. Feature-Module dürfen
  nicht direkt voneinander importieren; gemeinsame Fachlogik gehört in den
  vorgesehenen Kern-/Domain-Bereich.
- Für `myprosole_web` gilt: Seiten unter `src/pages/`, wiederverwendbare
  Komponenten unter `src/components/`, Zustandsverwaltung unter `src/store/`,
  Typdefinitionen unter `src/types/`.
- Vor einer neuen Implementierung wird nach einer vorhandenen passenden
  Funktion oder einem vorhandenen Modul gesucht.
- Nur Abstraktionen bauen, die für die aktuelle Anforderung benötigt werden.
- Keine fachlichen Magic Numbers oder Magic Strings und keine Gottesklassen
  oder übergroßen Funktionen. Fachliche Konstanten erhalten Namen und einen
  eindeutigen Ort.
- Änderungen bleiben klein, nachvollziehbar und auf die Anforderung begrenzt.
- Eine neue Dependency darf erst nach kurzer Prüfung von Pflegezustand,
  Lizenz, Sicherheitslage und tatsächlichem Bedarf vorgeschlagen werden.

## Tests und Qualitäts-Gates

- Neue oder geänderte Business-/Domain-Logik erhält fokussierte Unit-Tests,
  einschließlich relevanter Fehler- und Grenzfälle – nicht nur des Happy Path.
- User-Flows und modulübergreifende Änderungen erhalten automatisierte
  Workflow- oder Integrationstests.
- Kritische Pfade wie Authentifizierung, Zahlungen und Analysealgorithmen
  benötigen Integrationstests. Bei sicherheits- oder datenkritischen Änderungen
  werden zusätzliche Tests proaktiv vorgeschlagen und umgesetzt, soweit die
  notwendige Infrastruktur vorhanden ist.
- Fehlgeschlagene Tests dürfen nicht übersprungen, gelöscht oder abgeschwächt
  werden, um eine Änderung durchzubringen. Implementierung oder objektiv falsche
  Erwartung korrigieren.
- Vor Übergabe oder Push muss aus dem Repository-Stamm erfolgreich laufen:

  ```bash
  python scripts/run_tests.py --suite all
  ```

- Lokale Git-Hooks und GitHub Actions sind verbindliche, modell- und
  editorunabhängige Qualitäts-Gates. Sie dürfen nicht umgangen werden.

## Datenschutz

- Privacy by Design und Datenminimierung: nur Daten erheben, die für den klar
  beschriebenen Zweck erforderlich sind.
- Bei jeder neuen persistenten Nutzerdatenart werden Löschung, Aufbewahrung und
  Export von Beginn an berücksichtigt.
- Produktionsnahe Testdaten müssen anonymisiert oder synthetisch sein.
- Zugriffe folgen dem Least-Privilege-Prinzip und werden bei sensiblen Daten
  nachvollziehbar protokolliert.

## Arbeitsdisziplin und Definition of Done

Vor der Implementierung:

1. Vorhandene Module, Funktionen, Migrationen und Tests prüfen.
2. Fehlenden Kontext klären, statt eine fachlich riskante Annahme zu treffen.
3. Eine konkrete Definition of Done (DoD) für die Aufgabe festlegen.
4. Auswirkungen auf Sicherheit, Gesundheitsdaten, Datenbank und Datenschutz
   bewerten.

Eine Aufgabe ist erst erledigt, wenn alle zutreffenden Punkte erfüllt sind:

- Akzeptanzkriterien und fachliches Verhalten sind umgesetzt.
- Eingaben und Fehlerfälle an Systemgrenzen sind behandelt.
- Architektur- und Modulgrenzen bleiben eingehalten.
- Datenbankänderungen liegen als versionierte Migration mit Constraints,
  Indizes und Rückwärts-/Bestandsdatenstrategie vor.
- Datenschutz, Löschung und Export wurden geprüft.
- Fokussierte Unit-Tests und erforderliche automatisierte/Integrationstests sind
  vorhanden und erfolgreich.
- Die vollständige Qualitätssuite ist erfolgreich.
- Dokumentation wurde dort aktualisiert, wo Verhalten, Betrieb oder Einrichtung
  sich geändert haben.
- Keine Secrets oder sensiblen Echtdaten befinden sich im Diff.

## Ausnahmeverfahren

Kann eine Regel wegen fehlender Infrastruktur oder einer anderen echten
Blockade nicht eingehalten werden, muss die Übergabe enthalten:

1. die konkret nicht erfüllte Regel,
2. den Grund und das daraus entstehende Risiko,
3. die sicherste derzeit mögliche Ersatzlösung,
4. eine klar beschriebene Folgeaufgabe zur vollständigen Behebung.

Ohne diese Angaben darf die Abweichung nicht als erledigt bezeichnet werden.
