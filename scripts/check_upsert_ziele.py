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

Der zweite Teil, seit 24.08.2026: Leserecht auf die Zielspalte
--------------------------------------------------------------
Derselbe Fehlertyp, andere Ursache. Am 24.08.2026 entzog Migration 0056 der
Rolle `authenticated` das SELECT-Recht auf drei Spalten von
`community_profiles`. Danach scheiterte jedes

    upsert({ user_id, zusammenlauf_sichtbar })

mit 42501 - obwohl nur GESCHRIEBEN werden sollte. Der Grund:

    insert ... on conflict do update set spalte = excluded.spalte

verlangt SELECT auf die ZIELSPALTE der Zuweisung. Die EXCLUDED-Seite ist
rechtefrei; die linke Seite nicht.

**Zwei unabhaengige Agenten haben das aus dem PostgreSQL-Quelltext
abgeleitet - und beide falsch.** Sie prueften die EXCLUDED-Seite, wo ihre
Aussage stimmt, und uebersahen die Zuweisungsseite. Gefunden hat es erst ein
dritter, der es gegen eine laufende Datenbank GEMESSEN hat.

Genau deshalb steht es jetzt hier. Ein Skript ersetzt "jemand hat zufaellig
gemessen" durch "das kann nicht mehr passieren". Verlangt vom Nutzer am
24.08.2026, ausdruecklich als verbindlich, nicht als Kuer.

Was dieser Teil prueft
----------------------
Fuer jede Spalte, die in einem `upsert(...)` im Quelltext GESCHRIEBEN wird:
Wenn eine Migration ihr das SELECT-Recht spaltenweise entzogen hat, ist der
Aufruf zur Laufzeit tot - und die Pruefung wird rot.

"Entzogen" heisst hier: Es gibt ein `grant select (...)` auf die Tabelle, und
die Spalte steht NICHT in der Liste. Ein spaltenweises Grant ist die einzige
Form, in der dieses Projekt Leserechte einschraenkt (0052, 0056); ein
tabellenweites `grant select` gibt alles frei und ist damit unkritisch.

Was dieser Teil NICHT prueft
----------------------------
Die Reihenfolge der Migrationen. Wird ein Recht spaeter wieder tabellenweit
vergeben, meldet die Pruefung trotzdem - lieber ein Fehlalarm, der eine
Ausnahme in die Liste zwingt, als ein stiller Durchrutscher.
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


# Ein `upsert({ ... })` samt geschriebener Spalten. Bewusst genuegsam: Es
# genuegt, die Schluessel des Objektliterals zu finden.
UPSERT_AUFRUF = re.compile(r"\.upsert\(\s*\{([^}]*)\}", re.S)
SCHLUESSEL = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*:")
# `grant select (a, b, c) on public.tabelle`
SPALTEN_GRANT = re.compile(
    r"grant\s+select\s*\(([^)]*)\)\s*\n?\s*on\s+(?:public\.)?([a-z_][a-z0-9_]*)",
    re.I | re.S,
)
# Welche Tabelle gehoert zu einem upsert? `.from('x')` davor.
FROM_TABELLE = re.compile(r"\.from\(\s*['\"]([a-z_][a-z0-9_]*)['\"]\s*\)")


def spalten_ohne_leserecht() -> dict[str, set[str]]:
    """Je Tabelle: Spalten, denen eine Migration das SELECT-Recht entzogen hat.

    Entzogen heisst: Es gibt ein spaltenweises `grant select (...)`, und die
    Spalte steht nicht darin. Die Menge aller Spalten kommt aus der Summe
    aller Grants derselben Tabelle - eine Spalte, die nirgends auftaucht, ist
    fuer diese Pruefung unbekannt und wird nicht gemeldet.
    """
    erlaubt: dict[str, set[str]] = {}
    for datei in sorted(MIGRATIONEN.glob("*.sql")):
        text = datei.read_text(encoding="utf-8", errors="replace")
        for roh, tabelle in SPALTEN_GRANT.findall(text):
            spalten = {
                t.strip().split("--")[0].strip()
                for t in roh.split(",")
                if t.strip() and not t.strip().startswith("--")
            }
            spalten = {sp for sp in spalten if sp.isidentifier()}
            if spalten:
                erlaubt.setdefault(tabelle, set()).update(spalten)
    return erlaubt


def upserts_mit_spalten() -> list[tuple[Path, int, str, set[str]]]:
    """Jeder `.upsert({...})` im Quelltext, samt Tabelle und Spalten."""
    treffer: list[tuple[Path, int, str, set[str]]] = []
    for datei in sorted(QUELLE.rglob("*.ts")) + sorted(QUELLE.rglob("*.tsx")):
        if ".test." in datei.name:
            continue
        text = datei.read_text(encoding="utf-8", errors="replace")
        for m in UPSERT_AUFRUF.finditer(text):
            spalten = set(SCHLUESSEL.findall(m.group(1)))
            if not spalten:
                continue
            # Die Tabelle steht im `.from(...)` davor - das naechste
            # rueckwaerts gefundene.
            davor = text[: m.start()]
            tabellen = FROM_TABELLE.findall(davor)
            tabelle = tabellen[-1] if tabellen else "?"
            zeile = text.count("\n", 0, m.start()) + 1
            treffer.append((datei, zeile, tabelle, spalten))
    return treffer


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

    # ------------------------------------------------------------
    # Teil zwei: Leserecht auf die Zielspalte (siehe Kopf)
    # ------------------------------------------------------------
    erlaubt = spalten_ohne_leserecht()
    for datei, nr, tabelle, spalten in upserts_mit_spalten():
        if tabelle not in erlaubt:
            continue  # Keine spaltenweise Einschraenkung fuer diese Tabelle.
        fehlend = sorted(sp for sp in spalten if sp not in erlaubt[tabelle])
        if not fehlend:
            continue
        meldungen.append(
            f"  {datei.relative_to(ROOT)}:{nr}\n"
            f"      upsert auf '{tabelle}' schreibt {', '.join(fehlend)} - aber"
            f" eine Migration hat dieser Spalte das SELECT-Recht entzogen.\n"
            f"      `on conflict do update set spalte = ...` braucht SELECT auf"
            f" die ZIELSPALTE. Zur Laufzeit: 42501.\n"
            f"      Der Weg dorthin ist eine security-definer-Funktion"
            f" (siehe Migration 0056)."
        )

    if meldungen:
        print("Upsert-Aufrufe, die zur Laufzeit scheitern wuerden:\n")
        print("\n".join(meldungen))
        print(
            "\nBeide Faelle scheitern bei JEDER Anfrage, unabhaengig von "
            "Netz und Berechtigung: der fehlende Index mit 42P10 (Migration "
            "0050), das fehlende Leserecht auf die Zielspalte mit 42501 "
            "(Migration 0056)."
        )
        return 1

    print(f"Upsert-Ziele geprueft: {len(ziele)} - alle haben einen benutzbaren Index.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
