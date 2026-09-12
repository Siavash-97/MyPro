"""Erwartet die Datenbank das, was die Migrationen sagen?

Warum es dieses Skript gibt
---------------------------
Am 26.08.2026 stand `public.darf_ich_anfragen(ziel uuid)` in der
Produktionsdatenbank - `security definer`, ausfuehrbar fuer `authenticated`,
und **in keiner Migration des Repos**. Gefunden hat sie eine Vorbedingung,
die etwas ganz anderes pruefen sollte: Sie verlangte "genau vier Funktionen"
und bekam fuenf.

Am selben Tag kam heraus, dass 0056 beim ersten Einspielen nach der HAELFTE
abgebrochen war - zwei von vier Funktionen, ohne dass es jemandem auffiel.

Beide Faelle sind dieselbe Luecke: **Niemand hat je geprueft, ob der Katalog
der Datenbank zu den Migrationen passt.** Wir kennen die Migrationen, die wir
geschrieben haben. Was tatsaechlich in der Datenbank steht, ist eine andere
Frage, und sie wurde nie gestellt.

Was das Skript tut
------------------
Es liest die Migrationen in ihrer Reihenfolge und fuehrt Buch:

  create [or replace] function s.n(...)   -> erwartet
  drop function [if exists] s.n(...)      -> nicht mehr erwartet
  alter function s.n(...) set schema z    -> zieht um
  create policy p on s.t                  -> erwartet
  drop policy [if exists] p on s.t        -> nicht mehr erwartet

Und, seit 12.09.2026, dieselbe Buchfuehrung fuer Tabellen:

  create table [if not exists] s.t        -> erwartet
  drop table [if exists] a, b, ...        -> nicht mehr erwartet (Komma-Liste)
  alter table s.t rename to u             -> umbenannt
  alter table s.t set schema z            -> zieht um

Daraus baut es eine SQL-Abfrage, die den Sollzustand als `values`-Liste
mitbringt und gegen `pg_proc`, `pg_policies` und `pg_tables` haelt - **in
beide Richtungen**:

  im Katalog, nicht in den Migrationen  -> wie der Fund vom 26.08.
  in den Migrationen, nicht im Katalog  -> eine Migration lief nie oder halb

Anlass fuer die Tabellen-Buchfuehrung, 12.09.2026 (B3, Agent-Report
`2026-09-12_2108_leitung-abschluss-0061-0062-gehostet-belegt-b3-gemessen-gepusht.md`,
Abschnitt "B3 gemessen"): Eine ueber den Supabase-**Tabelleneditor** angelegte
Tabelle bekommt vier eigene Rechte (`SELECT, INSERT, UPDATE, DELETE` fuer
`anon` UND `authenticated`) - per **eigenem `grant`**, den der Editor selbst
absetzt, nicht aus `pg_default_acl`. Ein ACL-Vergleich (0061/0062) sieht das
nicht, weil er nur prueft, WELCHE Rechte eine vorhandene Tabelle hat, nicht
OB die Tabelle ueberhaupt aus einer Migration stammt. Nur der Abgleich
"existiert die Tabelle in den Migrationen" findet so einen Fall - und genauso
den Gegenfall vom 10.09. (0013, vier Wochen 404: eine Migration legt eine
Tabelle an, das Einspielen wurde uebersprungen, die Tabelle fehlte gehostet).
Siehe im Ordner "Fehler und Bug Reports" die Datei
2026-09-10_1544_zwei-tabellen-die-es-in-der-produktion-nie-gab.md,
Entscheidung 3 (Zeile 98) und "Offene Wege".

Vier Blindstellen, die der erste Lauf hatte
------------------------------------------
Die erste Fassung meldete DREI Treffer. Zwei davon waren Fehler in diesem
Skript, und die vollstaendige Liste des Nutzers zeigte danach 43 Zeilen -
davon 42 hausgemacht. Alle vier Ursachen sind behoben; sie stehen hier,
weil jede von ihnen zeigt, wie ein Pruefwerkzeug lauter Unsinn melden kann
und dabei richtig aussieht:

1. **Regelnamen in Anfuehrungszeichen.** 0008 schreibt
   `create policy "runs_select_own"`, 0056 schreibt ihn ohne. Der erste
   Ausdruck erlaubte kein `"` und uebersah damit 18 Regeln.
2. **Regeln aus `execute format()`-Schleifen.** 0019 und 0032 erzeugen sie
   aus einer Tabellenliste; der Name steht nirgends als Zeichenkette.
   Weitere 14.
3. **`drop table` raeumt Regeln mit weg.** 0038 loescht die Gym-Tabellen;
   das Skript erwartete ihre Regeln weiter. Acht.
4. **Nur drei Schemas gefragt.** Die Regeln auf `storage.objects` (0019,
   0021, 0022) fielen alle durch. Zehn.

Was es weiterhin NICHT kann
---------------------------
- Es liest den TEXT der Migrationen, nicht ihre Wirkung. Was in einem
  `do $$ ... $$`-Block per `execute` entsteht und KEINE Schleife ueber
  Tabellennamen ist - etwa die Umschreibung in 0055 -, sieht es nicht.
  Fuer Tabellen gilt dasselbe: Eine Tabelle, die in einem `do $$ ... $$`-
  Block oder per `execute format('create table %I ...', ...)` entsteht,
  sieht dieses Skript NICHT - anders als bei Policies gibt es dafuer (noch)
  keinen Schleifen-Parser, weil am 12.09.2026 keine Migration diesen Weg
  fuer Tabellen benutzt (geprueft per grep -inE nach "create table" ueber
  alle *.sql: kein Treffer innerhalb eines `do $$`-Blocks). Taucht das eines
  Tages auf, MUSS das gemeldet und nicht stillschweigend uebergangen werden -
  der Treffer fehlt sonst lautlos auf der "erwartet"-Seite.
- Es vergleicht Schema, Name und die ANZAHL der Parameter, nicht deren
  Typen. Zwei Ueberladungen mit gleich vielen Parametern faellt es nicht
  auf.
- Es prueft keine Spaltenrechte. Die stehen in 0057 und liessen sich
  ergaenzen; hier fehlen sie, damit das Skript ueberschaubar bleibt.
- Fuer Tabellen vergleicht es NUR den Namen (Schema + Tabellenname), keine
  Spalten, Indizes, Constraints oder Trigger - das ist die Grenze, die der
  Fehlerbericht vom 10.09. selbst benennt ("Namen sind nicht Struktur").
- Partitionen, Fremdtabellen (foreign tables) und Views werden nicht
  erwartet und nicht abgefragt - gemessen 12.09.2026 lokal:
  `select relkind, count(*) from pg_class ... where nspname='public'`
  liefert nur `r` (gewoehnliche Tabelle, 46) und `i` (Index, 129), keine
  Views/Partitionen/Fremdtabellen. Kaeme eine hinzu, wuerde sie als
  gewoehnliche Tabelle erwartet und faellt durch, wenn `pg_tables` sie
  nicht fuehrt (Fremdtabellen/Partitionen-Kindtabellen stehen dort anders).
- Fuer Tabellen wird nur `public`, `einwilligung` und `intern` abgefragt -
  `storage` NICHT, obwohl es fuer Policies mitgefragt wird (0019/0021/0022
  legen dort Regeln an). Gemessen 12.09.2026: keine Migration dieses Repos
  legt eine Tabelle im Schema `storage` an (`grep` ueber alle `create table`-
  Treffer, keiner mit `storage.`-Praefix) - `storage` gehoert Supabase selbst
  und seine zehn Tabellen (lokal gezaehlt) sind keine unseren.
- Von Supabase selbst verwaltete Objekte kennt es nicht. Wer eines findet,
  traegt es NICHT stillschweigend als Ausnahme ein, sondern belegt zuerst,
  dass es verwaltet ist - Eigentuemer, Erweiterungszugehoerigkeit, Event
  Trigger.

Jede dieser Grenzen ist eine Stelle, an der ein Fund durchrutschen kann.
Sie stehen hier, damit niemand das Ergebnis fuer vollstaendiger haelt, als
es ist.

Aufruf
------
    python scripts/katalog_gegen_migrationen.py

Gibt eine SQL-Abfrage auf die Standardausgabe. Die in den SQL-Editor
einfuegen und ausfuehren - sie AENDERT NICHTS, sie liest nur.
"""

