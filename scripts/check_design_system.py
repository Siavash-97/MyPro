#!/usr/bin/env python3
"""Prueft, dass die Oberflaeche das vorhandene Designsystem benutzt.

Warum es dieses Skript gibt
---------------------------
Am 21.08.2026 wurde ein Bildschirm mit der Klasse `md-chip--selected` gebaut.
Die Klasse existiert nicht. Ausgewaehlte und nicht ausgewaehlte Antworten
sahen deshalb identisch aus - man konnte nicht sehen, was man angetippt hatte.

Der Fehler war nicht Geschmack, sondern eine erfundene Klasse. Und er stand in
keiner Pruefung: Die Suite war gruen, TypeScript zufrieden, und niemand merkte
etwas, bis ein Mensch hinsah.

Dieselbe Sitzung zeigte, dass Regeln in Prosa nicht halten. Was eine Maschine
prueft, haelt. Also wird es geprueft.

Was geprueft wird
-----------------
1. Jede `md-*`-Klasse im Quelltext existiert in einem Stylesheet.
2. Die Zahl der inline-`style={{`-Angaben je Datei waechst nicht.
   Eine Sperrklinke, kein Verbot: Der Bestand ist gewachsen und laesst sich
   nicht an einem Tag aufloesen. Aber er darf nicht groesser werden.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "myprosole_web" / "src"
SPERRKLINKE = ROOT / "scripts" / "design_sperrklinke.json"

# Klassen, die kein Stylesheet definiert. Jede Ausnahme braucht einen Grund.
ERLAUBT_OHNE_STYLESHEET = {
    "md-visually-hidden",  # kommt aus Tailwind, nicht aus components.css
    # Unbestylte Huellen: Die Kindklassen tragen die Gestaltung, der
    # Blockname ist nur ein Anker zum Wiederfinden. Geprueft am 22.08.2026 -
    # md-greeting__title und md-anamnese__title sind definiert, die Huelle
    # selbst braucht keine Regel.
    "md-greeting",
    "md-anamnese__step",
}

KLASSE = re.compile(r"\b(md-[a-z0-9_-]+)")


def bekannte_klassen() -> set[str]:
    """Alle md-*-Klassen, die irgendein Stylesheet definiert."""
    gefunden: set[str] = set()
    for datei in WEB.rglob("*.css"):
        gefunden.update(
            re.findall(r"\.(md-[a-z0-9_-]+)", datei.read_text(encoding="utf-8"))
        )
    return gefunden


def klassennamen_aus(text: str) -> set[str]:
    """Nur die Werte von className, nichts daneben.

    Die erste Fassung las ein Fenster hinter `className=` und fing damit auch
    `var(--md-on-surface)` aus benachbarten style-Angaben ein - Farbnamen,
    keine Klassen. Deshalb hier genau: Zeichenkette in Anfuehrungszeichen,
    oder ein Ausdruck in geschweiften Klammern, aus dem nur die Zeichenketten
    gelesen werden.
    """
    namen: set[str] = set()

    for wert in re.findall(r'className="([^"]*)"', text):
        namen.update(KLASSE.findall(wert))

    for treffer in re.finditer(r"className=\{", text):
        anfang = treffer.end() - 1
        tiefe = 0
        for i in range(anfang, min(len(text), anfang + 2000)):
            if text[i] == "{":
                tiefe += 1
            elif text[i] == "}":
                tiefe -= 1
                if tiefe == 0:
                    ausdruck = text[anfang : i + 1]
                    # Nur Zeichenketten im Ausdruck; alles andere sind
                    # Variablen und Bedingungen.
                    for stueck in re.findall(r"""['"`]([^'"`]*)['"`]""", ausdruck):
                        namen.update(KLASSE.findall(stueck))
                    break
    return namen


def benutzte_klassen() -> dict[str, set[str]]:
    je_datei: dict[str, set[str]] = {}
    for datei in WEB.rglob("*.tsx"):
        namen = klassennamen_aus(datei.read_text(encoding="utf-8"))
        if namen:
            je_datei[str(datei.relative_to(ROOT)).replace("\\", "/")] = namen
    return je_datei


def inline_zaehlen() -> dict[str, int]:
    zaehlung: dict[str, int] = {}
    for datei in WEB.rglob("*.tsx"):
        anzahl = datei.read_text(encoding="utf-8").count("style={{")
        if anzahl:
            zaehlung[str(datei.relative_to(ROOT)).replace("\\", "/")] = anzahl
    return zaehlung


def validate() -> list[str]:
    fehler: list[str] = []

    bekannt = bekannte_klassen()
    if not bekannt:
        return ["Kein Stylesheet gefunden - die Pruefung waere wertlos."]

    for datei, namen in sorted(benutzte_klassen().items()):
        for name in sorted(namen - bekannt - ERLAUBT_OHNE_STYLESHEET):
            fehler.append(
                f"{datei}: Klasse '{name}' benutzt, aber in keinem Stylesheet "
                f"definiert. Erfunden oder vertippt?"
            )

    jetzt = inline_zaehlen()
    if SPERRKLINKE.is_file():
        erlaubt: dict[str, int] = json.loads(SPERRKLINKE.read_text(encoding="utf-8"))
        for datei, anzahl in sorted(jetzt.items()):
            grenze = erlaubt.get(datei)
            if grenze is None:
                fehler.append(
                    f"{datei}: {anzahl} inline-Stile in einer neuen Datei. Neue "
                    f"Oberflaeche benutzt das Designsystem, keine style-Angaben."
                )
            elif anzahl > grenze:
                fehler.append(
                    f"{datei}: {anzahl} inline-Stile, erlaubt sind {grenze}. Die "
                    f"Sperrklinke laesst die Zahl sinken, nicht steigen."
                )
    else:
        fehler.append(
            f"Sperrklinke fehlt: {SPERRKLINKE.relative_to(ROOT)}. Einmalig anlegen "
            f"mit: python scripts/check_design_system.py --sperrklinke"
        )

    return fehler


def main() -> int:
    if "--sperrklinke" in sys.argv:
        SPERRKLINKE.write_text(
            json.dumps(inline_zaehlen(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        print(f"Sperrklinke geschrieben: {SPERRKLINKE.relative_to(ROOT)}")
        return 0

    fehler = validate()
    if fehler:
        print("Designsystem verletzt:\n")
        for f in fehler:
            print(f"  - {f}")
        print(
            "\nHintergrund: docs/seiten-regeln.md. Fehlt eine Klasse wirklich, "
            "gehoert sie ins Stylesheet - nicht in den Quelltext erfunden."
        )
        return 1

    print("Designsystem eingehalten.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
