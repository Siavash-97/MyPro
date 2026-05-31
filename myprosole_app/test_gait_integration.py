"""
Integrationstest (ohne Streamlit-UI) für die regelbasierte Gang-/Laufanalyse.

Prüft:
1. Importierbarkeit der Kernmodule (Bootstrap, Loader, Registry, neues Modul).
2. Modul-Registrierung über den vorhandenen Loader.
3. Ausführung der integrierten Analyse-Pipeline auf:
   - myprosole_analysis/sample_data.csv (neues time_s-Format, 6 Sensoren)
   - FSR_LOG (5).CSV (timestamp_ms, Teilsensoren)
   sowie auf beiden Dateien über den App-Loader (read_sensor_table).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # kein Display nötig

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))

import pandas as pd  # noqa: E402

from core.domain import read_sensor_table  # noqa: E402
from core.registry import ModuleRegistry  # noqa: E402
from core.loader import load_modules  # noqa: E402
from modules.gait_analysis.pipeline import run_pipeline  # noqa: E402

SAMPLE = BASE / "myprosole_analysis" / "sample_data.csv"
FSR_LOG = BASE / "FSR_LOG (5).CSV"


def test_module_registration() -> None:
    print("== Modul-Registrierung über den Loader ==")
    registry = ModuleRegistry()
    load_modules(registry)
    ids = [m.id for m in registry.sorted_modules()]
    print("Registrierte Module:", ids)
    assert "gait_analysis" in ids, "gait_analysis nicht registriert!"
    assert "step_analysis" in ids, "step_analysis fehlt (Regression)!"
    print("OK\n")


def _run_on(path: Path) -> None:
    print(f"== Pipeline auf {path.name} ==")
    raw = read_sensor_table(str(path), path.name)
    print(f"Eingelesene Spalten: {list(raw.columns)}")
    result = run_pipeline(raw, params=None)
    print(f"Fehlende Sensorspalten (mit 0 gefüllt): {result.missing_sensor_columns}")
    print(f"Erkannte Schritte: {len(result.steps)}")

    assert isinstance(result.step_table, pd.DataFrame)
    assert isinstance(result.summary_table, pd.DataFrame)

    print("\nSTEP-LEVEL-TABELLE (erste 8 Zeilen):")
    with pd.option_context("display.max_columns", None, "display.width", 220):
        print(result.step_table.head(8).to_string(index=False))

    print("\nSUMMARY-TABELLE:")
    print(result.summary_table.to_string(index=False))

    print("\nKONTAKTMUSTER-VERTEILUNG:")
    print(result.pattern_distribution.to_string(index=False))
    print("OK\n")


def main() -> None:
    test_module_registration()
    _run_on(SAMPLE)
    if FSR_LOG.exists():
        _run_on(FSR_LOG)
    else:
        print(f"HINWEIS: {FSR_LOG} nicht gefunden – übersprungen.")
    print("Alle Tests erfolgreich abgeschlossen.")


if __name__ == "__main__":
    main()
