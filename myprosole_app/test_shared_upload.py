"""
Test der gemeinsamen Upload-Logik (eine Datei -> beide Module).

Hintergrund: Streamlit AppTest kann ``st.file_uploader`` nicht ansteuern.
Daher wird hier ein kleines Streamlit-Skript über ``AppTest.from_string``
ausgeführt, das exakt den realen Render-Pfad beider Module nutzt, die EINE
gemeinsame Datenquelle (wie nach einem Upload) aber direkt in den AppContext
schreibt. So wird verifiziert: eine Datei -> beide Analysen, ohne Exceptions.

Zusätzlich wird der Zustand OHNE Upload getestet (nur freundliche Hinweise).
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

from streamlit.testing.v1 import AppTest  # noqa: E402

BASE = Path(__file__).resolve().parent
SAMPLE = BASE / "myprosole_analysis" / "sample_data" / "sample_data.csv"
FSR_LOG = BASE / "FSR_LOG (5).CSV"

# Skript, das beide Module über die EINE gemeinsame Tab-Navigation rendert
# (gemeinsam injizierte Datei wie nach einem Upload).
_WITH_UPLOAD_SCRIPT = '''
import matplotlib
matplotlib.use("Agg")
import streamlit as st
from core.context import AppContext
from core.domain import read_sensor_table
from core.registry import ModuleRegistry
from core.loader import load_modules
from core.bootstrap import render_analysis_tabs

st.set_page_config(layout="wide")
CSV_PATH = r"__CSV_PATH__"

ctx = AppContext()
registry = ModuleRegistry()
load_modules(registry)
ctx.registry = registry

for module in registry.sorted_modules():
    module.register_sidebar(ctx)

raw_df = read_sensor_table(CSV_PATH, CSV_PATH)
ctx.set_param("shared_data", {"raw_df": raw_df, "source_name": "upload.csv"})

# EINE gemeinsame, de-duplizierte Tab-Navigation fuer alle Module.
render_analysis_tabs(ctx)
'''

# Skript ohne Upload: Upload-Eingabe + Tab-Navigation, shared_data bleibt None.
_NO_UPLOAD_SCRIPT = '''
import matplotlib
matplotlib.use("Agg")
from core.context import AppContext
from core.registry import ModuleRegistry
from core.loader import load_modules
from core.bootstrap import render_shared_data_input, render_analysis_tabs
import streamlit as st

st.set_page_config(layout="wide")
ctx = AppContext()
registry = ModuleRegistry()
load_modules(registry)
ctx.registry = registry
for module in registry.sorted_modules():
    module.register_sidebar(ctx)
# Kein Upload -> render_shared_data_input setzt shared_data auf None und zeigt Hinweis.
render_shared_data_input(ctx)
render_analysis_tabs(ctx)
'''


def _run_with_upload(csv_path: Path) -> None:
    print(f"== MIT Upload: {csv_path.name} ==")
    script = _WITH_UPLOAD_SCRIPT.replace("__CSV_PATH__", str(csv_path))
    at = AppTest.from_string(script, default_timeout=120).run()
    print("  exceptions:", len(at.exception))
    for e in at.exception:
        print("  EXC:", e.value)
    subheaders = [h.value for h in at.subheader]
    print("  subheaders:", subheaders)
    print("  dataframes:", len(at.dataframe))
    assert len(at.exception) == 0, "Exception im Mit-Upload-Pfad!"
    # Beide Pipelines tragen in die EINE gemeinsame Tab-Navigation ein
    # (erkennbar an ihren Kennzahlen-Subheadern in der Übersicht).
    assert any("Schrittanalyse" in h for h in subheaders), "Schrittanalyse-Beitrag fehlt"
    assert any("Gang-/Laufanalyse" in h for h in subheaders), "Gait-Beitrag fehlt"
    assert len(at.dataframe) > 0, "Keine Tabellen gerendert"
    print("  OK\n")


def _run_without_upload() -> None:
    print("== OHNE Upload ==")
    at = AppTest.from_string(_NO_UPLOAD_SCRIPT, default_timeout=60).run()
    print("  exceptions:", len(at.exception))
    for e in at.exception:
        print("  EXC:", e.value)
    infos = [i.value for i in at.info]
    print("  infos:", infos)
    assert len(at.exception) == 0, "Exception im Ohne-Upload-Pfad!"
    assert any("hochladen" in i.lower() for i in infos), "Upload-Hinweis fehlt"
    print("  OK\n")


def main() -> None:
    _run_without_upload()
    _run_with_upload(SAMPLE)
    if FSR_LOG.exists():
        _run_with_upload(FSR_LOG)
    else:
        print(f"HINWEIS: {FSR_LOG} nicht gefunden – übersprungen.")
    print("Alle Shared-Upload-Tests erfolgreich.")


if __name__ == "__main__":
    main()