from __future__ import annotations

import re
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[1]
MIGRATIONEN = WURZEL / "myprosole_app" / "supabase" / "migrations"

# `create or replace function public.foo(a uuid, b text)` - Schema optional.
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
# Die Anfuehrungszeichen sind KEIN Zierrat im Ausdruck: Die Migrationen
# schreiben Regelnamen mal so, mal so -
#
#     create policy "runs_select_own" on public.runs        (0008)
#     create policy kontakt_anfragen_anlegen on ...         (0056)
#
# Die erste Fassung dieses Skripts erlaubte kein fuehrendes `"` und hat
# damit den GROSSTEIL aller Regeln uebersehen. Ergebnis: 23 Fehlalarme in
# der Richtung "im Katalog, in keiner Migration" - also genau die Richtung,
# in der ein echter Fund steht. Ein Werkzeug, dessen Treffer man
# gewohnheitsmaessig wegwischt, ist schlimmer als keines.
CREATE_POLICY = re.compile(
    r'create\s+policy\s+"?([a-z_][a-z0-9_]*)"?\s+on\s+'
    r'(?:"?([a-z_][a-z0-9_]*)"?\.)?"?([a-z_][a-z0-9_]*)"?',
    re.I,
)
DROP_POLICY = re.compile(
    r'drop\s+policy\s+(?:if\s+exists\s+)?"?([a-z_][a-z0-9_]*)"?\s+on\s+'
    r'(?:"?([a-z_][a-z0-9_]*)"?\.)?"?([a-z_][a-z0-9_]*)"?',
    re.I,
)


