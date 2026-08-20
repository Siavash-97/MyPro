# Sicherheits-Scans für Claude-Code-Skills/Plugins/MCP-Server

Standing rule (seit 2026-08-12): **jedes neue Skill/Plugin/MCP wird vor dem
produktiven Einsatz mit [SkillSpector](https://github.com/NVIDIA/SkillSpector)
gescannt, und das Ergebnis wird hier protokolliert** — unabhängig davon, ob
der Scan sauber ausfällt oder nicht.

## Warum protokollieren, nicht nur scannen

Ein Score allein sagt nichts darüber, ob ein Fund echt ist. SkillSpector ist
ein guter erster Filter, aber kein Urteil, dem man blind vertraut — siehe der
Impeccable-Fall unten: 100/100 CRITICAL bei der ersten Prüfung, und trotzdem
kein echtes Problem. Ohne Protokoll müsste jede zukünftige Session diese
Prüfung wiederholen, um zum selben (richtigen) Schluss zu kommen. Mit
Protokoll steht die Begründung einmal fest.

## Vorgehen

```bash
# Erst-Scan (ohne LLM = schneller, rein statische Analyse)
skillspector scan <pfad-oder-url> --no-llm

# Bei Funden: JEDE als kritisch markierte Zeile im echten Quellcode nachlesen,
# nicht nur die Score-Zusammenfassung glauben. Erst danach entscheiden:
# - Echter Fund -> Skill nicht installieren / Autor kontaktieren
# - Fehlalarm, nachvollziehbar begründet -> Baseline anlegen, hier eintragen

skillspector baseline <pfad> --no-llm \
  --reason "<konkrete Begründung mit Dateiname:Zeile>" \
  -o docs/skillspector-baselines/<skill-name>.yaml

# Künftige Scans mit Baseline (nur neue Funde werden gemeldet):
skillspector scan <pfad> --no-llm --baseline docs/skillspector-baselines/<skill-name>.yaml
```

Baseline-Dateien liegen versioniert unter
[`docs/skillspector-baselines/`](skillspector-baselines/).

## Protokoll

### 2026-08-12 — agent-reach

- **Quelle:** `~/.claude/skills/agent-reach` (installiert via `pipx`, siehe
  Chat-Verlauf; global, da systemweites CLI-Tool wie `git`/`gh`)
- **Ergebnis:** 6/100, LOW, SAFE
- **Fund:** 1× RP1 (MCP-Server-Referenz ohne angepinnte Version,
  `references/career.md:21`)
- **Entscheidung:** Kein Baseline nötig, Fund ist eine reine
  Versions-Hygiene-Anmerkung. Deckt sich mit der vorherigen manuellen
  Code-Prüfung (kein `postinstall`-Hook, lokale Zugangsdaten-Speicherung,
  keine Telemetrie, `SECURITY.md` vorhanden).

### 2026-08-12 — impeccable

- **Quelle:** `C:\MyProSole\MyProSole\.claude\skills\impeccable`
  (projektlokal installiert via `npx impeccable install`)
- **Ergebnis (Erst-Scan):** 100/100, **CRITICAL**, "DO NOT INSTALL" — 58
  Funde
- **Manuelle Nachprüfung der konkret gemeldeten Zeilen** (nicht nur der
  Kategorie vertraut):
  - *HIGH — P6 Direct Prompt Extraction*, `scripts/lib/design-parser.mjs:390`:
    Zeile ist `return rules;` am Ende einer Funktion, die
    Markdown-Design-Regeln (z. B. "The Contrast Rule") aus
    Dokumentationstext extrahiert. Hat nichts mit dem Auslesen von
    KI-System-Prompts zu tun — Fehlalarm, ausgelöst durch die Wörter
    "rules"/"extract" im Kontext eines Regel-*Parsers*.
  - *HIGH — P6*, `scripts/detector/shared/inline-ignores.mjs:132`: Zeile ist
    eine Hilfsfunktion, die prüft, ob Lint-Ignore-Kommentare im Quelltext
    vorhanden sind (`impeccable-ignore-next-line`-Mechanik). Ebenfalls
    fachfremd zum gemeldeten Muster — Fehlalarm.
  - *MEDIUM — SSRF2 Internal Network Request*, mehrere Fundstellen in
    `scripts/live-browser.js` (u. a. Zeile 4199): browserseitiger Code, der
    mit `fetch('http://localhost:' + PORT + ...token...)` den eigenen,
    token-gesicherten lokalen Begleitprozess von Impeccables dokumentierter
    "Live Mode"-Funktion anspricht (Live-Vorschau während der Bearbeitung).
    Kein Zugriff auf fremde interne Netzwerke — Fehlalarm.
  - *MEDIUM — RP1*, ca. 50 Wiederholungen: `npx impeccable...`-Aufrufe ohne
    fest angepinnte Versionsnummer. Real, aber eine verbreitete
    Hygiene-Praxis, kein Hinweis auf Kompromittierung.
- **Abgleich mit vorheriger manueller Code-Prüfung** (vor der Installation,
  siehe Chat-Verlauf): keine `postinstall`/`preinstall`-Hooks in
  `package.json`, lesbarer, nicht verschleierter CLI-Einstieg, ausschließlich
  bekannte, seriöse npm-Abhängigkeiten (css-tree, htmlparser2, marked,
  puppeteer). Beide Prüfungen — Quellcode vorab, SkillSpector-Funde im
  Nachgang — stützen sich gegenseitig: nichts deutet auf echte
  Kompromittierung hin.
- **Entscheidung:** Fehlalarme als Baseline hinterlegt
  ([`docs/skillspector-baselines/impeccable.yaml`](skillspector-baselines/impeccable.yaml)),
  mit Begründung pro Fund-Typ im Baseline-File selbst. Score mit Baseline:
  **0/100, LOW, SAFE**. Impeccable bleibt installiert.
- **Lehre für künftige Scans:** SkillSpector schlägt bei Skills, deren
  eigener Code Regel-/Muster-Text verarbeitet (Linter, Design-Parser,
  Anti-Pattern-Detektoren), überdurchschnittlich oft falsch aus — der Scanner
  kann den fachlichen Kontext ("das ist ein Parser für X", nicht "das ist X")
  nicht unterscheiden. Bei solchen Skills ist eine manuelle Zeilen-Prüfung
  der Funde besonders wichtig, nicht optional.

### 2026-08-15 — taste-skill und ui-ux-pro-max

- **Anlass:** Beide kamen über den Branch
  `claude/mockup-development-folder-eddxrz` (Commit `760d9c5`) und sollten
  nach `main` gemergt werden. Prüfung fand **vor** dem Merge statt.
- **Werkzeug:** SkillSpector war weder im Projekt noch global installiert.
  Stattdessen manuelle Prüfung — also genau der Teil, auf den es laut
  bisheriger Erfahrung ohnehin ankommt.
- **Umfang:** 218 Dateien im Skill-Verzeichnis, davon neu gegenüber `main`
  nur `taste-skill/` und `ui-ux-pro-max/`. `impeccable` war bereits
  installiert und wurde am 12.08.2026 geprüft.
- **Ausführbarer Code:** `taste-skill` enthält **keinen** — nur eine
  SKILL.md mit 1206 Zeilen Dokumentation. `ui-ux-pro-max` bringt 15
  Python-Dateien mit, davon 10 Tests.
- **Gesucht wurde in den Python-Dateien nach:** `subprocess`, `os.system`,
  `os.popen`, `eval`, `exec`, `__import__`, `base64`, `urlopen`,
  `requests.get/post`, Socket- und HTTP-Importen, Schreibzugriffen
  (`open(..., 'w'/'a')`), `shutil.rmtree`, `unlink`, Zugriffen auf
  `os.environ` / `getenv`.
  **Einziger Treffer:** `design_system.py:615` liest `os.environ['COLORTERM']`,
  um zu entscheiden, ob das Terminal Farben kann. Harmlos.
  Kein Netzzugriff, kein Prozessstart, keine Dateiänderung, keine
  Verschleierung.
- **Gesucht wurde in den SKILL.md-Dateien nach** Anweisungen, die auf
  Prompt-Injektion hindeuten: „ignore previous instructions", „do not
  tell/mention", „without asking", Zugriff auf `.env`, Passwörter,
  API-Schlüssel, Token, `curl`/`wget`, `rm -rf`, `chmod`, `sudo`,
  unverschlüsselte oder auffällige Domains.
  **Alle Treffer harmlos:** durchweg „design tokens", ein Shopify-Beispiel
  mit `%SHOPIFY_API_KEY%` als Platzhalter im HTML, und `npm install`-Befehle
  für offizielle UI-Bibliotheken (Fluent, Material, Atlaskit).
- **Was die Skills tun:** `taste-skill` ist reine Anleitung für
  UI-Entscheidungen. `ui-ux-pro-max` durchsucht offline mitgelieferte CSV-
  und JSON-Dateien (Farben, Schriften, Icons, Stack-Empfehlungen) — die
  Daten liegen im Skill, es wird nichts nachgeladen.
- **Entscheidung:** beide unbedenklich, Merge nach `main` durchgeführt.
- **Offen:** Ein SkillSpector-Lauf wäre trotzdem gut, sobald das Werkzeug
  wieder verfügbar ist — die manuelle Suche deckt bekannte Muster ab, aber
  eine zweite, unabhängige Sicht schadet nie.
  → **Am 17.08.2026 nachgeholt, siehe unten. Es hat sich gelohnt.**

### 2026-08-17 — Nachscan aller vorhandenen Skills

- **Anlass:** ausdrücklicher Wunsch, zur Sicherheit erneut zu scannen.
- **Werkzeug:** SkillSpector war weiterhin nicht installiert. `pipx install
  skillspector` scheitert — **das Paket gibt es auf PyPI nicht.** Der Weg, der
  funktioniert:
  ```bash
  pipx install "git+https://github.com/NVIDIA/SkillSpector.git"
  ```
  Ergebnis: Version 2.9.3 unter `~/.local/bin/skillspector`. Das Verzeichnis
  liegt nicht im PATH der Shell; entweder `pipx ensurepath` oder den vollen
  Pfad benutzen.

| Skill | Ergebnis | Anmerkung |
| --- | --- | --- |
| `web-perf` | **0/100, LOW, SAFE** | keine Funde |
| `agent-reach` | **6/100, LOW, SAFE** | derselbe RP1-Fund wie am 12.08. — unverändert |
| `taste-skill` | **15/100, LOW, SAFE** | 3× RP1 (`npx shadcn` ohne Version), 1× EA2 |
| `impeccable` | **0/100, LOW, SAFE** *mit* Baseline | ohne Baseline weiterhin 100/100 CRITICAL, 60 Funde unterdrückt |
| `ui-ux-pro-max` | **100/100, CRITICAL** | zwei echte Funde, siehe unten |

#### Der Fund, der die Prüfung vom 15.08. berichtigt

SkillSpector meldet in `ui-ux-pro-max` zweimal **AST4 — subprocess module
call**. Das Protokoll vom 15.08.2026 hält ausdrücklich fest, es sei nach
`subprocess` gesucht worden und der einzige Treffer sei
`design_system.py:615` (`os.environ['COLORTERM']`) gewesen. **Das war falsch.**

Die Zeilen nachgelesen:

- `scripts/tests/test_core.py:256` — `subprocess.Popen([sys.executable,
  str(search_script), …])`: startet achtmal das eigene `search.py` des Skills,
  um zu prüfen, dass beim gleichzeitigen Schreiben nur ein Prozess schreibt.
- `scripts/tests/test_catalog_refresh.py:26` — `subprocess.run([sys.executable,
  *args], cwd=REPO, …)`: ruft die eigenen Aktualisierungsskripte des Skills auf.

Beide starten den laufenden Python-Interpreter mit Dateien aus dem Skill
selbst. Kein Shell-Aufruf, kein fremdes Programm, keine Eingabe von außen.
**Sachlich harmlos.**

Falsch war nicht das Urteil, sondern der Umfang der Suche: Sie hat die zehn
Testdateien nicht erfasst, obwohl das Protokoll „15 Python-Dateien, davon 10
Tests" selbst nennt. Testcode ist Code — er wird ausgeführt, wenn ihn jemand
ausführt.

- Zweiter Fund: **LP3 — Skill declares no tool scope.** Real, aber eine
  Härtungsanmerkung, kein Hinweis auf Kompromittierung.
- **Entscheidung:** `ui-ux-pro-max` bleibt. Baseline am 17.08.2026 angelegt:
  [`docs/skillspector-baselines/ui-ux-pro-max.yaml`](skillspector-baselines/ui-ux-pro-max.yaml),
  74 Funde unterdrückt, Begründung mit Dateiname und Zeile im Baseline-File.
  Score mit Baseline: **0/100, LOW, SAFE**.

  ```bash
  skillspector scan .claude/skills/ui-ux-pro-max --no-llm \
    --baseline docs/skillspector-baselines/ui-ux-pro-max.yaml
  ```
- **Lehre:** Eine manuelle Suche muss ihren Umfang mit angeben. „Gesucht in den
  Python-Dateien" ist zu ungenau, wenn zwei Drittel davon Tests sind und nicht
  durchsucht wurden.

#### Die sechs Marktplatz-Plugins

Design, Engineering, Product Management, Modern Web Guidance, Productivity und
StackHawk HawkScan **lassen sich derzeit nicht scannen**: Ihr Quellcode liegt
nicht auf der Platte, sondern wird zur Laufzeit bereitgestellt. Gefunden wurde
nur ein leeres Verzeichnis `~/.claude/plugins/data/hawkscan-inline`.

Einzige Ausnahme: `web-perf` aus „Modern Web Guidance" liegt unter
`~/.claude/skills/` und ist oben geprüft.

**Das ist eine offene Ausnahme nach dem Ausnahmeverfahren, keine erledigte
Prüfung:**

1. **Nicht erfüllte Regel:** jedes neue Plugin vor dem Einsatz scannen.
2. **Grund:** kein lokaler Quellcode vorhanden.
3. **Risiko:** vier der sechs stammen von Anthropic selbst, zwei von Dritten
   (Google Chrome, StackHawk). Das Risiko ist nicht null, aber die Bezugsquelle
   ist der offizielle Marktplatz.
4. **Ersatzlösung:** Verhalten im Betrieb beobachten — insbesondere, ob ein
   Plugin ungefragt Netzzugriffe oder Prozessstarts auslöst.
5. **Folgeaufgabe:** prüfen, ob sich Plugin-Quellen exportieren lassen; sonst
   die Ausnahme bewusst und dauerhaft festhalten, statt sie in jeder Sitzung
   neu zu entdecken.

---

### 2026-08-20 — mattpocock-skills (70 Skills)

- **Quelle:** Marktplatz `mattpocock/skills` (GitHub), installiert über
  `claude plugin install mattpocock-skills@mattpocock`, Fassung 1.2.3,
  Geltungsbereich: Nutzer
- **Umfang:** 101 Dateien, 100 % inspiziert
- **Ergebnis:** **100/100, CRITICAL, „DO NOT INSTALL"** — 13 Funde
- **Bewertung nach manueller Prüfung: alle 13 Fehlalarme.** Baseline unter
  [`skillspector-baselines/mattpocock-skills.yaml`](skillspector-baselines/mattpocock-skills.yaml)

Damit ist es der zweite Fall nach Impeccable, in dem die Höchstwertung keinen
echten Fund bedeutet. Der Grund ist hier besonders deutlich.

#### Die fünf HIGH-Funde, einzeln nachgelesen

| Fund | Ort | Warum Fehlalarm |
|---|---|---|
| TM1 Tool Parameter Abuse | `git-guardrails-claude-code/SKILL.md:13` | Dort steht die **Liste der Befehle, die das Skill blockiert** (`git push`, `git reset --hard`, `git clean -fd`). Der Scanner liest eine Schutzliste als Angriff. |
| TM1 Tool Parameter Abuse | `.../scripts/block-dangerous-git.sh:8` | Dasselbe: das Feld `DANGEROUS_PATTERNS`. |
| AS1 Agent Config Directory Access | `git-guardrails-claude-code/SKILL.md:24` | Das Skill fragt, ob der Hook nach `.claude/settings.json` oder `~/.claude/settings.json` soll. Zugriff ist der **deklarierte Zweck** und wird vorher erfragt. |
| PE3 Credential Access | `engineering/wizard/template.sh:98` | `ask()` liest vorhandene `.env`-Werte als Vorbelegung eines interaktiven Assistenten. Lokal, sichtbar, kein Abfluss. |
| P6 Direct Prompt Extraction | `diagnosing-bugs/scripts/hitl-loop.template.sh:10` | Ein **Kommentar**, der erklärt, wie eine Mensch-im-Kreis-Hilfe Antworten als `KEY=VALUE` zurückgibt. |

Die vier MEDIUM `RP1` sind ungepinnte `npx`-Aufrufe in Dokumentation
(`npx skills`, `npx husky`, 2× `npx lint-staged`) — Versionshygiene, kein Risiko.
`TM2` in `to-tickets/SKILL.md:40` beschreibt Expand-Contract-Refactoring.

#### Kein Sicherheitsproblem, aber für uns wichtig

Drei Dinge, die der Scanner nicht bewertet und die den Betrieb betreffen:

1. **`git-guardrails-claude-code` blockiert `git push`.** Das steht unserer
   Merge-Regel und dem Ablauf „nach jeder Aufgabe pushen" direkt entgegen.
   **Diesen Hook nicht einrichten.**
2. **`grilling` und `grill-me` starten Unteragenten,** um Fakten selbst zu
   suchen (`grilling/SKILL.md:26`). Sinnvoll gedacht, aber es muss bewusst
   geschehen und nicht nebenbei.
3. **`loop-me` verschiebt Rückfragen bewusst so weit wie möglich nach hinten**
   („Push right … Do maximal work before involving the human",
   `loop-me/SKILL.md:27`). Bei einem Einzelgründer, der sich auf Zwischenberichte
   verlässt, ist das die falsche Voreinstellung. **Nicht benutzen.**

#### Künftige Scans

```bash
skillspector scan ~/.claude/plugins/marketplaces/mattpocock/skills --no-llm \
  --baseline docs/skillspector-baselines/mattpocock-skills.yaml
```

Meldet nur noch **neue** Funde — wichtig, weil das Marktplatz-Verzeichnis bei
jedem `plugin update` neu geklont wird.
