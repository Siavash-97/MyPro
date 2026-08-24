"""Prueft, ob zu geaenderten Quelldateien ein frischer Bericht existiert.

Warum es diese Pruefung gibt
----------------------------
Am 23.08.2026 wurden drei Fehler behoben (Zeitgrenze beim Speichern,
Rueckmeldung, haengende Laeufe) - und die Berichte blieben aus. Nicht aus
Vergessen: Sie wurden ausdruecklich an die Zustimmung des Nutzers geknuepft
("das mache ich mit den Berichten, wenn du sagst, dass es passt").

Die Regel in CLAUDE.md sagt aber: **nach jeder Coding-Aufgabe** ein
Task-Bericht. Nicht nach Freigabe. Eine Pflicht, die zur Option gemacht
wird, ist keine mehr.

Der Nutzer hat dazu gesagt: "das darf nie wieder passieren". Ein Versprechen
traegt das nicht - CLAUDE.md haelt selbst fest, dass Regeln in Prosa nicht
halten und nur das haelt, was ein Skript prueft. Also prueft es ab jetzt ein
Skript.

Was genau geprueft wird
-----------------------
Gibt es im Arbeitsbaum geaenderte oder neue QUELLDATEIEN, dann muss in
`C:\\MyProSole\\Agent-Reports` ein Bericht liegen, der juenger ist als die
aelteste dieser Aenderungen. Sonst ist die Aufgabe nicht fertig.

Was ausdruecklich NICHT geprueft wird
-------------------------------------
Der INHALT des Berichts. Ob er die Wahrheit sagt, kann kein Skript wissen -
dafuer gibt es `check-and-notify.ps1` und den Menschen. Diese Pruefung
beantwortet nur die eine Frage, die mechanisch beantwortbar ist: **Ist
ueberhaupt einer da?**

Auch nicht geprueft: reine Bericht-, Doku- und Konfigurationsaenderungen.
Wer eine Zeile in einer Markdown-Datei aendert, schreibt darueber keinen
Bericht - das waere Laerm und wuerde die Pruefung wertlos machen.
"""
from __future__ import annotations

import datetime
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BERICHTE = Path(r"C:\MyProSole\Agent-Reports")