# Regeln, die in einer Schleife entstehen. Muster aus 0019 und 0032:
#
#     foreach t in array array['community_posts', 'community_post_likes'] loop
#       execute format('create policy %I_select_all on public.%I ...', t, t);
#
# Der Regelname steht dort NIRGENDS als Zeichenkette - er wird aus dem
# Tabellennamen und dem Suffix zusammengesetzt. Die erste Fassung dieses
# Skripts sah davon nichts und meldete jede so erzeugte Regel als "im
# Katalog, in keiner Migration".
#
# Der Ausdruck fasst absichtlich NUR den Rumpf zwischen `loop` und
# `end loop`: In 0010 steht ein `array[...]` in einem gewoehnlichen Insert
# (security_domains), und das ist keine Regelerzeugung.
SCHLEIFE = re.compile(
    r"foreach\s+\w+\s+in\s+array\s+array\[(.*?)\]\s*loop(.*?)end\s+loop",
    re.I | re.S,
)
SCHLEIFEN_POLICY = re.compile(r"create\s+policy\s+%I_([a-z0-9_]+)\s+on", re.I)


# Wird eine Tabelle geloescht, gehen ihre Regeln mit - Postgres raeumt sie
# ohne Nachfrage weg. Die erste Fassung merkte sich nur `drop policy` und
# erwartete die Regeln der Gym-Tabellen weiter, obwohl 0038 sie am
# 19.08.2026 samt Tabellen entfernt hat. Ergebnis: acht Fehlalarme in der
# Richtung "in einer Migration, nicht im Katalog".
#
# Der Ausdruck fasst absichtlich NUR die Textstelle nach dem Schluesselwort
# bis zum Semikolon (`[^;]+`) - nicht nur den ersten Tabellennamen. Grund:
# `drop table [if exists] a, b, c;` ist eine gueltige Komma-Liste (0038
# schreibt sie zwar als drei einzelne Anweisungen, aber die Buchfuehrung
# darf sich nicht darauf verlassen, dass das so bleibt). `tabellen_aus_liste`
# zerlegt die Liste danach.
DROP_TABELLE = re.compile(
    r"drop\s+table\s+(?:if\s+exists\s+)?([^;]+)",
    re.I,
)


def tabellen_aus_liste(rohe_liste: str) -> list[tuple[str, str]]:
    """Zerlegt `a, s.b, c` aus einem `drop table ...`-Fund in
    [(schema, tabelle), ...]. Schema ohne Angabe = public. `cascade`/
    `restrict` am Ende des letzten Elements wird abgeschnitten."""
    ergebnis: list[tuple[str, str]] = []
    for stueck in rohe_liste.split(","):
        stueck = stueck.strip().strip('"')
        stueck = re.sub(r"\s+(cascade|restrict)\s*$", "", stueck, flags=re.I).strip()
        if not stueck:
            continue
        teile = [t.strip().strip('"') for t in stueck.split(".")]
        if len(teile) == 2:
            ergebnis.append((teile[0].lower(), teile[1].lower()))
        elif len(teile) == 1 and teile[0]:
            ergebnis.append(("public", teile[0].lower()))
    return ergebnis


