#!/usr/bin/env python3
"""Prueft, dass keine Begruendung unveraendert von Report zu Report weiterwandert.

Warum es diese Pruefung gibt
----------------------------
In der Tabelle "Flache Module, die stehen blieben" stand elfmal
hintereinander dieselbe Zeile:

    | Fehleruebersetzung, verstreut | fuenf Module uebersetzen jedes fuer
      sich | Risiko - 61 Aufrufstellen |

Sie war falsch. Echte Uebersetzungslogik gibt es in zwei Modulen mit je
einem Aufrufer. Aufgefallen ist es erst durch eine Architektur-Analyse am
22.08.2026 - nach elf Reports.

Der Schaden lag nicht in der falschen Zahl, sondern darin, dass die Zeile in
der Spalte "Warum nicht angefasst" stand und den Grund gleich mitlieferte.
Eine plausible Erklaerung an der Stelle einer fehlenden Pruefung macht
unsichtbar, dass eine fehlt - genau das, wovor Regel 2 der CLAUDE.md warnt.
Und sie wurde dabei nicht vager, sondern bestimmter: bis zum 21.08. "vier
Module", ab dem 22.08. "fuenf".

Die Regel
---------
Dieselbe Begruendung fuer dasselbe Modul darf in hoechstens **drei**
aufeinanderfolgenden Reports stehen. Beim vierten Mal muss sie sich
geaendert haben - was nur passiert, wenn jemand nachgesehen hat. Oder die
Zeile faellt weg.

Die Drei ist nicht neu: CLAUDE.md macht schon jetzt einen Lauf von
`improve-codebase-architecture` faellig, sobald dieselbe Datei dreimal in
Folge auffaellt. Diese Pruefung macht dieselbe Zahl fuer die *Begruendung*
verbindlich.

Was NICHT geprueft wird
-----------------------
Ob die Begruendung stimmt. Das kann kein Skript. Geprueft wird nur, dass
sie nicht unbesehen weitergereicht wird.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BERICHTE = ROOT.parent / "Agent-Reports"

HOECHSTENS = 3

UEBERSCHRIFT = re.compile(r"^#{2,4}\s+.*Flache Module", re.IGNORECASE)
# Ordnungszahlen wie "viertes Mal auffaellig" aendern sich jedes Mal, ohne
# dass jemand nachgesehen haette. Sie zaehlen nicht als Aenderung.
ZAEHLWORT = re.compile(
    r"\b(zweites|drittes|viertes|f(ue|ü)nftes|sechstes|siebtes|achtes|neuntes|zehntes|elftes)"
    r"\s+mal\b",
    re.IGNORECASE,
)


def vereinheitlichen(text: str) -> str:
    """Auszeichnung und Zaehlwoerter weg - es zaehlt die Aussage."""
    ohne = re.sub(r"[*`~_]", "", text)
    ohne = ZAEHLWORT.sub("N-tes mal", ohne)
    return " ".join(ohne.split()).lower()


def zeilen_der_tabelle(pfad: Path) -> dict[str, str]:
    """{Modul: Begruendung} aus der Tabelle 'Flache Module' eines Reports."""
    treffer: dict[str, str] = {}
    im_abschnitt = False
    for zeile in pfad.read_text(encoding="utf-8", errors="replace").splitlines():
        if UEBERSCHRIFT.match(zeile):
            im_abschnitt = True
            continue
        if im_abschnitt and zeile.startswith("#"):
            break
        if not im_abschnitt or not zeile.strip().startswith("|"):
            continue

        spalten = [s.strip() for s in zeile.strip().strip("|").split("|")]
        if len(spalten) < 2:
            continue
        # Kopfzeile und Trennlinie ueberspringen
        if set(spalten[0]) <= set("-: ") or spalten[0].lower() == "modul":
            continue

        modul = vereinheitlichen(spalten[0])
        if modul:
            treffer[modul] = vereinheitlichen(" | ".join(spalten[1:]))
    return treffer


def main() -> int:
    if not BERICHTE.is_dir():
        print(f"Kein Ordner {BERICHTE} - Pruefung uebersprungen.")
        return 0

    # Dateinamen tragen JJJJ-MM-TT_HHmm, sortieren also chronologisch.
    reports = sorted(BERICHTE.glob("*.md"))
    if len(reports) <= HOECHSTENS:
        print(f"Nur {len(reports)} Reports - noch nichts zu wiederholen.")
        return 0

    neuester = reports[-1]
    tabellen = [zeilen_der_tabelle(p) for p in reports]

    meldungen: list[str] = []
    for modul, begruendung in tabellen[-1].items():
        # Rueckwaerts zaehlen, solange dieselbe Begruendung dasteht.
        laeufe = 0
        for frueher in reversed(tabellen):
            if frueher.get(modul) != begruendung:
                break
            laeufe += 1
        if laeufe > HOECHSTENS:
            meldungen.append(
                f"  {modul}\n"
                f"      steht mit derselben Begruendung in {laeufe} Reports in Folge:\n"
                f"      „{begruendung[:110]}“"
            )

    if meldungen:
        print(f"Unveraenderte Begruendungen in {neuester.name}:\n")
        print("\n".join(meldungen))
        print(
            f"\nHoechstens {HOECHSTENS} Reports in Folge. Beim naechsten Mal muss "
            "nachgesehen worden sein -\nund was dabei herauskam, gehoert in die "
            "Zeile. Oder die Zeile faellt weg.\n"
            "Grund: Die Zeile zur Fehleruebersetzung stand elfmal da und war falsch."
        )
        return 1

    print(f"Reports geprueft: {len(reports)} - keine Begruendung laenger als {HOECHSTENS} Mal.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
