import base64
from pathlib import Path

import streamlit as st

from core.context import AppContext
from core.domain import read_sensor_table
from core.loader import load_modules
from core.registry import ModuleRegistry, has_analysis_tabs

# Schlüssel, unter dem die EINE gemeinsam genutzte Datenquelle im AppContext liegt.
SHARED_DATA_PARAM = "shared_data"

# MyProSole-Logo (liegt im assets-Ordner des App-Roots).
LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "myprosole_logo.png"


def _render_centered_logo() -> None:
    if not LOGO_PATH.exists():
        return
    data = base64.b64encode(LOGO_PATH.read_bytes()).decode()
    st.markdown(
        f"<div style='text-align:center; margin-top:0.5rem; margin-bottom:1rem;'>"
        f"<img src='data:image/png;base64,{data}' style='width:280px; max-width:80%;'/></div>",
        unsafe_allow_html=True,
    )


def init_app() -> AppContext:
    page_icon = str(LOGO_PATH) if LOGO_PATH.exists() else "🦶"
    st.set_page_config(
        page_title="MyProSole Schrittanalyse", page_icon=page_icon, layout="wide"
    )
    _render_centered_logo()
    return AppContext()


def render_shared_data_input(ctx: AppContext) -> None:
    """Rendert den EINEN gemeinsamen Datei-Upload für alle Module.

    Die Datei wird nur einmal eingelesen (``read_sensor_table``) und als Roh-
    DataFrame im AppContext abgelegt, sodass alle Module dieselbe Quelle nutzen.
    Es gibt KEIN automatisches Laden einer Standarddatei mehr.
    """
    st.subheader("Datei-Upload (für alle Analysen)")
    uploaded = st.file_uploader(
        "CSV/XLSX hochladen – wird von Schrittanalyse UND Gang-/Laufanalyse verwendet",
        type=["csv", "xlsx"],
        key="shared_uploader",
    )

    if uploaded is None:
        ctx.set_param(SHARED_DATA_PARAM, None)
        st.info("Bitte zuerst eine Datei hochladen, um die Analysen zu starten.")
        return

    try:
        raw_df = read_sensor_table(uploaded, uploaded.name)
    except Exception as exc:  # noqa: BLE001 - dem Nutzer eine klare Meldung geben
        ctx.set_param(SHARED_DATA_PARAM, None)
        st.error(f"Fehler beim Lesen der Datei: {exc}")
        return

    ctx.set_param(
        SHARED_DATA_PARAM,
        {"raw_df": raw_df, "source_name": uploaded.name},
    )
    st.success(f"Datei geladen: **{uploaded.name}** ({len(raw_df)} Zeilen)")


def render_analysis_tabs(ctx: AppContext) -> None:
    """Rendert EINE gemeinsame Tab-Navigation aus den Modul-Beiträgen.

    Jedes Modul liefert über ``analysis_tabs`` Inhaltsbeiträge zu benannten
    Tabs (``TabContribution``). Mehrere Module können in denselben Tab einzahlen
    (z. B. tragen Schritt- und Gang-/Laufanalyse beide zu „Übersicht“ bei). So
    entsteht statt zweier gestapelter Tab-Leisten genau eine de-duplizierte
    Navigation. Module ohne Tab-Beiträge rendern weiterhin über ``render``.
    """
    registry = ctx.registry
    if registry is None:
        return

    sections = registry.collect_tab_sections(ctx)
    if sections:
        tabs = st.tabs([section.label for section in sections])
        for tab, section in zip(tabs, sections):
            with tab:
                for item in section.items:
                    item.render(ctx)

    for module in registry.sorted_modules():
        if not has_analysis_tabs(module):
            module.render(ctx)


def run_app() -> None:
    ctx = init_app()
    registry = ModuleRegistry()
    load_modules(registry)
    ctx.registry = registry

    for module in registry.sorted_modules():
        module.register_sidebar(ctx)

    # EIN gemeinsamer Upload vor allen Modul-Bereichen.
    render_shared_data_input(ctx)

    # EINE gemeinsame, de-duplizierte Tab-Navigation für alle Analysen.
    render_analysis_tabs(ctx)