# `create table [if not exists] s.t (...)` - Schema optional, wie bei
# Funktionen. Erfasst KEINE Tabellen, die in einem `do $$ ... $$`-Block per
# `execute format(...)` mit einem Platzhalter (`%I`) entstehen - dafuer
# bräuchte es einen Schleifen-Parser wie bei Policies (SCHLEIFE unten), den
# es fuer Tabellen (noch) nicht gibt, weil am 12.09.2026 keine Migration
# diesen Weg fuer Tabellen benutzt (siehe Kopf-Docstring, "Was es weiterhin
# NICHT kann").
CREATE_TABELLE = re.compile(
    r"create\s+table\s+(?:if\s+not\s+exists\s+)?"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)",
    re.I,
)

# `alter table [if exists] s.t rename to u` - benannt nach dem Vorbild
# ALTER_SCHEMA fuer Funktionen. Erfordert woertlich "rename to" direkt nach
# dem Tabellennamen, damit `rename column x to y` (0018) NICHT trifft - dort
# steht zwischen "rename" und "to" das Wort "column".
ALTER_TABELLE_UMBENENNEN = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)"
    r"\s+rename\s+to\s+([a-z_][a-z0-9_]*)",
    re.I,
)

ALTER_TABELLE_SCHEMA = re.compile(
    r"alter\s+table\s+(?:if\s+exists\s+)?"
    r"(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)"
    r"\s+set\s+schema\s+([a-z_][a-z0-9_]*)",
    re.I,
)


def ohne_kommentare(text: str) -> str:
    """Zeilenkommentare weg - sonst zaehlt jedes Beispiel im Kopf mit.

    Genau das waere ein stiller Fehler: Die Migrationen dieses Projekts
    tragen lange Kopfkommentare, in denen SQL zitiert wird - auch SQL, das
    ausdruecklich NICHT ausgefuehrt werden soll.
    """
    return "\n".join(z for z in text.split("\n") if not z.lstrip().startswith("--"))


def parameter_zahl(rohe_liste: str) -> int:
    inhalt = rohe_liste.strip()
    if not inhalt:
        return 0
    # Klammern in Typen wie numeric(10,2) wuerden hier stoeren; im Projekt
    # kommen sie in Funktionssignaturen nicht vor. Faellt das eines Tages
    # auseinander, meldet der Vergleich einen Unterschied - lauter Fehler
    # ist besser als ein stiller.
    return len([t for t in inhalt.split(",") if t.strip()])


