# MyProSole
MVP

## Entwicklung

Für beide Teilprojekte gelten die
[verbindlichen Entwicklungsstandards](docs/DEVELOPMENT_STANDARDS.md). Sie sind
modell- und editorunabhängig über Repository-Anweisungen, lokale Git-Hooks,
GitHub Actions und die Pull-Request-Checkliste integriert.

Lokale Qualitäts-Gates einmalig aktivieren:

```bash
python scripts/setup_quality_gates.py
```

Vollständige Prüfung vor Übergabe oder Push:

```bash
python scripts/run_tests.py --suite all
```
