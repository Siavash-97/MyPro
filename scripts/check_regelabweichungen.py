"""Prueft, ob Task-Reports ihre sechs Pflichtueberschriften tragen.

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

Am 15.09.2026 kamen die vier Ueberschriften der Gliederung und der Abschnitt
"Nicht benutzt" dazu (docs/DEVELOPMENT_STANDARDS.md, Abschlussbericht). Von 145
Berichten ab dem 23.08. trugen vor der Korrektur durch die Leitung 92
`### Nicht benutzt — und warum`, 47 die falsche Ebene `##`, 6 gar keinen
Abschnitt. Gemeldet hat das niemand: `check-and-notify.ps1:102` nimmt jede
Ebene, und dieses Skript suchte `### Regelabweichungen` nur als Teilstring.

Was diese Pruefung leistet - und was nicht
------------------------------------------
Sie prueft, ob jede Pflichtueberschrift **da ist**: als eigene Zeile,
wortgleich mit Ebene; nur rechter Leerraum wird vorher entfernt, damit
CRLF-Zeilenenden zaehlen.

Grenzen:
- Sie prueft keinen Inhalt unter den Ueberschriften.
- Sie prueft keine Reihenfolge der Ueberschriften.
- Eine passende Zeile in einem Codeblock zaehlt mit, als waere sie eine
  Ueberschrift.
- Dateien ohne Datumspraefix `JJJJ-MM-TT_` im Namen werden nicht geprueft.

Mehr kann ein Skript nicht: Ob
sein Inhalt ehrlich ist, ob eine Abweichung verschwiegen wurde, ob der
Grund traegt - all das kann nur der Mensch beurteilen.

Genau deshalb ist der Abschnitt Pflicht **auch wenn nichts abzuweichen
war**. Dann steht dort "Keine." Ein fehlender Abschnitt ist von einer
verschwiegenen Abweichung nicht zu unterscheiden; ein Abschnitt mit
"Keine." ist eine Aussage, fuer die jemand geradesteht.

Jede Ueberschrift gilt ab dem Tag, an dem ihre Regel entstand:
`### Regelabweichungen` ab 23.08.2026, die fuenf anderen ab 15.09.2026.
Aeltere rueckwirkend zu bemaengeln waere Laerm.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

BERICHTE = Path(r"C:\MyProSole\Agent-Reports")

UEBERSCHRIFT = [
    ("## Auftrag", "2026-09-15"),
    ("## Struktur", "2026-09-15"),
    ("## Tools und Methoden", "2026-09-15"),
    ("### Nicht benutzt — und warum", "2026-09-15"),
    ("## Offene Punkte und Risiken", "2026-09-15"),
    ("### Regelabweichungen", "2026-08-23"),
]

# Ab hier gilt die erste Regel. Aeltere Dateien werden nicht geprueft.
AB_DATUM = min(ab for _, ab in UEBERSCHRIFT)


def fehlende_ueberschriften(text: str, datum: str) -> list[str]:
    zeilen = {z.rstrip() for z in text.split("\n")}
    return [u for u, ab in UEBERSCHRIFT if datum >= ab and u not in zeilen]

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
        # berichte() laesst nur Namen mit Datumspraefix JJJJ-MM-TT_ durch.
        fehlend += [(p, u) for u in fehlende_ueberschriften(text, p.name[:10])]

    if fehlend:
        dateien = len({p for p, _ in fehlend})
        print(f"Pflichtueberschrift fehlt in {dateien} von {len(alle)} Reports:")
        for p, u in fehlend:
            print(f"  - {p.name}: {u}")
        print()
        print("Jeder Task-Report braucht je Ueberschrift ab ihrem Stichtag eine eigene Zeile, wortgleich:")
        for u, ab in UEBERSCHRIFT:
            print(f"  {u}   (ab {ab})")
        print("Gab es nichts abzuweichen, steht dort \"Keine.\" - der Abschnitt")
        print("entfaellt nie. Ein fehlender Abschnitt ist von einer verschwiegenen")
        print("Abweichung nicht zu unterscheiden.")
        print()
        print("Siehe docs/DEVELOPMENT_STANDARDS.md, Abschnitt Abschlussbericht nach jeder Coding-Aufgabe.")
        return 1

    print(f"Reports ab {AB_DATUM} geprueft: {len(alle)} - alle mit ihren Pflichtueberschriften.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
