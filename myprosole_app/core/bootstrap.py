import streamlit as st

from core.context import AppContext
from core.loader import load_modules
from core.registry import ModuleRegistry


def init_app() -> AppContext:
    st.set_page_config(page_title="MyProSole Schrittanalyse", layout="wide")
    st.title("🦶 MyProSole – Schrittanalyse (Paar-Sensoren links/rechts)")
    return AppContext()


def run_app() -> None:
    ctx = init_app()
    registry = ModuleRegistry()
    load_modules(registry)
    ctx.registry = registry

    for module in registry.sorted_modules():
        module.register_sidebar(ctx)

    for module in registry.sorted_modules():
        module.render(ctx)