# Was als Quelltext zaehlt. Bewusst eng: Nur wo eine Aenderung Verhalten
# aendern kann, ist ein Bericht faellig.
QUELL_ENDUNGEN = {".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".sql", ".css"}

# Ausnahmen, die keine Coding-Aufgabe sind.
AUSNAHMEN = (
    "scripts/check_",          # die Pruefungen selbst
    "node_modules/",
    "/dist/",
    "/build/",
)


def geaenderte_quelldateien() -> list[Path]:
    """Alle geaenderten und neuen Quelldateien im Arbeitsbaum."""
    ergebnis = subprocess.run(
        ["git", "status", "--porcelain", "--untracked-files=all"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if ergebnis.returncode != 0:
        # Kein Git-Baum: Diese Pruefung kann nichts aussagen und schweigt.
        return []

    dateien: list[Path] = []
    for zeile in ergebnis.stdout.splitlines():
        if len(zeile) < 4:
            continue
        pfad = zeile[3:].strip().strip('"')
        # Umbenennungen: "alt -> neu"
        if " -> " in pfad:
            pfad = pfad.split(" -> ", 1)[1]
        if Path(pfad).suffix not in QUELL_ENDUNGEN:
            continue
        vergleich = "/" + pfad.replace("\\", "/")
        if any(a in vergleich for a in AUSNAHMEN):
            continue
        voll = ROOT / pfad
        if voll.is_file():
            dateien.append(voll)
    return dateien


def bericht_zeitpunkt(pfad: Path) -> float | None:
    """Der Zeitpunkt, den der Bericht in seinem NAMEN nennt.

    Nicht die Aenderungszeit der Datei - und das ist der Kern.

    Die erste Fassung nahm `st_mtime`. Damit machte ein `touch` auf einen
    beliebigen alten Bericht diese Pruefung gruen, ohne dass irgendwer etwas
    berichtet haette. Gefunden vom Agenten `pruefung` am 23.08.2026, wenige
    Stunden nachdem hier schon einmal ein Loch gestopft worden war (min statt
    max). Zweimal dieselbe Lehre: **Eine Pruefung mit einem Loch ist
    schlimmer als keine, weil sie beruhigt.**

    Der Name traegt das Muster `JJJJ-MM-TT_HHmm_kurzbeschreibung.md`. Ihn zu
    faelschen hiesse, eine Datei mit neuem Namen anzulegen - und genau das
    ist "einen Bericht schreiben".
    """
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})_", pfad.name)
    if not m:
        return None
    jahr, monat, tag, stunde, minute = (int(g) for g in m.groups())
    try:
        return datetime.datetime(jahr, monat, tag, stunde, minute).timestamp()
    except ValueError:
        return None


def juengster_bericht() -> tuple[Path | None, float]:
    if not BERICHTE.is_dir():
        return None, 0.0
    datiert = [
        (pfad, zeit)
        for pfad in BERICHTE.glob("*.md")
        if (zeit := bericht_zeitpunkt(pfad)) is not None
    ]
    if not datiert:
        return None, 0.0
    return max(datiert, key=lambda paar: paar[1])


def main() -> int:
    dateien = geaenderte_quelldateien()
    if not dateien:
        print("Keine offenen Quelltextaenderungen - kein Bericht faellig.")
        return 0

    # max, NICHT min - und das ist der Kern dieser Pruefung.
    #
    # Die erste Fassung nahm die AELTESTE Aenderung. Damit deckte ein
    # einmal geschriebener Bericht alles ab, was danach kam: Datei A um
    # 10:00 aendern, Bericht um 10:30, Datei B um 11:00 -> gruen, obwohl B
    # unberichtet ist. Gefunden vom Pruefagenten am 23.08.2026, wenige
    # Stunden nachdem diese Pruefung als Garantie ausgegeben worden war.
    #
    # Eine Pruefung mit einem Loch ist schlimmer als keine: Sie beruhigt.
    # Auf die MINUTE abgerundet - beide Seiten.
    #
    # Der Berichtsname traegt nur `_HHmm_`, die Dateizeiten tragen Sekunden.
    # Wer um 10:30:45 die letzte Zeile speichert und den Bericht als
    # `..._1030_...` anlegt, bekam sonst 10:30:00 < 10:30:45 -> rot, obwohl
    # der Bericht danach entstand. Die Abhilfe waere gewesen, den Bericht auf
    # eine spaetere Minute zu datieren - also die Zahl anzupassen, damit die
    # Pruefung gruen wird. Genau das darf eine Pruefung nie erzwingen.
    #
    # Gefunden vom Agenten `pruefung`, 24.08.2026.
    juengste = max(d.stat().st_mtime for d in dateien) // 60 * 60
    bericht, bericht_zeit = juengster_bericht()

    if bericht is None:
        # Kein Berichtsordner heisst: fremde Maschine, CI, frischer Klon.
        # Dort kann diese Pruefung nichts aussagen und schweigt - sie darf
        # die Suite nicht rot machen. Dasselbe Verhalten wie in
        # check_regelabweichungen.py; die beiden gehoeren zusammen.
        if not BERICHTE.is_dir():
            print(f"Kein Berichtsordner unter {BERICHTE} - hier nicht pruefbar.")
            return 0
        print(f"FEHLT: {len(dateien)} geaenderte Quelldateien, aber kein Bericht in")
        print(f"       {BERICHTE}")
        return 1

    if bericht_zeit < juengste:
        f = lambda t: datetime.datetime.fromtimestamp(t).strftime("%d.%m. %H:%M")
        print(f"VERALTET: {len(dateien)} geaenderte Quelldateien, juengste von {f(juengste)},")
        print(f"          juengster Bericht ist {bericht.name} von {f(bericht_zeit)}.")
        print()
        print("Nach jeder Coding-Aufgabe gehoert ein Task-Bericht nach")
        print(f"{BERICHTE} - nicht erst nach einer Freigabe.")
        print("Siehe CLAUDE.md Regel 4.")
        return 1

    print(
        f"{len(dateien)} geaenderte Quelldateien, juengster Bericht "
        f"{bericht.name} ist neuer - in Ordnung."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
