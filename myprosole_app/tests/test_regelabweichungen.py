"""Faelle fuer `scripts/check_regelabweichungen.py` (15.09.2026).

Das Skript meldet jeden Task-Bericht, dem eine der sechs Pflichtueberschriften
als ganze Zeile fehlt - wortgleich, mit Ebene, je mit ihrem Stichtag:
`### Regelabweichungen` ab 2026-08-23, die fuenf anderen ab 2026-09-15.

Die Ueberschriften stehen hier als eigene Literale, nicht aus dem Skript
gelesen - sonst prueft der Test die Liste gegen sich selbst.

Das Skript liegt nicht auf dem Importpfad; es wird ueber `ROOT/scripts`
geladen - so, wie `run_tests.py` es aufruft.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import check_regelabweichungen  # noqa: E402

SECHS = [
    "## Auftrag",
    "## Struktur",
    "## Tools und Methoden",
    "### Nicht benutzt — und warum",
    "## Offene Punkte und Risiken",
    "### Regelabweichungen",
]


def bericht(ueberschriften: list[str], ende: str = "\n") -> str:
    """Ein Bericht mit je einer Zeile Fliesstext unter jeder Ueberschrift."""
    zeilen: list[str] = []
    for u in ueberschriften:
        zeilen += [u, "", "Text.", ""]
    return ende.join(zeilen) + ende


def test_b_alle_sechs_als_zeilen_nicht_gemeldet() -> None:
    text = bericht(SECHS)
    assert check_regelabweichungen.fehlende_ueberschriften(text, "2026-09-15") == []


def test_a_falsche_ebene_wird_mit_genau_dieser_ueberschrift_gemeldet() -> None:
    """Der haeufigste Fehler bis 15.09.: `##` statt `###` (47 von 145)."""
    ueberschriften = [
        "## Nicht benutzt — und warum" if u == "### Nicht benutzt — und warum" else u
        for u in SECHS
    ]
    text = bericht(ueberschriften)
    assert check_regelabweichungen.fehlende_ueberschriften(text, "2026-09-15") == [
        "### Nicht benutzt — und warum"
    ]


def test_e_ueberschrift_mit_zusatz_ist_keine_ueberschrift() -> None:
    """Zeilengenau, kein Teilstring: `(keine)` dahinter zaehlt nicht."""
    ueberschriften = [
        "### Regelabweichungen (keine)" if u == "### Regelabweichungen" else u
        for u in SECHS
    ]
    text = bericht(ueberschriften)
    assert check_regelabweichungen.fehlende_ueberschriften(text, "2026-09-15") == [
        "### Regelabweichungen"
    ]


def test_f_crlf_zeilenenden_nicht_gemeldet() -> None:
    text = bericht(SECHS, ende="\r\n")
    assert "\r\n" in text
    assert check_regelabweichungen.fehlende_ueberschriften(text, "2026-09-15") == []


def test_g_vor_dem_ersten_stichtag_nicht_geprueft(tmp_path, monkeypatch) -> None:
    (tmp_path / "2026-08-22_1200_alt.md").write_text("Nur Text.\n", encoding="utf-8")
    monkeypatch.setattr(check_regelabweichungen, "BERICHTE", tmp_path)
    assert check_regelabweichungen.berichte() == []
    assert check_regelabweichungen.fehlende_ueberschriften("Nur Text.\n", "2026-08-22") == []


def test_c_vor_dem_15_09_zaehlt_nur_regelabweichungen() -> None:
    text = bericht(["### Regelabweichungen"])
    assert check_regelabweichungen.fehlende_ueberschriften(text, "2026-09-14") == []


def test_d_ab_23_08_fehlende_regelabweichungen_mit_datei_gemeldet(
    tmp_path, monkeypatch, capsys
) -> None:
    """Datum aus dem Dateinamen; die Ausgabe nennt Datei UND Ueberschrift."""
    name = "2026-08-23_0900_ohne-abschnitt.md"
    (tmp_path / name).write_text("## Auftrag\n\nText.\n", encoding="utf-8")
    monkeypatch.setattr(check_regelabweichungen, "BERICHTE", tmp_path)
    assert check_regelabweichungen.main() == 1
    ausgabe = capsys.readouterr().out.splitlines()
    assert [z for z in ausgabe if name in z and "### Regelabweichungen" in z] != []
