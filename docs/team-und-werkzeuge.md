# Team und Werkzeuge

Wer macht was, und womit. Angelegt am 17.08.2026, weil Aufgaben bis dahin
ungeteilt liefen und die vorhandenen Werkzeuge nicht zuverlässig zum Einsatz
kamen.

Die Rollen liegen als Dateien in [`.claude/agents/`](../.claude/agents/) und
sind unter ihrem Namen aufrufbar.

---

## Die Rollen

| Rolle | Zuständig für | Darf ändern | Werkzeuge |
| --- | --- | --- | --- |
| **oberflaeche** | Screens, Farben, Typografie, Abstände, Layout, Zugänglichkeit, Klicktiefe | ja | `impeccable`, `ui-ux-pro-max`, `taste-skill`, `dataviz`, `web-perf` |
| **datenbank** | Schema, Migrationen, Normalform, Indizes, Zeilenrechte, Bestandsdaten, Aufbewahrung | ja | Supabase CLI, Docker |
| **sicherheit** | Zeilenrechte, Prüfbedingungen, Auslöser, Anmeldung, Art.-9-Daten, Geheimnisse, fremder Code | **nein** | `security-review`, `skillspector` |
| **pruefung** | Fertigen Diff durchsehen: Korrektheit, Wiederverwendung, Vereinfachung | **nein** | `code-review`, `simplify` |
| **recherche** | Nachschlagen vor Festlegungen: Bibliotheken, Anbieter, Tarife, Erfahrungsberichte | **nein** | `agent-reach`, Websuche, Seitenabruf |

**Warum drei Rollen nichts ändern dürfen:** Wer prüft und gleichzeitig
repariert, prüft am Ende die eigene Reparatur. Befund und Behebung bleiben
getrennt; die Behebung macht, wer zuständig ist.

---

## Wann welche Rolle

| Anlass | Rolle |
| --- | --- |
| Ein Screen entsteht oder wird überarbeitet | oberflaeche |
| „Sieht komisch aus", Farbe, Abstand, Überlauf | oberflaeche |
| Eine Tabelle, Spalte, Regel oder ein Index ändert sich | datenbank |
| Eine Abfrage ist langsam, die Datenbank wächst zu schnell | datenbank |
| Vor jeder Migration und vor dem Merge sicherheitsrelevanter Änderungen | sicherheit |
| Ein neues Skill, Plugin oder MCP soll benutzt werden | sicherheit |
| Vor Übergabe oder Merge eines fertigen Stands | pruefung |
| Neue Abhängigkeit, Anbieter, Tarif; schwer umkehrbare Entscheidung | recherche |
| Verdacht auf einen bekannten Fehler in fremdem Code | recherche |

**Nicht für alles.** Eine Rolle wird gerufen, wenn ihr Gebiet betroffen ist und
die Aufgabe mehr als ein paar Handgriffe umfasst. Eine Tippfehlerkorrektur
braucht kein Team – der Aufruf kostet mehr, als er einbringt.

---

## Der Werkzeugkasten

### Docker und die Supabase-CLI — die wichtigste Ergänzung

Beide sind installiert (Docker 29.1.3, Compose v2.40.3, Supabase CLI 2.113.0).
Zusammen lösen sie ein Problem, das bisher in jeder Übergabe als Ausnahme
stand: **Migrationen ließen sich nicht prüfen, weil die Zugangsdaten zur echten
Datenbank nicht im Projekt liegen.** Geschrieben wurde also blind.

Mit laufendem Docker Desktop startet `supabase start` eine vollständige
Postgres-Instanz mit denselben Erweiterungen, und `supabase db reset` spielt
alle Migrationen von 0001 an der Reihe nach ein. Damit lässt sich vorher
feststellen, was sonst erst auf dem Telefon auffällt:

- Ob eine Prüfbedingung eine bestehende Zeile abweist
- Ob ein Auslöser den Vorgang mitreißt, den er begleiten soll
- Ob eine Migration zweimal ausgeführt werden kann
- Ob eine Regel wirklich greift — mit einer Testsitzung statt aus dem Kopf

Genau die zwei Fehler vom 17.08.2026 wären dabei aufgefallen, bevor sie auf ein
Gerät kamen.

**Regel ab jetzt:** Eine Migration gilt erst dann als fertig, wenn sie gegen
eine lokale Datenbank gelaufen ist. Nur die *Anwendung* auf die produktive
Datenbank bleibt beim Menschen.

