#!/usr/bin/env python3
"""Prueft, dass eine Agentenakte kein Werkzeug anweist, das sie nicht hat.

Warum es dieses Skript gibt
---------------------------
Bis zum 07.09.2026 stand in `.claude/agents/bauer.md`, der Bauer solle an
einer Grenze "per SendMessage an main" fragen. Seine `tools:`-Zeile, sieben
Zeilen darueber, fuehrte SendMessage nie. Die Anweisung war seit dem Tag
unausfuehrbar, an dem sie geschrieben wurde, und niemand merkte es: Eine Akte
wird gelesen, nicht ausgefuehrt, und ein Werkzeug, das fehlt, wirft keinen
Fehler - der Agent kann die Anweisung schlicht nicht befolgen.

Was geprueft wird
-----------------
1. Je `.claude/agents/*.md`: ein Werkzeugname, der im Text als **Anweisung**
   steht - im selben Satz mit "per", "mit", "ueber", "benutze", "rufe",
   "fragst", "schreibst" - und nicht in der `tools:`-Zeile der Akte steht.
2. Dieselbe Namenspruefung auf die zwei `--disallowedTools`-Zeilen der
   Berichts-Automatisierung. Dort stehen Namen, die es als lebendes Werkzeug
   nicht mehr gibt (`MultiEdit`, `Task`, `TodoWrite`); wer eine solche Liste
   pflegt, glaubt zu sperren, was gar nicht mehr da ist.

Warum eine Sperrklinke und kein Sonderfall im Filter
----------------------------------------------------
Dasselbe Muster wie bei Tor 1, derselbe Grund: Ein Tor, das eine Formulierung
sucht, findet zuerst den Text, der sie **berichtigt**. `bauer.md` traegt seit
dem 07.09.2026 den Vermerk

    Bis zum 07.09.2026 stand hier "fragst per SendMessage an main" - eine
    Anweisung, die die Zeile `tools:` sieben Zeilen darueber unmoeglich machte.

Name, "per" und "fragst" stehen darin, ein Verneinungswort nicht. Das ist eine
Meldung, und sie ist richtig gefunden - der Satz *nennt* die alte Anweisung.
Falsch waere nur, ihn dauerhaft rot zu lassen.

Die erste Fassung dieses Skripts loeste das mit einem Sonderfall im Filter:
eine bestimmte Zeichenklasse liess den Satz durchfallen. Das ging - und riss
ein benanntes Loch: Wer eine echte Anweisung so setzt, kam durch. Ein Filter
mit einem Sonderfall ist ein Filter mit einer Luecke, und die Luecke waechst
mit jedem weiteren Sonderfall.

Deshalb hier wie bei Tor 1: Die Ausnahme ist **eine Zahl in einer Datei**,
`scripts/akten_sperrklinke.json`. Sie haelt je Akte die Zahl der Meldungen vom
Tag des Einbaus (heute: `bauer.md: 1`). Gemeldet wird, was darueber liegt -
und, damit die Klinke keine Erlaubnis wird, auch was darunter liegt. Der
Filter selbst kennt keinen Sonderfall mehr.

Warum die `.ps1`-Pruefung ein Schalter ist und kein Suitepunkt
--------------------------------------------------------------
Die zwei `.ps1`-Dateien liegen ausserhalb des Repos und sind gesperrt. Ihre
drei toten Namen sind heute real und werden gemeldet - `python
scripts/check_akten_werkzeuge.py` ist deshalb **erwartet rot**, solange der
Nutzer die Zeilen nicht berichtigt hat. In `scripts/run_tests.py` haengt
darum nur `--nur-akten`; ein Suitepunkt, der auf eine fremde, gesperrte Datei
zeigt, waere ein Dauerrot und damit binnen einer Woche Rauschen, das man
wegwischt (siehe CLAUDE.md, Regel 2b).

Was das Skript nicht sieht
--------------------------
- Eine Anweisung ohne eines der acht Signalwoerter ("Nimm SendMessage.").
- Eine Verneinung, die keines der fuenf Woerter benutzt.
- Ein Satz gilt bis zum naechsten `.`, `!` oder `?` mit Leerzeichen dahinter;
  Datumsangaben wie 07.09.2026 trennen nicht.
- Ob ein Treffer ehrlich ist, entscheidet ein Mensch. Das Skript zaehlt.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AKTEN = ROOT / ".claude" / "agents"
SPERRKLINKE = ROOT / "scripts" / "akten_sperrklinke.json"

PS1 = [
    Path(r"C:\MyProSole\Agent-Reports\.automation\check-and-notify.ps1"),
    Path(r"C:\MyProSole\Fehler und Bug Reports\.automation\check-bugs.ps1"),
]

# Alle Namen, die in diesem Repo je als Werkzeug auftauchen - lebende und tote.
WERKZEUGE = [
    "Read", "Grep", "Glob", "Edit", "Write", "Bash", "Skill",
    "WebFetch", "WebSearch", "Agent", "NotebookEdit", "SendMessage",
    "MultiEdit", "Task", "TodoWrite",
]

# Die toten: Namen, die die Werkzeugzeile eines Agenten nie traegt.
TOT = {"MultiEdit", "Task", "TodoWrite"}

ANWEISUNG = ["per", "mit", "über", "ueber", "benutze", "rufe", "fragst", "schreibst"]
VERNEINUNG = ["kein", "nicht", "fehlt", "hat kein", "ohne"]

# Satzende: Punkt/Ruf/Frage plus Leerraum. Nicht zwischen Ziffern - sonst
# zerfaellt "07.09.2026" in drei Saetze und der Satz davor verliert sein
# Verneinungswort.
SATZENDE = re.compile(r"(?<!\d)[.!?]+(?=\s|$)")

DISALLOWED = re.compile(r'--disallowedTools\s+"([^"]*)"')


def _rumpf(text: str) -> str:
    """Die Akte ohne ihre eigene `tools:`-Zeile."""
    return re.sub(r"^tools:.*$", "", text, count=1, flags=re.MULTILINE)


def saetze(text: str) -> list[str]:
    stueck = SATZENDE.split(text)
    return [s.strip() for s in stueck if s.strip()]


def _enthaelt_wort(satz: str, wort: str) -> bool:
    return re.search(rf"\b{re.escape(wort)}\b", satz, re.IGNORECASE) is not None


def _ist_anweisung(satz: str) -> bool:
    return any(_enthaelt_wort(satz, w) for w in ANWEISUNG)


def _ist_verneint(satz: str) -> bool:
    klein = satz.lower()
    return any(w in klein for w in VERNEINUNG)


def werkzeuge_der_akte(text: str) -> set[str]:
    """Die Namen aus der `tools:`-Zeile im Kopf der Akte."""
    m = re.search(r"^tools:\s*(.+)$", text, re.MULTILINE)
    if not m:
        return set()
    return {t.strip() for t in m.group(1).split(",") if t.strip()}


def pruefe_akte(pfad: Path) -> list[str]:
    text = pfad.read_text(encoding="utf-8", errors="replace")
    hat = werkzeuge_der_akte(text)

    fehler: list[str] = []
    for satz in saetze(_rumpf(text)):
        if not _ist_anweisung(satz) or _ist_verneint(satz):
            continue
        for name in WERKZEUGE:
            if name in hat:
                continue
            if re.search(rf"\b{name}\b", satz):
                fehler.append(
                    f"{pfad.name}: '{name}' als Anweisung, aber nicht in "
                    f"tools: ({', '.join(sorted(hat)) or 'leer'}) - "
                    f"\"{_kurz(satz)}\""
                )
    return fehler


def _kurz(satz: str, laenge: int = 120) -> str:
    eine_zeile = " ".join(satz.split())
    if len(eine_zeile) <= laenge:
        return eine_zeile
    return eine_zeile[: laenge - 1] + "…"


def pruefe_ps1(pfad: Path) -> list[str]:
    if not pfad.is_file():
        return [f"{pfad}: nicht gefunden - die Pruefung waere wertlos."]
    text = pfad.read_text(encoding="utf-8", errors="replace")

    fehler: list[str] = []
    for nr, zeile in enumerate(text.splitlines(), start=1):
        m = DISALLOWED.search(zeile)
        if not m:
            continue
        for name in [n.strip() for n in m.group(1).split(",") if n.strip()]:
            if name in TOT or name not in WERKZEUGE:
                fehler.append(
                    f"{pfad.name}:{nr}: '{name}' in --disallowedTools, aber kein "
                    f"lebendes Werkzeug. Eine Sperre auf einen Namen, den es nicht "
                    f"gibt, sperrt nichts."
                )
    return fehler


def meldungen_je_akte(akten: Path) -> dict[str, list[str]]:
    je_akte: dict[str, list[str]] = {}
    for datei in sorted(akten.glob("*.md")):
        gefunden = pruefe_akte(datei)
        if gefunden:
            je_akte[datei.name] = gefunden
    return je_akte


def zaehlung(akten: Path) -> dict[str, int]:
    return {k: len(v) for k, v in meldungen_je_akte(akten).items()}


def schreibe_klinke(akten: Path, klinke: Path) -> dict[str, int]:
    stand = zaehlung(akten)
    klinke.write_text(
        json.dumps(stand, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return stand


def validate(akten: Path, ps1: list[Path], klinke: Path = SPERRKLINKE) -> list[str]:
    fehler: list[str] = []

    if not klinke.is_file():
        fehler.append(
            f"Sperrklinke fehlt: {klinke}. Einmalig anlegen mit: "
            f"python scripts/check_akten_werkzeuge.py --sperrklinke"
        )
    else:
        erlaubt: dict[str, int] = json.loads(klinke.read_text(encoding="utf-8"))
        jetzt = meldungen_je_akte(akten)

        for name, gefunden in sorted(jetzt.items()):
            grenze = erlaubt.get(name)
            if grenze is None:
                fehler.extend(gefunden)
            elif len(gefunden) > grenze:
                fehler.append(
                    f"{name}: {len(gefunden)} Meldungen, erlaubt sind {grenze}. "
                    + " | ".join(gefunden)
                )

        # Die Gegenrichtung: eine Klinke, die zu hoch steht, ist eine Erlaubnis.
        for name, grenze in sorted(erlaubt.items()):
            anzahl = len(jetzt.get(name, []))
            if anzahl < grenze:
                fehler.append(
                    f"{name}: {anzahl} Meldungen, die Klinke steht auf {grenze} "
                    f"- unter der Klinke. Nachziehen mit: "
                    f"python scripts/check_akten_werkzeuge.py --sperrklinke"
                )

    for datei in ps1:
        fehler.extend(pruefe_ps1(datei))
    return fehler


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--sperrklinke", action="store_true",
                   help="Klinke aus dem Ist-Stand neu schreiben")
    p.add_argument("--nur-akten", action="store_true",
                   help="nur .claude/agents/*.md - so haengt es in run_tests.py")
    p.add_argument("--akten", type=Path, default=AKTEN,
                   help="anderer Aktenordner")
    p.add_argument("--klinke", type=Path, default=SPERRKLINKE,
                   help="andere Sperrklinken-Datei")
    p.add_argument("--ps1", action="append", type=Path, default=None,
                   help="andere .ps1-Dateien")
    args = p.parse_args(argv)

    if not args.akten.is_dir():
        print(f"Aktenordner nicht gefunden: {args.akten}")
        return 1

    if args.sperrklinke:
        stand = schreibe_klinke(args.akten, args.klinke)
        print(f"Sperrklinke geschrieben: {args.klinke}")
        print(f"{len(stand)} Akten mit Meldungen, {sum(stand.values())} Meldungen.")
        return 0

    ps1 = [] if args.nur_akten else (args.ps1 if args.ps1 else PS1)
    fehler = validate(args.akten, ps1, args.klinke)

    if fehler:
        print(f"Werkzeuge in den Akten: {len(fehler)} Meldungen\n")
        for f in fehler:
            print(f"  - {f}")
        print()
        print("Eine Anweisung auf ein Werkzeug, das die `tools:`-Zeile nicht fuehrt,")
        print("ist unausfuehrbar - und faellt niemandem auf, weil sie keinen Fehler")
        print("wirft. Entweder das Werkzeug gehoert in die Zeile, oder der Satz")
        print("gehoert umgeschrieben.")
        print("Haelt ein Satz die Nennung fest, weil er die alte Anweisung")
        print("berichtigt, gehoert er in die Klinke - nicht in den Filter:")
        print("  python scripts/check_akten_werkzeuge.py --sperrklinke")
        return 1

    gezaehlt = len(sorted(args.akten.glob("*.md")))
    print(f"{gezaehlt} Akten geprueft" + ("" if args.nur_akten else f" und {len(ps1)} .ps1")
          + f" - nichts ueber der Klinke ({args.klinke.name}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
