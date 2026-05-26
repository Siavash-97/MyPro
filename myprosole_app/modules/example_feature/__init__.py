"""Beispiel-Skeleton: zeigt, wie ein zusätzliches Feature ohne Kern-Änderung eingebunden wird."""

import streamlit as st

from core.context import AppContext
from core.registry import ModuleRegistry


class ExampleFeatureModule:
    id = "example_feature"
    display_name = "Beispiel-Feature"
    order = 90

    def register_sidebar(self, ctx: AppContext) -> None:
        with st.sidebar:
            st.divider()
            enabled = st.checkbox("Beispiel-Feature anzeigen", value=False, key="example_feature_enabled")
            ctx.set_param("example_feature_enabled", enabled)

    def render(self, ctx: AppContext) -> None:
        if not ctx.param("example_feature_enabled"):
            return

        with st.expander("📌 Beispiel-Feature (Skeleton)", expanded=False):
            st.markdown(
                """
                Dieses Modul ist eine **Vorlage** für neue Features.

                - Sidebar-Einträge in `register_sidebar()`
                - Haupt-UI in `render()`
                - Optional: eigener Tab nach Analyse via `render_analysis_tab()`
                - Modul in `config.ENABLED_MODULES` eintragen
                """
            )
            st.code(
                "modules/mein_feature/__init__.py  →  class MeinFeatureModule + register(registry)",
                language="text",
            )


def register(registry: ModuleRegistry) -> None:
    registry.add(ExampleFeatureModule())
