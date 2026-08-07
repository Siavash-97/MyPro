"""Den klickbaren Entwurf zu Cloudflare Pages hochladen.

Warum ein Skript und nicht nur ein Befehl in der Anleitung: hochgeladen werden
darf ausschliesslich ``myprosole_app/design``. Ein Tippfehler im Pfad – ein
Punkt zu viel – wuerde das ganze Repository veroeffentlichen, samt
Geschaeftsplan und Trainingskonzept. Das laesst sich nicht zurueckholen.
Deshalb prueft dieses Skript den Ordner, bevor es ihn weitergibt.

Einmalig vorher anmelden::

    npx wrangler login

Danach::

    python scripts/deploy_prototype.py

Mit ``--pruefen`` laeuft nur die Pruefung, ohne etwas hochzuladen.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_ROOT = REPO_ROOT / "myprosole_app" / "design"
PROJECT_NAME = "myprosole-prototyp"

# Alles, was nach Unterlage aussieht statt nach Web-Entwurf. Solche Dateien
# gehoeren nicht auf eine oeffentliche Adresse.
FORBIDDEN_SUFFIXES = {".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".env", ".key", ".pem"}
REQUIRED_FILES = ("manifest.webmanifest", "sw.js", "mockups/welcome.html")


def check() -> list[str]:
    """Gibt die Gruende zurueck, aus denen nicht hochgeladen werden darf."""
    reasons: list[str] = []

    if not UPLOAD_ROOT.is_dir():
        return [f"{UPLOAD_ROOT} gibt es nicht."]

    for name in REQUIRED_FILES:
        if not (UPLOAD_ROOT / name).is_file():
            reasons.append(f"Es fehlt: {name}")

    # Der Ordner darf nicht versehentlich das Repository selbst sein.
    if (UPLOAD_ROOT / ".git").exists():
        reasons.append("Der Ordner enthaelt .git – das ist nicht der Entwurfsordner.")

    for path in UPLOAD_ROOT.rglob("*"):
        if path.is_file() and path.suffix.lower() in FORBIDDEN_SUFFIXES:
            reasons.append(f"Gehoert nicht ins Netz: {path.relative_to(REPO_ROOT)}")

    return reasons


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pruefen",
        action="store_true",
        help="nur pruefen, nichts hochladen",
    )
    args = parser.parse_args()

    reasons = check()
    if reasons:
        print("Kein Upload. Gruende:")
        for reason in reasons:
            print(f"  - {reason}")
        return 1

    files = sum(1 for path in UPLOAD_ROOT.rglob("*") if path.is_file())
    print(f"Geprueft: {UPLOAD_ROOT.relative_to(REPO_ROOT)} mit {files} Dateien.")

    if args.pruefen:
        print("Nur Pruefung, nichts hochgeladen.")
        return 0

    command = [
        "npx",
        "--yes",
        "wrangler@latest",
        "pages",
        "deploy",
        str(UPLOAD_ROOT),
        f"--project-name={PROJECT_NAME}",
        "--branch=main",
        "--commit-dirty=true",
    ]
    print("Aufruf:", " ".join(command))
    return subprocess.run(command, cwd=REPO_ROOT, shell=sys.platform == "win32").returncode


if __name__ == "__main__":
    raise SystemExit(main())
