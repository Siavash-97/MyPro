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
- Supabase `user_metadata` ist vom Benutzer selbst beschreibbar und darf
  niemals für Autorisierungsentscheidungen verwendet werden (z. B. Rollen,
  Berechtigungen, Admin-Flags). Autorisierung ausschließlich über
  `app_metadata` (nur serverseitig änderbar) oder RLS-Policies steuern.
- Ein neues Claude-Code-Skill, -Plugin oder -MCP-Server wird vor dem
  produktiven Einsatz mit [SkillSpector](https://github.com/NVIDIA/SkillSpector)
  gescannt; das Ergebnis wird protokolliert, unabhängig davon, ob der Scan
  sauber ausfällt. Jeder als kritisch gemeldete Fund wird an der konkreten
  Codezeile nachgeprüft, nicht nur am Score – ein hoher Score ist ein Hinweis
  zum Nachschauen, kein Urteil. Siehe
  [`docs/skill-security-scans.md`](skill-security-scans.md) für Vorgehen und
  bisherige Scans.

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

## Tiefe Module und strategisches Bauen

Grundlage: John Ousterhout, *A Philosophy of Software Design* – und Kent Becks
Satz *„Invest in the design of the system every day."*

### Das Prinzip

> **Ein Modul kostet, was seine Schnittstelle verlangt. Es nützt, was es
> verbirgt.** Ein gutes Modul ist deshalb **tief**: viel Funktionalität hinter
> einer schmalen Schnittstelle.

- **Vor jedem neuen Modul die Bewertungsfrage stellen:** Wie viel muss jemand
  wissen, um es zu benutzen? Je weniger, desto tiefer – und desto besser.
- **Flache Module vermeiden.** Ein Modul, das seine Aufrufe im Wesentlichen
  weiterreicht, ist Schnittstelle ohne Gegenwert. Viele kleine Module, die eng
  zusammenhängen, werden zusammengelegt statt einzeln veröffentlicht.
- **Erst die Schnittstelle entwerfen, dann die Umsetzung dahinter.** Die
  Schnittstelle ist die Entscheidung; die Umsetzung ist die Folge.
- **Fehler unten erledigen, nicht nach oben reichen.** Was ein Modul selbst
  behandeln kann, darf den Aufrufer nicht erreichen. Jeder Sonderfall, der nach
  oben durchschlägt, verbreitert die Schnittstelle.
- **Sonderfälle verschwinden lassen,** statt sie zu dokumentieren. Der beste
  Grenzfall ist der, den es durch die Bauart nicht mehr gibt.

### Beispiele aus diesem Projekt

- `myprosole_web/src/lib/aufzeichnungBruecke.ts` ist **tief**: Sieben Funktionen
  verbergen Plugin-Registrierung, Fehlerbehandlung und das Verhalten im Browser.
  Wer sie benutzt, muss von Capacitor nichts wissen.
- `myprosole_web/src/lib/bewegung.ts` ist **tief**: Rauschmodell, Ruhepegel,
  Schwellenwerte und Schwerpunktbildung liegen hinter einem Aufruf.
- `myprosole_app/core/domain/` ist die Fachlogik, Streamlit nur die Darstellung.
  Die Regel dahinter gilt überall: **Fachlogik nach unten, Darstellung nach
  oben.**

### Strategisch statt taktisch

- Jede Aufgabe hinterlässt den Entwurf **besser**, als sie ihn vorgefunden hat.
  Der schnellste Weg zu einer Änderung ist nicht der beste, wenn er die nächste
  Änderung teurer macht.
- **Auflösung zum Punkt „Nur Abstraktionen bauen, die benötigt werden":** Beide
  Regeln gelten. Strategisch heißt **nicht**, auf Vorrat zu bauen – es heißt,
  die Schnittstelle sorgfältig zu wählen, **bevor** die Umsetzung dahinter
  wächst. Nicht *mehr* Abstraktionen, sondern *bessere*.
- Wo eine Abweichung wissentlich in Kauf genommen wird, wird sie benannt und in
  [`zurueckgestellt.md`](zurueckgestellt.md) eingetragen – nicht verschwiegen.

### Vor größeren Änderungen

1. **Befragen, bevor Code entsteht.** Annahmen, Grenzfälle und Abhängigkeiten
   klären, bis ein gemeinsames Verständnis steht.
2. **Ergebnis als PRD festhalten,** wenn die Änderung mehrere Sitzungen
   überdauert oder andere Personen betrifft.
3. **In senkrechte Scheiben zerlegen:** Jede Scheibe ist für sich fertig,
   geprüft und nützlich – nicht „erst alle Datenbank­änderungen, dann alle
   Oberflächen".

## Recherche vor technischen Festlegungen

Ein KI-Modell antwortet aus einem Wissensstand, der zwangsläufig veraltet ist —
Paketlandschaften, Tarife und Anbieterregeln ändern sich schneller. Deshalb
gilt: **Vor einer technischen Festlegung wird nachgeschlagen, nicht aus dem
Gedächtnis entschieden.**

**Verbindlich vor:**

- der Aufnahme einer neuen Abhängigkeit, eines Plugins oder einer Bibliothek
- der Wahl eines Anbieters oder eines Tarifs
- jeder Entscheidung, die sich später nicht billig zurücknehmen lässt
  (App-Kennung, Kontotyp, Datenmodell, Signaturschlüssel)
- der Diagnose eines Symptoms, das nach einem bekannten Fehler in einer
  fremden Bibliothek aussieht

**Nicht nötig** für gewöhnliche Änderungen an eigenem Code. Die Regel soll
Festlegungen absichern, nicht jeden Arbeitsschritt verlangsamen.

**Was angesehen wird, in dieser Reihenfolge der Beweiskraft:**

1. **Das GitHub-Repository:** letzter Commit, offene und geschlossene Issues
   zur konkreten Frage, Häufigkeit der Veröffentlichungen, Lizenz, wie viele
   Menschen es pflegen. Das sind Tatsachen.
2. **Offizielle Dokumentation und Änderungsprotokoll** des Anbieters.
3. **Entwicklerforen** — Reddit, GitHub Discussions, Stack Overflow. Gut für
   die Frage „was geht in der Praxis kaputt", etwa auf bestimmten
   Gerätemarken. Als Beleg taugen sie nicht.

**Die Trennung ist der Kern der Regel:** Eine Forenmeinung ist eine Spur, kein
Befund. Was zu einer Entscheidung führt, wird gegen Repository oder
Dokumentation nachgeprüft, und die Quelle wird in der Übergabe genannt — mit
Link, damit die nächste Sitzung die Suche nicht wiederholen muss.

Werkzeuge dafür: `agent-reach` (GitHub, Reddit, Foren), Websuche, direkter
Abruf einer Seite.

**Herkunft der Regel:** Zweimal wurde in diesem Projekt geraten, wo eine
Einstellung liegt, statt nachzuschlagen; und eine Aussage zum Google-Play-Konto
war aus dem Gedächtnis falsch (der Kontotyp lässt sich sehr wohl nachträglich
ändern). Beides hätte eine Minute Recherche verhindert.

## Struktur der Design-Mockups (Kopplung & Skalierung)

Für `myprosole_app/design/`: Mehrere Überlauf-Bugs in Folge (Filter-Chips,
`<legend>`-Titel, Grid-Spaltenbreite) hatten dieselbe Ursache – ein
gemeinsam genutztes CSS-Bauteil verließ sich stillschweigend auf eine
Browser-Default-Größe, die erst bei bestimmtem Inhalt sichtbar wurde. Damit
das nicht bei jedem neuen Screen erneut passiert:

- **Defensive Größen statt Zufallstreffer.** Jeder Flex-/Grid-Container, der
  langen oder nicht umbrechbaren Inhalt aufnehmen kann (Chip-Reihen,
  Legenden, lange Wörter), bekommt explizit `min-width: 0` (oder das
  Grid-Äquivalent). Ohne diese Zeile wächst der Container auf den
  Max-Content seines breitesten Kindes und zieht die ganze Seite in die
  Breite – unsichtbar, bis jemand einen langen Text einträgt.
- **Native Eigenheiten einmal lösen, nicht pro Screen neu entdecken.**
  `<legend>` sitzt per Spezifikation immer auf der (auch unsichtbaren)
  Rahmenlinie seines `<fieldset>`, nie vollständig darin – als sichtbarer
  Titel taugt es deshalb nicht. Der Standard dafür: ein `<legend
  class="md-visually-hidden">` für den Screenreader-Namen, plus ein
  gewöhnliches `<p class="md-form-section__title">` für die sichtbare
  Beschriftung. Diese Lösung gilt für jedes neue `.md-form-section`, nicht
  nur für den Screen, an dem sie auffiel.
- **Geteilte Klassen haben große Reichweite – das ist gewollt, aber
  pflichtet zu Sorgfalt.** Wird eine Klasse aus `design-system/` geändert,
  wird vor dem Abschluss geprüft, auf welchen Screens sie noch verwendet
  wird (`grep` über `mockups/`), nicht nur auf dem Screen, von dem die
  Meldung kam. Ein Fix, der nur lokal getestet wurde, kann auf einem
  anderen Screen unbemerkt denselben Bug lassen oder einen neuen erzeugen.
- **Wiederholte Inline-Styles sind versteckte Kopplung.** Taucht dasselbe
  `style="..."`-Muster in drei oder mehr Dateien auf, gehört es in eine
  Klasse im Design-System statt kopiert zu werden. Sonst erfordert eine
  spätere Anpassung des Werts das Suchen und Ändern jeder Kopie einzeln,
  und einzelne Kopien werden dabei erfahrungsgemäß übersehen.
- **Jeder neue Screen kommt in die Überlauf-Regression.** Die Playwright-
  Prüfung `never lets the device frame scroll sideways` in
  `myprosole_app/e2e/entwuerfe.spec.ts` prüft sowohl den Geräterahmen als
  auch die tatsächliche Seitenbreite. Ein neuer Mockup gilt erst als fertig,
  wenn er dort in der Screen-Liste steht.
- **Die Entwurfsprüfungen liegen bei MyProSole, nicht beim Projektplaner.**
  Bis zum 19.08.2026 standen sie unter
  `project-planner/e2e/myprosole-design.spec.ts` und liefen im selben Befehl
  wie die Prüfungen des Planers. Das hatte drei Folgen: Wer die Entwürfe
  änderte, musste im Planer editieren; ein flackernder Test im Planer ließ
  das Prüftor für MyProSole rot werden; und wer den Planer prüfen wollte,
  führte 1307 Zeilen fremde Prüfungen mit aus. Beide Teile sind jetzt
  getrennt und einzeln aufrufbar:

  ```
  python scripts/run_tests.py --suite all --project app      # nur MyProSole
  python scripts/run_tests.py --suite all --project planner  # nur der Planer
  ```

  **Am Projektplaner wird nichts geändert, solange nicht ausdrücklich am
  Planer gearbeitet wird.**
- **Getrennte Dateien pro Screen bleiben der Normalfall**, auch wenn das
  bedeutet, dass ein Tab-Wechsel (z. B. zwischen Feed/ZusammenLauf/Gruppen)
  eine echte Seitennavigation ist und dadurch nach oben scrollt. Das ist der
  Preis für unabhängig bearbeitbare, einzeln überschaubare Screens – ein
  gemeinsames Tab-Dokument für mehrere Screens würde diese Trennung
  aufheben und macht spätere Änderungen an einem Tab riskanter für die
  anderen. Wird eine nahtlose Tab-Umschaltung ohne Sprung explizit
  gewünscht, ist das eine bewusste Ausnahme von dieser Regel und wird als
  solche benannt, nicht stillschweigend eingeführt.

## Seitenregeln der Web-App

Für jede neue Seite in `myprosole_web` gelten die Regeln in
[`docs/seiten-regeln.md`](seiten-regeln.md): Aufbau über `AppShell`, Farben und
Abstände ausschließlich über die Gestaltungswerte, Knopfklassen, Prüfliste.

Was sich mechanisch prüfen lässt, prüft `scripts/check_page_rules.py` bei jedem
`run_tests.py --suite all` – eine Seite ohne Seitencontainer oder ohne Titel
kommt damit nicht mehr durch. Die Punkte 4 bis 8 der Prüfliste brauchen Augen
am Gerät und bleiben Teil der Definition of Done.

## Bedienbarkeit (Klicktiefe)

- Häufig genutzte Funktionen müssen mit möglichst wenigen Taps erreichbar sein.
  Niemand soll Zeit damit verbringen müssen, ein Feature erst zu finden.
- Richtwert ab Home: alltägliche Aktionen (Lauf starten, Community, Verlauf,
  Training, Profil) in maximal 1–2 Taps; seltene oder einmalige Aktionen
  (Setup, Gerät verbinden, Gruppe gründen) in maximal 3 Taps.
- Keine wichtige Funktion darf ausschließlich hinter einem unbeschrifteten
  Overflow-/Kebab-Menü liegen. Braucht ein Screen ein solches Menü, muss sein
  Symbol oder Label erkennen lassen, was dahinter liegt – "Weitere Optionen"
  ohne Kontext reicht nicht.
- Bei jedem neuen Screen wird die Klicktiefe ab Home geprüft, bevor der
  Screen als fertig gilt: Wie viele Taps braucht die Kernaktion, und ist der
  Einstieg dahin selbsterklärend beschriftet?

## Aussagen über den Körper: messen, nicht bewerten

- **MyProSole misst und beschreibt. MyProSole bewertet nicht.**
- Erlaubt sind Messwerte und Beschreibungen: „Bodenkontaktzeit 245 ms",
  „links 8 % länger als rechts", „dein Fersenanteil sank von 60 auf 45 %".
- Nicht erlaubt sind Aussagen über Krankheitsrisiken oder
  Fehlstellungen: „erhöht dein Verletzungsrisiko", „deine Überpronation
  solltest du korrigieren", „beugt Läuferknie vor".
- **Warum das eine harte Regel ist:** Die EU-Leitlinie MDCG 2019-11 in der
  Fassung von Juni 2025 stuft Software, die „durch Analyse physiologischer
  Parameter das Risiko von Krankheiten" angeht, nach Regel 11a als
  **Medizinprodukt der Klasse IIa** ein — genanntes Beispiel ist die Lage der
  Rückenwirbel, strukturell dasselbe wie eine Fußstellung. Klasse IIa bedeutet
  Benannte Stelle, ISO 13485 und klinische Bewertung.
- Die Einstufung hängt am **Wortlaut der Zweckbestimmung**, nicht an der
  Rechengenauigkeit. Sie gilt für die Oberfläche, für Texte im App Store und
  für Screenshots gleichermaßen.
- Der Ort der Ausführung ist ausdrücklich unerheblich: Die Rechnung auf einen
  Server zu verlagern ändert an der Einstufung nichts.
- Herleitung und Grenzfälle: [bauart-und-wachstum.md](bauart-und-wachstum.md),
  Abschnitt 8.

## Bauberichte

- Wird etwas Wichtiges gebaut, gehört in die zugehörige Datei ein **Bericht**:
  was gebaut wurde und **was die einzelnen Teile tun** – Datei für Datei,
  darin Teil für Teil.
- Ein Bauplan sagt, was werden soll; er sagt nicht, was am Ende dasteht. Beim
  Bauen ändert sich regelmäßig etwas. Weicht das Gebaute vom Plan ab, wird die
  Abweichung ausdrücklich benannt und der Plan nachgezogen – sonst laufen Text
  und Code auseinander.
- In dieselbe Datei wie den Plan, als eigener Abschnitt. Ein Thema, ein Ort.
- Dazu gehört immer: was noch fehlt, und was nur am Gerät prüfbar ist.
- Vorbilder: `docs/gps-genauigkeit.md` Abschnitt 8,
  `docs/hintergrund-aufzeichnung-entwurf.md` Abschnitt 11.

### Abschlussbericht nach jeder Coding-Aufgabe

Zwingend, bevor eine Aufgabe als fertig gilt – zusätzlich zum Baubericht in
der Fachdatei und unabhängig von der Größe der Änderung.

- **Ort:** `C:\MyProSole\Agent-Reports`
- **Name:** `JJJJ-MM-TT_HHmm_kurzer-titel.md`
- **Gliederung:** Auftrag · Struktur · Tools und Methoden · Offene Punkte und
  Risiken

Inhaltlich verlangt:

**Auftrag** – **ein bis zwei Sätze**, in den Worten des Auftraggebers, damit
er abgleichen kann. Nicht mehr; die Ausführung gehört in die anderen
Abschnitte.

**Struktur**

- Welche Module und Dateien neu oder geändert wurden, und **warum genau diese
  Aufteilung** – nicht mehr und nicht weniger.
- Wo bei jedem neuen oder geänderten Modul die **Schnittstelle** verläuft und
  was genau sich **dahinter** verbirgt.
- Welche Module bewusst **zusammengelegt** oder bewusst **getrennt** wurden,
  je Entscheidung ein bis zwei Sätze Begründung.

**Tools und Methoden**

- Welche Skills und Befehle benutzt wurden – etwa `/grill-me`, `/tdd`,
  `/improve-codebase-architecture`, `/diagnosing-bugs` – und **an welcher
  Stelle im Ablauf**.
- Wurde **keiner** benutzt, gehört der Grund dazu. „Keine Skills benutzt" ist
  keine Auskunft, sondern eine Auslassung.
- Fand **kein `/grill-me` und keine Klärung vor dem Bauen** statt: ausdrücklich
  benennen, warum nicht.
- **Tests:** wenn ja, **nach welchem Muster** (etwa Rot-Grün-Sauber). Wenn
  nein, warum nicht – als Feststellung, nicht als Rechtfertigung.

**Offene Punkte und Risiken**

- Welche **flachen Module** noch bestehen, bewusst nicht angefasst wurden, und
  ob der Grund **Umfang, Zeit oder Risiko** war.
- Welche **Annahmen** der Auftraggeber noch bestätigen muss.
- Was bei einem Lauf von `/improve-codebase-architecture` vermutlich als
  **nächster Kandidat** auftauchen würde.

**Gehört eine Migration zur Aufgabe, wird der Bericht erst danach
geschrieben** – nachdem sie eingespielt und ihre Wirkung geprüft ist. Ein
Bericht über eine Datenbankänderung, die noch niemand ausgeführt hat,
beschreibt eine Absicht und kein Ergebnis.

Ist das Einspielen noch nicht möglich, wird im Bericht sichtbar vermerkt:
**auf menschliches Einspielen wartend**, mit Dateiname und mit dem, was bis
dahin nicht funktioniert. Eine fertig gemeldete Aufgabe, die still auf einen
Handgriff wartet, ist nicht fertig gemeldet, sondern falsch gemeldet.

Zur Prüfung gehört: **was von außen nachweisbar ist, wird nachgewiesen** –
etwa dass Tabellen und Funktionen tatsächlich existieren. Was nur mit einer
angemeldeten Sitzung prüfbar ist, wird als solches benannt und dem
Auftraggeber übergeben, statt es als geprüft auszugeben.

**Nach dem Speichern** wird die Benachrichtigung angestoßen:

```
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\MyProSole\Agent-Reports\.automation\check-and-notify.ps1"
```

Im Hintergrund, ohne Rückfrage, Ausgabe egal. Das Skript gehört dem
Auftraggeber und verschickt die fertigen Berichte weiter; es ist damit Teil
des Abschlusses und nicht ein zusätzlicher Schritt.

**Ton:** nachprüfbare Tatsachen. Keine Werbesprache, kein Eigenlob, kein
„läuft jetzt einwandfrei". Kein Quelltext im Bericht – wer ihn liest, soll
ohne Blick in den Code verstehen, **was** gebaut wurde, **warum so**, und
**welche Abwägungen** es gab. So kurz wie möglich, so vollständig wie nötig.

## Tests und Qualitäts-Gates

### Testgetriebene Entwicklung

Vorgehen: **Rot – Grün – Sauber.** Erst ein fehlschlagender Test, der das
gewünschte Verhalten beschreibt. Dann die einfachste Umsetzung, die ihn grün
macht. Dann aufräumen, ohne das Verhalten zu ändern.

- **Pflicht** bei zwei Arten von Code:
  1. **Datenformaten** – Byte-Aufteilungen, Schnittstellen zu fremden Systemen,
     alles, worüber wir uns mit jemand anderem einig sein müssen. Der Test ist
     dort die Spezifikation: eine Beschreibung, die man **ausführen** kann.
  2. **Reinen Berechnungen** – Fachlogik ohne Seiteneffekte, mit bekannten
     Sollwerten.
- **Bevorzugt** überall sonst, wo es ohne Verrenkungen geht.
- **Ausgenommen,** weil Tests im Nachhinein dort ehrlicher sind: Gestaltung und
  Layout, sowie der Lebenszyklus nativer Dienste – der braucht ein Gerät, keinen
  Unit-Test.
- **Der Test beschreibt Verhalten, nicht Umsetzung.** Ein Test, der bei einem
  reinen Umbau ohne Verhaltensänderung bricht, ist falsch geschrieben und wird
  neu geschrieben, nicht angepasst.
- Bei Fehlersuche gilt dasselbe: **zuerst ein Test, der den Fehler zeigt.** Ohne
  ihn ist nicht belegbar, dass die Ursache behoben wurde und nicht nur das
  Symptom.

### Umfang

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

## Messwerte und ihre Herkunft

Ausführlich in [messquellen.md](messquellen.md). Verbindlich davon:

- **Keine Zahl schlägt eine falsche Zahl.** Wo nichts messbar ist, steht nichts
  — mit einem Satz, der sagt warum. Eine geschätzte Zahl wird als solche
  gekennzeichnet, nie stillschweigend gezeigt.
- **Die Herkunft wird immer mitgespeichert**, auch wenn sie nicht angezeigt
  wird. Ohne sie mischt der Verlauf unbemerkt verschiedene Güten, und
  nachträglich lässt sie sich nicht ergänzen.
- **Verfügbarkeit kennt drei Zustände, nicht zwei:** nicht vorhanden, nicht
  erlaubt, meldet sich nicht. Der Satz „dein Gerät hat das nicht“ darf nur
  fallen, wenn die Abfrage ohne fehlende Berechtigung möglich war. Im Zweifel
  gilt der mildere Zustand.
- **Eine neue Quelle ändert eine Datei, nicht dreissig Bildschirme.** Wer eine
  Messgröße abfragt, erfährt nicht, woher sie kam.

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

## Merge nach `main`

Abgeschlossene Arbeit bleibt nicht auf Branches liegen. Der Merge ist der
automatische Abschluss eines Arbeitspakets – er wird ohne zusätzliche
Rückfrage durchgeführt, sobald **alle** folgenden Kriterien erfüllt sind, und
in der Übergabe ausdrücklich benannt (was gemergt wurde, Commit-IDs).

**Merge-Kriterien (alle erforderlich):**

1. Das Arbeitspaket ist fachlich abgeschlossen und die Definition of Done ist
   erfüllt – kein halbfertiger Zwischenstand, der `main` funktional
   verschlechtert.
2. `python scripts/run_tests.py --suite all` ist auf dem endgültigen
   Branch-Stand erfolgreich.
3. Bei sichtbaren UI-Änderungen liegt eine visuelle Abnahme vor (Screenshots
   hell/dunkel oder gleichwertiger Nachweis) und es gibt keine offenen
   Einwände dazu.
4. Es gibt keine offene Ausnahme nach dem Ausnahmeverfahren und keine
   unentschiedene fachliche Frage im Diff.
5. Die Divergenz wurde gegen **`origin/main`** geprüft (nach `git fetch`),
   nicht gegen ein möglicherweise veraltetes lokales `main` – parallele
   Sessions mergen über Squash-PRs. Konflikte werden aufgelöst, das Ergebnis
   wird verifiziert (z. B. Diff gegen den Branch-Stand) und die Suite läuft
   danach erneut.
6. Merge-Form: Fast-Forward, wenn möglich; sonst Merge-Commit mit
   aussagekräftiger Nachricht. Direkt nach dem Merge wird gepusht.

**Nicht automatisch mergen – hier ist eine ausdrückliche Freigabe nötig:**

- Datenbank-Migrationen ohne dokumentierte Rückwärts- und
  Bestandsdatenstrategie.
- Sicherheits- oder datenschutzrelevante Änderungen (Authentifizierung,
  Kryptografie, Gesundheitsdaten nach DSGVO Art. 9).
- Experimentelle Spikes oder bewusst unfertige Stände.

`main` wird automatisch deployt (Vercel). Ein Merge ist damit zugleich ein
Deployment – die Kriterien gelten deshalb ohne Ausnahme.

## Ausnahmeverfahren

Kann eine Regel wegen fehlender Infrastruktur oder einer anderen echten
Blockade nicht eingehalten werden, muss die Übergabe enthalten:

1. die konkret nicht erfüllte Regel,
2. den Grund und das daraus entstehende Risiko,
3. die sicherste derzeit mögliche Ersatzlösung,
4. eine klar beschriebene Folgeaufgabe zur vollständigen Behebung.

Ohne diese Angaben darf die Abweichung nicht als erledigt bezeichnet werden.