def sollzustand() -> tuple[
    set[tuple[str, str, int]], set[tuple[str, str]], set[tuple[str, str]]
]:
    funktionen: set[tuple[str, str, int]] = set()
    policies: set[tuple[str, str]] = set()
    tabellenkatalog: set[tuple[str, str]] = set()

    for datei in sorted(MIGRATIONEN.glob("*.sql")):
        text = ohne_kommentare(datei.read_text(encoding="utf-8"))

        for schema, name, args in CREATE_FUNKTION.findall(text):
            funktionen.add((schema.lower() or "public", name.lower(), parameter_zahl(args)))

        for schema, name, args in DROP_FUNKTION.findall(text):
            funktionen.discard((schema.lower() or "public", name.lower(), parameter_zahl(args)))

        for schema, name, args, ziel in ALTER_SCHEMA.findall(text):
            alt = (schema.lower() or "public", name.lower(), parameter_zahl(args))
            if alt in funktionen:
                funktionen.discard(alt)
            funktionen.add((ziel.lower(), name.lower(), parameter_zahl(args)))

        # Tabellen-Buchfuehrung. Erst anlegen/umbenennen/umziehen, dann
        # loeschen lesen - innerhalb einer Datei kommt in diesem Projekt
        # kein `create table` nach dem `drop table` derselben Tabelle vor.
        for schema, name in CREATE_TABELLE.findall(text):
            tabellenkatalog.add((schema.lower() or "public", name.lower()))

        for schema, name, ziel in ALTER_TABELLE_UMBENENNEN.findall(text):
            alt = (schema.lower() or "public", name.lower())
            tabellenkatalog.discard(alt)
            tabellenkatalog.add((schema.lower() or "public", ziel.lower()))

        for schema, name, zielschema in ALTER_TABELLE_SCHEMA.findall(text):
            alt = (schema.lower() or "public", name.lower())
            if alt in tabellenkatalog:
                tabellenkatalog.discard(alt)
            tabellenkatalog.add((zielschema.lower(), name.lower()))

        for name, schema, tabelle in CREATE_POLICY.findall(text):
            policies.add((name.lower(), tabelle.lower()))

        # Und die, die eine Schleife erzeugt.
        for liste, rumpf in SCHLEIFE.findall(text):
            schleifentabellen = re.findall(r"'([a-z_][a-z0-9_]*)'", liste)
            for suffix in SCHLEIFEN_POLICY.findall(rumpf):
                for tabelle in schleifentabellen:
                    policies.add((f"{tabelle.lower()}_{suffix.lower()}", tabelle.lower()))

        # `drop table` raeumt sowohl die Regeln der geloeschten Tabelle
        # (bestehendes Verhalten, 0038) als auch die Tabelle selbst aus dem
        # Katalog (neu, 12.09.2026) - dieselbe Fundstelle im Text bedient
        # jetzt beide Buchfuehrungen.
        for rohe_liste in DROP_TABELLE.findall(text):
            for schema, tabelle in tabellen_aus_liste(rohe_liste):
                tabellenkatalog.discard((schema, tabelle))
                for eintrag in list(policies):
                    if eintrag[1] == tabelle:
                        policies.discard(eintrag)

        for name, schema, tabelle in DROP_POLICY.findall(text):
            # `drop policy if exists` steht fast immer direkt VOR dem
            # zugehoerigen `create policy`. Weil beide in derselben Datei
            # stehen und create nach drop gelesen wird, traegt die
            # Reihenfolge - der Eintrag kommt gleich wieder herein.
            policies.discard((name.lower(), tabelle.lower()))
        for name, schema, tabelle in CREATE_POLICY.findall(text):
            policies.add((name.lower(), tabelle.lower()))

    return funktionen, policies, tabellenkatalog


