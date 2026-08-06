# MyProSole – Goldstandard für Entwicklung

Verbindliche Grundregeln für alle, die an MyProSole arbeiten – egal ob selbst getippt oder mit KI-Unterstützung ("Vibe Coding") gebaut. Tempo darf nie auf Kosten von Sicherheit, Datenstruktur oder Wartbarkeit gehen: was jetzt schlampig aufgebaut wird, kostet später ein Vielfaches an Zeit.

Betrifft sowohl das MyProSole-Produkt (App, Sensor-Backend) als auch interne Tools wie den Projektplaner.

---

## 1. Sicherheit

- Keine Secrets (API-Keys, DB-Passwörter, Tokens) im Code oder in Git-Historie – nur in `.env`/Secret-Manager, `.gitignore` regelmäßig prüfen.
- Eingabevalidierung an **jeder** Systemgrenze: Nutzereingaben, Sensordaten-Uploads, API-Requests. Niemals Client-Daten blind vertrauen.
- Auth: sichere Passwort-Hashes (bcrypt/argon2, nie selbst gebaut), Tokens mit Ablaufzeit, Refresh-Token-Rotation.
- Biometrische/Gesundheitsdaten sind besonders sensibel (DSGVO Art. 9) → Verschlüsselung at rest **und** in transit (TLS überall), Zugriff nur mit klarem Zweck.
- Least Privilege: DB-User und API-Keys bekommen nur die Rechte, die sie wirklich brauchen.
- Dependency-Scanning regelmäßig (`pip-audit`, `npm audit` o.ä.), keine ungeprüften Third-Party-Pakete "weil's schnell ging".
- Rate-Limiting auf allen öffentlichen Endpunkten.
- Fehlermeldungen an Clients nie mit Stacktraces oder internen Details – Details nur ins Server-Log.
- Sicherheitsrelevanter Code (Auth, Krypto, SQL-Queries), egal ob von KI oder Mensch geschrieben, wird **immer** von einem Menschen gegengelesen, nie blind gemergt.

## 2. Datenbank-Struktur

- Schema von Anfang an sauber normalisiert (min. 3NF); Denormalisierung nur bewusst und mit Begründung dokumentiert.
- Migrationen versioniert (z. B. Alembic) – nie manuell am Produktiv-Schema herumschrauben.
- Jede Tabelle: eindeutiger Primärschlüssel, Fremdschlüssel mit echten Constraints, Indizes auf Spalten, nach denen gefiltert/sortiert wird.
- Konsistente Namenskonvention (snake_case, einheitlich Singular oder Plural).
- `created_at`/`updated_at` und eine Soft-Delete-Strategie von Anfang an mitdenken, nicht nachträglich reinflicken.
- Sensordaten (hohes Volumen, kontinuierlich) brauchen von Anfang an eine Partitionierungs-/Retention-Strategie, nicht erst wenn die Tabelle zu groß ist.
- Backups regelmäßig **und** regelmäßig testweise zurückspielen – ein Backup, das nie getestet wurde, ist kein Backup.

## 3. Code-Struktur / Architektur

- Klare Trennung: UI / Business-Logik / Datenzugriff / Services (siehe bestehende Kern-/Modul-Trennung in `MODULE.md`).
- Feature-Module bleiben unabhängig voneinander – keine Querimporte zwischen Modulen, gemeinsame Logik gehört in `core/domain/`.
- SOLID pragmatisch anwenden: keine Abstraktion "für später, falls wir's mal brauchen" – nur bauen, was heute gebraucht wird.
- Sprechende Namen, keine Magic Numbers/Strings → Konstanten oder Enums.
- Jede Funktion/Klasse hat genau eine Verantwortung.
- Code-Review vor jedem Merge auf `main` – auch (gerade) bei KI-generiertem Code.

## 4. Testing

- Unit-Tests für Business-/Domain-Logik, nicht nur den Happy Path.
- Kritische Pfade (Auth, Zahlungen, Sensor-Auswertung/Analyse-Algorithmen) brauchen zusätzlich Integrationstests.
- Test-Coverage als Richtwert für Kernlogik (z. B. 70–80 %), nicht als Selbstzweck – 100 % auf trivialem Code bringt nichts.
- CI führt Tests bei jedem Pull Request aus; bei rotem Test kein Merge, keine Ausnahme.
- Nie echte Nutzerdaten als Testdaten verwenden.

## 5. Vibe-Coding-spezifische Fallstricke

- KI-generierten Code immer lesen und verstehen, bevor er übernommen wird – besonders bei Security, Datenbank-Migrationen und Zahlungen.
- Kleine, überprüfbare Änderungen statt eines riesigen KI-generierten Patches, den niemand mehr komplett durchschaut.
- Vor jedem neuen Feature prüfen: "Gibt's das nicht schon in einem Modul/einer Utility?" – KI dupliziert gerne, statt Bestehendes wiederzuverwenden.
- Keine neue Dependency ohne kurzen Check: wird sie gepflegt, welche Lizenz, gab es Sicherheitsvorfälle?
- Bei fehlendem Kontext lieber nachfragen als die KI raten lassen – gilt für Code genauso wie für Kommentare/Doku.
- Definition of Done für jede Aufgabe explizit festlegen (siehe Projektplaner), nicht implizit im Kopf behalten.

## 6. CI/CD & Tooling

