import streamlit as st

from core.branding import configure_page, render_centered_logo
from core.context import AppContext
from core.domain import read_sensor_table
from core.loader import load_modules
from core.registry import ModuleRegistry, has_analysis_tabs
from core.sample_catalog import (
    SESSION_SAMPLE_KEY,
    available_samples,
    sample_by_filename,
)

# Schlüssel, unter dem die EINE gemeinsam genutzte Datenquelle im AppContext liegt.
SHARED_DATA_PARAM = "shared_data"

def init_app() -> AppContext:
    configure_page(page_title="MyProSole Schrittanalyse")
    render_centered_logo()
    return AppContext()


def _set_shared_data(ctx: AppContext, raw_df, source_name: str) -> None:
    ctx.set_param(
        SHARED_DATA_PARAM,
        {"raw_df": raw_df, "source_name": source_name},
    )


def render_sample_data_sidebar() -> None:
    """Beispieldaten in der Sidebar – ein Klick lädt direkt in die Analyse."""
    samples = available_samples()
    if not samples:
        return

    with st.sidebar:
        st.markdown("### Beispieldaten")
        st.caption(
            "Profil wählen und **Laden** – oder Datei **herunterladen** und "
            "in den Upload-Bereich ziehen."
        )

        labels = {sample.filename: sample.title for sample in samples}
        selected = st.selectbox(
            "Profil",
            options=[sample.filename for sample in samples],
            format_func=lambda name: labels.get(name, name),
            key="sample_profile_select",
        )
        meta = sample_by_filename(selected)
        if meta:
            st.caption(meta.description)

        col_load, col_dl = st.columns(2)
        with col_load:
            if st.button("Laden", use_container_width=True, key="load_sample_btn"):
                st.session_state[SESSION_SAMPLE_KEY] = selected
                st.rerun()
        with col_dl:
            if meta and meta.path.is_file():
                st.download_button(
                    "Download",
                    data=meta.path.read_bytes(),
                    file_name=meta.filename,
                    mime="text/csv",
                    use_container_width=True,
                    key=f"download_sample_{meta.filename}",
                )

        active = st.session_state.get(SESSION_SAMPLE_KEY)
        if active:
            active_meta = sample_by_filename(active)
            title = active_meta.title if active_meta else active
            if st.button("Beispiel entfernen", key="clear_sample_btn"):
                st.session_state.pop(SESSION_SAMPLE_KEY, None)
                st.rerun()
            st.info(f"Aktiv: **{title}**")


def _load_active_sample() -> tuple[object, str] | None:
    filename = st.session_state.get(SESSION_SAMPLE_KEY)
    if not filename:
        return None
    meta = sample_by_filename(filename)
    if meta is None or not meta.path.is_file():
        st.sidebar.warning(f"Beispieldatei fehlt: {filename}")
        st.session_state.pop(SESSION_SAMPLE_KEY, None)
        return None
    try:
        raw_df = read_sensor_table(meta.path, meta.filename)
    except Exception as exc:  # noqa: BLE001
        st.error(f"Fehler beim Lesen der Beispieldatei: {exc}")
        return None
    return raw_df, meta.filename


def render_shared_data_input(ctx: AppContext) -> None:
    """Rendert den EINEN gemeinsamen Datei-Upload für alle Module.

    Die Datei wird nur einmal eingelesen (``read_sensor_table``) und als Roh-
    DataFrame im AppContext abgelegt, sodass alle Module dieselbe Quelle nutzen.
    Alternativ können Beispieldaten aus der Sidebar geladen werden.
    """
    st.subheader("Datei-Upload (für alle Analysen)")
    uploaded = st.file_uploader(
        "CSV/XLSX hochladen – wird von Schrittanalyse UND Gang-/Laufanalyse verwendet",
        type=["csv", "xlsx"],
        key="shared_uploader",
    )

    if uploaded is not None:
        st.session_state.pop(SESSION_SAMPLE_KEY, None)
        try:
            raw_df = read_sensor_table(uploaded, uploaded.name)
        except Exception as exc:  # noqa: BLE001 - dem Nutzer eine klare Meldung geben
            ctx.set_param(SHARED_DATA_PARAM, None)
            st.error(f"Fehler beim Lesen der Datei: {exc}")
            return

        _set_shared_data(ctx, raw_df, uploaded.name)
        st.success(f"Datei geladen: **{uploaded.name}** ({len(raw_df)} Zeilen)")
        return

    sample_loaded = _load_active_sample()
    if sample_loaded is not None:
        raw_df, source_name = sample_loaded
        _set_shared_data(ctx, raw_df, source_name)
        meta = sample_by_filename(source_name)
        label = meta.title if meta else source_name
        st.success(
            f"Beispieldaten geladen: **{label}** (`{source_name}`, {len(raw_df)} Zeilen)"
        )
        return

    ctx.set_param(SHARED_DATA_PARAM, None)
    st.info(
        "Bitte zuerst eine Datei hochladen oder links in der Sidebar "
        "ein Beispielprofil **Laden**."
    )


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

    render_sample_data_sidebar()

    # EIN gemeinsamer Upload vor allen Modul-Bereichen.
    render_shared_data_input(ctx)

    # EINE gemeinsame, de-duplizierte Tab-Navigation für alle Analysen.
    render_analysis_tabs(ctx)
