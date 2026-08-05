#!/usr/bin/env python3
"""Configure tracked Git hooks and optionally install all test dependencies."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "myprosole_app"
PLANNER = ROOT / "project-planner"
VENV = APP / ".venv"


def run(command: list[str], cwd: Path = ROOT) -> None:
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=cwd, check=True)


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="Installiert zusätzlich Python-, npm- und Browser-Abhängigkeiten.")
    args = parser.parse_args()

    run(["git", "config", "core.hooksPath", ".githooks"])
    print("Git-Hooks aktiviert: .githooks")

    if args.install:
        if not venv_python().is_file():
            run([sys.executable, "-m", "venv", str(VENV)])
        run([str(venv_python()), "-m", "pip", "install", "-r", "requirements-dev.txt"], APP)
        npm = "npm.cmd" if os.name == "nt" else "npm"
        npx = "npx.cmd" if os.name == "nt" else "npx"
        run([npm, "ci"], PLANNER)
        run([npx, "playwright", "install", "chromium"], PLANNER)

    print("Fertig. Vollständiger Test: python scripts/run_tests.py --suite all")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
