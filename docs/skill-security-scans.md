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
