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
import shutil
import subprocess
import sys
import tempfile
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

# Was zum Prototyp gehoert - und NUR das geht hoch.
#
# Bis zum 25.08.2026 ging der gesamte Ordner hoch, weil hier nichts stand:
# `wrangler pages deploy <UPLOAD_ROOT>` laedt ein Verzeichnis, wie es ist.
# Damit lagen `mockups-entwurf/`, `mockups-neue-farben/` und README.md
# oeffentlich erreichbar im Netz - **365 KB in 39 Dateien** von 2,60 MB, von
# `mockups/` aus nirgends verlinkt, also nur fuer den auffindbar, der die
# Adresse kennt. Gewollt war
# das nie; es stand bloss kein Filter da.
#
# **Die Richtung ist damit umgedreht.** Frueher war oeffentlich, was nicht
# verboten war. Jetzt ist privat, was nicht ausdruecklich hier steht. Wer
# einen Entwurfsordner anlegt, muss nichts wissen und nichts tun, damit er
# privat bleibt - das ist der einzige Zustand, der auch dem hilft, der die
# Regel nicht kennt.
AUSLIEFERN = (
    "mockups",        # der Prototyp selbst
    "design-system",  # seine CSS
    "scripts",        # sein Verhalten
    "icons",
    "assets",
    "manifest.webmanifest",
    "sw.js",
    "_headers",
    "_redirects",
)

# Harte Grenze von Cloudflare Pages. Wer sie reisst, erfaehrt es sonst erst
# nach dem Anlegen des Projekts und mitten im Hochladen.
MAX_FILE_BYTES = 25 * 1024 * 1024
# Keine Grenze, nur ein Hinweis: darueber wartet jemand mit Mobilfunk spuerbar.
HEAVY_FILE_BYTES = 3 * 1024 * 1024


def dateien_zum_ausliefern() -> list[Path]:
    """Jede Datei, die tatsaechlich hochgeht - und keine andere."""
    gefunden: list[Path] = []
    for name in AUSLIEFERN:
        eintrag = UPLOAD_ROOT / name
        if eintrag.is_dir():
            gefunden.extend(p for p in sorted(eintrag.rglob("*")) if p.is_file())
        elif eintrag.is_file():
            gefunden.append(eintrag)
    return gefunden


def fehlende_eintraege() -> list[str]:
    """Was in AUSLIEFERN steht und NICHT auf der Platte liegt.

    Die Gegenrichtung zu `uebersprungene_eintraege()`. Ohne sie verschwindet
    ein umbenannter oder verschobener Eintrag lautlos aus beiden Schleifen -
    sie sind `if is_dir() ... elif is_file()` ohne `else`.

    Der Zaehler-Waechter in `main()` faengt das nicht: Er vergleicht die
    Buehne gegen `dateien_zum_ausliefern()`, und beide stammen aus derselben
    Liste, werden also gemeinsam falsch.

    Konkreter Fall: Wer `_headers` umbenennt, bekommt einen Lauf, der
    durchgeht, eine Datei weniger meldet und kein Wort sagt - waehrend die
    oeffentliche Adresse CSP und noindex verliert. Gefunden vom Agenten
    `pruefung` am 25.08.2026.
    """
    return [name for name in AUSLIEFERN if not (UPLOAD_ROOT / name).exists()]


def uebersprungene_eintraege() -> list[str]:
    """Was im Ordner liegt und NICHT hochgeht.

    Wird beim Lauf ausgegeben. Eine stille Auslassung ist so schlimm wie eine
    falsche Zahl: Fehlt ein Ordner in AUSLIEFERN, der eigentlich online
    gehoert, faellt das sonst niemandem auf.
    """
    return sorted(
        eintrag.name
        for eintrag in UPLOAD_ROOT.iterdir()
        if eintrag.name not in AUSLIEFERN and not eintrag.name.startswith(".")
    )


