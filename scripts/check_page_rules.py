#!/usr/bin/env python3
"""Prueft, ob neue Seiten die verbindlichen Seitenregeln einhalten.

Warum es diese Pruefung gibt
----------------------------
Die Seitenregeln standen als Prosa in docs/. Trotzdem ging eine Seite ohne
Seitencontainer in die App: Der Titel war in der Huelle schon eingetragen,
die Route lag daneben. Beide Haelften derselben Aenderung, an zwei Stellen,
nie gegeneinander geprueft.

Prosa kann man ueberlesen. Eine Pruefung in der Suite nicht - sie laeuft vor
jedem Commit. Deshalb steht hier, was mechanisch pruefbar ist; der Rest
steht in docs/seiten-regeln.md.
"""

from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "myprosole_web" / "src"
APP_TSX = WEB / "App.tsx"
TOP_BAR = WEB / "components" / "layout" / "TopAppBar.tsx"

# Seiten, die bewusst ausserhalb der Huelle liegen - je mit Begruendung.
# Wer eine Seite hier eintraegt, muss sagen warum; wer es vergisst, faellt
# durch die Pruefung. Das ist der Zweck der Liste.
VOLLBILD_ERLAUBT: dict[str, str] = {
    "profil/setup": "Einrichtung vor dem ersten Start - noch keine Navigation sinnvoll",
    "anamnese": "Eigener Frageablauf mit Fortschritt, Navigation wuerde ablenken",
    "training/workout/aktiv": "Laufendes Training, Bildschirm gehoert der Uebung",
    "training/routine": "Laufende Mikroroutine, gleiche Begruendung",
    "lauf/tracking": "Laufende Aufzeichnung, Karte fuellt den Bildschirm",
    "lauf/zusammenfassung": "Abschluss eines Laufs, fuehrt selbst weiter",
    "chat/lauf/:id": "Unterhaltung mit eigener Eingabezeile unten",
}

# Feste Farben sind hier erlaubt, weil sie von aussen vorgegeben sind.
FARBEN_ERLAUBT = {"GoogleMark.tsx"}

# Begruendete Ausnahme fuer eine feste Farbe.
MARKE = "feste-farbe-ok"


def route_baum(quelle: str) -> list[dict]:
    """Liest die Routen aus App.tsx samt ihrer Verschachtelung.

    Von Hand statt mit einem regulaeren Ausdruck: In den Attributen steht
    element={<AppShell />} - das '>' darin wuerde jeden einfachen Ausdruck
    an der falschen Stelle abschneiden.
    """
    routen: list[dict] = []
    stapel: list[dict] = []
    i = 0
    while i < len(quelle):
        if quelle.startswith("</Route>", i):
            if stapel:
                stapel.pop()
            i += 8
            continue
        if not quelle.startswith("<Route", i):
            i += 1
            continue
        j, tiefe = i + 6, 0
        while j < len(quelle):
            if quelle[j] == "{":
                tiefe += 1
            elif quelle[j] == "}":
                tiefe -= 1
            elif quelle[j] == ">" and tiefe == 0:
                break
            j += 1
        attribute = quelle[i + 6 : j]
        selbstschliessend = attribute.rstrip().endswith("/")
        pfad = re.search(r'path="([^"]*)"', attribute)
        element = re.search(r"element=\{<(\w+)", attribute)
        index = "index" in attribute and "path=" not in attribute
        eintrag = {
            "pfad": pfad.group(1) if pfad else ("" if index else None),
            "element": element.group(1) if element else None,
            "vorfahren": [s["element"] for s in stapel if s["element"]],
            "pfad_teile": [s["pfad"] for s in stapel if s["pfad"]],
        }
        if eintrag["pfad"] is not None:
            routen.append(eintrag)
        if not selbstschliessend:
            stapel.append(eintrag)
        i = j + 1
    return routen


def voller_pfad(route: dict) -> str:
    teile = [t for t in route["pfad_teile"] + [route["pfad"]] if t]
    return "/".join(teile)


