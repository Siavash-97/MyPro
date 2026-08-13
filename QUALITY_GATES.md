# Verbindliche Qualitätsregeln

Diese Regeln gehören zum Repository und sind deshalb unabhängig von Editor,
KI-Modell oder Arbeitsweise. Änderungen von Claude, Codex/ChatGPT, VS Code,
Cursor oder manueller Entwicklung durchlaufen dieselben Prüfungen.

## Regel 1: Unit-Tests

Unit-Tests prüfen kleine fachliche Einheiten isoliert und schnell.

```powershell
python scripts/run_tests.py --suite unit
```

- Projektplaner: Vitest (`npm run test:unit`)
- MyProSole-Auswertung: Pytest (`python -m pytest tests -q`)
- MyProSole-Web: TypeScript-Check und Vite-Build (`npm run build`)
- Der Git-`pre-commit`-Hook führt diese Suite vor jedem Commit aus.

## Regel 2: Automatisierte Ablauf-Tests

Automatisierte Tests prüfen echte Abläufe über mehrere Module hinweg.

```powershell
python scripts/run_tests.py --suite automated
```

- Projektplaner: Playwright steuert einen echten Chromium-Browser.
- MyProSole-Auswertung: Pipeline-Integration und Streamlit AppTest.
- Der Git-`pre-push`-Hook führt Unit- und Ablauf-Tests vor jedem Push aus.

Alle Prüfungen zusammen:

```powershell
python scripts/run_tests.py --suite all
```

## Einmalige Einrichtung

```powershell
python scripts/setup_quality_gates.py --install
```

Das Skript aktiviert den versionierten Hook-Pfad, erstellt die Python-Umgebung,
installiert die npm-Abhängigkeiten und lädt den Playwright-Testbrowser. GitHub
Actions wiederholt alle Prüfungen zentral bei jedem Push und Pull Request. Selbst
wenn jemand lokale Hooks mit `--no-verify` umgeht, bleibt die CI-Prüfung bestehen.

## Neue Funktionen

Jede neue fachliche Funktion benötigt mindestens:

1. einen Unit-Test für ihre Kernlogik;
2. einen automatisierten Ablauf-Test für den wichtigsten Nutzerweg oder die
   relevante Integrationsstrecke.

Fehlgeschlagene Tests werden behoben; sie werden nicht gelöscht, übersprungen
oder abgeschwächt, nur damit ein Commit oder Push durchläuft.