def buehne_bauen(ziel: Path) -> int:
    """Baut ein Verzeichnis, das NUR enthaelt, was hochgehen soll.

    `wrangler pages deploy <Ordner>` laedt ein Verzeichnis, wie es ist - es
    kennt keine Dateiliste. Ohne diesen Schritt waere AUSLIEFERN bloss eine
    Absichtserklaerung, die niemand durchsetzt.

    Gibt die Zahl der abgelegten Dateien zurueck, damit der Aufrufer sie
    gegen `dateien_zum_ausliefern()` halten kann.
    """
    for name in AUSLIEFERN:
        quelle = UPLOAD_ROOT / name
        if quelle.is_dir():
            shutil.copytree(quelle, ziel / name)
        elif quelle.is_file():
            ziel.mkdir(parents=True, exist_ok=True)
            shutil.copy2(quelle, ziel / name)
    return sum(1 for pfad in ziel.rglob("*") if pfad.is_file())


def check() -> list[str]:
    """Gibt die Gruende zurueck, aus denen nicht hochgeladen werden darf."""
    reasons: list[str] = []

    if not UPLOAD_ROOT.is_dir():
        return [f"{UPLOAD_ROOT} gibt es nicht."]

    for name in REQUIRED_FILES:
        if not (UPLOAD_ROOT / name).is_file():
            reasons.append(f"Es fehlt: {name}")

    # Ein Eintrag aus AUSLIEFERN, den es nicht gibt, ist ein Grund - kein
    # Achselzucken. Sonst geht der Upload mit einer Datei weniger durch, und
    # niemand erfaehrt, welcher.
    for name in fehlende_eintraege():
        reasons.append(
            f"Steht in AUSLIEFERN, liegt aber nicht im Ordner: {name}"
        )

    # Der Ordner darf nicht versehentlich das Repository selbst sein.
    if (UPLOAD_ROOT / ".git").exists():
        reasons.append("Der Ordner enthaelt .git – das ist nicht der Entwurfsordner.")

    # Geprueft wird, was HOCHGEHT - nicht, was danebenliegt. Sonst blockiert
    # ein PDF im Entwurfsordner jede Auslieferung, obwohl es gar nicht mit
    # hochginge.
    for path in dateien_zum_ausliefern():
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
        for path in dateien_zum_ausliefern()
        if path.stat().st_size > HEAVY_FILE_BYTES
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

    hoch = dateien_zum_ausliefern()
    total = sum(path.stat().st_size for path in hoch)
    print(
        f"Geprueft: {UPLOAD_ROOT.relative_to(REPO_ROOT)} "
        f"mit {len(hoch)} Dateien, zusammen {total / 1048576:.1f} MB."
    )

    # Ausdruecklich genannt, nicht stillschweigend weggelassen. Wer hier einen
    # Ordner sieht, der eigentlich online gehoert, merkt es sofort.
    ausgelassen = uebersprungene_eintraege()
    if ausgelassen:
        print("Bleibt hier (nicht in AUSLIEFERN):")
        for name in ausgelassen:
            print(f"  - {name}")

    for name, megabytes in heavy_files():
        print(f"  Hinweis: {name} ist {megabytes:.1f} MB gross - laedt ueber Mobilfunk lange.")

    if args.pruefen:
        print("Nur Pruefung, nichts hochgeladen.")
        return 0

    # `wrangler pages deploy <Ordner>` laedt ein VERZEICHNIS, wie es ist - es
    # kennt keine Dateiliste. Also wird eines gebaut, das nur enthaelt, was
    # hochgehen soll. Das ist der einzige Weg, bei dem die Positivliste oben
    # nicht bloss eine Absichtserklaerung ist.
    with tempfile.TemporaryDirectory(prefix="myprosole-prototyp-") as tmp:
        buehne = Path(tmp) / "public"
        gestapelt = buehne_bauen(buehne)
        if gestapelt != len(hoch):
            print(
                f"Abbruch: {gestapelt} Dateien im Zwischenordner, erwartet {len(hoch)}."
            )
            return 1

        command = [
            "npx",
            "--yes",
            "wrangler@latest",
            "pages",
            "deploy",
            str(buehne),
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
