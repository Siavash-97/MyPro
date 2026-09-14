#!/usr/bin/env python3
"""Prueft, dass jede angelegte Funktion ihr `revoke ... from public` hat.

Warum es diese Pruefung gibt
----------------------------
PostgreSQL vergibt beim Anlegen JEDER Funktion additiv PUBLIC=EXECUTE - eine
dokumentierte Altlast ("historically, EXECUTE privilege for functions is
granted to PUBLIC by default"). `anon` erbt das ueber PUBLIC. Eine neue
Funktion in `public` ist damit ab der Sekunde ihrer Entstehung ueber die
REST-Schnittstelle fuer jeden Unangemeldeten aufrufbar, ohne dass irgendwo
ein `grant` dazu steht. Dieselbe Klasse wie 0037: Rechte, die die Plattform
vergibt und die keine Migration zurueckholt (0037, Nachzug in 0054).

Die naheliegende Abwehr hilft nicht. 0062:100-114 haelt die Messung vom
11.09.2026 fest: nach `alter default privileges ... revoke execute on
functions from public` zeigt `pg_default_acl` korrekt KEINE PUBLIC-Zeile
mehr - und die naechste neu angelegte Funktion hat trotzdem
`proacl = {=X/postgres, ...}`, `has_function_privilege('anon', ...)` bleibt
wahr. Die Voreinstellung schuetzt kuenftige Funktionen NICHT.

Was bisher schuetzte, war Hausbrauch: jede Funktion bekommt ihr eigenes
`revoke all on function ... from public, anon` in ihrer eigenen Migration
(0052:421, 0056:391/469/494, 0062:166). Hausbrauch haelt, bis ihn jemand
vergisst. Ab hier haelt es dieses Skript.

Was geprueft wird
-----------------
Die Migrationen werden in ihrer Reihenfolge als TEXT gelesen:

  create [or replace] function s.n(...)  -> ab jetzt erwartet
  drop function [if exists] s.n(...)     -> Erwartung endet
  alter function s.n(...) set schema z   -> zieht um, Deckung zieht mit
  revoke all|execute on function s.n(...) from <rollen>
                                         -> deckt, wenn `public` in <rollen>

Ein `revoke ... from anon` OHNE `public` zaehlt NICHT: es nimmt anon sein
eigenes Recht, laesst PUBLIC=EXECUTE stehen, und anon erbt es weiter.

Die einzige Ausnahme ist `returns trigger`, und sie ist gemessen, nicht
angenommen (Sicherheitsbericht 12.09.2026, Abnahme 7):

    set local role anon;  select current_user;  -> anon
    select public.handle_new_user();
    ERROR:  trigger functions can only be called as triggers

Der Aufruf scheitert vor jedem Rechte- und Datenzugriff. Ein EXECUTE-Recht
auf eine Trigger-Funktion ist kein Weg hinein. Es gibt hier KEINE Liste
ausgenommener Funktionsnamen - eine solche Liste waechst still. Ausgenommen
wird, was `returns trigger` im Kopf traegt; das Skript druckt die
betroffenen Funktionen bei jedem Lauf namentlich aus.

Was NICHT geprueft wird
-----------------------
- Wirkung, nur Text. Was in einem `do $$ ... $$`-Block per `execute`
  entsteht, sieht das Skript nicht - weder die Funktion noch ihr revoke.
- Ueberladungen nur nach ANZAHL der Parameter, nicht nach Typen (wie
  scripts/katalog_gegen_migrationen.py). Zwei Ueberladungen mit gleich
  vielen Parametern fallen zusammen.
- Ob das revoke in der Datenbank tatsaechlich GILT. Eine halb eingespielte
  Migration sieht hier vollstaendig aus; das beantwortet der Abgleich
  Katalog gegen Migrationen, nicht dieses Skript.
- Eine Anweisung, ein Funktionsname: `revoke ... on function a(), b() from
  public` wuerde nur a decken. Kommt im Repo nicht vor.
- Parameterlisten mit Klammern im Typ (`numeric(10,2)`) zaehlt es falsch.
  Kommt im Repo nicht vor.

Aufruf
------
    python scripts/check_funktions_revoke.py
    python scripts/check_funktions_revoke.py --selbsttest

Der Selbsttest prueft die Muster an sieben bekannten Antworten, in beide
Richtungen (CLAUDE.md, Regel 2b). Er laeuft auch am Anfang jedes normalen
Laufs: ein Werkzeug, das bekannte Faelle nicht wiederfindet, darf keine
Zahl melden.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[1]
MIGRATIONEN = WURZEL / "myprosole_app" / "supabase" / "migrations"


# ---------------------------------------------------------------- Kern


class Funktion:
    """Eine Funktion, wie die Migrationen sie bis hierher hinterlassen haben."""

    def __init__(self, schema: str, name: str, parameter: int, trigger: bool,
                 angelegt_in: str) -> None:
        self.schema = schema
        self.name = name
        self.parameter = parameter
        self.trigger = trigger
        self.angelegt_in = angelegt_in
        self.gedeckt_in: str | None = None

    @property
    def schluessel(self) -> tuple[str, str, int]:
        return (self.schema, self.name, self.parameter)

    @property
    def bezeichner(self) -> str:
        return f"{self.schema}.{self.name}({self.parameter})"

    @property
    def zustand(self) -> str:
        if self.trigger:
            return "ausgenommen"
        return "gedeckt" if self.gedeckt_in else "ungedeckt"


class Ergebnis:
    def __init__(self, erwartet: list[Funktion], fremde_revokes: list[str]) -> None:
        self.erwartet = erwartet
        self.fremde_revokes = fremde_revokes

    def mit_zustand(self, zustand: str) -> list[Funktion]:
        return [f for f in self.erwartet if f.zustand == zustand]

    def befund(self) -> list[tuple[str, str, str]]:
        """Die Form, gegen die der Selbsttest vergleicht."""
        return sorted(
            (f.bezeichner, f.zustand, f.gedeckt_in or "") for f in self.erwartet
        )


# Die Ausdruecke sind bewusst dieselbe Bauart wie in
# scripts/katalog_gegen_migrationen.py - Schema optional, Parameter nur
# gezaehlt. Die Dopplung ist gewollt: dieses Tor muss allein laufen.
CREATE_FUNKTION = re.compile(
    r"create\s+(?:or\s+replace\s+)?function\s+"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)",
    re.I,
)
DROP_FUNKTION = re.compile(
    r"drop\s+function\s+(?:if\s+exists\s+)?"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)",
    re.I,
)
ALTER_SCHEMA = re.compile(
    r"alter\s+function\s+(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)"
    r"\s+set\s+schema\s+([a-z_][a-z0-9_]*)",
    re.I,
)
# `revoke all|execute [privileges] on function s.n(...) from <rollen>;`
# Die Rollenliste darf ueber Zeilen gehen - 0056:469 tut genau das.
# `revoke all on functionS from anon` (alter default privileges, 0062:116)
# trifft der Ausdruck NICHT: nach `function` steht dort kein Leerraum.
REVOKE_FUNKTION = re.compile(
    r"revoke\s+(?:all|execute)(?:\s+privileges)?\s+on\s+function\s+"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(([^)]*)\)"
    r"\s+from\s+([^;]+);",
    re.I,
)
# `public` als ganzes Wort in der Rollenliste - `from public, anon` deckt,
# `from anon` nicht, und eine Rolle namens `public_leser` deckt auch nicht.
ROLLE_PUBLIC = re.compile(r"(?<![a-z0-9_])public(?![a-z0-9_])", re.I)
# Direkt hinter der Parameterliste, nicht irgendwo im Rumpf: sonst wuerde
# ein `returns trigger` in einem Kommentar oder einem erzeugten Trigger
# eine gewoehnliche Funktion stillschweigend ausnehmen.
RETURNS_TRIGGER = re.compile(r"\s*returns\s+trigger(?![a-z0-9_])", re.I)


def ohne_kommentare(text: str) -> str:
    """Zeilenkommentare weg - sonst zaehlt jedes Beispiel im Kopf mit.

    Genau das waere ein stiller Fehler: Die Migrationen dieses Projekts
    tragen lange Kopfkommentare, in denen SQL zitiert wird - auch SQL, das
    ausdruecklich NICHT ausgefuehrt werden soll (0062:112 zitiert ein
    `revoke all on function ... from public, anon` als Merksatz).
    """
    return "\n".join(z for z in text.split("\n") if not z.lstrip().startswith("--"))


def parameter_zahl(rohe_liste: str) -> int:
    inhalt = rohe_liste.strip()
    if not inhalt:
        return 0
    return len([t for t in inhalt.split(",") if t.strip()])


def pruefe(dateien: list[tuple[str, str]]) -> Ergebnis:
    """Migrationen (Name, Text) in Reihenfolge lesen und Buch fuehren."""
    bestand: dict[tuple[str, str, int], Funktion] = {}
    reihenfolge: list[Funktion] = []
    fremde_revokes: list[str] = []

    for dateiname, roh in dateien:
        text = ohne_kommentare(roh)

        # Innerhalb einer Datei zaehlt die Reihenfolge der Anweisungen:
        # 0055 zieht `ist_blockiert` erst um und revoked dann unter dem
        # neuen Schema. Andersherum gelesen ginge die Deckung verloren.
        anweisungen: list[tuple[int, str, re.Match[str]]] = []
        for ausdruck, art in (
            (CREATE_FUNKTION, "create"),
            (DROP_FUNKTION, "drop"),
            (ALTER_SCHEMA, "alter"),
            (REVOKE_FUNKTION, "revoke"),
        ):
            for treffer in ausdruck.finditer(text):
                anweisungen.append((treffer.start(), art, treffer))
        anweisungen.sort(key=lambda a: a[0])

        for _, art, treffer in anweisungen:
            schema = (treffer.group(1) or "public").lower()
            name = treffer.group(2).lower()
            zahl = parameter_zahl(treffer.group(3))
            schluessel = (schema, name, zahl)

            if art == "create":
                if schluessel in bestand:
                    # `create or replace` setzt die Rechte nicht zurueck.
                    continue
                trigger = RETURNS_TRIGGER.match(text, treffer.end()) is not None
                eintrag = Funktion(schema, name, zahl, trigger, dateiname)
                bestand[schluessel] = eintrag
                reihenfolge.append(eintrag)

            elif art == "drop":
                alt = bestand.pop(schluessel, None)
                if alt is not None:
                    reihenfolge.remove(alt)

            elif art == "alter":
                ziel = treffer.group(4).lower()
                alt = bestand.pop(schluessel, None)
                if alt is None:
                    continue
                alt.schema = ziel
                bestand[alt.schluessel] = alt

            elif art == "revoke":
                if not ROLLE_PUBLIC.search(treffer.group(4)):
                    continue  # `from anon` allein laesst PUBLIC=EXECUTE stehen
                eintrag = bestand.get(schluessel)
                if eintrag is None:
                    fremde_revokes.append(
                        f"{dateiname}: {schema}.{name}({zahl})"
                    )
                    continue
                eintrag.gedeckt_in = dateiname

    return Ergebnis(reihenfolge, fremde_revokes)


# ---------------------------------------------------------- Selbsttest

# Sieben bekannte Antworten. Jede Zeile: Kennung, was sie zeigt, die
# Probetexte (Dateiname, SQL) und der erwartete Befund - Bezeichner,
# Zustand, Datei des deckenden revoke.
#
# Fall (a) ist kein erfundener Text: die beiden Zeilen stehen so in
# 0052_zusammenlauf_vorschlaege_und_anfragen.sql (332 und 421).
FAELLE: list[tuple[str, str, list[tuple[str, str]], list[tuple[str, str, str]]]] = [
    (
        "a",
        "echtes Paar aus 0052 - create und revoke werden zusammengefuehrt",
        [
            (
                "0052_zusammenlauf_vorschlaege_und_anfragen.sql",
                "create or replace function public.zusammenlauf_vorschlaege("
                "hoechstens int default 20)\n"
                "returns table (nutzer uuid)\n"
                "language sql\n"
                "as $$ select null::uuid $$;\n"
                "revoke all on function public.zusammenlauf_vorschlaege(int)"
                " from public, anon;\n",
            )
        ],
        [
            (
                "public.zusammenlauf_vorschlaege(1)",
                "gedeckt",
                "0052_zusammenlauf_vorschlaege_und_anfragen.sql",
            )
        ],
    ),
    (
        "b",
        "Funktion ohne jedes revoke - genau der Fund, den das Tor sucht",
        [
            (
                "9001_probe.sql",
                "create or replace function public._p() returns int language sql"
                " as $$ select 1 $$;\n",
            )
        ],
        [("public._p(0)", "ungedeckt", "")],
    ),
    (
        "c",
        "dieselbe Funktion als Trigger-Funktion - ausgenommen, gemessen",
        [
            (
                "9002_probe.sql",
                "create or replace function public._p() returns trigger language"
                " plpgsql as $$ begin return new; end $$;\n",
            )
        ],
        [("public._p(0)", "ausgenommen", "")],
    ),
    (
        "d",
        "drop function beendet die Erwartung - keine Meldung",
        [
            (
                "9003_probe.sql",
                "create or replace function public._p() returns int language sql"
                " as $$ select 1 $$;\n"
                "drop function public._p();\n",
            )
        ],
        [],
    ),
    (
        "e",
        "set schema zieht um - das revoke darf unter dem neuen Schema stehen",
        [
            (
                "9004_probe.sql",
                "create function public._p(ziel uuid) returns int language sql"
                " as $$ select 1 $$;\n",
            ),
            (
                "9005_probe.sql",
                "alter function public._p(uuid) set schema intern;\n"
                "revoke all on function intern._p(uuid) from public, anon;\n",
            ),
        ],
        [("intern._p(1)", "gedeckt", "9005_probe.sql")],
    ),
    (
        "f",
        "revoke nur von anon deckt NICHT - PUBLIC=EXECUTE bleibt stehen",
        [
            (
                "9006_probe.sql",
                "create or replace function public._p() returns int language sql"
                " as $$ select 1 $$;\n"
                "revoke all on function public._p() from anon;\n",
            )
        ],
        [("public._p(0)", "ungedeckt", "")],
    ),
    (
        "g",
        "revoke execute ... from public deckt genauso wie revoke all",
        [
            (
                "9007_probe.sql",
                "create or replace function public._p() returns int language sql"
                " as $$ select 1 $$;\n"
                "revoke execute on function public._p() from public;\n",
            )
        ],
        [("public._p(0)", "gedeckt", "9007_probe.sql")],
    ),
]


def selbsttest(laut: bool = True) -> list[str]:
    """Gibt die Kennungen der gefallenen Faelle zurueck - leer heisst gruen."""
    gefallen: list[str] = []
    for kennung, beschreibung, dateien, erwartet in FAELLE:
        soll = sorted(erwartet)
        try:
            ist = pruefe(list(dateien)).befund()
        except Exception as fehler:  # noqa: BLE001 - der Fall soll fallen, nicht das Skript
            ist = [("<Ausnahme>", f"{type(fehler).__name__}: {fehler}", "")]
        if ist != soll:
            gefallen.append(kennung)
            if laut:
                print(f"  FALL ({kennung}) FAELLT - {beschreibung}")
                print(f"    erwartet: {soll}")
                print(f"    bekommen: {ist}")
        elif laut:
            print(f"  Fall ({kennung}) wie erwartet - {beschreibung}")
    return gefallen


# ------------------------------------------------------------ Aufruf


def migrationen_lesen() -> list[tuple[str, str]]:
    return [
        (p.name, p.read_text(encoding="utf-8"))
        for p in sorted(MIGRATIONEN.glob("*.sql"))
    ]


def main(argv: list[str]) -> int:
    nur_selbsttest = "--selbsttest" in argv

    print("Selbsttest an sieben bekannten Antworten (CLAUDE.md, Regel 2b):")
    gefallen = selbsttest(laut=True)
    if gefallen:
        print()
        print(f"Selbsttest GEFALLEN in {len(gefallen)} von {len(FAELLE)} Faellen: "
              f"{', '.join(gefallen)}")
        print("Ein Werkzeug, das bekannte Faelle nicht wiederfindet, meldet keine")
        print("Zahl ueber die echten Migrationen. Abbruch.")
        return 2
    print(f"Selbsttest: {len(FAELLE)}/{len(FAELLE)} Faelle wie erwartet.")

    if nur_selbsttest:
        return 0

    if not MIGRATIONEN.is_dir():
        print(f"Migrationsordner nicht gefunden: {MIGRATIONEN}")
        return 2

    ergebnis = pruefe(migrationen_lesen())
    gedeckt = ergebnis.mit_zustand("gedeckt")
    ausgenommen = ergebnis.mit_zustand("ausgenommen")
    ungedeckt = ergebnis.mit_zustand("ungedeckt")

    print()
    print(f"{len(ergebnis.erwartet)} Funktionen legen die Migrationen an "
          f"(angelegt, nicht wieder geloescht).")
    print()
    print(f"Geprueft und gedeckt ({len(gedeckt)}) - je Funktion die Datei mit "
          f"dem revoke:")
    for f in sorted(gedeckt, key=lambda f: f.bezeichner):
        print(f"  {f.bezeichner:<52} {f.gedeckt_in}")
    print()
    print(f"Als Trigger-Funktion ausgenommen ({len(ausgenommen)}) - gemessen, "
          f"nicht angenommen:")
    for f in sorted(ausgenommen, key=lambda f: f.bezeichner):
        print(f"  {f.bezeichner:<52} angelegt in {f.angelegt_in}")

    if ergebnis.fremde_revokes:
        print()
        print("Hinweis - revoke auf eine Funktion, die keine Migration anlegt:")
        for zeile in ergebnis.fremde_revokes:
            print(f"  {zeile}")

    if ungedeckt:
        print()
        print(f"FEHLER: {len(ungedeckt)} Funktion(en) ohne "
              f"`revoke ... on function ... from public`:")
        for f in sorted(ungedeckt, key=lambda f: f.bezeichner):
            print(f"  {f.bezeichner:<52} angelegt in {f.angelegt_in}")
        print()
        print("PostgreSQL hat diesen Funktionen beim Anlegen PUBLIC=EXECUTE")
        print("gegeben; `anon` erbt es. Die Voreinstellung aus 0062 nimmt es")
        print("nicht zurueck (0062:100-114). In die Migration, die die Funktion")
        print("anlegt, gehoert daher:")
        print("    revoke all on function <schema>.<name>(<typen>) from public, anon;")
        print("    grant execute on function <schema>.<name>(<typen>) to authenticated;")
        return 1

    print()
    print("OK: keine Funktion ohne `revoke ... from public`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
