"""Faelle fuer die zwei Prueftore aus Auftrag P (07.09.2026).

Tor 1 - `scripts/check_beleg_tsc.py`: findet Zeilen, die `tsc --noEmit` als
Beleg fuehren (Befehl + Erfolgsvokabel in derselben Zeile). Die Ausnahme ist
keine Wortliste, sondern die Sperrklinke `scripts/beleg_sperrklinke.json`.

Tor 2 - `scripts/check_akten_werkzeuge.py`: haelt Werkzeugnamen im Text einer
Agentenakte gegen ihre `tools:`-Zeile und prueft dieselben Namen in den zwei
`--disallowedTools`-Zeilen der Automatisierung.

Die Skripte liegen nicht auf dem Importpfad; sie werden ueber `ROOT/scripts`
geladen - so, wie `run_tests.py` sie aufruft.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import check_akten_werkzeuge  # noqa: E402
import check_beleg_tsc  # noqa: E402


# --------------------------------------------------------------------------
# Tor 1: tsc --noEmit als Beleg
# --------------------------------------------------------------------------


def test_belegzeile_wird_gefunden() -> None:
    """Befehl und Erfolgsvokabel in derselben Zeile - das ist ein Beleg."""
    # Nur diese eine Erfolgsvokabel - so faellt der Fall, wenn jemand
    # "Exit 0" aus ERFOLG nimmt (Mutationsprobe, Abnahmesatz 10).
    text = "Definition of Done. `npx tsc --noEmit`: Exit 0. Suite vollzaehlig.\n"
    treffer = check_beleg_tsc.treffer_in_text(text)
    assert [nr for nr, _ in treffer] == [1]


def test_erfolgsvokabel_grün_wird_gefunden() -> None:
    text = "Ein echter Fehler kam erst im Prueftor hoch. `npx tsc --noEmit` war grün,\n"
    assert len(check_beleg_tsc.treffer_in_text(text)) == 1


def test_verwerfungszeile_bleibt_gruen() -> None:
    """Eine Zeile, die den Befehl verwirft, ist kein Beleg."""
    text = (
        "**`tsc --noEmit` ist kein Nachweis.**\n"
        "Statt `npx tsc --noEmit` gilt seit dem 31.08. `npm run build`.\n"
        "`npx tsc --noEmit --listFiles | grep -vc node_modules` -> 0\n"
    )
    assert check_beleg_tsc.treffer_in_text(text) == []


def test_erfolgsvokabel_ohne_befehl_bleibt_gruen() -> None:
    text = "`npx tsc -b`: Exit 0, alles bestanden.\n"
    assert check_beleg_tsc.treffer_in_text(text) == []


def test_schluessel_traegt_ordnernamen_als_praefix(tmp_path: Path) -> None:
    ordner = tmp_path / "Agent-Reports"
    ordner.mkdir()
    (ordner / "2026-09-07_1200_probe.md").write_text(
        "`npx tsc --noEmit`: Exit 0\n", encoding="utf-8"
    )
    assert list(check_beleg_tsc.zaehlung([ordner])) == [
        "Agent-Reports/2026-09-07_1200_probe.md"
    ]


def test_neue_datei_wird_ganz_gemeldet(tmp_path: Path) -> None:
    """Eine Datei, die die Klinke nicht kennt, wird mit jeder Zeile gemeldet."""
    ordner = tmp_path / "Berichte"
    ordner.mkdir()
    (ordner / "neu.md").write_text(
        "Vorwort ohne Befund.\n`npx tsc --noEmit`: Exit 0\n", encoding="utf-8"
    )
    klinke = tmp_path / "klinke.json"
    klinke.write_text("{}\n", encoding="utf-8")

    fehler = check_beleg_tsc.validate([ordner], klinke)
    assert len(fehler) == 1
    assert "Berichte/neu.md:2" in fehler[0]


def test_zahl_auf_der_klinke_ist_gruen(tmp_path: Path) -> None:
    ordner = tmp_path / "Berichte"
    ordner.mkdir()
    (ordner / "alt.md").write_text("`npx tsc --noEmit`: Exit 0\n", encoding="utf-8")
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"Berichte/alt.md": 1}), encoding="utf-8")

    assert check_beleg_tsc.validate([ordner], klinke) == []


def test_zahl_ueber_der_klinke_meldet_die_neue_zeile(tmp_path: Path) -> None:
    ordner = tmp_path / "Berichte"
    ordner.mkdir()
    (ordner / "alt.md").write_text(
        "`npx tsc --noEmit`: Exit 0\n`npx tsc --noEmit` war grün\n", encoding="utf-8"
    )
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"Berichte/alt.md": 1}), encoding="utf-8")

    fehler = check_beleg_tsc.validate([ordner], klinke)
    assert len(fehler) == 1
    assert "2 Belegzeilen" in fehler[0]
    assert "erlaubt sind 1" in fehler[0]


def test_zahl_unter_der_klinke_meldet_ebenfalls(tmp_path: Path) -> None:
    """Sonst wird die Klinke zur Erlaubnis: sie muss mitsinken."""
    ordner = tmp_path / "Berichte"
    ordner.mkdir()
    (ordner / "alt.md").write_text("`npx tsc --noEmit`: Exit 0\n", encoding="utf-8")
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"Berichte/alt.md": 2}), encoding="utf-8")

    fehler = check_beleg_tsc.validate([ordner], klinke)
    assert len(fehler) == 1
    assert "unter der Klinke" in fehler[0]
    assert "--sperrklinke" in fehler[0]


def test_klinke_wird_aus_dem_ist_stand_geschrieben(tmp_path: Path) -> None:
    ordner = tmp_path / "Berichte"
    ordner.mkdir()
    (ordner / "alt.md").write_text("`npx tsc --noEmit`: Exit 0\n", encoding="utf-8")
    klinke = tmp_path / "klinke.json"

    check_beleg_tsc.schreibe_klinke([ordner], klinke)
    assert json.loads(klinke.read_text(encoding="utf-8")) == {"Berichte/alt.md": 1}
    assert check_beleg_tsc.validate([ordner], klinke) == []


def test_ausgelieferte_klinke_haelt_den_echten_korpus_gruen() -> None:
    if not all(o.is_dir() for o in check_beleg_tsc.ORDNER):
        pytest.skip("Berichtsordner auf dieser Maschine nicht vorhanden")
    assert check_beleg_tsc.validate(check_beleg_tsc.ORDNER, check_beleg_tsc.SPERRKLINKE) == []


# --------------------------------------------------------------------------
# Tor 2: Werkzeugnamen in den Akten
# --------------------------------------------------------------------------


AKTE_KOPF = "---\nname: probe\ntools: Read, Grep, Glob, Bash\n---\n\n"


def _akte(tmp_path: Path, rumpf: str) -> Path:
    p = tmp_path / "probe.md"
    p.write_text(AKTE_KOPF + rumpf, encoding="utf-8")
    return p


def test_anweisung_mit_fremdem_werkzeug_wird_gemeldet(tmp_path: Path) -> None:
    akte = _akte(tmp_path, "An der GRENZE fragst du per SendMessage an main.\n")
    fehler = check_akten_werkzeuge.pruefe_akte(akte)
    assert len(fehler) == 1
    assert "SendMessage" in fehler[0]


def test_zweite_anweisung_mit_fremdem_werkzeug_wird_gemeldet(tmp_path: Path) -> None:
    akte = _akte(tmp_path, "Aktuelle Fassungen holst du dir mit WebFetch.\n")
    fehler = check_akten_werkzeuge.pruefe_akte(akte)
    assert len(fehler) == 1
    assert "WebFetch" in fehler[0]


def test_begruendungssatz_mit_kein_bleibt_gruen(tmp_path: Path) -> None:
    akte = _akte(
        tmp_path,
        "Du kannst nicht fragen: Deine Werkzeugzeile hat kein SendMessage, und "
        "das ist Absicht.\n",
    )
    assert check_akten_werkzeuge.pruefe_akte(akte) == []


def test_werkzeug_aus_der_tools_zeile_bleibt_gruen(tmp_path: Path) -> None:
    akte = _akte(tmp_path, "Signaturen schlaegst du mit Grep nach, per Read liest du.\n")
    assert check_akten_werkzeuge.pruefe_akte(akte) == []


def test_name_ohne_anweisungswort_bleibt_gruen(tmp_path: Path) -> None:
    akte = _akte(tmp_path, "Agent - du vergibst nichts weiter; ein Lauf, ein Name.\n")
    assert check_akten_werkzeuge.pruefe_akte(akte) == []


def test_verneinung_ohne_bleibt_gruen(tmp_path: Path) -> None:
    """Haengt nur an "ohne" - faellt, wenn jemand das Wort aus VERNEINUNG nimmt."""
    akte = _akte(tmp_path, "Ohne WebFetch arbeitest du mit dem, was im Repo steht.\n")
    assert check_akten_werkzeuge.pruefe_akte(akte) == []


# Der Berichtigungsvermerk aus `bauer.md`, Zeile 61: er zitiert die entfernte
# Anweisung und ist deshalb eine Meldung - die Klinke traegt sie, kein Filter.
VERMERK = (
    'Bis zum 07.09.2026 stand hier "fragst per SendMessage an main" - eine '
    "Anweisung, die die Zeile tools: sieben Zeilen darueber unmoeglich machte.\n"
)


def test_berichtigungsvermerk_ist_eine_meldung(tmp_path: Path) -> None:
    akte = _akte(tmp_path, VERMERK)
    assert len(check_akten_werkzeuge.pruefe_akte(akte)) == 1


def test_neue_akte_wird_ganz_gemeldet(tmp_path: Path) -> None:
    _akte(tmp_path, VERMERK)
    klinke = tmp_path / "klinke.json"
    klinke.write_text("{}\n", encoding="utf-8")

    fehler = check_akten_werkzeuge.validate(tmp_path, [], klinke)
    assert len(fehler) == 1
    assert "SendMessage" in fehler[0]


def test_akte_auf_der_klinke_ist_gruen(tmp_path: Path) -> None:
    _akte(tmp_path, VERMERK)
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"probe.md": 1}), encoding="utf-8")

    assert check_akten_werkzeuge.validate(tmp_path, [], klinke) == []


def test_akte_ueber_der_klinke_meldet(tmp_path: Path) -> None:
    _akte(tmp_path, VERMERK + "An der GRENZE fragst du per SendMessage an main.\n")
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"probe.md": 1}), encoding="utf-8")

    fehler = check_akten_werkzeuge.validate(tmp_path, [], klinke)
    assert len(fehler) == 1
    assert "2 Meldungen" in fehler[0]
    assert "erlaubt sind 1" in fehler[0]


def test_akte_unter_der_klinke_meldet_ebenfalls(tmp_path: Path) -> None:
    """Sonst wird die Klinke zur Erlaubnis: sie muss mitsinken."""
    _akte(tmp_path, VERMERK)
    klinke = tmp_path / "klinke.json"
    klinke.write_text(json.dumps({"probe.md": 2}), encoding="utf-8")

    fehler = check_akten_werkzeuge.validate(tmp_path, [], klinke)
    assert len(fehler) == 1
    assert "unter der Klinke" in fehler[0]
    assert "--sperrklinke" in fehler[0]


def test_klinke_der_akten_wird_aus_dem_ist_stand_geschrieben(tmp_path: Path) -> None:
    _akte(tmp_path, VERMERK)
    klinke = tmp_path / "klinke.json"

    check_akten_werkzeuge.schreibe_klinke(tmp_path, klinke)
    assert json.loads(klinke.read_text(encoding="utf-8")) == {"probe.md": 1}
    assert check_akten_werkzeuge.validate(tmp_path, [], klinke) == []


def test_bauer_akte_steht_mit_ihrem_vermerk_in_der_klinke() -> None:
    bauer = check_akten_werkzeuge.AKTEN / "bauer.md"
    text = bauer.read_text(encoding="utf-8")
    assert text.count("SendMessage") >= 3
    # Zwei der drei Nennungen sind verneint, die dritte ist der
    # Berichtigungsvermerk - genau eine Meldung, und die traegt die Klinke.
    assert len(check_akten_werkzeuge.pruefe_akte(bauer)) == 1


def test_echte_akten_gegen_ausgelieferte_klinke_gruen() -> None:
    akten = sorted(check_akten_werkzeuge.AKTEN.glob("*.md"))
    assert akten, "keine Agentenakten gefunden - die Pruefung waere wertlos"
    assert check_akten_werkzeuge.validate(
        check_akten_werkzeuge.AKTEN, [], check_akten_werkzeuge.SPERRKLINKE
    ) == []


def test_ps1_meldet_tote_werkzeugnamen(tmp_path: Path) -> None:
    p = tmp_path / "check.ps1"
    p.write_text(
        '$raw = $prompt | & claude -p --disallowedTools '
        '"Bash,Read,Write,Edit,MultiEdit,Glob,Grep,WebFetch,WebSearch,Task,'
        'TodoWrite,NotebookEdit" 2>> $logFile\n',
        encoding="utf-8",
    )
    fehler = check_akten_werkzeuge.pruefe_ps1(p)
    gemeldet = {n for n in ("MultiEdit", "Task", "TodoWrite") if any(n in f for f in fehler)}
    assert gemeldet == {"MultiEdit", "Task", "TodoWrite"}


def test_ps1_ohne_tote_namen_bleibt_gruen(tmp_path: Path) -> None:
    p = tmp_path / "check.ps1"
    p.write_text(
        '& claude -p --disallowedTools "Bash,Read,Write,Edit,Glob,Grep,'
        'WebFetch,WebSearch,NotebookEdit"\n',
        encoding="utf-8",
    )
    assert check_akten_werkzeuge.pruefe_ps1(p) == []