def als_sql(funktionen, policies, tabellenkatalog) -> str:
    f_zeilen = ",\n".join(
        f"      ('{s}', '{n}', {a})" for s, n, a in sorted(funktionen)
    )
    p_zeilen = ",\n".join(f"      ('{n}', '{t}')" for n, t in sorted(policies))
    t_zeilen = ",\n".join(f"      ('{s}', '{n}')" for s, n in sorted(tabellenkatalog))

    return f"""-- ============================================================
-- Katalog gegen Migrationen
-- ============================================================
-- Erzeugt von scripts/katalog_gegen_migrationen.py aus {len(funktionen)}
-- erwarteten Funktionen, {len(policies)} erwarteten Policies und
-- {len(tabellenkatalog)} erwarteten Tabellen.
--
-- DIESE ABFRAGE AENDERT NICHTS. Sie liest nur.
--
-- Erwartet wird: KEINE Zeile. Jede Zeile ist ein Unterschied zwischen dem,
-- was die Migrationen sagen, und dem, was in der Datenbank steht.
--
-- Grenzen, damit niemand das Ergebnis fuer vollstaendiger haelt als es ist:
--   - Was in einem `do $$ ... $$`-Block entsteht, sieht das Skript nicht -
--     auch keine Tabelle, die per `execute format(...)` mit Platzhalter
--     entsteht.
--   - Verglichen wird Schema, Name und ANZAHL der Parameter, nicht deren
--     Typen (Funktionen).
--   - Bei Tabellen wird NUR der Name verglichen (Schema + Tabellenname) -
--     keine Spalten, Indizes, Constraints, Trigger.
--   - Tabellen werden nur in public, einwilligung und intern erwartet und
--     abgefragt - storage NICHT (dort legt keine Migration eine Tabelle
--     an, gemessen 12.09.2026). Partitionen, Fremdtabellen und Views
--     werden nicht erwartet.
--   - Spaltenrechte werden nicht geprueft.
-- ============================================================

with erwartet_funktion (schema, name, parameter) as (
  values
{f_zeilen}
),
erwartet_policy (name, tabelle) as (
  values
{p_zeilen}
),
erwartet_tabelle (schema, name) as (
  values
{t_zeilen}
),
ist_funktion as (
  select n.nspname as schema, p.proname as name, p.pronargs as parameter
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'intern', 'einwilligung')
     -- Nur was wir selbst angelegt haben koennten. Erweiterungen bringen
     -- eigene Funktionen mit, und die stehen in keiner Migration.
     and not exists (
       select 1 from pg_depend d
        where d.objid = p.oid and d.deptype = 'e'
     )
     -- BELEGTE AUSNAHME, nicht vermutet.
     --
     -- `public.rls_auto_enable` steht in keiner Migration und tauchte beim
     -- ersten Lauf am 26.08.2026 als offener Fund auf. Am selben Tag gegen
     -- die Produktionsdatenbank gemessen:
     --
     --   eigentuemer             postgres
     --   security_definer        true
     --   gehoert_zu_erweiterung  false
     --   event_trigger           ensure_rls
     --   kommentar               NULL
     --
     -- Der Event Trigger `ensure_rls` ist der Beleg: Die Funktion haengt an
     -- der Plattform-Automatik, die neue Tabellen mit Zeilenrechten
     -- versieht - nicht an Anwendungscode. Kein Aufrufer im Repo
     -- (`grep` ueber alle .ts/.tsx/.sql/.py: null Treffer).
     --
     -- Was der Beleg NICHT sagt: `gehoert_zu_erweiterung = false` heisst,
     -- sie stammt aus keiner Erweiterung, sondern wurde angelegt. Von wem,
     -- steht hier nicht - nur DASS sie Infrastruktur bedient und nicht die
     -- App. Faellt der Event Trigger eines Tages weg, gehoert diese
     -- Ausnahme sofort geprueft.
     --
     -- Sie steht hier, damit sie nicht bei jedem Lauf erneut als offener
     -- Punkt erscheint - genau das Rauschen, vor dem der Kopf warnt.
     and not (n.nspname = 'public' and p.proname = 'rls_auto_enable')
),
ist_policy as (
  select policyname as name, tablename as tabelle
    from pg_policies
   where schemaname in ('public', 'intern', 'einwilligung', 'storage')
),
ist_tabelle as (
  -- storage bewusst NICHT dabei - siehe Grenzen oben. Nur gewoehnliche
  -- Tabellen; pg_tables fuehrt ohnehin keine Views (die stehen in
  -- information_schema.views / pg_class relkind 'v'), aber Partitionen und
  -- Fremdtabellen sind hier ebenfalls nicht ausgeschlossen, weil im Projekt
  -- keine vorkommen (gemessen 12.09.2026, siehe Kopf-Docstring).
  select schemaname as schema, tablename as name
    from pg_tables
   where schemaname in ('public', 'intern', 'einwilligung')
)
select 'Funktion' as art,
       'im Katalog, in KEINER Migration' as befund,
       i.schema || '.' || i.name || '(' || i.parameter || ' Parameter)' as objekt
  from ist_funktion i
  left join erwartet_funktion e
    on e.schema = i.schema and e.name = i.name and e.parameter = i.parameter
 where e.name is null

union all

select 'Funktion',
       'in einer Migration, NICHT im Katalog',
       e.schema || '.' || e.name || '(' || e.parameter || ' Parameter)'
  from erwartet_funktion e
  left join ist_funktion i
    on i.schema = e.schema and i.name = e.name and i.parameter = e.parameter
 where i.name is null

union all

select 'Policy',
       'im Katalog, in KEINER Migration',
       i.tabelle || ' / ' || i.name
  from ist_policy i
  left join erwartet_policy e
    on e.name = i.name and e.tabelle = i.tabelle
 where e.name is null

union all

select 'Policy',
       'in einer Migration, NICHT im Katalog',
       e.tabelle || ' / ' || e.name
  from erwartet_policy e
  left join ist_policy i
    on i.name = e.name and i.tabelle = e.tabelle
 where i.name is null

union all

select 'Tabelle',
       'im Katalog, in KEINER Migration',
       i.schema || '.' || i.name
  from ist_tabelle i
  left join erwartet_tabelle e
    on e.schema = i.schema and e.name = i.name
 where e.name is null

union all

select 'Tabelle',
       'in einer Migration, NICHT im Katalog',
       e.schema || '.' || e.name
  from erwartet_tabelle e
  left join ist_tabelle i
    on i.schema = e.schema and i.name = e.name
 where i.name is null

order by 1, 2, 3;
"""


if __name__ == "__main__":
    f, p, t = sollzustand()
    print(als_sql(f, p, t))
