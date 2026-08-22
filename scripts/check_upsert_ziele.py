#!/usr/bin/env python3
"""Prueft, dass jedes onConflict-Ziel der Web-App wirklich benutzbar ist.

Warum es diese Pruefung gibt
----------------------------
Am 22.08.2026 stellte sich heraus, dass seit Wochen kein einziger GPS-Punkt
in der Datenbank ankam. Der Grund war kein Netzfehler und keine fehlende
Berechtigung, sondern ein Index:

    create unique index run_points_client_id_uk
      on public.run_points (run_id, client_id)
      where client_id is not null;

PostgreSQL kann einen TEILWEISEN Index fuer "on conflict" nur benutzen, wenn
dieselbe Bedingung in der Anweisung mitsteht. PostgREST schickt nur die
Spalten. Jede Uebertragung scheiterte mit 42P10 - immer, sofort, fuer alle.

Weder TypeScript noch die Testsuite konnten das bemerken: Auf der einen Seite
steht eine Zeichenkette in TypeScript, auf der anderen SQL. Zwischen beiden
gab es nichts, was sie vergleicht. Diese Pruefung ist dieses Etwas.

Was geprueft wird
-----------------
Fuer jedes ``onConflict: 'a,b'`` im Quelltext muss in den Migrationen ein
eindeutiger Index oder eine eindeutige Bedingung ueber genau diese Spalten
stehen, die nicht teilweise ist (kein ``where``) und nicht spaeter wieder
entfernt wurde.

Was NICHT geprueft wird
-----------------------
Die Tabelle. Verglichen werden nur Spaltensaetze - haetten zwei Tabellen
denselben, wuerde eine fehlende Bedingung durchrutschen. Der Aufwand dafuer
waere ein halber SQL-Leser; der Nutzen wird erst gebraucht, wenn es solche
Paare gibt.

Und ob die Migration in der Produktionsdatenbank eingespielt IST. Das kann nur
ein Zugriff auf die Datenbank sagen, und der gehoert nicht in ein Prueftor,
das ohne Netz laufen muss.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
QUELLE = ROOT / "myprosole_web" / "src"
MIGRATIONEN = ROOT / "myprosole_app" / "supabase" / "migrations"

# onConflict: 'run_id,client_id'  -  einfache oder doppelte Anfuehrungszeichen
AUFRUF = re.compile(r"""onConflict\s*:\s*['"]([^'"]+)['"]""")

# create unique index [concurrently] [if not exists] name on tabelle (spalten) [where ...]
INDEX = re.compile(
    r"create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?"
    r"(?P<name>[\w.]+)\s+on\s+(?P<tabelle>[\w.]+)\s*\((?P<spalten>[^)]*)\)"
    r"(?P<rest>[^;]*)",
    re.IGNORECASE | re.DOTALL,
)

# [add] constraint name unique (spalten) - in create table wie in alter table.
BEDINGUNG = re.compile(
    r"(?:add\s+)?constraint\s+(?P<name>[\w.]+)\s+unique\s*\((?P<spalten>[^)]*)\)",
    re.IGNORECASE | re.DOTALL,
)

# Ohne eigenen Namen, als Tabellenbedingung: primary key (a, b) / unique (a, b)
OHNE_NAMEN = re.compile(
    r"(?<!\w)(?:primary\s+key|unique)\s*\((?P<spalten>[^)]*)\)", re.IGNORECASE
)

# In der Spaltenzeile selbst:  user_id  uuid  primary key  references ...
# Der Spaltenname ist das erste Wort der Zeile.
IN_SPALTE = re.compile(
    r"^\s*\"?(?P<spalte>\w+)\"?\s+[^,]*?\b(?:primary\s+key|unique)\b", re.IGNORECASE
)

# Zeilen, die mit einem dieser Woerter beginnen, sind keine Spaltenzeilen.
KEIN_SPALTENANFANG = re.compile(
    r"^\s*(?:constraint|add|drop|create|alter|primary|unique|foreign|comment|"
    r"select|insert|update|delete|with|on|where|references|grant|revoke)\b",
    re.IGNORECASE,
)

ENTFERNT = re.compile(
    r"drop\s+(?:index|constraint)\s+(?:if\s+exists\s+)?(?P<name>[\w.]+)", re.IGNORECASE
)


def spaltensatz(roh: str) -> frozenset[str]:
    """'run_id, client_id' -> {'run_id', 'client_id'}.

    Die Reihenfolge ist bewusst egal: Fuer die Eindeutigkeit spielt sie keine
    Rolle, und "on conflict" findet den Index in jeder Reihenfolge.
    """
    return frozenset(t.strip().strip('"').lower() for t in roh.split(",") if t.strip())


def kurz(name: str) -> str:
    """'public.run_points_uk' -> 'run_points_uk' - fuers Vergleichen."""
    return name.rsplit(".", 1)[-1].lower()


def sammle_ziele() -> list[tuple[Path, int, frozenset[str], str]]:
    ziele = []
    for datei in sorted(QUELLE.rglob("*.ts")) + sorted(QUELLE.rglob("*.tsx")):
        if datei.name.endswith(".test.ts"):
            continue
        for nr, zeile in enumerate(datei.read_text(encoding="utf-8").splitlines(), start=1):
            for treffer in AUFRUF.finditer(zeile):
                ziele.append((datei, nr, spaltensatz(treffer.group(1)), treffer.group(1)))
    return ziele


def sammle_indizes() -> tuple[dict[frozenset[str], list[str]], dict[frozenset[str], str]]:
    """Liefert brauchbare Spaltensaetze und die Gruende der unbrauchbaren.

    Die Migrationen werden in ihrer Reihenfolge gelesen und ein laufender
    Stand gefuehrt: anlegen setzt, "drop" nimmt weg. Andernfalls wuerde eine
    Bedingung, die weggenommen und danach neu gesetzt wurde - das uebliche
    "drop constraint if exists" vor "add constraint" - als entfernt gelten.
    """
    aktiv: dict[str, tuple[frozenset[str], str | None]] = {}

    for datei in sorted(MIGRATIONEN.glob("*.sql")):
        text = datei.read_text(encoding="utf-8", errors="replace")
        # Kommentarzeilen weg: In diesem Projekt stehen ganze Migrationen als
        # Erklaerung im Kopf, samt Beispielen des FALSCHEN Index.
        zeilen = [z for z in text.splitlines() if not z.lstrip().startswith("--")]
        ohne_kommentar = "\n".join(zeilen)

        for nr, zeile in enumerate(zeilen, start=1):
            if KEIN_SPALTENANFANG.match(zeile):
                continue
            treffer = IN_SPALTE.match(zeile)
            if treffer:
                # Kein eigener Name, nie einzeln entfernbar: eine Kennung,
                # die mit keiner anderen zusammenfaellt.
                aktiv[f"{datei.name}:{nr}"] = (frozenset({treffer.group("spalte").lower()}), None)

        for t in INDEX.finditer(ohne_kommentar):
            bedingung = None
            if re.search(r"\bwhere\b", t.group("rest"), re.IGNORECASE):
                bedingung = " ".join(t.group("rest").split())
            aktiv[kurz(t.group("name"))] = (spaltensatz(t.group("spalten")), bedingung)

        for t in BEDINGUNG.finditer(ohne_kommentar):
            aktiv[kurz(t.group("name"))] = (spaltensatz(t.group("spalten")), None)

        for t in OHNE_NAMEN.finditer(ohne_kommentar):
            spalten = spaltensatz(t.group("spalten"))
            aktiv.setdefault(f"{datei.name}:tabelle:{sorted(spalten)}", (spalten, None))

        for t in ENTFERNT.finditer(ohne_kommentar):
            aktiv.pop(kurz(t.group("name")), None)

    brauchbar: dict[frozenset[str], list[str]] = {}
    unbrauchbar: dict[frozenset[str], str] = {}
    for name, (spalten, bedingung) in aktiv.items():
        if bedingung is None:
            brauchbar.setdefault(spalten, []).append(name)
        else:
            unbrauchbar.setdefault(spalten, f"{name} ({bedingung})")

    return brauchbar, unbrauchbar


def main() -> int:
    if not QUELLE.is_dir() or not MIGRATIONEN.is_dir():
        print("Quelltext oder Migrationen nicht gefunden - Pruefung uebersprungen.")
        return 0

    ziele = sammle_ziele()
    brauchbar, unbrauchbar = sammle_indizes()

    meldungen: list[str] = []
    for datei, nr, spalten, roh in ziele:
        if spalten in brauchbar:
            continue
        hinweis = ""
        if spalten in unbrauchbar:
            hinweis = (
                f"\n      Es gibt einen, aber er ist teilweise und damit fuer "
                f"'on conflict' unbrauchbar:\n      {unbrauchbar[spalten]}"
            )
        meldungen.append(
            f"  {datei.relative_to(ROOT)}:{nr}\n"
            f"      onConflict: '{roh}' - dazu gibt es keinen benutzbaren "
            f"eindeutigen Index.{hinweis}"
        )

    if meldungen:
        print("Upsert-Ziele ohne benutzbaren Index:\n")
        print("\n".join(meldungen))
        print(
            "\nPostgreSQL antwortet in diesem Fall mit 42P10 - bei jeder "
            "einzelnen Anfrage,\nunabhaengig von Netz und Berechtigung. "
            "Siehe Migration 0050."
        )
        return 1

    print(f"Upsert-Ziele geprueft: {len(ziele)} - alle haben einen benutzbaren Index.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