**Was sie am 19.08.2026 im ersten vollständigen Durchlauf gefunden hat** —
beides jahrelang unbemerkt, beides nur so auffindbar:

- Der Auslöser, der bei jeder Registrierung das Profil anlegt, stand in
  keiner Migration. Er existierte allein in der produktiven Datenbank, von
  Hand gesetzt (behoben mit 0035).
- 43 Tabellen mit 135 Zeilenregeln — und für **keine einzige** ein
  Zugriffsrecht. Die App lief nur, weil Supabase neue Tabellen automatisch
  freigab; diese Einstellung wird zum 30.10.2026 abgeschafft (behoben mit
  0037).

Eine aus den Migrationen aufgebaute Datenbank war bis dahin für die App
vollständig unbenutzbar.

Der zweite Einsatzzweck kommt später: Die Auswertungs-Schnittstelle wird als
Container gebaut, damit der Anbieter austauschbar bleibt — siehe
[bewertung-web-app-zu-echter-app.md](bewertung-web-app-zu-echter-app.md).

### Die Prüfsuite

`python scripts/run_tests.py --suite all` — **neun Prüfungen**, seit dem
19.08.2026 nach Projekten getrennt aufrufbar:

```
--project app      6 Prüfungen   nur MyProSole
--project planner  4 Prüfungen   nur der Projektplaner
(ohne Angabe)      9 Prüfungen   alles
```

**Warum getrennt:** Die Browserprüfungen der MyProSole-Entwürfe lagen bis
dahin unter `project-planner/e2e/` — 1307 Zeilen gegenüber 449 des Planers
selbst. Wer die Entwürfe änderte, musste im Planer editieren; ein
flackernder Test im Planer ließ das Prüftor für MyProSole rot werden. Jetzt
liegen sie unter `myprosole_app/e2e/entwuerfe.spec.ts` mit eigenem
Playwright-Aufbau.

**Am Projektplaner wird nichts geändert, solange nicht ausdrücklich am
Planer gearbeitet wird.**

Zwei Prüfungen flackern und sind als solche benannt, nicht stillgelegt:
`project-planner.spec.ts:273` (Ziehen und Ablegen) und
`entwuerfe.spec.ts:919` (zeitabhängig unter Last). Ein Prüftor, das mal grün
und mal rot ist, prüft nichts — beide gehören eigens behoben.

### SkillSpector

Installiert unter `~/.local/bin/skillspector` (Version 2.9.3, aus dem
GitHub-Repository — auf PyPI gibt es das Paket nicht). Zuständigkeit: Rolle
**sicherheit**. Vorgehen und Protokoll in
[skill-security-scans.md](skill-security-scans.md).

Wichtig: Wo eine Baseline existiert, muss sie mitgegeben werden. Ohne sie
meldet `impeccable` weiterhin 100/100 CRITICAL — mit ihr 0/100.

### agent-reach

Durchsucht GitHub, Reddit und Foren. Zuständigkeit: Rolle **recherche**. Die
zugehörige Regel steht in
[DEVELOPMENT_STANDARDS.md](DEVELOPMENT_STANDARDS.md) unter „Recherche vor
technischen Festlegungen".

### Die Design-Skills

`impeccable` läuft zusätzlich automatisch als Hook bei Änderungen an
Oberflächendateien und meldet, was sich statisch feststellen lässt. Das ersetzt
den bewussten Aufruf nicht — der Hook prüft, er entwirft nicht.

### Was nicht benutzt wird, solange es niemand verlangt

Mehrstufige Agenten-Workflows. Sie starten Dutzende Läufe und kosten
entsprechend. Der Einsatz braucht eine ausdrückliche Ansage.

---

## Was noch fehlt

- **Eine Rolle für Android/Capacitor** — sinnvoll erst, wenn Schritt 1 aus
  [plan-android-app.md](plan-android-app.md) steht. Vorher wüsste sie nichts,
  was nicht schon im Plan steht.
- **Die sechs Marktplatz-Plugins sind nicht scanbar.** Ihr Quellcode liegt
  nicht auf der Platte; er kommt zur Laufzeit. Nur `web-perf` aus „Modern Web
  Guidance" ist als Datei vorhanden und wurde geprüft. Solange das so ist, ist
  die Scan-Regel für diese Plugins technisch nicht erfüllbar — das ist eine
  offene Ausnahme, keine erledigte Prüfung.