def pruefe_huelle(routen: list[dict]) -> list[str]:
    """Regel 1: Jede geschuetzte Seite liegt in AppShell.

    AppShell liefert <main class="md-page-stack"> - daher kommen die
    seitlichen Abstaende, der Platz fuer die Navigation unten und der
    sichere Bereich. Eine Seite daneben hat davon nichts.
    """
    fehler = []
    for route in routen:
        if "AuthGuard" not in route["vorfahren"]:
            continue  # oeffentliche Seiten bringen ihr Layout selbst mit
        pfad = voller_pfad(route)
        if "AppShell" in route["vorfahren"]:
            continue
        if pfad in VOLLBILD_ERLAUBT:
            continue
        fehler.append(
            f'Route "{pfad}" liegt ausserhalb von AppShell und hat damit keine '
            f"Seitenabstaende. Entweder in den AppShell-Block verschieben oder "
            f"in check_page_rules.py unter VOLLBILD_ERLAUBT mit Begruendung eintragen."
        )
    return fehler


def pruefe_titel(routen: list[dict], top_bar: str) -> list[str]:
    """Regel 2: Jede Seite in der Huelle hat einen Titel in der Kopfzeile.

    Die Titel stehen an zwei Stellen: ROOT_TITLES fuer die fuenf Hauptseiten,
    SUB_ROUTES als Ausdruecke fuer alles darunter. Beide muessen hier gelesen
    werden - sonst meldet die Pruefung Seiten, die laengst einen Titel haben.
    """
    feste = set(re.findall(r"'(/[^']*)':", top_bar))
    muster = [
        re.compile(p.replace(r"\/", "/"))
        for p in re.findall(r"\[/(.+?)/,", top_bar)
    ]

    fehler = []
    for route in routen:
        if "AppShell" not in route["vorfahren"]:
            continue
        # Platzhalter durch einen Beispielwert ersetzen: ":id" ist keine
        # Adresse, die je aufgerufen wird - "/lauf/x" schon.
        pfad = "/" + re.sub(r":[^/]+", "x", voller_pfad(route))
        if pfad in feste or any(m.search(pfad) for m in muster):
            continue
        fehler.append(
            f'Route "{pfad}" hat keinen Titel in TopAppBar.tsx - die Kopfzeile '
            f"bliebe leer."
        )
    return fehler


def pruefe_farben() -> list[str]:
    """Regel 3: Farben kommen aus den Gestaltungswerten, nicht aus dem Code.

    Eine feste Farbe im Code kennt den Hellmodus nicht und aendert sich nicht
    mit, wenn die Palette angepasst wird.
    """
    fehler = []
    fest = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(")
    for datei in sorted(list((WEB / "pages").rglob("*.tsx")) + list((WEB / "components").rglob("*.tsx"))):
        if datei.name in FARBEN_ERLAUBT:
            continue
        zeilen = datei.read_text(encoding="utf-8").splitlines()
        for nr, zeile in enumerate(zeilen, 1):
            # Ausnahme, wenn sie begruendet ist - in der Zeile selbst oder
            # darueber. Erlaubt bleibt damit, was von aussen vorgegeben ist;
            # unbemerkt durchrutschen kann nichts mehr.
            davor = zeilen[nr - 2] if nr >= 2 else ""
            if MARKE in zeile or MARKE in davor:
                continue
            if fest.search(zeile):
                kurz = zeile.strip()[:70]
                fehler.append(
                    f"{datei.relative_to(ROOT)}:{nr}: feste Farbe statt "
                    f"var(--md-...): {kurz}"
                )
    return fehler


def main() -> int:
    app = APP_TSX.read_text(encoding="utf-8")
    routen = route_baum(app)
    fehler = (
        pruefe_huelle(routen)
        + pruefe_titel(routen, TOP_BAR.read_text(encoding="utf-8"))
        + pruefe_farben()
    )
    if fehler:
        print("Seitenregeln verletzt (docs/seiten-regeln.md):", file=sys.stderr)
        for f in fehler:
            print(f"- {f}", file=sys.stderr)
        return 1
    print(f"Seitenregeln eingehalten ({len(routen)} Routen geprueft).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
