#!/usr/bin/env python3
"""Run the repository's model- and editor-independent quality gates."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
PLANNER = ROOT / "project-planner"
APP = ROOT / "myprosole_app"
TEST_CACHE = APP / ".test-cache"


def app_python() -> str:
    candidates = [
        APP / ".venv" / "Scripts" / "python.exe",
        APP / ".venv" / "bin" / "python",
    ]
    return str(next((path for path in candidates if path.is_file()), Path(sys.executable)))


def npm_command() -> str:
    executable = "npm.cmd" if os.name == "nt" else "npm"
    resolved = shutil.which(executable)
    if not resolved:
        raise RuntimeError("npm wurde nicht gefunden. Bitte zuerst Node.js installieren.")
    return resolved


def run(label: str, command: list[str], cwd: Path) -> bool:
    print(f"\n=== {label} ===", flush=True)
    matplotlib_cache = TEST_CACHE / "matplotlib"
    matplotlib_cache.mkdir(parents=True, exist_ok=True)
    env = {
        **os.environ,
        "MPLBACKEND": "Agg",
        "MPLCONFIGDIR": str(matplotlib_cache),
        "PYTHONUTF8": "1",
    }
    try:
        result = subprocess.run(command, cwd=cwd, env=env, check=False)
    except FileNotFoundError as error:
        print(f"FEHLER: {error}", file=sys.stderr)
        return False
    if result.returncode != 0:
        print(f"FEHLGESCHLAGEN: {label} (Exit-Code {result.returncode})", file=sys.stderr)
        return False
    print(f"BESTANDEN: {label}")
    return True


def selected(project: str, expected: str) -> bool:
    return project in {"all", expected}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--suite", choices=("unit", "automated", "all"), default="all")
    parser.add_argument("--project", choices=("all", "planner", "app"), default="all")
    args = parser.parse_args()

    npm = npm_command()
    python = app_python()
    checks: list[tuple[str, list[str], Path]] = []

    if args.suite in {"unit", "all"}:
        if selected(args.project, "planner"):
            checks.append(("Projektplaner Unit-Tests", [npm, "run", "test:unit"], PLANNER))
        if selected(args.project, "app"):
            checks.append(("MyProSole Unit-Tests", [python, "-m", "pytest", "tests", "-q"], APP))

    if args.suite in {"automated", "all"}:
        if selected(args.project, "planner"):
            checks.append(("Projektplaner Browser-Automation", [npm, "run", "test:automated"], PLANNER))
        if selected(args.project, "app"):
            checks.extend(
                [
                    ("MyProSole Pipeline-Integration", [python, "test_gait_integration.py"], APP),
                    ("MyProSole Streamlit-Automation", [python, "test_shared_upload.py"], APP),
                ]
            )

    results = [run(label, command, cwd) for label, command, cwd in checks]
    failed = len([passed for passed in results if not passed])
    print(f"\n=== Ergebnis: {len(results) - failed}/{len(results)} Prüfungen bestanden ===")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
