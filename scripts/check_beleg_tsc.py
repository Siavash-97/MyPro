#!/usr/bin/env python3
"""Prueft, dass kein Bericht `tsc --noEmit` als Nachweis fuehrt.

Warum es dieses Skript gibt
---------------------------
`npx tsc --noEmit` prueft in `myprosole_web` **keine einzige Datei** - die
`tsconfig.json` traegt `"files": []`, und der Befehl meldet trotzdem Exit 0.
Wer diese Zeile in einen Bericht schreibt, belegt damit nichts; er belegt nur,
dass er den Befehl gefahren hat. Der Nachweis heisst `npx tsc -b`.
Gemessen und aufgeschrieben am 07.09.2026 in
`Fehler und Bug Reports/2026-09-07_1259_die-typpruefung-die-null-dateien-pruefte.md`.

Warum eine Sperrklinke und keine Wortliste fuer Ausnahmen
---------------------------------------------------------
Ein Tor, das eine Zeichenfolge verbietet, braucht immer eine Ausnahme fuer den
Text, der genau diese Zeichenfolge **berichtigt**. Der Bericht, der den Fehler
beschreibt, zitiert ihn zwangslaeufig - mitsamt dem "war gruen", das ihn
falsch machte.

Der erste Nachbau des Nutzers versuchte das mit einer Wortliste ("verworfen",
"kein Nachweis", ...) und fand vier Treffer, **zwei davon in dem Bericht, der
den Fehler beschreibt**. Eine Wortliste waechst mit jedem neuen Satzbau des
Berichtenden und ist nie fertig; wer sie pflegt, pflegt Fehlalarme.

Deshalb hier: keine Wortliste. Die Ausnahme ist die Sperrklinke
`scripts/beleg_sperrklinke.json`. Sie haelt je Datei die Zahl der Belegzeilen
vom Tag des Einbaus. Gemeldet wird nur, was **darueber** liegt - neue Zeilen in
bekannten Dateien, jede Zeile in neuen Dateien.

Und der zweite Satz, ohne den die Klinke zur Erlaubnis wuerde: Liegt die Zahl
einer Datei **unter** ihrer Klinke, ist das ebenfalls rot. Sonst haette man
einen Freibetrag, den ein spaeterer Bericht stillschweigend wieder ausschoepfen
kann. Die Klinke laesst die Zahl sinken - aber nur mit
`python scripts/check_beleg_tsc.py --sperrklinke`, also sichtbar im Diff.

Was das Skript nicht sieht
--------------------------
- Nur Zeilen, in denen Befehl **und** Erfolgsvokabel zusammen stehen. Wer den
  Beleg auf zwei Zeilen verteilt, kommt durch.
- Nur die zwei Berichtsordner, nur `*.md` direkt darin - keine Unterordner.
- Ob ein Treffer ehrlich ist, entscheidet ein Mensch. Das Skript zaehlt.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPERRKLINKE = ROOT / "scripts" / "beleg_sperrklinke.json"

ORDNER = [
    Path(r"C:\MyProSole\Agent-Reports"),
    Path(r"C:\MyProSole\Fehler und Bug Reports"),
]

# Der Befehl - mit oder ohne `npx`, mit oder ohne `-p tsconfig.json`.
BEFEHL = re.compile(r"tsc\s+--noEmit")

# Die Vokabeln, mit denen ein Befehl zum Beleg wird. Bewusst gross- und
# kleingeschrieben aufgefuehrt und exakt verglichen: "Exit 0" und "exit 0"
# stehen beide da, weil beide in den Berichten vorkommen.
ERFOLG = (
    "Exit 0",
    "exit 0",
    "grün",
    "gruen",
    "bestanden",
    "sauber",
    "ohne Ausgabe",
    "✓",
)


def treffer_in_text(text: str) -> list[tuple[int, str]]:
    """Zeilen, die den Befehl **und** eine Erfolgsvokabel tragen."""
    gefunden: list[tuple[int, str]] = []
    for nr, zeile in enumerate(text.splitlines(), start=1):
        if not BEFEHL.search(zeile):
            continue
        if any(wort in zeile for wort in ERFOLG):
            gefunden.append((nr, zeile))
    return gefunden


def _schluessel(ordner: Path, datei: Path) -> str:
    """Ordnername als Praefix, dann der Pfad relativ zum Ordner."""
    return f"{ordner.name}/{datei.relative_to(ordner).as_posix()}"


def treffer_je_datei(ordner: list[Path]) -> dict[str, list[tuple[int, str]]]:
    je_datei: dict[str, list[tuple[int, str]]] = {}
    for o in ordner:
        if not o.is_dir():
            continue
        for datei in sorted(o.glob("*.md")):
            treffer = treffer_in_text(datei.read_text(encoding="utf-8", errors="replace"))
            if treffer:
                je_datei[_schluessel(o, datei)] = treffer
    return je_datei


def zaehlung(ordner: list[Path]) -> dict[str, int]:
    return {k: len(v) for k, v in treffer_je_datei(ordner).items()}


def schreibe_klinke(ordner: list[Path], klinke: Path) -> dict[str, int]:
    stand = zaehlung(ordner)
    klinke.write_text(
        json.dumps(stand, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return stand


def validate(ordner: list[Path], klinke: Path) -> list[str]:
    fehler: list[str] = []

    if not klinke.is_file():
        return [
            f"Sperrklinke fehlt: {klinke}. Einmalig anlegen mit: "
            f"python scripts/check_beleg_tsc.py --sperrklinke"
        ]

    erlaubt: dict[str, int] = json.loads(klinke.read_text(encoding="utf-8"))
    jetzt = treffer_je_datei(ordner)

    for schluessel, treffer in sorted(jetzt.items()):
        grenze = erlaubt.get(schluessel)
        if grenze is None:
            for nr, zeile in treffer:
                fehler.append(
                    f"{schluessel}:{nr}: `tsc --noEmit` als Beleg gefuehrt - "
                    f"{zeile.strip()}"
                )
        elif len(treffer) > grenze:
            zeilen = ", ".join(str(nr) for nr, _ in treffer)
            fehler.append(
                f"{schluessel}: {len(treffer)} Belegzeilen, erlaubt sind {grenze}. "
                f"Zeilen: {zeilen}. `tsc --noEmit` prueft in myprosole_web null "
                f"Dateien - es belegt nichts. Der Nachweis heisst `npx tsc -b`."
            )

    # Die Gegenrichtung: eine Klinke, die zu hoch steht, ist eine Erlaubnis.
    # Nur Schluessel der gerade geprueften Ordner - sonst meldet ein Lauf mit
    # `--ordner` den ganzen uebrigen Korpus.
    geprueft = {o.name for o in ordner if o.is_dir()}
    for schluessel, grenze in sorted(erlaubt.items()):
        if schluessel.split("/", 1)[0] not in geprueft:
            continue
        anzahl = len(jetzt.get(schluessel, []))
        if anzahl < grenze:
            fehler.append(
                f"{schluessel}: {anzahl} Belegzeilen, die Klinke steht auf {grenze} "
                f"- unter der Klinke. Nachziehen mit: "
                f"python scripts/check_beleg_tsc.py --sperrklinke"
            )

    return fehler


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--sperrklinke", action="store_true",
                   help="Klinke aus dem Ist-Stand neu schreiben")
    p.add_argument("--ordner", action="append", type=Path, default=None,
                   help="Berichtsordner statt der zwei voreingestellten")
    p.add_argument("--klinke", type=Path, default=SPERRKLINKE,
                   help="andere Sperrklinken-Datei")
    args = p.parse_args(argv)

    ordner = args.ordner if args.ordner else ORDNER

    if args.sperrklinke:
        stand = schreibe_klinke(ordner, args.klinke)
        print(f"Sperrklinke geschrieben: {args.klinke}")
        print(f"{len(stand)} Dateien, {sum(stand.values())} Belegzeilen.")
        return 0

    fehlend = [str(o) for o in ordner if not o.is_dir()]
    if fehlend:
        print("Berichtsordner nicht gefunden - nichts zu pruefen:")
        for o in fehlend:
            print(f"  - {o}")
        if len(fehlend) == len(ordner):
            return 0

    fehler = validate(ordner, args.klinke)
    if fehler:
        print(f"`tsc --noEmit` als Beleg: {len(fehler)} Meldungen\n")
        for f in fehler:
            print(f"  - {f}")
        print()
        print("`npx tsc --noEmit` prueft in myprosole_web null Dateien und meldet")
        print("trotzdem Exit 0. Der Nachweis heisst `npx tsc -b`.")
        print("Berichtigt ein Bericht den Fehler und zitiert ihn dabei, gehoert er")
        print("in die Klinke - nicht in eine Wortliste:")
        print("  python scripts/check_beleg_tsc.py --sperrklinke")
        return 1

    print(f"Keine neue Belegzeile mit `tsc --noEmit`. Klinke: {args.klinke.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
