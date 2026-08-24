"""Prueft, ob Task-Reports den Pflichtabschnitt „Regelabweichungen" tragen.

Warum es diese Pruefung gibt
----------------------------
Am 23.08.2026 sagte der Nutzer: *"die verstoesse gegen bestehende Regeln
duerfen nicht passieren. wenn die ausnahmsweise in besonderen faellen
passieren muessen im bericht unbedingt erklaert werden warum! das muss so
sein."*

Der Anlass: An diesem Tag wurden drei Regeln gebrochen - eine
Oberflaechenaenderung ohne den Agenten `oberflaeche`, ein Bericht, der an
eine Freigabe geknuepft wurde, die die Regel nie vorsah, und ein
verschobener Pruefagent. Zwei davon standen im Bericht, einer nur
beilaeufig.

Was diese Pruefung leistet - und was nicht
------------------------------------------
Sie prueft, ob der Abschnitt **da ist**. Mehr kann ein Skript nicht: Ob
sein Inhalt ehrlich ist, ob eine Abweichung verschwiegen wurde, ob der
Grund traegt - all das kann nur der Mensch beurteilen.

Genau deshalb ist der Abschnitt Pflicht **auch wenn nichts abzuweichen
war**. Dann steht dort "Keine." Ein fehlender Abschnitt ist von einer
verschwiegenen Abweichung nicht zu unterscheiden; ein Abschnitt mit
"Keine." ist eine Aussage, fuer die jemand geradesteht.

Geprueft werden nur Reports ab dem 23.08.2026 - dem Tag, an dem die Regel
entstand. Aeltere rueckwirkend zu bemaengeln waere Laerm.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

BERICHTE = Path(r"C:\MyProSole\Agent-Reports")

# Ab hier gilt die Regel. Der Tag, an dem sie entstand.
AB_DATUM = "2026-08-23"

UEBERSCHRIFT = "### Regelabweichungen"

# Dateien der Automatisierung und Unterordner gehen uns nichts an.
def berichte() -> list[Path]:
    if not BERICHTE.is_dir():
        return []
    gefunden = []
    for p in sorted(BERICHTE.glob("*.md")):
        m = re.match(r"^(\d{4}-\d{2}-\d{2})_", p.name)
        if not m:
            continue
        if m.group(1) < AB_DATUM:
            continue
        gefunden.append(p)
    return gefunden


def main() -> int:
    alle = berichte()
    if not alle:
        print(f"Keine Reports ab {AB_DATUM} gefunden - nichts zu pruefen.")
        return 0

    fehlend = []
    for p in alle:
        text = p.read_text(encoding="utf-8", errors="replace")
        if UEBERSCHRIFT not in text:
            fehlend.append(p)

    if fehlend:
        print(f"Pflichtabschnitt fehlt in {len(fehlend)} von {len(alle)} Reports:")
        for p in fehlend:
            print(f"  - {p.name}")
        print()
        print(f'Jeder Task-Report ab {AB_DATUM} braucht die Ueberschrift')
        print(f'  {UEBERSCHRIFT}')
        print("Gab es nichts abzuweichen, steht dort \"Keine.\" - der Abschnitt")
        print("entfaellt nie. Ein fehlender Abschnitt ist von einer verschwiegenen")
        print("Abweichung nicht zu unterscheiden.")
        print()
        print("Siehe docs/DEVELOPMENT_STANDARDS.md, Abschnitt Regelabweichungen.")
        return 1

    print(f"Reports ab {AB_DATUM} geprueft: {len(alle)} - alle mit Regelabweichungen-Abschnitt.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