- Linting und Formatting automatisiert (z. B. `ruff`/`black` für Python; später `eslint`/`prettier` für die App).
- Pre-Commit-Hooks für Secrets-Scan und Linting.
- CI-Pipeline: Lint → Test → Build, blockiert den Merge bei Fehlern.
- Getrennte Umgebungen dev/staging/prod – nie direkt in Prod testen oder debuggen.

## 7. Datenschutz (DSGVO)

- Privacy by Design von Anfang an, nicht nachträglich draufgesetzt.
- Datensparsamkeit: nur erheben, was für die Funktion wirklich gebraucht wird.
- Nutzer-Einwilligung nachvollziehbar dokumentiert (Zeitpunkt, Version der Einwilligung).
- Recht auf Löschung und Datenexport von Anfang an technisch mitdenken – das nachträglich einzubauen ist deutlich teurer.
- Auftragsverarbeitungsverträge (AVV) mit allen Drittanbietern (Cloud-Hosting, KI-APIs, Analytics).

## 8. Performance

- Keine Premature Optimization, aber: Pagination für Listen von Anfang an, keine ungebremsten "SELECT *"-Queries auf wachsenden Tabellen.
- Sensordaten-Verarbeitung als Batching/Streaming denken, nicht alles auf einmal in den Speicher laden.
- Caching-Strategie für teure Berechnungen (z. B. Analyse-Ergebnisse) früh mitdenken, nicht erst wenn's langsam wird.

## 9. Dokumentation & Projektplanung

- Jedes Feature-Modul bekommt ein Mini-README nach dem Vorbild von `MODULE.md`.
- Architekturentscheidungen mit kurzer Begründung festhalten (Mini-ADR: Was, Warum, Alternativen erwogen), nicht nur im Code verstecken.
- Im Projektplaner: jede Aufgabe braucht Definition of Done, Abhängigkeiten und einen Termin, bevor sie als "in Arbeit" markiert wird. Keine Aufgabe wird "erledigt" gesetzt, ohne dass die Definition of Done tatsächlich erfüllt ist.

---

## Prompt für den Bot

Diesen Block direkt in die Projekt-Instruktionen eures Coding-Assistenten (z. B. `CLAUDE.md`, System-Prompt o. ä.) einfügen, damit die Regeln automatisch für jede Session gelten:

```
# MyProSole – Entwicklungsstandards (verbindlich)

Du entwickelst am Projekt MyProSole (Sensor-Einlage + Health-/Sport-App). Diese Regeln
gelten für jede Code-Änderung, auch bei kleinen Aufgaben. Wenn eine Anforderung gegen
eine dieser Regeln verstößt, weise aktiv darauf hin, statt sie stillschweigend zu befolgen.

Sicherheit:
- Niemals Secrets, API-Keys oder Passwörter im Code oder in Commits. Nutze .env/Secret-Manager.
- Validiere jede Eingabe an Systemgrenzen (User-Input, API, Sensordaten). Vertraue Client-Daten nie blind.
- Biometrische/Gesundheitsdaten sind besonders sensibel (DSGVO Art. 9): verschlüsselt speichern
  und übertragen, Zugriff nur mit klarem Zweck.
- Baue Auth/Krypto nie selbst – etablierte, geprüfte Bibliotheken verwenden.
- Fehlermeldungen an Clients ohne Stacktraces oder interne Details.

Datenbank:
- Normalisiertes Schema (min. 3NF), Denormalisierung nur mit expliziter Begründung.
- Alle Schemaänderungen über versionierte Migrationen, nie manuell.
- Primär-/Fremdschlüssel mit echten Constraints, Indizes auf abgefragten Spalten.
- created_at/updated_at und Soft-Delete von Anfang an mitdenken.
- Hochvolumige Daten (z. B. Sensordaten) mit Retention-/Partitionierungsstrategie planen.

Code-Struktur:
- Trenne UI, Business-Logik, Datenzugriff und Services strikt.
- Halte dich an die bestehende Kern-/Modul-Trennung (siehe MODULE.md) – keine Querimporte
  zwischen Feature-Modulen.
- Baue keine Abstraktionen "für später" – nur was die aktuelle Anforderung braucht.
- Keine Magic Numbers/Strings, keine Gottesklassen/-funktionen.

Tests:
- Schreibe Unit-Tests für Business-/Domain-Logik, nicht nur den Happy Path.
- Kritische Pfade (Auth, Zahlungen, Analyse-Algorithmen) brauchen Integrationstests.
- Schlage bei sicherheits- oder datenkritischem Code proaktiv Tests vor, auch wenn nicht
  explizit verlangt.

Vibe-Coding-Disziplin:
- Bevor du etwas Neues baust: prüfe, ob es schon eine passende Funktion/ein Modul gibt.
- Mach kleine, nachvollziehbare Änderungen statt riesiger Patches.
- Schlage keine neue Dependency vor, ohne kurz auf Pflegezustand/Lizenz hinzuweisen.
- Wenn Kontext fehlt: frag nach, rate nicht.
- Jede Aufgabe braucht eine klare Definition of Done, bevor sie als erledigt gilt.

Datenschutz:
- Privacy by Design: nur die Daten erheben, die für die Funktion nötig sind.
- Denke Löschung/Export von Nutzerdaten von Anfang an mit, nicht nachträglich.

Wenn eine dieser Regeln bei einer Aufgabe nicht eingehalten werden kann (z. B. Zeitdruck,
fehlende Infrastruktur), sag das explizit und schlage die nächstbeste Lösung vor, statt
die Regel stillschweigend zu ignorieren.
```
