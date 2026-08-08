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
import hashlib
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
UPLOAD_ROOT = REPO_ROOT / "myprosole_app" / "design"
PROJECT_NAME = "myprosole-prototyp"
BRANCH = "main"
PUBLIC_URL = f"https://{BRANCH}.{PROJECT_NAME}.pages.dev"

# Dateien, an denen sich ablesen laesst, ob der Upload angekommen ist.
PROOF_FILES = ("design-system/components.css", "scripts/prototype-app-shell.js")

# Alles, was nach Unterlage aussieht statt nach Web-Entwurf. Solche Dateien
# gehoeren nicht auf eine oeffentliche Adresse.
FORBIDDEN_SUFFIXES = {".pdf", ".docx", ".xlsx", ".pptx", ".csv", ".env", ".key", ".pem"}
REQUIRED_FILES = ("manifest.webmanifest", "sw.js", "mockups/welcome.html")

# Harte Grenze von Cloudflare Pages. Wer sie reisst, erfaehrt es sonst erst
# nach dem Anlegen des Projekts und mitten im Hochladen.
MAX_FILE_BYTES = 25 * 1024 * 1024
# Keine Grenze, nur ein Hinweis: darueber wartet jemand mit Mobilfunk spuerbar.
HEAVY_FILE_BYTES = 3 * 1024 * 1024


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
        if not path.is_file():
            continue
        if path.suffix.lower() in FORBIDDEN_SUFFIXES:
            reasons.append(f"Gehoert nicht ins Netz: {path.relative_to(REPO_ROOT)}")
        size = path.stat().st_size
        if size > MAX_FILE_BYTES:
            reasons.append(
                f"Zu gross fuer Cloudflare Pages ({size / 1048576:.1f} MB, Grenze 25 MB): "
                f"{path.relative_to(UPLOAD_ROOT).as_posix()}"
            )

    return reasons


def heavy_files() -> list[tuple[str, float]]:
    """Dateien, die auf dem Telefon ueber Mobilfunk spuerbar warten lassen."""
    found = [
        (path.relative_to(UPLOAD_ROOT).as_posix(), path.stat().st_size / 1048576)
        for path in UPLOAD_ROOT.rglob("*")
        if path.is_file() and path.stat().st_size > HEAVY_FILE_BYTES
    ]
    return sorted(found, key=lambda entry: -entry[1])


def digest(data: bytes) -> str:
    """Zeilenenden vereinheitlichen, damit Windows und der Server vergleichbar sind."""
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()[:12]


def confirm_live(attempts: int = 6, pause: float = 4.0) -> bool:
    """Nachsehen, ob unter der Adresse wirklich das liegt, was hier liegt.

    Ohne diese Pruefung faellt ein misslungener oder vergessener Upload erst
    auf, wenn jemand mit dem Telefon einen Fehler meldet, der laengst behoben
    ist – und man sucht ihn im Code statt in der Leitung.
    """
    expected = {name: digest((UPLOAD_ROOT / name).read_bytes()) for name in PROOF_FILES}

    for attempt in range(1, attempts + 1):
        live: dict[str, str] = {}
        for name in PROOF_FILES:
            # Ohne eigenen Absender weist Cloudflare den Abruf mit 403 ab.
            request = urllib.request.Request(
                f"{PUBLIC_URL}/{name}",
                headers={"User-Agent": f"{PROJECT_NAME}-deploy-check", "Cache-Control": "no-cache"},
            )
            try:
                with urllib.request.urlopen(request, timeout=20) as answer:
                    live[name] = digest(answer.read())
            except (urllib.error.URLError, TimeoutError) as error:
                live[name] = f"nicht erreichbar ({error})"

        if live == expected:
            print(f"Bestaetigt: unter {PUBLIC_URL} liegt derselbe Stand wie hier.")
            return True

        if attempt < attempts:
            # Cloudflare braucht einen Moment, bis der neue Stand ueberall gilt.
            time.sleep(pause)

    print("ACHTUNG: die Adresse liefert nicht denselben Stand wie dieser Ordner.")
    for name in PROOF_FILES:
        if live.get(name) != expected[name]:
            print(f"  {name}: hier {expected[name]}, dort {live.get(name)}")
    return False


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
    total = sum(path.stat().st_size for path in UPLOAD_ROOT.rglob("*") if path.is_file())
    print(
        f"Geprueft: {UPLOAD_ROOT.relative_to(REPO_ROOT)} "
        f"mit {files} Dateien, zusammen {total / 1048576:.1f} MB."
    )

    for name, megabytes in heavy_files():
        print(f"  Hinweis: {name} ist {megabytes:.1f} MB gross – laedt ueber Mobilfunk lange.")

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
        f"--branch={BRANCH}",
        "--commit-dirty=true",
    ]
    print("Aufruf:", " ".join(command))
    code = subprocess.run(command, cwd=REPO_ROOT, shell=sys.platform == "win32").returncode
    if code != 0:
        print("Der Upload ist fehlgeschlagen. Es liegt weiterhin der vorige Stand dort.")
        return code

    if not confirm_live():
        return 1

    print(f"\nLink zum Weitergeben: {PUBLIC_URL}")
    print(
        "Wer den Entwurf schon installiert hat, muss die App einmal ganz schliessen\n"
        "und zweimal oeffnen – beim ersten Start liefert noch der alte Zwischenspeicher."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
