#!/usr/bin/env python3
"""Verify that model-independent development policy entry points stay installed."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
POLICY_PATH = ROOT / "docs" / "DEVELOPMENT_STANDARDS.md"

REQUIRED_CONTENT: dict[Path, tuple[str, ...]] = {
    POLICY_PATH: (
        "## Sicherheit",
        "## Datenbank",
        "## Code-Struktur",
        "## Tests und Qualitäts-Gates",
        "## Datenschutz",
        "## Arbeitsdisziplin und Definition of Done",
        "## Ausnahmeverfahren",
        "docs/seiten-regeln.md",
    ),
    ROOT / "docs" / "seiten-regeln.md": (
        "## Der Aufbau einer Seite",
        "## Farben",
        "## Abstände, Radien, Schrift",
        "## Prüfliste für jede neue Seite",
    ),
    ROOT / "AGENTS.md": ("docs/DEVELOPMENT_STANDARDS.md", "run_tests.py --suite all"),
    ROOT / "CLAUDE.md": ("docs/DEVELOPMENT_STANDARDS.md", "run_tests.py --suite all"),
    ROOT / ".github" / "copilot-instructions.md": (
        "docs/DEVELOPMENT_STANDARDS.md",
        "run_tests.py --suite all",
    ),
    ROOT / ".github" / "pull_request_template.md": (
        "Definition of Done",
        "Keine Secrets",
        "run_tests.py --suite all",
    ),
    ROOT / "myprosole_app" / "MODULE.md": ("Kern vs. Modul",),
}


def validate() -> list[str]:
    errors: list[str] = []
    for path, snippets in REQUIRED_CONTENT.items():
        relative_path = path.relative_to(ROOT)
        if not path.is_file():
            errors.append(f"Pflichtdatei fehlt: {relative_path}")
            continue
        content = path.read_text(encoding="utf-8")
        for snippet in snippets:
            if snippet not in content:
                errors.append(f"{relative_path}: Pflichtinhalt fehlt: {snippet!r}")
    return errors


def main() -> int:
    errors = validate()
    if errors:
        print("Entwicklungsstandards sind nicht vollständig integriert:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Entwicklungsstandards und KI-/Review-Einstiegspunkte sind vollständig integriert.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
